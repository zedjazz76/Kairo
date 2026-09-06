using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Collections.Generic;

namespace Kairo.Diagnostics {
    public sealed class Layer {
        public string state = "NOT_RUN", code = "NOT_RUN", detail = "Not attempted.";
        public long elapsedMs;
        public void Set(string stateValue, string codeValue, string explanation, long elapsed) {
            state = stateValue; code = codeValue; detail = explanation; elapsedMs = elapsed;
        }
    }
    public sealed class Result {
        public string mode, host, timestamp, resolvedAddress = "", classification = "FAILED";
        public int port;
        public long elapsedMs;
        public Layer dns = new Layer(), tcp = new Layer(), association = new Layer(), echo = new Layer();
        public string release = "NOT_RUN", echoStatus = "";
        public int? rejectionResult, rejectionSource, rejectionReason;
    }
    public static class EndpointProbe {
        public static string Classify(Exception error) {
            for (Exception current = error; current != null; current = current.InnerException) {
                var socket = current as SocketException;
                if (socket != null) {
                    if (socket.SocketErrorCode == SocketError.ConnectionRefused) return "CONNECTION_REFUSED";
                    if (socket.SocketErrorCode == SocketError.TimedOut) return "TIMEOUT";
                    if (socket.SocketErrorCode == SocketError.HostNotFound || socket.SocketErrorCode == SocketError.NoData) return "DNS_FAILED";
                    if (socket.SocketErrorCode == SocketError.NetworkUnreachable || socket.SocketErrorCode == SocketError.HostUnreachable) return "UNREACHABLE";
                    if (socket.SocketErrorCode == SocketError.ConnectionReset) return "CONNECTION_RESET";
                }
                if (current is TimeoutException) return "TIMEOUT";
            }
            return "NETWORK_ERROR";
        }
        static void Validate(string mode, string host, int port, int timeout, string calling, string called) {
            if ((mode != "tcp" && mode != "dicom") || String.IsNullOrWhiteSpace(host) || host.Length > 253 || host != host.Trim() ||
                Uri.CheckHostName(host) == UriHostNameType.Unknown || port < 1 || port > 65535 || timeout < 100 || timeout > 10000)
                throw new ArgumentException("DIAGNOSTIC_INPUT_REJECTED");
            if (mode == "dicom") {
                foreach (string ae in new string[] { calling, called }) {
                    if (String.IsNullOrWhiteSpace(ae) || ae.Length > 16) throw new ArgumentException("DIAGNOSTIC_AE_REJECTED");
                    foreach (char c in ae) if (c < 32 || c > 126 || c == '\\') throw new ArgumentException("DIAGNOSTIC_AE_REJECTED");
                }
            }
        }
        const string Verification = "1.2.840.10008.1.1", Implicit = "1.2.840.10008.1.2", Application = "1.2.840.10008.3.1.1.1";
        sealed class ProtocolFailure : Exception {
            public string code;
            public ProtocolFailure(string codeValue, string detail) : base(detail) { code = codeValue; }
        }
        sealed class Pdu { public byte type; public byte[] body; }
        static void Require(bool valid, string code = "MALFORMED_RESPONSE") {
            if (!valid) throw new ProtocolFailure(code, code == "RESPONSE_MISMATCH" ? "The reply does not match this Verification request/context. No success is inferred." : "The peer response did not match the expected bounded DICOM structure.");
        }
        static byte[] Join(params byte[][] parts) {
            using (var data = new MemoryStream()) { foreach (var part in parts) data.Write(part, 0, part.Length); return data.ToArray(); }
        }
        static byte[] Be32(uint value) { return new byte[] { (byte)(value >> 24), (byte)(value >> 16), (byte)(value >> 8), (byte)value }; }
        static uint U32(byte[] data, int p) { Require(p >= 0 && p + 4 <= data.Length); return ((uint)data[p] << 24) | ((uint)data[p + 1] << 16) | ((uint)data[p + 2] << 8) | data[p + 3]; }
        static int U16(byte[] data, int p) { Require(p >= 0 && p + 2 <= data.Length); return (data[p] << 8) | data[p + 1]; }
        static byte[] Slice(byte[] data, int p, int length) { Require(p >= 0 && length >= 0 && p <= data.Length - length); var copy = new byte[length]; Buffer.BlockCopy(data, p, copy, 0, length); return copy; }
        static byte[] Item(byte type, byte[] body) { return Join(new byte[] { type, 0, (byte)(body.Length >> 8), (byte)body.Length }, body); }
        static int Remaining(Stopwatch timer, int timeout) { long remaining = timeout - timer.ElapsedMilliseconds; if (remaining <= 0) throw new TimeoutException(); return (int)remaining; }
        static byte[] ReadExact(NetworkStream stream, int count, Stopwatch timer, int timeout) {
            var bytes = new byte[count]; int position = 0;
            while (position < count) {
                stream.ReadTimeout = Remaining(timer, timeout);
                int read = stream.Read(bytes, position, count - position);
                if (read == 0) throw new ProtocolFailure("INCOMPLETE_RESPONSE", "The peer closed before a complete DICOM response arrived.");
                position += read;
            }
            return bytes;
        }
        static Pdu ReadPdu(NetworkStream stream, Stopwatch timer, int timeout) {
            byte[] header = ReadExact(stream, 6, timer, timeout);
            uint length = U32(header, 2);
            if (length > 65536) throw new ProtocolFailure("RESPONSE_TOO_LARGE", "The peer PDU exceeded the diagnostic size limit.");
            var pdu = new Pdu { type = header[0], body = ReadExact(stream, (int)length, timer, timeout) };
            if (pdu.type == 7) { Require(pdu.body.Length == 4); throw new ProtocolFailure("PEER_ABORT", "The DICOM peer aborted the association (source " + pdu.body[2] + ", reason " + pdu.body[3] + ")."); }
            return pdu;
        }
        static void WritePdu(NetworkStream stream, byte type, byte[] body, Stopwatch timer, int timeout) {
            var bytes = Join(new byte[] { type, 0 }, Be32((uint)body.Length), body);
            stream.WriteTimeout = Remaining(timer, timeout); stream.Write(bytes, 0, bytes.Length);
        }
        static int Negotiate(NetworkStream stream, int timeout, string calling, string called, Result result) {
            var timer = Stopwatch.StartNew();
            var fixedPart = new byte[68]; fixedPart[1] = 1;
            Buffer.BlockCopy(Encoding.ASCII.GetBytes(called.PadRight(16)), 0, fixedPart, 4, 16);
            Buffer.BlockCopy(Encoding.ASCII.GetBytes(calling.PadRight(16)), 0, fixedPart, 20, 16);
            var context = Item(0x20, Join(new byte[] { 1, 0, 0, 0 }, Item(0x30, Encoding.ASCII.GetBytes(Verification)), Item(0x40, Encoding.ASCII.GetBytes(Implicit))));
            var user = Item(0x50, Join(Item(0x51, Be32(16384)), Item(0x52, Encoding.ASCII.GetBytes("2.25.25815942481606045106159218101014368293")), Item(0x55, Encoding.ASCII.GetBytes("KAIRO_STAGE5"))));
            WritePdu(stream, 1, Join(fixedPart, Item(0x10, Encoding.ASCII.GetBytes(Application)), context, user), timer, timeout);
            var response = ReadPdu(stream, timer, timeout);
            if (response.type == 3) {
                Require(response.body.Length == 4);
                result.rejectionResult = response.body[1]; result.rejectionSource = response.body[2]; result.rejectionReason = response.body[3];
                string reason = response.body[2] == 1 && response.body[3] == 7 ? "Called AE title not recognized." :
                    response.body[2] == 1 && response.body[3] == 3 ? "Calling AE title not recognized." : "Check AE configuration, application context and peer association policy.";
                throw new ProtocolFailure("ASSOCIATION_REJECTED", "TCP connected; the peer rejected the association. " + reason + " Result/source/reason: " + response.body[1] + "/" + response.body[2] + "/" + response.body[3] + ".");
            }
            Require(response.type == 2 && response.body.Length >= 68 && (U16(response.body, 0) & 1) == 1);
            bool app = false, accepted = false, seenContext = false, maxSeen = false; int maxPdu = 16384;
            for (int p = 68; p < response.body.Length;) {
                Require(p + 4 <= response.body.Length);
                int type = response.body[p], n = U16(response.body, p + 2); var value = Slice(response.body, p + 4, n); p += 4 + n;
                if (type == 0x10) { Require(!app && Encoding.ASCII.GetString(value) == Application); app = true; }
                if (type == 0x21) {
                    Require(value.Length >= 4 && value[0] == 1 && !seenContext); seenContext = true;
                    if (value[2] != 0) throw new ProtocolFailure("VERIFICATION_NOT_ACCEPTED", "Association response arrived, but Verification presentation context was rejected (result " + value[2] + "). C-ECHO was not sent.");
                    for (int q = 4; q < value.Length;) {
                        Require(q + 4 <= value.Length); int subType = value[q], subLength = U16(value, q + 2); var sub = Slice(value, q + 4, subLength); q += 4 + subLength;
                        if (subType == 0x40) { Require(!accepted && Encoding.ASCII.GetString(sub) == Implicit, "NEGOTIATION_MISMATCH"); accepted = true; }
                    }
                }
                if (type == 0x50) {
                    for (int q = 0; q < value.Length;) {
                        Require(q + 4 <= value.Length); int subType = value[q], subLength = U16(value, q + 2); var sub = Slice(value, q + 4, subLength); q += 4 + subLength;
                        if (subType == 0x51) { Require(sub.Length == 4 && !maxSeen); uint maximum = U32(sub, 0); Require(maximum == 0 || maximum >= 7, "NEGOTIATION_MISMATCH"); maxPdu = maximum == 0 ? 16384 : (int)Math.Min(maximum, 16384u); maxSeen = true; }
                    }
                }
            }
            Require(app && seenContext && accepted && maxSeen);
            return maxPdu;
        }
        static byte[] CommandElement(ushort tag, byte[] value) {
            return Join(new byte[] { 0, 0, (byte)tag, (byte)(tag >> 8) }, BitConverter.GetBytes((uint)value.Length), value);
        }
        static ushort Echo(NetworkStream stream, int timeout, int maxPdu) {
            var timer = Stopwatch.StartNew();
            var sop = Encoding.ASCII.GetBytes(Verification + "\0");
            var fields = Join(CommandElement(2, sop), CommandElement(0x100, BitConverter.GetBytes((ushort)0x30)), CommandElement(0x110, BitConverter.GetBytes((ushort)1)), CommandElement(0x800, BitConverter.GetBytes((ushort)0x101)));
            var request = Join(CommandElement(0, BitConverter.GetBytes((uint)fields.Length)), fields);
            for (int offset = 0; offset < request.Length;) {
                int n = Math.Min(maxPdu - 6, request.Length - offset);
                byte control = offset + n == request.Length ? (byte)3 : (byte)1;
                WritePdu(stream, 4, Join(Be32((uint)n + 2), new byte[] { 1, control }, Slice(request, offset, n)), timer, timeout); offset += n;
            }
            using (var command = new MemoryStream()) {
                bool complete = false; int pduCount = 0;
                while (!complete) {
                    Require(++pduCount <= 128, "RESPONSE_TOO_LARGE");
                    var response = ReadPdu(stream, timer, timeout); Require(response.type == 4 && response.body.Length >= 6);
                    for (int p = 0; p < response.body.Length;) {
                        uint length = U32(response.body, p); p += 4;
                        Require(length >= 2 && length <= response.body.Length - p && !complete);
                        Require(response.body[p] == 1 && (response.body[p + 1] & 1) == 1, "RESPONSE_MISMATCH");
                        Require(command.Length + length - 2 <= 65536, "RESPONSE_TOO_LARGE");
                        command.Write(response.body, p + 2, (int)length - 2); complete = (response.body[p + 1] & 2) != 0; p += (int)length;
                    }
                }
                byte[] bytes = command.ToArray(); var values = new Dictionary<ushort, byte[]>();
                for (int p = 0; p < bytes.Length;) {
                    Require(p + 8 <= bytes.Length && BitConverter.ToUInt16(bytes, p) == 0);
                    ushort tag = BitConverter.ToUInt16(bytes, p + 2); uint length = BitConverter.ToUInt32(bytes, p + 4); p += 8;
                    Require(length <= bytes.Length - p && !values.ContainsKey(tag)); values.Add(tag, Slice(bytes, p, (int)length)); p += (int)length;
                }
                Require(values.ContainsKey(0) && values[0].Length == 4 && BitConverter.ToUInt32(values[0], 0) == bytes.Length - 12);
                foreach (ushort tag in new ushort[] { 0x100, 0x120, 0x800, 0x900 }) Require(values.ContainsKey(tag) && values[tag].Length == 2);
                Require(BitConverter.ToUInt16(values[0x100], 0) == 0x8030 && BitConverter.ToUInt16(values[0x120], 0) == 1 && BitConverter.ToUInt16(values[0x800], 0) == 0x101, "RESPONSE_MISMATCH");
                if (values.ContainsKey(2)) Require(Encoding.ASCII.GetString(values[2]).TrimEnd('\0', ' ') == Verification, "RESPONSE_MISMATCH");
                return BitConverter.ToUInt16(values[0x900], 0);
            }
        }
        public static Result Run(string mode, string host, int port, int timeout, string calling, string called) {
            Validate(mode, host, port, timeout, calling, called);
            var result = new Result { mode = mode, host = host, port = port, timestamp = DateTime.UtcNow.ToString("o") };
            var total = Stopwatch.StartNew();
            TcpClient client = null;
            Layer layer = result.dns;
            var phase = Stopwatch.StartNew();
            try {
                IPAddress address;
                if (IPAddress.TryParse(host, out address)) result.dns.Set("SUCCESS", "NOT_REQUIRED", "IP literal supplied; DNS was not required.", 0);
                else {
                    var lookup = Dns.GetHostAddressesAsync(host);
                    if (!lookup.Wait(timeout)) throw new TimeoutException();
                    var addresses = lookup.Result;
                    if (addresses.Length == 0) throw new SocketException((int)SocketError.HostNotFound);
                    address = addresses[0];
                    // Select one IPv4 address when available; otherwise one IPv6. Never sweep or retry addresses.
                    foreach (var candidate in addresses) if (candidate.AddressFamily == AddressFamily.InterNetwork) { address = candidate; break; }
                    result.dns.Set("SUCCESS", "RESOLVED", "DNS resolved. Only the displayed address is tested; no address fallback.", phase.ElapsedMilliseconds);
                }
                result.resolvedAddress = address.ToString();
                layer = result.tcp; phase.Restart();
                client = new TcpClient(address.AddressFamily);
                var connect = client.BeginConnect(address, port, null, null);
                try {
                    if (!connect.AsyncWaitHandle.WaitOne(timeout)) throw new TimeoutException();
                    client.EndConnect(connect);
                } finally { connect.AsyncWaitHandle.Close(); }
                layer.Set("SUCCESS", "TCP_CONNECTED", "TCP accepted a connection. This alone does not verify DICOM or HL7 application behavior.", phase.ElapsedMilliseconds);
                result.classification = "TCP_CONNECTED";
                if (mode == "dicom") {
                    var stream = client.GetStream();
                    layer = result.association; phase.Restart();
                    int maximum = Negotiate(stream, timeout, calling, called, result);
                    layer.Set("SUCCESS", "ASSOCIATION_ACCEPTED", "Association accepted with a Verification presentation context.", phase.ElapsedMilliseconds);
                    layer = result.echo; phase.Restart();
                    ushort status = Echo(stream, timeout, maximum);
                    result.echoStatus = status.ToString("X4");
                    if (status != 0) throw new ProtocolFailure("C_ECHO_FAILED", "A correlated C-ECHO response returned status " + result.echoStatus + ". Verification did not succeed.");
                    layer.Set("SUCCESS", "C_ECHO_SUCCESS", "DICOM Verification succeeded. This does not prove C-STORE, MWL or Query/Retrieve support.", phase.ElapsedMilliseconds);
                    result.classification = "C_ECHO_SUCCESS";
                    try {
                        var releaseClock = Stopwatch.StartNew();
                        WritePdu(stream, 5, new byte[4], releaseClock, Math.Min(timeout, 1000));
                        var released = ReadPdu(stream, releaseClock, Math.Min(timeout, 1000));
                        result.release = released.type == 6 && released.body.Length == 4 ? "RELEASED" : "UNCONFIRMED";
                    } catch { result.release = "UNCONFIRMED"; }
                }
            } catch (Exception error) {
                var protocol = error as ProtocolFailure;
                string code = protocol == null ? Classify(error) : protocol.code;
                if (layer == result.dns) code = code == "TIMEOUT" ? "DNS_TIMEOUT" : "DNS_FAILED";
                string meaning = code == "CONNECTION_REFUSED" ? "The address responded but did not accept this TCP connection; a listener or network policy may be refusing it." :
                    code == "TIMEOUT" || code == "DNS_TIMEOUT" ? "No completion within the configured layer timeout. Filtering, routing or endpoint delay may be involved." :
                    code == "DNS_FAILED" ? "The hostname could not be resolved. TCP was not attempted." : "The connection failed at this layer. Check the endpoint and network path.";
                layer.Set(code == "ASSOCIATION_REJECTED" ? "REJECTED" : "FAILED", code, protocol == null ? meaning : protocol.Message, phase.ElapsedMilliseconds);
                result.classification = code;
            } finally { if (client != null) client.Close(); result.elapsedMs = total.ElapsedMilliseconds; }
            return result;
        }
    }
}
