import { randomInt } from "node:crypto";

export interface PairingOffer {
  code: string;
  coreDeviceId: string;
  expiresAt: number;
}

export interface ConfirmedPairingSession {
  pairingCode: string;
  coreDeviceId: string;
  confirmedAt: number;
  expiresAt: number;
}

interface PairingRecord extends PairingOffer {
  confirmedAt: number | null;
  consumed: boolean;
}

export interface PairingServiceOptions {
  now?: () => number;
  codeTtlMillis?: number;
}

export class PairingService {
  private readonly now: () => number;
  private readonly codeTtlMillis: number;
  private readonly offers = new Map<string, PairingRecord>();

  constructor(options: PairingServiceOptions = {}) {
    this.now = options.now ?? Date.now;
    this.codeTtlMillis = options.codeTtlMillis ?? 60_000;
  }

  createOffer({ coreDeviceId }: { coreDeviceId: string }): PairingOffer {
    const createdAt = this.now();
    const code = this.createUniqueCode();
    const record: PairingRecord = {
      code,
      coreDeviceId,
      expiresAt: createdAt + this.codeTtlMillis,
      confirmedAt: null,
      consumed: false,
    };

    this.offers.set(code, record);

    return {
      code: record.code,
      coreDeviceId: record.coreDeviceId,
      expiresAt: record.expiresAt,
    };
  }

  confirm({ code, coreDeviceId }: { code: string; coreDeviceId: string }): void {
    const record = this.offers.get(code);
    if (!record) {
      throw new Error("pairing_not_found");
    }

    if (this.isExpired(record)) {
      this.offers.delete(code);
      throw new Error("pairing_expired");
    }

    if (record.coreDeviceId !== coreDeviceId) {
      throw new Error("pairing_device_mismatch");
    }

    if (record.consumed) {
      throw new Error("pairing_consumed");
    }

    record.confirmedAt = this.now();
  }

  confirmed(code: string): ConfirmedPairingSession | null {
    const record = this.offers.get(code);
    if (!record) {
      return null;
    }

    if (this.isExpired(record)) {
      this.offers.delete(code);
      return null;
    }

    if (record.confirmedAt === null || record.consumed) {
      return null;
    }

    return {
      pairingCode: record.code,
      coreDeviceId: record.coreDeviceId,
      confirmedAt: record.confirmedAt,
      expiresAt: record.expiresAt,
    };
  }

  consumeConfirmed(code: string): ConfirmedPairingSession | null {
    const session = this.confirmed(code);
    if (!session) {
      return null;
    }

    const record = this.offers.get(code)!;
    record.consumed = true;
    this.offers.delete(code);

    return session;
  }

  private isExpired(record: PairingRecord): boolean {
    return this.now() > record.expiresAt;
  }

  private createUniqueCode(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
      if (!this.offers.has(code)) {
        return code;
      }
    }

    throw new Error("pairing_code_unavailable");
  }
}
