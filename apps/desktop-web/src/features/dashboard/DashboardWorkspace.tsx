import type { EvidenceInspectionRecord } from "../evidence/EvidencePane.tsx";
import type { KnowledgeSummary } from "../knowledge/KnowledgeWorkspace.tsx";
import type { ProjectSummary } from "../projects/ProjectsWorkspace.tsx";
import type { WorkSummary } from "../workboard/WorkWorkspace.tsx";

export type DashboardWorkspaceProps = {
  projects: readonly ProjectSummary[];
  workItems: readonly WorkSummary[];
  knowledgeEntries: readonly KnowledgeSummary[];
  evidenceRecords: readonly EvidenceInspectionRecord[];
};

export function DashboardWorkspace({
  projects,
  workItems,
  knowledgeEntries,
  evidenceRecords,
}: DashboardWorkspaceProps) {
  return (
    <section className="kairo-content dashboard-workspace" data-testid="home-dashboard" aria-label="Home dashboard">
      <header className="kairo-page-head">
        <div>
          <p className="kairo-eyebrow">Clinical systems command</p>
          <h1>Operational focus</h1>
          <p>Current project health, evidence-backed priorities, and the next decisions that move work forward.</p>
        </div>
        <div className="kairo-updated"><span className="status-dot" />Kairo Core connected<span>Authoritative local memory</span></div>
      </header>

      <div className="kairo-metrics" aria-label="Workspace summary">
        <article><span>Active projects</span><strong>{projects.length}</strong><small>Core-backed portfolio</small></article>
        <article><span>Open work</span><strong>{workItems.length}</strong><small>{workItems.filter((item) => item.priority === "High").length} high priority</small></article>
        <article><span>Knowledge</span><strong>{knowledgeEntries.length}</strong><small>Evidence-aware entries</small></article>
        <article className="accent"><span>Sources</span><strong>{evidenceRecords.length}</strong><small>Tracked provenance</small></article>
      </div>

      <div className="kairo-dashboard-grid">
        <section className="kairo-panel">
          <header><div><h2>Active projects</h2><p>Current portfolio and operational direction</p></div></header>
          <div className="project-list">
            {projects.length === 0 ? <p className="empty-copy">No projects loaded from Kairo Core.</p> : projects.map((project) => (
              <article className="project-row" key={project.id}>
                <span className="project-symbol">{project.name.slice(0, 2).toUpperCase()}</span>
                <div><h3>{project.name}</h3><p>{project.summary}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="kairo-panel">
          <header><div><h2>Priority work</h2><p>Items that need movement</p></div></header>
          <div className="work-list">
            {workItems.length === 0 ? <p className="empty-copy">No open work loaded.</p> : workItems.slice(0, 5).map((item) => (
              <article className="work-row" key={item.id}>
                <span className={`priority-dot ${item.priority.toLowerCase()}`} />
                <div><small>{item.id} · {item.status}</small><h3>{item.title}</h3><p>{item.nextAction ?? item.project ?? "Ready for review"}</p></div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="kairo-lower-grid">
        <section className="kairo-panel">
          <header><div><h2>Recent knowledge</h2><p>Curated operational memory</p></div></header>
          <div className="knowledge-list">
            {knowledgeEntries.length === 0 ? <p className="empty-copy">No knowledge entries loaded.</p> : knowledgeEntries.slice(0, 4).map((entry) => (
              <article key={entry.id}><div><h3>{entry.title}</h3><p>{entry.summary}</p><small>{entry.evidenceState}</small></div></article>
            ))}
          </div>
        </section>
        <section className="kairo-panel">
          <header><div><h2>Recent sources</h2><p>Original evidence remains connected</p></div></header>
          <div className="source-register">
            {evidenceRecords.length === 0 ? <p className="empty-copy">No sources loaded.</p> : evidenceRecords.slice(0, 4).map((record) => (
              <article key={record.evidenceRef}><div><h3>{record.sourceName}</h3><p>{record.anchorDescription}</p><small>{record.sourceType} · {record.classification}</small></div></article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
