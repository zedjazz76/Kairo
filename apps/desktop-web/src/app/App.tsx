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
};

export function App({
  workspace,
  captureBatch,
  evidenceRecords,
  commandSender,
  createRequestId,
  memoryCandidates = [],
  projects = [],
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
  };

  return (
    <main>
      <CaptureWorkspace captureBatch={captureBatch} onSendCommand={sendCommand} />
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
