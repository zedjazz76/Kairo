using System.Net;
using Kairo.Helper.Hosting;
using Xunit;

namespace Kairo.Helper.Tests.Hosting;

public sealed class LoopbackHostTests : IDisposable
{
    private readonly string root = Path.Combine(Path.GetTempPath(), "kairo-host-" + Guid.NewGuid().ToString("N"));

    public LoopbackHostTests()
    {
        Directory.CreateDirectory(Path.Combine(root, "app", "definitions"));
        Directory.CreateDirectory(Path.Combine(root, "data", "runtime"));
        File.WriteAllText(Path.Combine(root, "app", "index.html"), "<h1>Kairo test</h1>");
        File.WriteAllText(Path.Combine(root, "app", "definitions", "sample.json"), "{}");
    }

    [Fact]
    public async Task ServesStaticAssetsAndRequiresAuthenticationForApi()
    {
        await using LoopbackHost host = await LoopbackHost.StartAsync(
            Path.Combine(root, "app"), Path.Combine(root, "data", "runtime"), new string('a', 64));
        Assert.Equal(IPAddress.Loopback, host.EndPoint.Address);
        Assert.NotEqual(0, host.EndPoint.Port);

        using var client = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{host.EndPoint.Port}") };
        string page = await client.GetStringAsync("/");
        Assert.Equal("<h1>Kairo test</h1>", page);

        using HttpResponseMessage denied = await client.GetAsync("/api/session");
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        Assert.Equal("{\"error\":\"FORBIDDEN\"}", await denied.Content.ReadAsStringAsync());

        client.DefaultRequestHeaders.Add("X-HL7-Token", new string('a', 64));
        using HttpResponseMessage accepted = await client.GetAsync("/api/session");
        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
        Assert.Equal("{\"status\":\"ready\",\"version\":\"1.0.0-phase1\"}", await accepted.Content.ReadAsStringAsync());
        Assert.Equal("no-store, max-age=0", accepted.Headers.CacheControl!.ToString());
        Assert.Equal("nosniff", accepted.Headers.GetValues("X-Content-Type-Options").Single());
    }

    [Fact]
    public async Task RejectsWrongHostAndStopsAfterDisposal()
    {
        var host = await LoopbackHost.StartAsync(Path.Combine(root, "app"), Path.Combine(root, "data", "runtime"), new string('b', 64));
        int port = host.EndPoint.Port;
        using var client = new HttpClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, $"http://127.0.0.1:{port}/api/session");
        request.Headers.Host = $"example.test:{port}";
        request.Headers.Add("X-HL7-Token", new string('b', 64));
        using HttpResponseMessage response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await host.DisposeAsync();
        await Assert.ThrowsAnyAsync<HttpRequestException>(() => client.GetAsync($"http://127.0.0.1:{port}/"));
    }

    public void Dispose() => Directory.Delete(root, true);
}
