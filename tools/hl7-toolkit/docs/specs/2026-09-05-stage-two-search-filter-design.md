# KAIRO Guardian Stage Two Search and Filter Design

**Date:** September 5, 2026
**Status:** Approved
**Scope:** First Stage Two release

## Objective

Help an analyst reduce a loaded HL7 collection to relevant messages without sending or persisting raw message content. Filtering must remain responsive for the existing 100 MiB intake limit and must preserve the Phase One rule that raw HL7 stays in browser and worker memory.

## User workflow

The Inspect catalog gains a filter builder with two layers:

1. Instant metadata filters for message number, MSH-7 timestamp, MSH-9 type/family, MSH-10 control ID, MSH-12 version, sender, receiver, framing, and message length.
2. Optional deep filters evaluated in a Web Worker against message text. Deep filters support an HL7 path with the operators exists, missing, empty, equals, contains, and regular expression.

All active conditions use AND logic. A user can add multiple conditions, remove them individually, clear the filter, and see matched versus total counts. Filtering changes only the catalog view. It never changes, sanitizes, deletes, compares, validates, or sends messages.

The first release supports one value per condition and case-insensitive text matching by default. Regular expressions are explicitly selected, use JavaScript syntax without delimiters, and report invalid patterns without discarding the prior valid result.

## Architecture

A new pure module, `search-filter.mjs`, owns filter normalization, metadata evaluation, deep field evaluation, and result summaries. It accepts catalog message objects and returns matching message IDs. It has no DOM, network, storage, or clipboard access.

The intake worker receives a `filter` request containing only in-memory messages and normalized conditions. It parses message text only when a deep condition requires it. Work is chunked, reports progress, honors cancellation, and returns matching IDs. No raw values are included in progress or error events.

The workbench owns filter state and rendering. Metadata-only conditions run synchronously because catalog metadata is already indexed. Any deep condition is delegated to the worker. A monotonically increasing request identifier prevents a slow, stale result from replacing a newer filter result.

## Filter model

A filter is:

```javascript
{
  conditions: [
    {
      id: "condition-1",
      target: "metadata" | "path",
      field: "type" | "family" | "controlId" | "version" | "timestamp" |
        "sendingApplication" | "receivingApplication" | "framing" | "length" | "PID-3.1",
      operator: "exists" | "missing" | "empty" | "equals" | "contains" | "regex" |
        "greater-than" | "less-than",
      value: "..."
    }
  ]
}
```

Length accepts numeric comparison operators. Other metadata accepts exists, missing, empty, equals, contains, and regex. HL7 paths accept exists, missing, empty, equals, contains, and regex. Invalid targets, fields, operators, numbers, paths, or patterns produce a safe validation error before evaluation.

Path matching uses the existing generic parser and `getValue`. A repeated path without an explicit repetition matches when any repetition satisfies the condition. An explicit repetition such as `PID-3[2].1` evaluates that repetition only.

## Performance and cancellation

Metadata filters complete on the main thread over lightweight catalog fields. Deep filtering runs in worker chunks of at most 250 messages and yields between chunks. It emits counts and progress percentages only. Starting a new deep filter cancels the prior request.

The 100 MiB performance test must demonstrate early progress, successful cancellation, and event-loop yielding. No fixed wall-clock pass threshold is added because hardware differs.

## Privacy and safety

Raw values remain in browser or worker memory. Filter definitions are not saved automatically because search terms may contain PHI. Filter queries, matching values, and raw snippets never enter sanitized history, logs, URLs, filenames, or service requests.

Regular expressions are evaluated per field value. Input length is capped at 256 characters, and evaluation is chunked and cancellable. The application does not claim protection from every pathological JavaScript regular expression; users should prefer equals or contains for routine searches.

## Interface

The catalog panel keeps the existing quick text box and adds an “Advanced filters” disclosure. Each condition exposes target, field/path, operator, and value controls. The Apply button shows progress for deep filters. Clear restores the full catalog. The count reads “N of M messages.”

Keyboard order follows visual order, every control has a visible label, validation uses an assertive live region, and filtering progress uses a polite live region. Active filters remain visible while the analyst inspects messages.

## Error handling

Invalid filters are rejected before execution with a message naming the condition and problem, without echoing its value. Worker failure leaves the last valid catalog result visible and allows retry. Cancellation is a normal state and does not display an error.

## Testing

Pure module tests cover every operator, metadata and path targets, repetitions, AND logic, validation, invalid regex handling, and nonmutation. Worker tests cover progress, cancellation, stale request isolation, and safe event payloads. UI contract tests cover labels, live regions, matched counts, Apply, and Clear. The complete Phase One suite and PowerShell service probe remain required.

## Deferred

OR logic, nested groups, saved searches, time-zone normalization, cross-message statistics, result exports, fuzzy matching, and search inside durable history remain separate Stage Two work.
