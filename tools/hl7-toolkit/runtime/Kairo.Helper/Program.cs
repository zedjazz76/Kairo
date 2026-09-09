#nullable enable

namespace Kairo.Helper;

internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        try
        {
            await Bootstrap.RunAsync(args.Contains("--no-browser", StringComparer.Ordinal));
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine($"Kairo could not start: {SafeError(error)}");
            return 1;
        }
    }

    private static string SafeError(Exception error) => error.Message switch
    {
        "REQUIRED_STATIC_ASSETS_MISSING" => "Required application files are missing.",
        "DATA_ROOT_NOT_WRITABLE" => "The runtime data folder is not writable. Extract Kairo to a user-writable folder.",
        _ => "The local workstation helper could not be started."
    };
}
