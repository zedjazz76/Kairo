#nullable enable

using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace Kairo.Helper.Security;

public static class SessionSecurity
{
    public static string CreateToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();

    public static bool FixedTimeTokenEquals(string? expected, string? supplied)
    {
        if (expected is null || supplied is null) return false;
        byte[] left = Encoding.UTF8.GetBytes(expected);
        byte[] right = Encoding.UTF8.GetBytes(supplied);
        return left.Length == right.Length && CryptographicOperations.FixedTimeEquals(left, right);
    }

    public static bool IsLoopback(IPAddress? address) => address is not null && address.Equals(IPAddress.Loopback);

    public static bool IsAuthorizedHost(string? host, int port) =>
        string.Equals(host, $"127.0.0.1:{port}", StringComparison.Ordinal)
        || string.Equals(host, $"localhost:{port}", StringComparison.Ordinal);

    public static bool IsAuthorizedOrigin(string? origin, int port)
    {
        if (string.IsNullOrEmpty(origin)) return true;
        return Uri.TryCreate(origin, UriKind.Absolute, out Uri? uri)
            && uri.Scheme == Uri.UriSchemeHttp
            && (uri.Host == "127.0.0.1" || uri.Host == "localhost")
            && uri.Port == port
            && uri.AbsolutePath == "/"
            && string.IsNullOrEmpty(uri.Query)
            && string.IsNullOrEmpty(uri.Fragment);
    }
}
