import type { CaptureBatch } from "../features/capture/CaptureBatch.ts";
import { CaptureWorkspace } from "../features/capture/CaptureWorkspace.tsx";
import { CopilotWorkspace } from "../features/copilot/CopilotWorkspace.tsx";
import {
  EvidencePane,
  type EvidenceInspectionRecord,
} from "../features/evidence/EvidencePane.tsx";
import type { DesktopWorkspace } from "./DesktopWorkspace.ts";

export type AppProps = {
  workspace: DesktopWorkspace;
  captureBatch: CaptureBatch;
  evidenceRecords?: readonly EvidenceInspectionRecord[];
};

export function App({ workspace, captureBatch, evidenceRecords }: AppProps) {
  return (
    <main>
      <CaptureWorkspace captureBatch={captureBatch} />
      {workspace.copilotVisible ? (
        <CopilotWorkspace onOpenEvidence={(evidenceRef) => workspace.openEvidence(evidenceRef)} />
      ) : null}
      {workspace.evidencePaneVisible && workspace.activeEvidenceRef ? (
        <EvidencePane
          evidenceRef={workspace.activeEvidenceRef}
          evidenceRecords={evidenceRecords}
        />
      ) : null}
    </main>
  );
}
