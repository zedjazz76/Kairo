#nullable enable

using System.Diagnostics;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Kairo.Helper.Mllp;

namespace Kairo.Helper.Hosting;

internal static class MllpRoutes
{
    private static readonly HashSet<string> UsedRequests = new(StringComparer.Ordinal);

    public static object Handle(HttpRequestData request, string path)
    {
        if (request.Method != "POST") throw Bad("SEND_METHOD_REJECTED");
        JsonElement payload;
        try { payload = JsonSerializer.Deserialize<JsonElement>(request.Body); if (payload.ValueKind != JsonValueKind.Object) throw new JsonException(); }
        catch { throw Bad("SEND_REQUEST_FAILED"); }
        JsonElement profileElement = payload.GetProperty("profile"); Profile profile = ParseProfile(profileElement);
        if (path == "/api/mllp/check") return Check(profile).GetAwaiter().GetResult();
        if (!payload.TryGetProperty("reviewed", out JsonElement reviewed) || reviewed.ValueKind != JsonValueKind.True) throw Bad("SEND_REVIEW_REQUIRED");
        if (!payload.TryGetProperty("message", out JsonElement messageElement) || messageElement.ValueKind != JsonValueKind.String) throw Bad("SEND_ONE_MESSAGE_REQUIRED");
        string message = messageElement.GetString()!;
        string mode = payload.TryGetProperty("contentMode", out JsonElement modeElement) ? modeElement.GetString() ?? "" : "";
        if (mode is not ("original" or "sanitized")) throw Bad("SEND_MODE_REQUIRED");
        if (mode == "original" && profile.Environment == "Production" && (!payload.TryGetProperty("productionConfirmed", out JsonElement confirmed) || confirmed.ValueKind != JsonValueKind.True)) throw Bad("SEND_PRODUCTION_CONFIRMATION_REQUIRED");
        string hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(message))).ToLowerInvariant();
        if (!payload.TryGetProperty("messageHash", out JsonElement hashElement) || hashElement.GetString() != hash) throw Bad("SEND_REVIEW_EXPIRED");
        string requestId = payload.TryGetProperty("requestId", out JsonElement requestElement) ? requestElement.GetString() ?? "" : "";
        if (!Guid.TryParseExact(requestId, "D", out _)) throw Bad("SEND_REQUEST_ID_REQUIRED");
        lock (UsedRequests) { if (UsedRequests.Count >= 100_000) throw Bad("SEND_SESSION_LIMIT"); if (!UsedRequests.Add(requestId)) throw Bad("SEND_REQUEST_ALREADY_USED"); }
        return Send(profile, message).GetAwaiter().GetResult();
    }

    private static async Task<object> Check(Profile profile)
    {
        var timer = Stopwatch.StartNew();
        try { using TcpClient client = await MllpProtocol.ConnectAsync(profile.Host, profile.Port, profile.ConnectTimeoutMs); return new { status = "reachable", latencyMs = timer.ElapsedMilliseconds, bytesSent = 0 }; }
        catch { return new { status = "connect-failed", latencyMs = timer.ElapsedMilliseconds, bytesSent = 0 }; }
    }

    private static async Task<object> Send(Profile profile, string message)
    {
        var timer = Stopwatch.StartNew(); int bytesSent = 0; bool attempted = false;
        try
        {
            using TcpClient client = await MllpProtocol.ConnectAsync(profile.Host, profile.Port, profile.ConnectTimeoutMs); long connectMs = timer.ElapsedMilliseconds;
            Encoding encoding = Encoding.GetEncoding(profile.Encoding, EncoderFallback.ExceptionFallback, DecoderFallback.ExceptionFallback);
            byte[] frame = MllpProtocol.Frame(message, profile.Encoding, profile.StartByte, profile.EndBytes); NetworkStream stream = client.GetStream(); attempted = true;
            await stream.WriteAsync(frame); await stream.FlushAsync(); bytesSent = frame.Length; long responseStart = timer.ElapsedMilliseconds;
            string response = await MllpProtocol.ReadFrameAsync(stream, profile.ResponseTimeoutMs, encoding, profile.StartByte, profile.EndBytes);
            return new { status = "response", bytesSent, latencyMs = timer.ElapsedMilliseconds, connectMs, responseMs = timer.ElapsedMilliseconds - responseStart, writeAttempted = true, deliveryUncertain = false, response };
        }
        catch (TimeoutException) { return new { status = "timeout", bytesSent, latencyMs = timer.ElapsedMilliseconds, connectMs = 0L, responseMs = 0L, writeAttempted = attempted, deliveryUncertain = attempted, response = "" }; }
        catch { return new { status = attempted ? "unknown-delivery" : "connect-failed", bytesSent, latencyMs = timer.ElapsedMilliseconds, connectMs = 0L, responseMs = 0L, writeAttempted = attempted, deliveryUncertain = attempted, response = "" }; }
    }

    private static Profile ParseProfile(JsonElement value)
    {
        string Get(string name) => value.TryGetProperty(name, out JsonElement property) && property.ValueKind == JsonValueKind.String ? property.GetString()! : throw Bad("PROFILE_TEXT_REJECTED");
        int Number(string name, int min, int max) { if (!value.TryGetProperty(name, out JsonElement property) || !property.TryGetInt32(out int number) || number < min || number > max) throw Bad("PROFILE_NUMBER_REJECTED"); return number; }
        if (Get("schema") != "hl7-toolkit.endpoint-profile.v1") throw Bad("PROFILE_SCHEMA_REJECTED");
        return new Profile(Get("host"), Number("port", 1, 65535), Number("connectTimeoutMs", 100, 120000), Number("responseTimeoutMs", 100, 120000), Get("encoding"), (byte)Number("startByte", 0, 255), value.GetProperty("endBytes").EnumerateArray().Select(item => item.GetByte()).ToArray(), Get("environment"));
    }

    private static ApiException Bad(string code) => new(code, 400, "Bad Request");
    private sealed record Profile(string Host, int Port, int ConnectTimeoutMs, int ResponseTimeoutMs, string Encoding, byte StartByte, byte[] EndBytes, string Environment);
}
