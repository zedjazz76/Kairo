using System.Net;
using Kairo.Helper.Security;
using Xunit;

namespace Kairo.Helper.Tests.Security;

public sealed class SecurityTests : IDisposable
{
    private readonly string root = Path.Combine(Path.GetTempPath(), "kairo-security-" + Guid.NewGuid().ToString("N"));

    public SecurityTests()
    {
        Directory.CreateDirectory(Path.Combine(root, "app", "definitions"));
        File.WriteAllText(Path.Combine(root, "app", "index.html"), "ok");
    }

    [Fact]
    public void TokenIsCryptographicAndComparedExactly()
    {
        string token = SessionSecurity.CreateToken();
        Assert.Equal(64, token.Length);
        Assert.True(SessionSecurity.FixedTimeTokenEquals(token, token));
        Assert.False(SessionSecurity.FixedTimeTokenEquals(token, token.ToUpperInvariant()));
        Assert.False(SessionSecurity.FixedTimeTokenEquals(token, token[..^1]));
    }

    [Theory]
    [InlineData("127.0.0.1:43123", true)]
    [InlineData("localhost:43123", true)]
    [InlineData("127.0.0.1:80", false)]
    [InlineData("example.test:43123", false)]
    public void HostMustBeExactLoopbackAndSelectedPort(string host, bool expected) =>
        Assert.Equal(expected, SessionSecurity.IsAuthorizedHost(host, 43123));

    [Fact]
    public void RemoteAndOriginMustRemainLoopback()
    {
        Assert.True(SessionSecurity.IsLoopback(IPAddress.Loopback));
        Assert.False(SessionSecurity.IsLoopback(IPAddress.Parse("192.0.2.1")));
        Assert.True(SessionSecurity.IsAuthorizedOrigin(null, 43123));
        Assert.True(SessionSecurity.IsAuthorizedOrigin("http://127.0.0.1:43123", 43123));
        Assert.True(SessionSecurity.IsAuthorizedOrigin("http://localhost:43123", 43123));
        Assert.False(SessionSecurity.IsAuthorizedOrigin("https://127.0.0.1:43123", 43123));
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/definitions/example.json")]
    public void StaticPathsStayUnderTheApplicationRoot(string requestPath)
    {
        string resolved = PathSecurity.ResolveStaticPath(Path.Combine(root, "app"), requestPath);
        Assert.StartsWith(Path.GetFullPath(Path.Combine(root, "app")) + Path.DirectorySeparatorChar, resolved, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("/../secret")]
    [InlineData("/%2e%2e/secret")]
    [InlineData("/..%5csecret")]
    [InlineData("/C:%5csecret")]
    public void StaticTraversalIsRejected(string requestPath) =>
        Assert.Throws<InvalidOperationException>(() => PathSecurity.ResolveStaticPath(Path.Combine(root, "app"), requestPath));

    public void Dispose()
    {
        Directory.Delete(root, recursive: true);
    }
}
