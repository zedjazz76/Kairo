using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Kairo.Helper.Hosting;
using Xunit;

namespace Kairo.Helper.Tests.Hosting;

public sealed class ApiRouteTests : IAsyncDisposable
{
    private readonly string root = Path.Combine(Path.GetTempPath(), "kairo-api-" + Guid.NewGuid().ToString("N"));
    private readonly LoopbackHost host;
    private readonly HttpClient client;

    public ApiRouteTests()
    {
        Directory.CreateDirectory(Path.Combine(root, "app"));
        File.WriteAllText(Path.Combine(root, "app", "index.html"), "ok");
        host = LoopbackHost.StartAsync(Path.Combine(root, "app"), Path.Combine(root, "data", "runtime"), new string('c', 64)).GetAwaiter().GetResult();
        client = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{host.EndPoint.Port}") };
        client.DefaultRequestHeaders.Add("X-HL7-Token", new string('c', 64));
    }

    [Theory]
    [InlineData("/api/diagnostics/run", "{}", "DIAGNOSTIC_INPUT_REJECTED")]
    [InlineData("/api/dicom/mwl/find", "{}", "MWL_SCHEMA_REJECTED")]
    [InlineData("/api/dicom/studies/find", "{}", "STUDY_SCHEMA_REJECTED")]
    public async Task InvalidProtocolPayloadsReturnBoundedContractErrors(string path, string json, string code)
    {
        using HttpResponseMessage response = await client.PostAsync(path, new StringContent(json, System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal($"{{\"error\":\"{code}\"}}", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task EndpointProfileRoundTripsThroughApprovedDataRoot()
    {
        var profile = new
        {
            schema = "hl7-toolkit.endpoint-profile.v1", id = "lab-test", label = "Lab Test", environment = "Test",
            type = "mllp", host = "127.0.0.1", port = 2575, callingAe = "", calledAe = "",
            connectTimeoutMs = 1000, responseTimeoutMs = 2000, encoding = "utf-8", startByte = 11,
            endBytes = new[] { 28, 13 }, notes = "Synthetic endpoint"
        };
        string directJson = JsonSerializer.Serialize(new { profile });
        using HttpResponseMessage saved = await client.PostAsync("/api/profiles/endpoint", new StringContent(directJson, System.Text.Encoding.UTF8, "application/json"));
        Assert.True(saved.StatusCode == HttpStatusCode.OK, await saved.Content.ReadAsStringAsync());
        using HttpResponseMessage listed = await client.GetAsync("/api/profiles/endpoint");
        Assert.Equal(HttpStatusCode.OK, listed.StatusCode);
        using JsonDocument body = JsonDocument.Parse(await listed.Content.ReadAsStringAsync());
        Assert.Equal("lab-test", body.RootElement.GetProperty("profiles")[0].GetProperty("id").GetString());
        Assert.True(File.Exists(Path.Combine(root, "data", "runtime", "profiles", "lab-test.json")));
    }

    [Fact]
    public async Task BaselineAndSanitizedHistoryPersistOnlyThroughApprovedRoutes()
    {
        var baseline = new { schema = "kairo.diagnostic-baseline.v1", profileId = "lab-test", type = "tcp", endpoint = new { label = "Lab", host = "127.0.0.1" }, savedAt = "2026-09-09T12:00:00Z", classification = "REACHABLE", totalMs = 4, layers = new { tcp = new { code = "CONNECTED", elapsedMs = 4 } } };
        string saveBaseline = JsonSerializer.Serialize(new { action = "save", baseline });
        using HttpResponseMessage saved = await client.PostAsync("/api/diagnostics/baseline", new StringContent(saveBaseline, System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        using HttpResponseMessage loaded = await client.PostAsync("/api/diagnostics/baseline", new StringContent("{\"action\":\"get\",\"profileId\":\"lab-test\"}", System.Text.Encoding.UTF8, "application/json"));
        Assert.Contains("\"classification\":\"REACHABLE\"", await loaded.Content.ReadAsStringAsync());

        var historyEvent = new { schema = "hl7-toolkit.sanitized-event.v1", type = "message-save", sanitizedText = "MSH|^~\\&|SYNTHETIC", policyVersion = "v1", mode = "synthetic-test" };
        string append = JsonSerializer.Serialize(new { sessionId = "session-one", @event = historyEvent });
        using HttpResponseMessage appended = await client.PostAsync("/api/history/events", new StringContent(append, System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.OK, appended.StatusCode);
        using HttpResponseMessage history = await client.GetAsync("/api/history?sessionId=session-one");
        Assert.Contains("MSH|^~", await history.Content.ReadAsStringAsync());
    }

    public async ValueTask DisposeAsync()
    {
        client.Dispose();
        await host.DisposeAsync();
        Directory.Delete(root, true);
    }
}
