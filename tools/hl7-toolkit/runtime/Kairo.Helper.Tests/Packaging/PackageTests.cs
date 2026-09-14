using Xunit;
using System.Text;

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
        Assert.Contains("Feature Version: 0.7.3", File.ReadAllText(Path.Combine(root, "VERSION.txt")), StringComparison.Ordinal);
        Assert.Contains("Workstation Runtime Build: 5", File.ReadAllText(Path.Combine(root, "VERSION.txt")), StringComparison.Ordinal);
        string html = File.ReadAllText(Path.Combine(root, "app", "index.html"));
        Assert.Contains("Image Sanitize", html, StringComparison.Ordinal);
        Assert.True(File.Exists(Path.Combine(root, "app", "scripts", "image-sanitize-ui.mjs")));
        Assert.True(File.Exists(Path.Combine(root, "app", "scripts", "image-content.mjs")));
        Assert.True(File.Exists(Path.Combine(root, "app", "scripts", "segment-help.mjs")));
        Assert.True(File.Exists(Path.Combine(root, "app", "definitions", "hl7-segments.v1.json")));
        Assert.True(File.Exists(Path.Combine(root, "app", "ocr", "tesseract.esm.min.js")));
        Assert.True(File.Exists(Path.Combine(root, "app", "ocr", "worker.min.js")));
        Assert.True(File.Exists(Path.Combine(root, "app", "ocr", "tesseract-core-lstm.wasm.js")));
        Assert.True(File.Exists(Path.Combine(root, "app", "ocr", "tesseract-core-lstm.wasm")));
        Assert.True(File.Exists(Path.Combine(root, "app", "ocr", "lang", "eng.traineddata.gz")));
        byte[] helper = File.ReadAllBytes(Path.Combine(root, "Kairo.Helper.dll"));
        Assert.True(helper.AsSpan().IndexOf(Encoding.Unicode.GetBytes("script-src 'self' 'wasm-unsafe-eval'")) >= 0);
        Assert.Empty(Directory.GetFiles(Path.Combine(root, "data", "runtime"), "*", SearchOption.AllDirectories));
    }
}
