# ADR-0001: Initial authoritative Core host

- Status: Accepted
- Date: 2026-08-20

## Context

Kairo V1 has one authoritative Core at a time. Android and the browser desktop
client must use the same versioned Core contracts, while the browser must work
without a local database or a second writable knowledge graph.

## Decision

Android hosts the first authoritative Kairo Core. Android uses the same
client-to-Core interfaces as every other client. Desktop access is through an
ephemeral, encrypted relay tunnel paired to that Core. The relay routes live
encrypted traffic only and does not become a permanent Kairo store.

There is no second writable graph on the desktop client or relay.

## Consequences

The Android deployment may later change without changing Core contracts.
Desktop capabilities require an active paired tunnel for Core operations, and
the relay remains stateless with respect to Kairo knowledge and source data.
