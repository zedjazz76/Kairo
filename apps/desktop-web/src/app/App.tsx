import type { CaptureBatch } from "../features/capture/CaptureBatch.ts";
import { CaptureWorkspace } from "../features/capture/CaptureWorkspace.tsx";
import { CopilotWorkspace } from "../features/copilot/CopilotWorkspace.tsx";
import {
  EvidencePane,
  type EvidenceInspectionRecord,
} from "../features/evidence/EvidencePane.tsx";
import {
  MemoryInbox,
  type MemoryCandidate,
} from "../features/memory/MemoryInbox.tsx";
import {
  ProjectsWorkspace,
  type ProjectSummary,
} from "../features/projects/ProjectsWorkspace.tsx";
import type { DesktopWorkspace } from "./DesktopWorkspace.ts";
import {
  composePairedDesktopCommands,
  type DesktopCommandSender,
} from "./PairedDesktopCommands.ts";

export type AppProps = {
  workspace: DesktopWorkspace;
  captureBatch: CaptureBatch;
  evidenceRecords?: readonly EvidenceInspectionRecord[];
  commandSender?: DesktopCommandSender;
  createRequestId?: () => string;
  memoryCandidates?: readonly MemoryCandidate[];
  projects?: ProjectSummary[];
  onWorkspaceChange?: () => void;
  onCaptureStaged?: () => void;
};

export function App({
  workspace,
  captureBatch,
  evidenceRecords,
  commandSender,
  createRequestId,
  memoryCandidates = [],
  projects = [],
  onWorkspaceChange,
  onCaptureStaged,
}: AppProps) {
  const pairedCommands = commandSender ?? composePairedDesktopCommands();
  const sendCommand = pairedCommands.send.bind(pairedCommands);
  const nextRequestId = createRequestId ?? (() => crypto.randomUUID());

  const openEvidence = async (evidenceRef: string): Promise<void> => {
    await sendCommand({
      requestId: nextRequestId(),
      type: "OpenEvidence",
      contractVersion: "v1",
      payload: { evidenceRef },
    });

    workspace.openEvidence(evidenceRef);
    onWorkspaceChange?.();
  };

  const navigate = (destination: DesktopWorkspace["activeWorkspace"]): void => {
    workspace.navigate(destination);
    onWorkspaceChange?.();
  };

  return (
    <main>
      <nav aria-label="Desktop workspace">
        <button type="button" onClick={() => navigate("capture")}>Capture</button>
        <button type="button" onClick={() => navigate("memory")}>Memory</button>
        <button type="button" onClick={() => navigate("projects")}>Projects</button>
      </nav>
      {workspace.activeWorkspace === "capture" ? (
        <CaptureWorkspace
          captureBatch={captureBatch}
          onSendCommand={sendCommand}
          onStaged={onCaptureStaged}
        />
      ) : null}
      {workspace.copilotVisible ? (
        <CopilotWorkspace
          createRequestId={nextRequestId}
          onSendCommand={sendCommand}
          onOpenEvidence={openEvidence}
        />
      ) : null}
      {workspace.activeWorkspace === "memory" ? (
        <MemoryInbox
          candidates={memoryCandidates}
          requestIdForCandidate={nextRequestId}
          onSendCommand={sendCommand}
        />
      ) : null}
      {workspace.activeWorkspace === "projects" ? (
        <ProjectsWorkspace
          projects={projects}
          requestIdForProject={nextRequestId}
          onSendCommand={sendCommand}
        />
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
