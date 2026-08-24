export type CopilotWorkspaceProps = {
  onOpenEvidence?: (evidenceRef: string) => void;
};

export function CopilotWorkspace({ onOpenEvidence }: CopilotWorkspaceProps) {
  return (
    <section data-testid="copilot-workspace" aria-label="Copilot">
      <h2>Copilot</h2>
      <label>
        Ask Kairo
        <input type="text" name="question" placeholder="Ask Kairo" />
      </label>
      {onOpenEvidence ? (
        <button type="button" onClick={() => onOpenEvidence("evidence-1")}>
          Open evidence
        </button>
      ) : null}
    </section>
  );
}
