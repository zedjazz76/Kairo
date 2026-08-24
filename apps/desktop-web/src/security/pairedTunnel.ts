import type { CoreCommandV1 } from "../../../../shared/contracts/generated/contracts.v1.ts";

export type EphemeralKeyPair = {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
};

export type TunnelFrameMetadata = {
  sessionId: string;
  sequence: number;
  expiresAt: number;
};

export type EncryptedTunnelFrame = TunnelFrameMetadata & {
  nonce: string;
  ciphertext: string;
};

export interface TunnelFrameTransport {
  send(frame: EncryptedTunnelFrame): Promise<void>;
  disconnect(): Promise<void>;
}

export type PairedTunnelClientOptions = {
  sessionId: string;
  expiresAt: number;
  sessionKey: CryptoKey;
  transport: TunnelFrameTransport;
  now?: () => number;
};

export class PairedTunnelClient {
  private readonly sessionId: string;
  private readonly expiresAt: number;
  private readonly sessionKey: CryptoKey;
  private readonly transport: TunnelFrameTransport;
  private readonly now: () => number;
  private sequence = 0;
  private connected = true;

  constructor(options: PairedTunnelClientOptions) {
    this.sessionId = options.sessionId;
    this.expiresAt = options.expiresAt;
    this.sessionKey = options.sessionKey;
    this.transport = options.transport;
    this.now = options.now ?? Date.now;
  }

  async sendCommand(command: CoreCommandV1): Promise<void> {
    await this.sendPlaintext(JSON.stringify(command));
  }

  async sendPlaintext(plaintext: string): Promise<void> {
    if (!this.connected) {
      throw new Error("tunnel_not_connected");
    }

    if (this.expiresAt <= this.now()) {
      throw new Error("session_expired");
    }

    const sequence = this.sequence + 1;
    this.sequence = sequence;

    const frame = await encryptTunnelFrame(
      this.sessionKey,
      {
        sessionId: this.sessionId,
        sequence,
        expiresAt: this.expiresAt,
      },
      plaintext,
    );

    await this.transport.send(frame);
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    await this.transport.disconnect();
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const P256_UNCOMPRESSED_PUBLIC_KEY_BYTES = 65;
const P256_UNCOMPRESSED_PREFIX = 0x04;

export async function createEphemeralKeyPair(): Promise<EphemeralKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveBits"],
  );

  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
  };
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<Uint8Array> {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", publicKey));

  if (
    raw.byteLength !== P256_UNCOMPRESSED_PUBLIC_KEY_BYTES ||
    raw[0] !== P256_UNCOMPRESSED_PREFIX
  ) {
    throw new Error("invalid_public_key");
  }

  return raw;
}

export async function importPublicKey(encoded: Uint8Array): Promise<CryptoKey> {
  if (
    encoded.byteLength !== P256_UNCOMPRESSED_PUBLIC_KEY_BYTES ||
    encoded[0] !== P256_UNCOMPRESSED_PREFIX
  ) {
    throw new Error("invalid_public_key");
  }

  try {
    return await crypto.subtle.importKey(
      "raw",
      encoded,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      [],
    );
  } catch {
    throw new Error("invalid_public_key");
  }
}

export async function deriveSessionKey(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const sharedSecret = await crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: peerPublicKey,
    },
    privateKey,
    256,
  );

  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    "HKDF",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info: encoder.encode("kairo-v1-paired-tunnel"),
    },
    hkdfKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptTunnelFrame(
  sessionKey: CryptoKey,
  metadata: TunnelFrameMetadata,
  plaintext: string,
): Promise<EncryptedTunnelFrame> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = authenticatedMetadata(metadata);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      additionalData,
      tagLength: 128,
    },
    sessionKey,
    encoder.encode(plaintext),
  );

  return {
    ...metadata,
    nonce: toBase64(nonce),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptTunnelFrame(
  sessionKey: CryptoKey,
  frame: EncryptedTunnelFrame,
): Promise<string> {
  const metadata: TunnelFrameMetadata = {
    sessionId: frame.sessionId,
    sequence: frame.sequence,
    expiresAt: frame.expiresAt,
  };

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromBase64(frame.nonce),
      additionalData: authenticatedMetadata(metadata),
      tagLength: 128,
    },
    sessionKey,
    fromBase64(frame.ciphertext),
  );

  return decoder.decode(decrypted);
}

function authenticatedMetadata(metadata: TunnelFrameMetadata): Uint8Array {
  return encoder.encode(
    JSON.stringify({
      sessionId: metadata.sessionId,
      sequence: metadata.sequence,
      expiresAt: metadata.expiresAt,
    }),
  );
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
