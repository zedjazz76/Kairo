import type { PairingService } from "../pairing/PairingService.ts";
import type { TunnelBroker } from "./TunnelBroker.ts";

export interface PairedTunnelSessionState {
  sessionId: string;
  coreDeviceId: string;
  expiresAt: number;
}

export interface PairedTunnelSessionOptions {
  pairing: PairingService;
  broker: TunnelBroker;
  now?: () => number;
}

export class PairedTunnelSession {
  private readonly pairing: PairingService;
  private readonly broker: TunnelBroker;
  private readonly now: () => number;
  private readonly consumedPairingCodes = new Set<string>();

  constructor(options: PairedTunnelSessionOptions) {
    this.pairing = options.pairing;
    this.broker = options.broker;
    this.now = options.now ?? Date.now;
  }

  open(input: { pairingCode: string; sessionId: string }): PairedTunnelSessionState {
    if (this.consumedPairingCodes.has(input.pairingCode)) {
      throw new Error("pairing_unavailable");
    }

    const confirmed = this.pairing.confirmed(input.pairingCode);
    if (!confirmed) {
      throw new Error("pairing_not_confirmed");
    }

    const consumed = this.pairing.consumeConfirmed(input.pairingCode);
    if (!consumed) {
      throw new Error("pairing_unavailable");
    }

    if (consumed.expiresAt <= this.now()) {
      throw new Error("pairing_unavailable");
    }

    this.consumedPairingCodes.add(input.pairingCode);
    this.broker.openSession({
      sessionId: input.sessionId,
      expiresAt: consumed.expiresAt,
    });

    return {
      sessionId: input.sessionId,
      coreDeviceId: consumed.coreDeviceId,
      expiresAt: consumed.expiresAt,
    };
  }
}
