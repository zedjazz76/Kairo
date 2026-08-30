export type WorkSummary = {
  id: string;
  title: string;
  status: string;
  priority: string;
  project?: string;
  nextAction?: string;
};

export function WorkWorkspace({ items }: { items: readonly WorkSummary[] }) {
  const statuses = ["New", "Triaged", "In Progress", "Waiting", "Ready to Retest"];
  return (
    <section className="kairo-content" data-testid="work-workspace" aria-label="Work">
      <header className="kairo-page-head"><div><p className="kairo-eyebrow">Unified work model</p><h1>Workboard</h1><p>Defects, tasks, incidents, testing, discovery, and follow-ups in one system.</p></div></header>
      <div className="workboard">
        {statuses.map((status) => <section className="work-column" key={status}><header><h2>{status}</h2><span>{items.filter((item) => item.status === status).length}</span></header>{items.filter((item) => item.status === status).map((item) => <article className="work-card" key={item.id}><small>{item.id} · {item.priority}</small><h3>{item.title}</h3><p>{item.nextAction ?? item.project ?? "No next action recorded"}</p></article>)}</section>)}
      </div>
    </section>
  );
}
