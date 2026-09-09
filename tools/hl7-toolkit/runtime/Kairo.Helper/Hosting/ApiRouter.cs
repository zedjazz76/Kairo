#nullable enable

using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Kairo.Diagnostics;
using Kairo.Helper.Security;

namespace Kairo.Helper.Hosting;

internal static partial class ApiRouter
{
    private static readonly JsonSerializerOptions JsonOptions = new() { IncludeFields = true, PropertyNamingPolicy = null };

    public static Task<HttpResponseData> RouteAsync(string path, HttpRequestData request, string dataRoot)
    {
        try
        {
            object result = path switch
            {
                "/api/profiles/endpoint" => Profiles(request, dataRoot),
                "/api/diagnostics/run" => Diagnostics(request),
                "/api/dicom/mwl/find" => Mwl(request),
                "/api/dicom/studies/find" => Studies(request),
                "/api/diagnostics/baseline" => Baseline(request, dataRoot),
                "/api/history" or "/api/history/events" or "/api/history/session" => History(request, path, dataRoot),
                "/api/mllp/check" or "/api/mllp/send-one" => MllpRoutes.Handle(request, path),
                _ => throw new ApiException("NOT_FOUND", 404, "Not Found")
            };
            return Task.FromResult(new HttpResponseData(200, "OK", JsonSerializer.Serialize(result, JsonOptions)));
        }
        catch (ApiException error)
        {
            return Task.FromResult(new HttpResponseData(error.StatusCode, error.Reason, $"{{\"error\":\"{error.Code}\"}}"));
        }
        catch
        {
            string prefix = path.Contains("mwl", StringComparison.Ordinal) ? "MWL_INPUT_REJECTED"
                : path.Contains("studies", StringComparison.Ordinal) ? "STUDY_INPUT_REJECTED"
                : path.Contains("diagnostics/run", StringComparison.Ordinal) ? "DIAGNOSTIC_INPUT_REJECTED"
                : "BAD_REQUEST";
            return Task.FromResult(new HttpResponseData(400, "Bad Request", $"{{\"error\":\"{prefix}\"}}"));
        }
    }

    private static object Diagnostics(HttpRequestData request)
    {
        RequireMethod(request, "POST", "DIAGNOSTIC_METHOD_REJECTED");
        if (request.Body.Length > 2048) throw Bad("DIAGNOSTIC_INPUT_REJECTED");
        JsonElement payload = ParseObject(request.Body, "DIAGNOSTIC_INPUT_REJECTED");
        string mode = Text(payload, "mode", "DIAGNOSTIC_INPUT_REJECTED");
        int timeout = OptionalInt(payload, "timeoutMs", 3000);
        if (timeout is < 100 or > 10000) throw Bad("DIAGNOSTIC_INPUT_REJECTED");
        if (mode == "http") return HttpTlsProbe.Run(Text(payload, "target", "DIAGNOSTIC_INPUT_REJECTED"), timeout);
        string host = Text(payload, "host", "DIAGNOSTIC_INPUT_REJECTED");
        int port = Integer(payload, "port", "DIAGNOSTIC_INPUT_REJECTED");
        string calling = "", called = "";
        if (mode == "dicom") { calling = Text(payload, "callingAe", "DIAGNOSTIC_AE_REJECTED"); called = Text(payload, "calledAe", "DIAGNOSTIC_AE_REJECTED"); }
        try { return EndpointProbe.Run(mode, host, port, timeout, calling, called); }
        catch { throw Bad("DIAGNOSTIC_INPUT_REJECTED"); }
    }

    private static object Mwl(HttpRequestData request)
    {
        RequireMethod(request, "POST", "MWL_METHOD_REJECTED");
        if (request.Body.Length > 8192) throw Bad("MWL_INPUT_REJECTED");
        JsonElement payload = ParseObject(request.Body, "MWL_INPUT_REJECTED");
        if (OptionalText(payload, "schema") != "kairo.mwl-query.v1") throw Bad("MWL_SCHEMA_REJECTED");
        ValidateAllowed(payload, ["schema", "host", "port", "callingAe", "calledAe", "timeoutMs", "criteria"], "MWL_INPUT_REJECTED");
        string host = RequiredTrimmed(payload, "host", 253, "MWL_HOST_INVALID");
        if (Uri.CheckHostName(host) == UriHostNameType.Unknown || host.Contains('*') || host.Contains('/')) throw Bad("MWL_HOST_INVALID");
        int port = RangeInt(payload, "port", 1, 65535, "MWL_PORT_INVALID");
        int timeout = RangeInt(payload, "timeoutMs", 100, 10000, "MWL_TIMEOUT_INVALID");
        string calling = Ae(payload, "callingAe", "MWL_AE_INVALID"), called = Ae(payload, "calledAe", "MWL_AE_INVALID");
        if (!payload.TryGetProperty("criteria", out JsonElement criteria) || criteria.ValueKind != JsonValueKind.Object) throw Bad("MWL_CRITERION_REQUIRED");
        ValidateAllowed(criteria, ["scheduledDate", "scheduledDateRange", "modality", "scheduledStationAe", "patientId", "accessionNumber", "requestedProcedureId", "requestedProcedureDescription", "procedureCode", "scheduledLocation"], "MWL_INPUT_REJECTED");
        if (!criteria.EnumerateObject().Any(property => property.Value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(property.Value.GetString()))) throw Bad("MWL_CRITERION_REQUIRED");
        string date = OptionalText(criteria, "scheduledDate") ?? "";
        if (date.Length > 0 && !EightDigits().IsMatch(date)) throw Bad("MWL_DATE_INVALID");
        return MwlQueryClient.Run(new MwlQueryRequest { host = host, port = port, callingAe = calling, calledAe = called, timeoutMs = timeout, scheduledDate = date });
    }

    private static object Studies(HttpRequestData request)
    {
        RequireMethod(request, "POST", "STUDY_METHOD_REJECTED");
        if (request.Body.Length > 4096) throw Bad("STUDY_INPUT_REJECTED");
        JsonElement payload = ParseObject(request.Body, "STUDY_INPUT_REJECTED");
        if (OptionalText(payload, "schema") != "kairo.study-query.v1") throw Bad("STUDY_SCHEMA_REJECTED");
        ValidateAllowed(payload, ["schema", "host", "port", "callingAe", "calledAe", "timeoutMs", "criteria"], "STUDY_INPUT_REJECTED");
        string host = RequiredTrimmed(payload, "host", 253, "STUDY_HOST_INVALID");
        if (Uri.CheckHostName(host) == UriHostNameType.Unknown || host.Contains('/') || host.Contains('\\')) throw Bad("STUDY_HOST_INVALID");
        int port = RangeInt(payload, "port", 1, 65535, "STUDY_PORT_INVALID");
        int timeout = RangeInt(payload, "timeoutMs", 100, 10000, "STUDY_TIMEOUT_INVALID");
        string calling = Ae(payload, "callingAe", "STUDY_AE_INVALID"), called = Ae(payload, "calledAe", "STUDY_AE_INVALID");
        if (!payload.TryGetProperty("criteria", out JsonElement criteria) || criteria.ValueKind != JsonValueKind.Object || !criteria.EnumerateObject().Any()) throw Bad("STUDY_CRITERION_REQUIRED");
        ValidateAllowed(criteria, ["accessionNumber", "patientId", "studyInstanceUid", "studyDate", "studyDateRange", "modalitiesInStudy"], "STUDY_INPUT_REJECTED");
        string accession = StudyCriterion(criteria, "accessionNumber", 16), patient = StudyCriterion(criteria, "patientId", 64);
        string uid = StudyCriterion(criteria, "studyInstanceUid", 64), modalities = StudyCriterion(criteria, "modalitiesInStudy", 16);
        if (uid.Length > 0 && !Uid().IsMatch(uid)) throw Bad("STUDY_UID_INVALID");
        string date = OptionalText(criteria, "studyDate") ?? "", range = "";
        if (date.Length > 0) ValidateDate(date, "STUDY_DATE_INVALID");
        if (criteria.TryGetProperty("studyDateRange", out JsonElement dateRange))
        {
            if (date.Length > 0 || dateRange.ValueKind != JsonValueKind.Object) throw Bad("STUDY_DATE_RANGE_INVALID");
            string start = Text(dateRange, "start", "STUDY_DATE_RANGE_INVALID"), end = Text(dateRange, "end", "STUDY_DATE_RANGE_INVALID");
            ValidateDate(start, "STUDY_DATE_RANGE_INVALID"); ValidateDate(end, "STUDY_DATE_RANGE_INVALID");
            if (string.CompareOrdinal(start, end) > 0) throw Bad("STUDY_DATE_RANGE_INVALID");
            range = start + "-" + end;
        }
        return StudyQueryClient.Run(new StudyQueryRequest { host = host, port = port, callingAe = calling, calledAe = called, timeoutMs = timeout, accessionNumber = accession, patientId = patient, studyInstanceUid = uid, studyDate = date, studyDateRange = range, modalitiesInStudy = modalities });
    }

    private static object Profiles(HttpRequestData request, string dataRoot)
    {
        string folder = PathSecurity.ValidateDataPath(dataRoot, Path.Combine(dataRoot, "profiles"));
        if (request.Method == "GET")
        {
            var profiles = new List<JsonElement>(); int invalid = 0;
            if (Directory.Exists(folder)) foreach (string file in Directory.GetFiles(folder, "*.json").Order())
                try { using JsonDocument document = JsonDocument.Parse(File.ReadAllText(file)); JsonElement clean = ValidateProfile(document.RootElement); if (Path.GetFileNameWithoutExtension(file) != clean.GetProperty("id").GetString()) throw new InvalidDataException(); profiles.Add(clean); } catch { invalid++; }
            return new { profiles = profiles.OrderBy(profile => profile.GetProperty("label").GetString()).ToArray(), invalidCount = invalid };
        }
        JsonElement payload = ParseObject(request.Body, "PROFILE_OBJECT_REQUIRED");
        if (request.Method == "POST")
        {
            if (!payload.TryGetProperty("profile", out JsonElement profile)) throw Bad("PROFILE_OBJECT_REQUIRED");
            JsonElement clean = ValidateProfile(profile);
            Directory.CreateDirectory(folder);
            AtomicWrite(Path.Combine(folder, clean.GetProperty("id").GetString()! + ".json"), clean.GetRawText());
            return clean;
        }
        if (request.Method == "DELETE")
        {
            string id = Text(payload, "id", "PROFILE_ID_REJECTED"); ValidateId(id, "PROFILE_ID_REJECTED");
            string path = Path.Combine(folder, id + ".json"); bool exists = File.Exists(path); if (exists) File.Delete(path); return new { deleted = exists };
        }
        throw Bad("PROFILE_METHOD_REJECTED");
    }

    private static JsonElement ValidateProfile(JsonElement profile)
    {
        if (profile.ValueKind != JsonValueKind.Object) throw Bad("PROFILE_OBJECT_REQUIRED");
        ValidateAllowed(profile, ["schema", "id", "label", "environment", "type", "host", "port", "callingAe", "calledAe", "connectTimeoutMs", "responseTimeoutMs", "encoding", "startByte", "endBytes", "notes"], "PROFILE_PROPERTY_REJECTED");
        if (OptionalText(profile, "schema") != "hl7-toolkit.endpoint-profile.v1") throw Bad("PROFILE_SCHEMA_REJECTED");
        string id = Text(profile, "id", "PROFILE_TEXT_REJECTED").Trim(); ValidateId(id, "PROFILE_ID_REJECTED");
        string label = Text(profile, "label", "PROFILE_TEXT_REJECTED").Trim(), environment = Text(profile, "environment", "PROFILE_TEXT_REJECTED").Trim();
        string type = OptionalText(profile, "type") ?? "mllp", host = Text(profile, "host", "PROFILE_TEXT_REJECTED").Trim();
        string encoding = Text(profile, "encoding", "PROFILE_TEXT_REJECTED").Trim(), notes = Text(profile, "notes", "PROFILE_TEXT_REJECTED").Trim();
        string calling = OptionalText(profile, "callingAe")?.Trim() ?? "", called = OptionalText(profile, "calledAe")?.Trim() ?? "";
        if (label.Length is < 1 or > 80 || notes.Length > 500) throw Bad("PROFILE_LABEL_REJECTED");
        if (environment is not ("Test" or "Production")) throw Bad("PROFILE_ENVIRONMENT_REJECTED");
        if (type is not ("tcp" or "dicom" or "http" or "https" or "mllp")) throw Bad("PROFILE_TYPE_REJECTED");
        if (host.Length > 253 || Uri.CheckHostName(host) == UriHostNameType.Unknown) throw Bad("PROFILE_HOST_REJECTED");
        if (encoding is not ("utf-8" or "ascii" or "windows-1252" or "iso-8859-1")) throw Bad("PROFILE_ENCODING_REJECTED");
        if (!ValidAe(calling) || !ValidAe(called)) throw Bad("PROFILE_AE_REJECTED");
        int port = RangeInt(profile, "port", 1, 65535, "PROFILE_NUMBER_REJECTED"), connect = RangeInt(profile, "connectTimeoutMs", 100, 120000, "PROFILE_NUMBER_REJECTED"), response = RangeInt(profile, "responseTimeoutMs", 100, 120000, "PROFILE_NUMBER_REJECTED"), start = RangeInt(profile, "startByte", 0, 255, "PROFILE_NUMBER_REJECTED");
        if (!profile.TryGetProperty("endBytes", out JsonElement end) || end.ValueKind != JsonValueKind.Array || end.GetArrayLength() is < 1 or > 8 || end.EnumerateArray().Any(value => !value.TryGetInt32(out int number) || number is < 0 or > 255)) throw Bad("PROFILE_FRAMING_REJECTED");
        return JsonSerializer.SerializeToElement(new { schema = "hl7-toolkit.endpoint-profile.v1", id, label, environment, type, host, port, callingAe = calling, calledAe = called, connectTimeoutMs = connect, responseTimeoutMs = response, encoding, startByte = start, endBytes = end.EnumerateArray().Select(value => value.GetInt32()).ToArray(), notes });
    }

    private static object Baseline(HttpRequestData request, string dataRoot)
    {
        RequireMethod(request, "POST", "DIAGNOSTIC_BASELINE_METHOD_REJECTED");
        JsonElement payload = ParseObject(request.Body, "DIAGNOSTIC_BASELINE_REJECTED");
        string folder = PathSecurity.ValidateDataPath(dataRoot, Path.Combine(dataRoot, "diagnostic-baselines"));
        string action = Text(payload, "action", "DIAGNOSTIC_BASELINE_ACTION_REJECTED");
        if (action == "save")
        {
            if (!payload.TryGetProperty("baseline", out JsonElement baseline) || baseline.ValueKind != JsonValueKind.Object) throw Bad("DIAGNOSTIC_BASELINE_REJECTED");
            ValidateAllowed(baseline, ["schema", "profileId", "type", "endpoint", "savedAt", "classification", "totalMs", "layers", "certificateDaysUntilExpiration", "tlsVersion", "httpStatus", "acknowledgmentCode"], "DIAGNOSTIC_BASELINE_REJECTED");
            if (OptionalText(baseline, "schema") != "kairo.diagnostic-baseline.v1") throw Bad("DIAGNOSTIC_BASELINE_REJECTED");
            string id = Text(baseline, "profileId", "DIAGNOSTIC_BASELINE_REJECTED"); ValidateId(id, "DIAGNOSTIC_BASELINE_ID_REJECTED");
            string classification = Text(baseline, "classification", "DIAGNOSTIC_BASELINE_REJECTED");
            if (!Regex.IsMatch(classification, "^[A-Z0-9_]{1,64}$") || !baseline.TryGetProperty("layers", out JsonElement layers) || layers.ValueKind != JsonValueKind.Object) throw Bad("DIAGNOSTIC_BASELINE_REJECTED");
            Directory.CreateDirectory(folder); AtomicWrite(Path.Combine(folder, id + ".json"), baseline.GetRawText()); return baseline.Clone();
        }
        if (action == "get")
        {
            string id = Text(payload, "profileId", "DIAGNOSTIC_BASELINE_ID_REJECTED"); ValidateId(id, "DIAGNOSTIC_BASELINE_ID_REJECTED");
            string file = Path.Combine(folder, id + ".json");
            if (!File.Exists(file)) return new { baseline = (object?)null };
            using JsonDocument document = JsonDocument.Parse(File.ReadAllText(file)); return new { baseline = document.RootElement.Clone() };
        }
        throw Bad("DIAGNOSTIC_BASELINE_ACTION_REJECTED");
    }

    private static object History(HttpRequestData request, string path, string dataRoot)
    {
        string root = PathSecurity.ValidateDataPath(dataRoot, Path.Combine(dataRoot, "history"));
        if (path == "/api/history" && request.Method == "GET")
        {
            string sessionId = GetQuery(request.Target, "sessionId") ?? "";
            if (sessionId.Length == 0)
            {
                if (!Directory.Exists(root)) return new { sessions = Array.Empty<object>(), totalBytes = 0L };
                var sessions = Directory.GetDirectories(root).Select(folder =>
                {
                    string id = Path.GetFileName(folder); string manifest = Path.Combine(folder, "manifest.json");
                    if (!Id().IsMatch(id) || !File.Exists(manifest)) return null;
                    using JsonDocument document = JsonDocument.Parse(File.ReadAllText(manifest)); JsonElement item = document.RootElement;
                    long bytes = Directory.GetFiles(folder).Sum(file => new FileInfo(file).Length);
                    return new { sessionId = id, createdUtc = OptionalText(item, "createdUtc"), updatedUtc = OptionalText(item, "updatedUtc"), eventCount = item.GetProperty("eventCount").GetInt32(), bytes };
                }).Where(item => item is not null).OrderByDescending(item => item!.updatedUtc).ToArray();
                return new { sessions, totalBytes = sessions.Sum(item => item!.bytes) };
            }
            ValidateId(sessionId, "HISTORY_SESSION_ID_REJECTED"); string folder = Path.Combine(root, sessionId);
            if (!Directory.Exists(folder)) throw Bad("HISTORY_SESSION_NOT_FOUND");
            using JsonDocument manifestDoc = JsonDocument.Parse(File.ReadAllText(Path.Combine(folder, "manifest.json")));
            JsonElement[] events = File.ReadAllLines(Path.Combine(folder, "events.jsonl")).Where(line => line.Length > 0).Select(line => JsonSerializer.Deserialize<JsonElement>(line)).ToArray();
            return new { manifest = manifestDoc.RootElement.Clone(), events, sanitizedText = File.ReadAllText(Path.Combine(folder, "messages.hl7")) };
        }
        JsonElement payload = ParseObject(request.Body, "HISTORY_REQUEST_FAILED");
        if (path == "/api/history/events" && request.Method == "POST")
        {
            string id = Text(payload, "sessionId", "HISTORY_SESSION_ID_REJECTED"); ValidateId(id, "HISTORY_SESSION_ID_REJECTED");
            if (!payload.TryGetProperty("event", out JsonElement supplied) || supplied.ValueKind != JsonValueKind.Object) throw Bad("HISTORY_SCHEMA_REJECTED");
            ValidateAllowed(supplied, ["schema", "type", "sanitizedText", "sanitizedResponse", "policyVersion", "mode", "warningCounts", "overrideCount", "outcome", "latencyMs", "bytesSent", "profileLabel", "ackCode", "correlated"], "HISTORY_PROPERTY_REJECTED");
            if (OptionalText(supplied, "schema") != "hl7-toolkit.sanitized-event.v1") throw Bad("HISTORY_SCHEMA_REJECTED");
            string type = Text(supplied, "type", "HISTORY_EVENT_TYPE_REJECTED"); if (type is not ("clipboard-copy" or "message-save" or "send-result" or "comparison-save")) throw Bad("HISTORY_EVENT_TYPE_REJECTED");
            string text = OptionalText(supplied, "sanitizedText") ?? "", response = OptionalText(supplied, "sanitizedResponse") ?? "";
            if (text.Length > 8_388_608 || response.Length > 8_388_608) throw Bad("HISTORY_CONTENT_REJECTED");
            var clean = new JsonObject
            {
                ["schema"] = "hl7-toolkit.sanitized-event.v1", ["type"] = type, ["eventId"] = Guid.NewGuid().ToString("N"), ["timestamp"] = DateTime.UtcNow.ToString("o"),
                ["policyVersion"] = OptionalText(supplied, "policyVersion") ?? "", ["mode"] = OptionalText(supplied, "mode") ?? "chat-safe", ["sanitizedText"] = text, ["sanitizedResponse"] = response,
                ["warningCounts"] = supplied.TryGetProperty("warningCounts", out JsonElement counts) ? JsonNode.Parse(counts.GetRawText()) : new JsonObject(),
                ["overrideCount"] = supplied.TryGetProperty("overrideCount", out JsonElement over) && over.TryGetInt32(out int overValue) ? overValue : 0,
                ["outcome"] = OptionalText(supplied, "outcome") ?? "saved", ["latencyMs"] = supplied.TryGetProperty("latencyMs", out JsonElement latency) && latency.TryGetInt32(out int latencyValue) ? latencyValue : 0,
                ["bytesSent"] = supplied.TryGetProperty("bytesSent", out JsonElement sent) && sent.TryGetInt32(out int sentValue) ? sentValue : 0, ["profileLabel"] = OptionalText(supplied, "profileLabel") ?? "", ["ackCode"] = OptionalText(supplied, "ackCode") ?? "", ["correlated"] = supplied.TryGetProperty("correlated", out JsonElement correlated) && correlated.ValueKind == JsonValueKind.True
            };
            string folder = Path.Combine(root, id); Directory.CreateDirectory(folder); string eventsPath = Path.Combine(folder, "events.jsonl"), messagesPath = Path.Combine(folder, "messages.hl7");
            File.AppendAllText(eventsPath, clean.ToJsonString() + "\n", new System.Text.UTF8Encoding(false));
            string content = text + (response.Length > 0 ? "\r" + response : "") + "\r\n"; File.AppendAllText(messagesPath, content, new System.Text.UTF8Encoding(false));
            int eventCount = File.ReadLines(eventsPath).Count(line => line.Length > 0); string timestamp = clean["timestamp"]!.GetValue<string>();
            var manifest = new { schema = "hl7-toolkit.session.v1", sessionId = id, createdUtc = eventCount == 1 ? timestamp : ReadCreated(folder), updatedUtc = timestamp, eventCount, contentCharacters = File.ReadAllText(messagesPath).Length, journalBytes = new FileInfo(eventsPath).Length, contentBytes = new FileInfo(messagesPath).Length };
            AtomicWrite(Path.Combine(folder, "manifest.json"), JsonSerializer.Serialize(manifest)); return new { saved = true, sessionId = id, eventId = clean["eventId"]!.GetValue<string>(), eventCount };
        }
        if (path == "/api/history/session" && request.Method == "DELETE" && payload.TryGetProperty("sessionIds", out JsonElement ids) && ids.ValueKind == JsonValueKind.Array)
        {
            int deleted = 0; foreach (JsonElement value in ids.EnumerateArray()) { string id = value.GetString() ?? ""; ValidateId(id, "HISTORY_SESSION_ID_REJECTED"); string folder = Path.Combine(root, id); if (Directory.Exists(folder)) { Directory.Delete(folder, true); deleted++; } } return new { deletedCount = deleted };
        }
        throw Bad("HISTORY_METHOD_REJECTED");
    }

    private static string ReadCreated(string folder) { try { using JsonDocument document = JsonDocument.Parse(File.ReadAllText(Path.Combine(folder, "manifest.json"))); return document.RootElement.GetProperty("createdUtc").GetString()!; } catch { return DateTime.UtcNow.ToString("o"); } }
    private static string? GetQuery(string target, string name) { int index = target.IndexOf('?'); if (index < 0) return null; foreach (string pair in target[(index + 1)..].Split('&')) { string[] parts = pair.Split('=', 2); if (Uri.UnescapeDataString(parts[0]) == name) return parts.Length == 2 ? Uri.UnescapeDataString(parts[1]) : ""; } return null; }

    private static JsonElement ParseObject(string json, string code) { try { JsonElement value = JsonSerializer.Deserialize<JsonElement>(json); if (value.ValueKind != JsonValueKind.Object) throw Bad(code); return value; } catch (JsonException) { throw Bad(code); } }
    private static string Text(JsonElement value, string name, string code) => value.TryGetProperty(name, out JsonElement property) && property.ValueKind == JsonValueKind.String ? property.GetString()! : throw Bad(code);
    private static string? OptionalText(JsonElement value, string name) => value.TryGetProperty(name, out JsonElement property) && property.ValueKind == JsonValueKind.String ? property.GetString() : null;
    private static int Integer(JsonElement value, string name, string code) => value.TryGetProperty(name, out JsonElement property) && property.TryGetInt32(out int number) ? number : throw Bad(code);
    private static int OptionalInt(JsonElement value, string name, int fallback) => value.TryGetProperty(name, out JsonElement property) ? property.TryGetInt32(out int number) ? number : throw Bad("DIAGNOSTIC_INPUT_REJECTED") : fallback;
    private static int RangeInt(JsonElement value, string name, int min, int max, string code) { int number = Integer(value, name, code); if (number < min || number > max) throw Bad(code); return number; }
    private static string RequiredTrimmed(JsonElement value, string name, int max, string code) { string text = Text(value, name, code); if (string.IsNullOrWhiteSpace(text) || text != text.Trim() || text.Length > max) throw Bad(code); return text; }
    private static string Ae(JsonElement value, string name, string code) { string text = RequiredTrimmed(value, name, 16, code); if (!ValidAe(text)) throw Bad(code); return text; }
    private static bool ValidAe(string text) => text.Length <= 16 && text.All(character => character is >= ' ' and <= '~' && character != '\\');
    private static string StudyCriterion(JsonElement value, string name, int max) { string? text = OptionalText(value, name); if (text is null) return ""; if (string.IsNullOrWhiteSpace(text) || text != text.Trim() || text.Length > max || text.Contains('*') || text.Contains('?')) throw Bad("STUDY_CRITERION_INVALID"); return text; }
    private static void ValidateDate(string date, string code) { if (!DateTime.TryParseExact(date, "yyyyMMdd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out _)) throw Bad(code); }
    private static void ValidateAllowed(JsonElement value, string[] allowed, string code) { foreach (JsonProperty property in value.EnumerateObject()) if (!allowed.Contains(property.Name, StringComparer.Ordinal)) throw Bad(code); }
    private static void ValidateId(string id, string code) { if (!Id().IsMatch(id)) throw Bad(code); }
    private static void RequireMethod(HttpRequestData request, string method, string code) { if (request.Method != method) throw Bad(code); }
    private static void AtomicWrite(string path, string content) { string folder = Path.GetDirectoryName(path)!; Directory.CreateDirectory(folder); string temporary = Path.Combine(folder, "." + Path.GetFileName(path) + "." + Guid.NewGuid().ToString("N") + ".tmp"); File.WriteAllText(temporary, content, new System.Text.UTF8Encoding(false)); File.Move(temporary, path, true); }
    private static ApiException Bad(string code) => new(code, 400, "Bad Request");
    [GeneratedRegex("^[a-z0-9][a-z0-9-]{0,63}$", RegexOptions.CultureInvariant)] private static partial Regex Id();
    [GeneratedRegex("^[0-9]{8}$", RegexOptions.CultureInvariant)] private static partial Regex EightDigits();
    [GeneratedRegex("^[0-9]+(\\.[0-9]+)+$", RegexOptions.CultureInvariant)] private static partial Regex Uid();
}

internal sealed class ApiException(string code, int statusCode, string reason) : Exception(code)
{
    public string Code { get; } = code;
    public int StatusCode { get; } = statusCode;
    public string Reason { get; } = reason;
}
