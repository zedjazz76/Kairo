#nullable enable

using System.Diagnostics;
using System.Net.Sockets;
using System.Text;

namespace Kairo.Helper.Mllp;

public static class MllpProtocol
{
    static MllpProtocol() => Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

    public static byte[] Frame(string message, string encodingName, byte startByte, byte[] endBytes)
    {
        if (message.Length is < 8 or > 8_388_608) throw new InvalidOperationException("SEND_ONE_MESSAGE_REQUIRED");
        string wire = message.Replace("\r\n", "\r", StringComparison.Ordinal).Replace('\n', '\r');
        if (!wire.StartsWith("MSH", StringComparison.Ordinal) || char.IsLetterOrDigit(wire[3]) || char.IsWhiteSpace(wire[3]) || wire.CountSequence("MSH", '\r') != 1 || wire.IndexOfAny(['\0', '\v', '\u001c']) >= 0) throw new InvalidOperationException("SEND_ONE_MESSAGE_REQUIRED");
        Encoding encoding = Encoding.GetEncoding(encodingName, EncoderFallback.ExceptionFallback, DecoderFallback.ExceptionFallback);
        byte[] payload;
        try { payload = encoding.GetBytes(wire); } catch (EncoderFallbackException error) { throw new InvalidOperationException("SEND_ENCODING_UNSUPPORTED_CHARACTER", error); }
        if (payload.Contains(startByte) || Contains(payload, endBytes)) throw new InvalidOperationException("SEND_EMBEDDED_FRAMING");
        byte[] frame = new byte[1 + payload.Length + endBytes.Length]; frame[0] = startByte; payload.CopyTo(frame, 1); endBytes.CopyTo(frame, 1 + payload.Length); return frame;
    }

    public static async Task<string> ReadFrameAsync(NetworkStream stream, int timeoutMs, Encoding encoding, byte startByte, byte[] endBytes)
    {
        using var timeout = new CancellationTokenSource(timeoutMs); var bytes = new List<byte>();
        byte[] one = new byte[1]; if (await stream.ReadAsync(one, timeout.Token) == 0 || one[0] != startByte) throw new InvalidOperationException("RESPONSE_MALFORMED");
        while (bytes.Count <= 1_048_576)
        {
            if (await stream.ReadAsync(one, timeout.Token) == 0) throw new InvalidOperationException("RESPONSE_INCOMPLETE"); bytes.Add(one[0]);
            if (bytes.Count >= endBytes.Length && bytes.TakeLast(endBytes.Length).SequenceEqual(endBytes)) return encoding.GetString(bytes.Take(bytes.Count - endBytes.Length).ToArray());
        }
        throw new InvalidOperationException("RESPONSE_MALFORMED");
    }

    public static async Task<TcpClient> ConnectAsync(string host, int port, int timeoutMs)
    {
        var client = new TcpClient();
        try { await client.ConnectAsync(host, port).WaitAsync(TimeSpan.FromMilliseconds(timeoutMs)); return client; }
        catch { client.Dispose(); throw; }
    }

    private static bool Contains(byte[] source, byte[] value) => value.Length > 0 && source.AsSpan().IndexOf(value) >= 0;
    private static int CountSequence(this string value, string sequence, char boundary) => value.Split(boundary).Count(part => part.StartsWith(sequence, StringComparison.Ordinal));
}
