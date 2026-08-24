import type { CaptureBatch } from "../features/capture/CaptureBatch.ts";
import { CaptureWorkspace } from "../features/capture/CaptureWorkspace.tsx";
import { CopilotWorkspace } from "../features/copilot/CopilotWorkspace.tsx";
import { EvidencePane } from "../features/evidence/EvidencePane.tsx";
import type { DesktopWorkspace } from "./DesktopWorkspace.ts";

export type AppProps = {
  workspace: DesktopWorkspace;
  captureBatch: CaptureBatch;
};

export function App({ workspace, captureBatch }: AppProps) {
  return (
    <main>
      <CaptureWorkspace captureBatch={captureBatch} />
      {workspace.copilotVisible ? <CopilotWorkspace /> : null}
      {workspace.evidencePaneVisible && workspace.activeEvidenceRef ? (
        <EvidencePane evidenceRef={workspace.activeEvidenceRef} />
      ) : null}
    </main>
  );
}
