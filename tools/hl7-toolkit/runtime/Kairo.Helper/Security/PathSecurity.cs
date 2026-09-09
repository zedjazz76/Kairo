#nullable enable

namespace Kairo.Helper.Security;

public static class PathSecurity
{
    public static string ResolveStaticPath(string root, string requestPath)
    {
        string decoded;
        try { decoded = Uri.UnescapeDataString(requestPath); }
        catch (UriFormatException error) { throw new InvalidOperationException("STATIC_PATH_REJECTED", error); }

        if (decoded.IndexOfAny(['\\', '\0']) >= 0 || decoded.Contains("..", StringComparison.Ordinal))
            throw new InvalidOperationException("STATIC_PATH_REJECTED");

        string relative = decoded == "/" ? "index.html" : decoded.TrimStart('/');
        if (relative.Length == 0 || Path.IsPathRooted(relative) || relative.Contains(':'))
            throw new InvalidOperationException("STATIC_PATH_REJECTED");

        string canonicalRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        string candidate = Path.GetFullPath(Path.Combine(root, relative));
        if (!candidate.StartsWith(canonicalRoot, StringComparison.Ordinal))
            throw new InvalidOperationException("STATIC_PATH_REJECTED");
        RejectLinks(canonicalRoot, candidate);
        return candidate;
    }

    public static string ValidateDataPath(string root, string candidate)
    {
        string canonicalRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        string canonicalCandidate = Path.GetFullPath(candidate);
        if (!canonicalCandidate.StartsWith(canonicalRoot, StringComparison.Ordinal))
            throw new InvalidOperationException("DATA_PATH_REJECTED");
        RejectLinks(canonicalRoot, canonicalCandidate);
        return canonicalCandidate;
    }

    private static void RejectLinks(string root, string candidate)
    {
        string current = root.TrimEnd(Path.DirectorySeparatorChar);
        string relative = Path.GetRelativePath(current, candidate);
        foreach (string segment in relative.Split(Path.DirectorySeparatorChar, StringSplitOptions.RemoveEmptyEntries))
        {
            current = Path.Combine(current, segment);
            if (!File.Exists(current) && !Directory.Exists(current)) continue;
            FileAttributes attributes = File.GetAttributes(current);
            if ((attributes & FileAttributes.ReparsePoint) != 0)
                throw new InvalidOperationException("LINKED_PATH_REJECTED");
        }
    }
}
