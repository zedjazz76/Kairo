import type { CoreCommandV1 } from "../../../../shared/contracts/generated/contracts.v1.ts";
import type { PairedTunnelClient } from "../security/pairedTunnel.ts";

export type DesktopConnectionState =
  | "UNPAIRED"
  | "CONNECTED"
  | "DISCONNECTED"
  | "EXPIRED";

export type DesktopCommandSender = {
  readonly connectionState: DesktopConnectionState;
  send(command: CoreCommandV1): Promise<void>;
  disconnect(): Promise<void>;
};

type PairedTunnelCommandClient = Pick<
  PairedTunnelClient,
  "sendCommand" | "disconnect"
>;

export function composePairedDesktopCommands(
  tunnel?: PairedTunnelCommandClient,
): DesktopCommandSender {
  let connectionState: DesktopConnectionState = tunnel ? "CONNECTED" : "UNPAIRED";

  return {
    get connectionState(): DesktopConnectionState {
      return connectionState;
    },

    async send(command: CoreCommandV1): Promise<void> {
      if (!tunnel || connectionState !== "CONNECTED") {
        throw new Error(
          connectionState === "EXPIRED" ? "session_expired" : "tunnel_not_connected",
        );
      }

      try {
        await tunnel.sendCommand(command);
      } catch (error) {
        connectionState = error instanceof Error && error.message === "session_expired"
          ? "EXPIRED"
          : "DISCONNECTED";
        throw error;
      }
    },

    async disconnect(): Promise<void> {
      if (!tunnel || connectionState !== "CONNECTED") {
        return;
      }

      connectionState = "DISCONNECTED";
      await tunnel.disconnect();
    },
  };
}
