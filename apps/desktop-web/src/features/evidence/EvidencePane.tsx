export type EvidencePaneProps = {
  evidenceRef: string;
};

export function EvidencePane({ evidenceRef }: EvidencePaneProps) {
  return (
    <aside data-testid="evidence-pane" aria-label="Evidence">
      <h2>Evidence</h2>
      <div data-testid="source-anchor">{evidenceRef}</div>
    </aside>
  );
}
