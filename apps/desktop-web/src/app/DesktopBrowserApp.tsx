import { useReducer, useState } from "react";
import { CaptureBatch } from "../features/capture/CaptureBatch.ts";
import { App } from "./App.tsx";
import { DesktopWorkspace } from "./DesktopWorkspace.ts";
import type { DesktopCommandSender } from "./PairedDesktopCommands.ts";

export type DesktopBrowserAppProps = {
  commandSender: DesktopCommandSender;
};

export function DesktopBrowserApp({ commandSender }: DesktopBrowserAppProps) {
  const [workspace] = useState(() => new DesktopWorkspace());
  const [captureBatch] = useState(
    () => new CaptureBatch({ captureSessionId: crypto.randomUUID() }),
  );
  const [, refresh] = useReducer((version: number) => version + 1, 0);

  return (
    <App
      workspace={workspace}
      captureBatch={captureBatch}
      commandSender={commandSender}
      createRequestId={() => crypto.randomUUID()}
      onWorkspaceChange={refresh}
      onCaptureStaged={refresh}
    />
  );
}
