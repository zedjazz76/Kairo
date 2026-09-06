using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Authentication;
using System.Security.Cryptography.X509Certificates;
using System.Text;

namespace Kairo.Diagnostics {
    public sealed class HttpResult {
        public string mode = "http", target, scheme, host, timestamp, resolvedAddress = "", classification = "FAILED";
        public int port, httpStatus;
        public long elapsedMs;
        public Layer dns = new Layer(), tcp = new Layer(), tls = new Layer(), http = new Layer();
        public string redirectLocation = "", tlsVersion = "", tlsTargetHost = "", httpHost = "", hostnameValidation = "NOT_AVAILABLE", chainValidation = "NOT_AVAILABLE", tlsPolicyErrors = "NOT_AVAILABLE", chainStatus = "NOT_AVAILABLE", exceptionType = "", innerExceptionType = "", certificateSubject = "", certificateIssuer = "", certificateValidFrom = "", certificateValidTo = "";
        public bool redirectFollowed = false, certificateReceived = false;
        public int? certificateDaysUntilExpiration;
        public Dictionary<string, string> headers = new Dictionary<string, string>();
    }

    public static class HttpTlsProbe {
        static readonly HashSet<string> SafeHeaders = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
            "cache-control", "content-length", "content-type", "date", "location", "server", "strict-transport-security"
        };
        static Uri Validate(string target, int timeout) {
            if (String.IsNullOrWhiteSpace(target) || target != target.Trim() || target.Length > 2048 || timeout < 100 || timeout > 10000) throw new ArgumentException("DIAGNOSTIC_INPUT_REJECTED");
            string entered = target.IndexOf("://", StringComparison.Ordinal) < 0 ? "https://" + target : target;
            Uri uri;
            if (!Uri.TryCreate(entered, UriKind.Absolute, out uri) || (uri.Scheme != "http" && uri.Scheme != "https") || String.IsNullOrWhiteSpace(uri.Host) || uri.Host.IndexOf('*') >= 0 || !String.IsNullOrEmpty(uri.UserInfo) || !String.IsNullOrEmpty(uri.Fragment) || uri.Port < 1 || uri.Port > 65535 || Uri.CheckHostName(uri.Host) == UriHostNameType.Unknown) throw new ArgumentException("DIAGNOSTIC_INPUT_REJECTED");
            return uri;
        }
        static int Remaining(Stopwatch timer, int timeout) { long left = timeout - timer.ElapsedMilliseconds; if (left <= 0) throw new TimeoutException(); return (int)left; }
        static byte[] ReadHeaders(Stream stream, int timeout) {
            var timer = Stopwatch.StartNew();
            using (var bytes = new MemoryStream()) {
                int matched = 0;
                while (bytes.Length < 32768) {
                    stream.ReadTimeout = Remaining(timer, timeout); int value = stream.ReadByte();
                    if (value < 0) throw new IOException("INCOMPLETE_HTTP_HEADERS");
                    bytes.WriteByte((byte)value); byte expected = matched == 0 || matched == 2 ? (byte)13 : (byte)10;
                    if (value == expected) matched += 1; else matched = value == 13 ? 1 : 0;
                    if (matched == 4) return bytes.ToArray();
                }
            }
            throw new IOException("HTTP_HEADERS_TOO_LARGE");
        }
        static void ParseHeaders(byte[] bytes, HttpResult result) {
            string[] lines = Encoding.GetEncoding(28591).GetString(bytes).Split(new string[] { "\r\n" }, StringSplitOptions.None);
            string[] status = lines[0].Split(new char[] { ' ' }, 3); int code;
            if (status.Length < 2 || !status[0].StartsWith("HTTP/", StringComparison.Ordinal) || !Int32.TryParse(status[1], NumberStyles.None, CultureInfo.InvariantCulture, out code) || code < 100 || code > 599) throw new IOException("MALFORMED_HTTP_RESPONSE");
            result.httpStatus = code;
            for (int index = 1; index < lines.Length && lines[index].Length > 0; index += 1) {
                int colon = lines[index].IndexOf(':'); if (colon <= 0) throw new IOException("MALFORMED_HTTP_RESPONSE");
                string name = lines[index].Substring(0, colon).Trim().ToLowerInvariant(); string value = lines[index].Substring(colon + 1).Trim();
                if (SafeHeaders.Contains(name) && !result.headers.ContainsKey(name)) result.headers.Add(name, value);
            }
            string location; if (result.headers.TryGetValue("location", out location) && code >= 300 && code <= 399) result.redirectLocation = location;
        }
        static void FillCertificate(HttpResult result, X509Certificate2 parsed) {
            if (parsed == null) return;
            result.certificateSubject = parsed.Subject; result.certificateIssuer = parsed.Issuer;
            result.certificateValidFrom = parsed.NotBefore.ToUniversalTime().ToString("o"); result.certificateValidTo = parsed.NotAfter.ToUniversalTime().ToString("o");
            result.certificateDaysUntilExpiration = (int)Math.Floor((parsed.NotAfter.ToUniversalTime() - DateTime.UtcNow).TotalDays);
        }
        static bool HasStatus(X509ChainStatusFlags combined, X509ChainStatusFlags wanted) { return (combined & wanted) != 0; }
        static string ClassifyCertificate(HttpResult result, X509ChainStatusFlags statuses, X509Certificate2 certificate) {
            if (result.hostnameValidation == "MISMATCH") return "TLS_CERTIFICATE_HOSTNAME_MISMATCH";
            if (HasStatus(statuses, X509ChainStatusFlags.Revoked)) return "TLS_CERTIFICATE_REVOKED";
            DateTime now = DateTime.UtcNow;
            if (HasStatus(statuses, X509ChainStatusFlags.NotTimeValid) || (certificate != null && (now < certificate.NotBefore.ToUniversalTime() || now > certificate.NotAfter.ToUniversalTime()))) return "TLS_CERTIFICATE_EXPIRED";
            if (HasStatus(statuses, X509ChainStatusFlags.UntrustedRoot)) return "TLS_CERTIFICATE_UNTRUSTED";
            if (HasStatus(statuses, X509ChainStatusFlags.PartialChain)) return "TLS_CERTIFICATE_CHAIN_ERROR";
            if (result.tlsPolicyErrors.IndexOf("RemoteCertificateChainErrors", StringComparison.Ordinal) >= 0) return "TLS_CERTIFICATE_CHAIN_ERROR";
            return "";
        }
        public static HttpResult Run(string target, int timeout) {
            Uri uri = Validate(target, timeout);
            var result = new HttpResult { target = target, scheme = uri.Scheme, host = uri.Host, port = uri.Port, tlsTargetHost = uri.DnsSafeHost, httpHost = uri.Authority, timestamp = DateTime.UtcNow.ToString("o") };
            var total = Stopwatch.StartNew(); var phase = Stopwatch.StartNew(); Layer layer = result.dns; TcpClient client = null;
            try {
                IPAddress address;
                if (IPAddress.TryParse(uri.Host, out address)) result.dns.Set("SUCCESS", "NOT_REQUIRED", "IP literal supplied; DNS was not required.", 0);
                else {
                    var lookup = Dns.GetHostAddressesAsync(uri.DnsSafeHost); if (!lookup.Wait(timeout)) throw new TimeoutException(); var addresses = lookup.Result;
                    if (addresses.Length == 0) throw new SocketException((int)SocketError.HostNotFound); address = addresses[0];
                    foreach (var candidate in addresses) if (candidate.AddressFamily == AddressFamily.InterNetwork) { address = candidate; break; }
                    result.dns.Set("SUCCESS", "RESOLVED", "DNS resolved. Only the displayed address is tested; no address fallback.", phase.ElapsedMilliseconds);
                }
                result.resolvedAddress = address.ToString(); layer = result.tcp; phase.Restart(); client = new TcpClient(address.AddressFamily);
                var connect = client.BeginConnect(address, uri.Port, null, null);
                try { if (!connect.AsyncWaitHandle.WaitOne(timeout)) throw new TimeoutException(); client.EndConnect(connect); } finally { connect.AsyncWaitHandle.Close(); }
                layer.Set("SUCCESS", "TCP_CONNECTED", "TCP accepted one connection to the displayed address.", phase.ElapsedMilliseconds);
                Stream stream = client.GetStream();
                if (uri.Scheme == "https") {
                    stream.ReadTimeout = timeout; stream.WriteTimeout = timeout;
                    layer = result.tls; phase.Restart(); X509Certificate2 captured = null; X509ChainStatusFlags combinedStatus = X509ChainStatusFlags.NoError;
                    var ssl = new SslStream(stream, false, delegate(object sender, X509Certificate certificate, X509Chain chain, SslPolicyErrors errors) {
                        result.certificateReceived = certificate != null; result.tlsPolicyErrors = errors.ToString();
                        if (certificate != null) { try { captured = new X509Certificate2(certificate.Export(X509ContentType.Cert)); FillCertificate(result, captured); } catch { } }
                        var statuses = new List<string>();
                        if (chain != null) foreach (var status in chain.ChainStatus) { combinedStatus |= status.Status; statuses.Add(status.Status.ToString()); }
                        result.chainStatus = statuses.Count == 0 ? "NoError" : String.Join(",", statuses.ToArray());
                        result.hostnameValidation = certificate == null ? "NOT_AVAILABLE" : (errors & SslPolicyErrors.RemoteCertificateNameMismatch) != 0 ? "MISMATCH" : "VALID";
                        result.chainValidation = certificate == null ? "NOT_AVAILABLE" : (errors & SslPolicyErrors.RemoteCertificateChainErrors) != 0 ? "FAILED" : "VALID";
                        return errors == SslPolicyErrors.None;
                    });
                    try { ssl.AuthenticateAsClient(uri.DnsSafeHost, new X509CertificateCollection(), SslProtocols.Tls12, false); }
                    catch (Exception tlsError) {
                        result.exceptionType = tlsError.GetType().FullName; result.innerExceptionType = tlsError.InnerException == null ? "" : tlsError.InnerException.GetType().FullName;
                        try { if (ssl.SslProtocol != SslProtocols.None) result.tlsVersion = ssl.SslProtocol.ToString(); } catch { }
                        string code = ClassifyCertificate(result, combinedStatus, captured), detail;
                        if (code == "TLS_CERTIFICATE_HOSTNAME_MISMATCH") detail = "The received certificate does not match the original URI hostname.";
                        else if (code == "TLS_CERTIFICATE_EXPIRED") detail = "The received certificate is outside its validity period.";
                        else if (code == "TLS_CERTIFICATE_REVOKED") detail = "The received certificate was reported revoked.";
                        else if (code == "TLS_CERTIFICATE_UNTRUSTED") detail = "The received certificate root is not trusted by Windows.";
                        else if (code == "TLS_CERTIFICATE_CHAIN_ERROR") detail = "Windows could not build a valid certificate chain.";
                        else if (!result.certificateReceived) {
                            code = EndpointProbe.Classify(tlsError) == "TIMEOUT" ? "TLS_TIMEOUT" : "TLS_HANDSHAKE_FAILED";
                            detail = code == "TLS_TIMEOUT" ? "TLS did not complete within the configured timeout." : "TLS negotiation failed before a certificate was received.";
                        } else { code = "TLS_HANDSHAKE_FAILED"; detail = "TLS negotiation failed after certificate validation produced no more specific error."; }
                        result.tls.Set("FAILED", code, detail, phase.ElapsedMilliseconds); result.classification = code; return result;
                    }
                    result.hostnameValidation = "VALID"; result.chainValidation = "VALID"; result.tlsVersion = ssl.SslProtocol.ToString();
                    layer.Set("SUCCESS", "TLS_CONNECTED", "TLS negotiation and certificate validation succeeded.", phase.ElapsedMilliseconds); stream = ssl;
                } else result.tls.Set("SUCCESS", "NOT_REQUIRED", "Plain HTTP selected; TLS was not requested.", 0);
                layer = result.http; phase.Restart(); string path = String.IsNullOrEmpty(uri.PathAndQuery) ? "/" : uri.PathAndQuery;
                byte[] request = Encoding.ASCII.GetBytes("GET " + path + " HTTP/1.1\r\nHost: " + result.httpHost + "\r\nUser-Agent: Kairo-Endpoint-Diagnostic/1.0\r\nAccept: */*\r\nConnection: close\r\n\r\n");
                stream.WriteTimeout = timeout; stream.Write(request, 0, request.Length); stream.Flush(); ParseHeaders(ReadHeaders(stream, timeout), result);
                layer.Set("SUCCESS", "HTTP_RESPONSE", "Received response headers. The response body was not read or retained; redirects were not followed.", phase.ElapsedMilliseconds); result.classification = "HTTP_RESPONSE";
            } catch (Exception error) {
                string code = EndpointProbe.Classify(error);
                if (layer == result.dns) code = code == "TIMEOUT" ? "DNS_TIMEOUT" : "DNS_FAILED"; else if (layer == result.tls) code = code == "TIMEOUT" ? "TLS_TIMEOUT" : "TLS_HANDSHAKE_FAILED"; else if (layer == result.http) code = code == "TIMEOUT" ? "HTTP_TIMEOUT" : "HTTP_FAILURE";
                string detail = code == "CONNECTION_REFUSED" ? "The address responded but refused this TCP connection." : code == "DNS_FAILED" ? "The hostname could not be resolved. TCP was not attempted." : code == "DNS_TIMEOUT" || code == "TIMEOUT" || code == "HTTP_TIMEOUT" ? "The layer did not complete within the configured timeout." : "The diagnostic failed at this layer.";
                layer.Set("FAILED", code, detail, phase.ElapsedMilliseconds); result.classification = code;
            } finally { if (client != null) client.Close(); result.elapsedMs = total.ElapsedMilliseconds; }
            return result;
        }
    }
}
