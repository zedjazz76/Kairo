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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
