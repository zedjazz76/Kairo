#nullable enable

using System.Diagnostics;
using Kairo.Helper.Hosting;
using Kairo.Helper.Security;

namespace Kairo.Helper;

public static class Bootstrap
{
    public static async Task RunAsync(bool noBrowser = false)
    {
        string root = AppContext.BaseDirectory;
        string appRoot = Path.Combine(root, "app");
        string dataRoot = Path.Combine(root, "data", "runtime");
        string token = SessionSecurity.CreateToken();
        using var shutdown = new CancellationTokenSource();
        ConsoleCancelEventHandler cancel = (_, eventArgs) => { eventArgs.Cancel = true; shutdown.Cancel(); };
        Console.CancelKeyPress += cancel;
        try
        {
            await using LoopbackHost host = await LoopbackHost.StartAsync(appRoot, dataRoot, token);
            string baseAddress = $"http://127.0.0.1:{host.EndPoint.Port}/";
            Console.WriteLine(RuntimeIdentity.DisplayName);
            Console.WriteLine("Kairo is running locally at " + baseAddress);
            Console.WriteLine("Close this window to stop the local helper.");
            if (!noBrowser) Process.Start(new ProcessStartInfo(baseAddress + "?token=" + token) { UseShellExecute = true });
            try { await Task.Delay(Timeout.InfiniteTimeSpan, shutdown.Token); } catch (OperationCanceledException) { }
        }
        finally { Console.CancelKeyPress -= cancel; }
    }
}
