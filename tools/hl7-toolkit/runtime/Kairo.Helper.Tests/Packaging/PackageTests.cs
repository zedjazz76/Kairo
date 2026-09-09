using Xunit;

namespace Kairo.Helper.Tests.Packaging;

public sealed class PackageTests
{
    [Fact]
    public void PublishedFolderHasApprovedWorkstationShape()
    {
        string root = Environment.GetEnvironmentVariable("KAIRO_PACKAGE_PATH") ?? throw new InvalidOperationException("KAIRO_PACKAGE_PATH is required");
        Assert.True(File.Exists(Path.Combine(root, "Kairo.Helper.exe")));
        Assert.True(File.Exists(Path.Combine(root, "app", "index.html")));
        Assert.True(File.Exists(Path.Combine(root, "VERSION.txt")));
        Assert.True(File.Exists(Path.Combine(root, "RELEASE-MANIFEST.json")));
        Assert.DoesNotContain(Directory.GetFiles(root, "*", SearchOption.AllDirectories), path => new[] { ".ps1", ".psm1", ".cmd", ".cs", ".pdb" }.Contains(Path.GetExtension(path), StringComparer.OrdinalIgnoreCase));
        Assert.DoesNotContain("0.7.4", File.ReadAllText(Path.Combine(root, "VERSION.txt")), StringComparison.Ordinal);
        Assert.Contains("Workstation Runtime Build: 1", File.ReadAllText(Path.Combine(root, "VERSION.txt")), StringComparison.Ordinal);
    }
}
