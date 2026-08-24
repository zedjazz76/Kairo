# ADR-0002: Desktop tunnel cryptography and pairing

- Status: Accepted
- Date: 2026-08-23

## Context

Kairo V1 keeps one authoritative Core on Android while allowing a no-install
browser client to invoke versioned `CoreCommandV1` operations. The browser and
Core need a secure session through a relay that can route live traffic without
learning command or file plaintext and without becoming a durable Kairo store.

The design must support one-time pairing, explicit Core confirmation, short
session lifetime, replay rejection, bounded encrypted chunk transport, and
immediate cleanup on disconnect.

## Decision

### Pairing and authentication

The relay issues short-lived six-digit pairing codes bound to a specific Core
device identity. The Core must explicitly confirm the code before it can be
consumed. Pairing is one-time use, can be cancelled by the same Core device,
and cannot be consumed after cancellation or expiry. A confirmed pairing may
open exactly one tunnel session, and that session may not outlive the pairing.

### Key agreement and derivation

Each peer generates an ephemeral P-256 (`secp256r1`) ECDH key pair. Public keys
are exchanged in standard uncompressed SEC1 format (`0x04 || X || Y`). The
peers derive a 256-bit shared secret with ECDH and derive the session encryption
key with HKDF-SHA-256 using the context string `kairo-v1-paired-tunnel` and a
per-session salt.

Ephemeral private keys and derived session keys are session material only and
are not retained by the relay.

### Frame encryption and integrity

Application payloads are encrypted end to end with AES-256-GCM using a fresh
96-bit nonce per frame. The authenticated additional data contains
`sessionId`, monotonic `sequence`, and `expiresAt`. Modifying authenticated
metadata or ciphertext causes decryption to fail closed.

The browser serializes typed `CoreCommandV1` envelopes before encryption. The
relay receives only live routing metadata, nonce, and ciphertext. It has no
session key and cannot decrypt Core commands or file payloads.

### Replay, expiry, chunking, and cleanup

Each tunnel session tracks the highest accepted sequence number and rejects
repeated or non-increasing sequence numbers as `replay_detected`. Expired
sessions or frames are rejected as `session_expired`.

Large encrypted payloads use bounded chunks with stable message identity,
`index`, and `total` metadata. Reassembly accepts out-of-order chunks but rejects
incomplete, duplicate, or mismatched chunk sets.

Disconnect immediately removes live routing state. Pairing offers, cancelled
pairing tombstones, and live session metadata are short-lived and expire; the
relay does not retain completed payloads, Kairo knowledge, source contents, or
session keys.

## Threat model

The relay is treated as an untrusted routing intermediary for payload
confidentiality. The tunnel is designed to protect command and file plaintext
from relay inspection, accidental relay logging, passive capture, metadata or
ciphertext tampering, replay, stale-session reuse, pairing-code reuse, and
confirmation by the wrong Core device.

This decision does not claim to protect a compromised browser endpoint, a
compromised Android Core device, or a user who explicitly approves pairing to
an attacker-controlled browser. Endpoint security and user confirmation remain
part of the trust boundary.

## Rotation and recovery

A new pairing creates new ephemeral ECDH keys and a new derived session key.
Session material is not reused across pairings. Expiry, cancellation,
disconnect, corrupted frames, or lost connectivity require a new pairing rather
than attempting to recover or persist the old session key.

If a session is suspected to be compromised, either endpoint disconnects and
the relay deletes the live routing state. The user then performs a fresh
pairing and explicit Core confirmation.

## Consequences

The browser can remain storage-light and the relay can remain stateless with
respect to durable Kairo data while still carrying encrypted Core commands and
file chunks. Pairing and session lifecycle are intentionally short-lived, so a
browser must re-pair after cancellation, expiry, or disconnect.

The Android and browser implementations must preserve the same P-256 public-key
encoding, HKDF context, AES-GCM frame metadata, and sequence semantics. Future
algorithm changes require a versioned protocol decision rather than silently
changing this V1 wire contract.
