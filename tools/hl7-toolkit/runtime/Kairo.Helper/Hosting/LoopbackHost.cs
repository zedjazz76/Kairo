#nullable enable

using System.Net;
using System.Net.Sockets;
using System.Text;
using Kairo.Helper.Security;

namespace Kairo.Helper.Hosting;

public sealed class LoopbackHost : IAsyncDisposable
{
    private const int MaximumHeaderBytes = 32_768;
    private const int MaximumBodyBytes = 16_777_216;
    private readonly TcpListener listener;
    private readonly CancellationTokenSource cancellation = new();
    private readonly Task acceptLoop;
    private readonly string appRoot;
    private readonly string dataRoot;
    private readonly string token;

    private LoopbackHost(TcpListener listener, string appRoot, string dataRoot, string token)
    {
        this.listener = listener;
        this.appRoot = appRoot;
        this.dataRoot = dataRoot;
        this.token = token;
        acceptLoop = AcceptLoopAsync();
    }

    public IPEndPoint EndPoint => (IPEndPoint)listener.LocalEndpoint;

    public static Task<LoopbackHost> StartAsync(string appRoot, string dataRoot, string token)
    {
        string canonicalApp = Path.GetFullPath(appRoot);
        if (!File.Exists(Path.Combine(canonicalApp, "index.html")))
            throw new InvalidOperationException("REQUIRED_STATIC_ASSETS_MISSING");
        string canonicalData = Path.GetFullPath(dataRoot);
        Directory.CreateDirectory(canonicalData);
        string writeProbe = Path.Combine(canonicalData, ".kairo-write-test-" + Guid.NewGuid().ToString("N"));
        try { File.WriteAllBytes(writeProbe, []); File.Delete(writeProbe); }
        catch (Exception error) { throw new InvalidOperationException("DATA_ROOT_NOT_WRITABLE", error); }

        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        return Task.FromResult(new LoopbackHost(listener, canonicalApp, canonicalData, token));
    }

    private async Task AcceptLoopAsync()
    {
        while (!cancellation.IsCancellationRequested)
        {
            TcpClient client;
            try { client = await listener.AcceptTcpClientAsync(cancellation.Token); }
            catch (OperationCanceledException) { break; }
            catch (SocketException) when (cancellation.IsCancellationRequested) { break; }
            _ = HandleClientSafelyAsync(client);
        }
    }

    private async Task HandleClientSafelyAsync(TcpClient client)
    {
        await using NetworkStream stream = client.GetStream();
        using (client)
        {
            try
            {
                if (client.Client.RemoteEndPoint is not IPEndPoint remote || !SessionSecurity.IsLoopback(remote.Address)) return;
                HttpRequestData request = await ReadRequestAsync(stream, cancellation.Token);
                int port = EndPoint.Port;
                if (!request.Headers.TryGetValue("host", out string? host) || !SessionSecurity.IsAuthorizedHost(host, port))
                {
                    await WriteAsync(stream, 403, "Forbidden", "application/json; charset=utf-8", "{\"error\":\"HOST_REJECTED\"}");
                    return;
                }

                string path = request.Target.Split('?', 2)[0];
                if (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase) || path == "/health")
                {
                    if (!Authorized(request, port))
                    {
                        await WriteAsync(stream, 403, "Forbidden", "application/json; charset=utf-8", "{\"error\":\"FORBIDDEN\"}");
                        return;
                    }
                    if (path == "/api/session" && request.Method == "GET")
                    {
                        await WriteAsync(stream, 200, "OK", "application/json; charset=utf-8", "{\"status\":\"ready\",\"version\":\"1.0.0-phase1\"}");
                        return;
                    }
                    if (path == "/health")
                    {
                        await WriteAsync(stream, 200, "OK", "application/json; charset=utf-8", "{\"status\":\"ok\",\"version\":\"1.0.0-phase1\",\"loopback\":true}");
                        return;
                    }
                    HttpResponseData response = await ApiRouter.RouteAsync(path, request, dataRoot);
                    await WriteAsync(stream, response.StatusCode, response.Reason, "application/json; charset=utf-8", response.Body);
                    return;
                }

                if (request.Method != "GET")
                {
                    await WriteAsync(stream, 405, "Method Not Allowed", "application/json; charset=utf-8", "{\"error\":\"METHOD_NOT_ALLOWED\"}", ("Allow", "GET"));
                    return;
                }
                string staticPath;
                try { staticPath = PathSecurity.ResolveStaticPath(appRoot, path); }
                catch { await WriteAsync(stream, 400, "Bad Request", "application/json; charset=utf-8", "{\"error\":\"INVALID_PATH\"}"); return; }
                if (!File.Exists(staticPath))
                {
                    await WriteAsync(stream, 404, "Not Found", "application/json; charset=utf-8", "{\"error\":\"NOT_FOUND\"}");
                    return;
                }
                await WriteAsync(stream, 200, "OK", ContentType(staticPath), await File.ReadAllBytesAsync(staticPath, cancellation.Token));
            }
            catch when (!cancellation.IsCancellationRequested)
            {
                try { await WriteAsync(stream, 400, "Bad Request", "application/json; charset=utf-8", "{\"error\":\"BAD_REQUEST\"}"); }
                catch { }
            }
        }
    }

    private bool Authorized(HttpRequestData request, int port)
    {
        request.Headers.TryGetValue("origin", out string? origin);
        if (!SessionSecurity.IsAuthorizedOrigin(origin, port)) return false;
        request.Headers.TryGetValue("x-hl7-token", out string? candidate);
        if (string.IsNullOrEmpty(candidate)) candidate = QueryValue(request.Target, "token");
        return SessionSecurity.FixedTimeTokenEquals(token, candidate);
    }

    private static string? QueryValue(string target, string name)
    {
        int question = target.IndexOf('?');
        if (question < 0) return null;
        foreach (string pair in target[(question + 1)..].Split('&'))
        {
            string[] parts = pair.Split('=', 2);
            if (Uri.UnescapeDataString(parts[0]) == name)
                return parts.Length == 2 ? Uri.UnescapeDataString(parts[1]) : "";
        }
        return null;
    }

    private static async Task<HttpRequestData> ReadRequestAsync(NetworkStream stream, CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(2));
        var bytes = new List<byte>();
        int matched = 0;
        byte[] boundary = [13, 10, 13, 10];
        while (matched < 4)
        {
            byte[] one = new byte[1];
            if (await stream.ReadAsync(one, timeout.Token) == 0) throw new InvalidDataException("HTTP_REQUEST_INCOMPLETE");
            bytes.Add(one[0]);
            if (bytes.Count > MaximumHeaderBytes) throw new InvalidDataException("HTTP_HEADERS_TOO_LARGE");
            matched = one[0] == boundary[matched] ? matched + 1 : one[0] == 13 ? 1 : 0;
        }
        string[] lines = Encoding.ASCII.GetString(bytes.ToArray()).Split("\r\n", StringSplitOptions.None);
        string[] first = lines[0].Split(' ');
        if (first.Length != 3) throw new InvalidDataException("HTTP_REQUEST_LINE_INVALID");
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (string line in lines.Skip(1).Where(value => value.Length > 0))
        {
            int separator = line.IndexOf(':');
            if (separator < 1 || !headers.TryAdd(line[..separator].Trim(), line[(separator + 1)..].Trim()))
                throw new InvalidDataException("HTTP_HEADER_INVALID");
        }
        if (headers.ContainsKey("transfer-encoding")) throw new InvalidDataException("HTTP_TRANSFER_ENCODING_REJECTED");
        int length = 0;
        if (headers.TryGetValue("content-length", out string? value) && (!int.TryParse(value, out length) || length < 0 || length > MaximumBodyBytes))
            throw new InvalidDataException("HTTP_BODY_TOO_LARGE");
        byte[] body = new byte[length];
        int offset = 0;
        timeout.CancelAfter(TimeSpan.FromSeconds(10));
        while (offset < length)
        {
            int count = await stream.ReadAsync(body.AsMemory(offset, length - offset), timeout.Token);
            if (count == 0) throw new InvalidDataException("HTTP_BODY_INCOMPLETE");
            offset += count;
        }
        return new HttpRequestData(first[0].ToUpperInvariant(), first[1], headers, Encoding.UTF8.GetString(body));
    }

    private static string ContentType(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".html" => "text/html; charset=utf-8", ".css" => "text/css; charset=utf-8",
        ".js" or ".mjs" => "text/javascript; charset=utf-8", ".json" => "application/json; charset=utf-8",
        ".svg" => "image/svg+xml", ".png" => "image/png", _ => "application/octet-stream"
    };

    private static Task WriteAsync(NetworkStream stream, int code, string reason, string contentType, string body, params (string, string)[] extra) =>
        WriteAsync(stream, code, reason, contentType, Encoding.UTF8.GetBytes(body), extra);

    private static async Task WriteAsync(NetworkStream stream, int code, string reason, string contentType, byte[] body, params (string, string)[] extra)
    {
        var headers = new List<(string, string)>
        {
            ("Cache-Control", "no-store, max-age=0"),
            ("Content-Security-Policy", "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; connect-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"),
            ("Cross-Origin-Opener-Policy", "same-origin"), ("Referrer-Policy", "no-referrer"),
            ("X-Content-Type-Options", "nosniff"), ("X-Frame-Options", "DENY"),
            ("Connection", "close"), ("Content-Length", body.Length.ToString(System.Globalization.CultureInfo.InvariantCulture)),
            ("Content-Type", contentType)
        };
        headers.AddRange(extra);
        string text = $"HTTP/1.1 {code} {reason}\r\n" + string.Join("", headers.Select(header => $"{header.Item1}: {header.Item2}\r\n")) + "\r\n";
        await stream.WriteAsync(Encoding.ASCII.GetBytes(text));
        if (body.Length > 0) await stream.WriteAsync(body);
        await stream.FlushAsync();
    }

    public async ValueTask DisposeAsync()
    {
        if (cancellation.IsCancellationRequested) return;
        cancellation.Cancel();
        listener.Stop();
        try { await acceptLoop; } catch (OperationCanceledException) { }
        cancellation.Dispose();
    }
}

public sealed record HttpRequestData(string Method, string Target, IReadOnlyDictionary<string, string> Headers, string Body);
public sealed record HttpResponseData(int StatusCode, string Reason, string Body);
