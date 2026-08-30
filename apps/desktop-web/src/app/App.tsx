import type { CaptureBatch } from "../features/capture/CaptureBatch.ts";
import { DashboardWorkspace } from "../features/dashboard/DashboardWorkspace.tsx";
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
import {
  KnowledgeWorkspace,
  type KnowledgeSummary,
} from "../features/knowledge/KnowledgeWorkspace.tsx";
import { WorkWorkspace, type WorkSummary } from "../features/workboard/WorkWorkspace.tsx";
import { SearchWorkspace, type SearchResultSummary } from "../features/search/SearchWorkspace.tsx";
import { SourcesWorkspace } from "../features/sources/SourcesWorkspace.tsx";
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
  knowledgeEntries?: readonly KnowledgeSummary[];
  workItems?: readonly WorkSummary[];
  searchResults?: readonly SearchResultSummary[];
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
  knowledgeEntries = [],
  workItems = [],
  searchResults = [],
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
    <main className="guardian-shell">
      <aside className="guardian-rail">
        <div className="guardian-brand" aria-label="Kairo Guardian wordmark">
          <img src="/guardian/icon-dark.png" alt="Guardian emblem" />
          <span>KAIRO</span>
        </div>
      <nav aria-label="Desktop workspace">
        <button aria-current={workspace.activeWorkspace === "home" ? "page" : undefined} type="button" onClick={() => navigate("home")}>Home</button>
        <button aria-current={workspace.activeWorkspace === "knowledge" ? "page" : undefined} type="button" onClick={() => navigate("knowledge")}>Knowledge</button>
        <button aria-current={workspace.activeWorkspace === "projects" ? "page" : undefined} type="button" onClick={() => navigate("projects")}>Projects</button>
        <button aria-current={workspace.activeWorkspace === "work" ? "page" : undefined} type="button" onClick={() => navigate("work")}>Work</button>
        <button aria-current={workspace.activeWorkspace === "sources" ? "page" : undefined} type="button" onClick={() => navigate("sources")}>Sources</button>
        <button aria-current={workspace.activeWorkspace === "capture" ? "page" : undefined} type="button" onClick={() => navigate("capture")}>Intake</button>
        <button aria-current={workspace.activeWorkspace === "search" ? "page" : undefined} type="button" onClick={() => navigate("search")}>Search</button>
        <button aria-current={workspace.activeWorkspace === "memory" ? "page" : undefined} type="button" onClick={() => navigate("memory")}>Memory Inbox</button>
      </nav>
      </aside>
      {workspace.activeWorkspace === "home" ? (
        <DashboardWorkspace
          projects={projects}
          workItems={workItems}
          knowledgeEntries={knowledgeEntries}
          evidenceRecords={evidenceRecords ?? []}
        />
      ) : null}
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
      {workspace.activeWorkspace === "knowledge" ? (
        <KnowledgeWorkspace entries={knowledgeEntries} onOpenEvidence={openEvidence} />
      ) : null}
      {workspace.activeWorkspace === "projects" ? (
        <ProjectsWorkspace
          projects={projects}
          requestIdForProject={nextRequestId}
          onSendCommand={sendCommand}
        />
      ) : null}
      {workspace.activeWorkspace === "work" ? (
        <WorkWorkspace items={workItems} />
      ) : null}
      {workspace.activeWorkspace === "sources" ? (
        <SourcesWorkspace records={evidenceRecords ?? []} onOpenEvidence={openEvidence} />
      ) : null}
      {workspace.activeWorkspace === "search" ? (
        <SearchWorkspace
          results={searchResults}
          createRequestId={nextRequestId}
          onSendCommand={sendCommand}
          onOpenEvidence={openEvidence}
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
