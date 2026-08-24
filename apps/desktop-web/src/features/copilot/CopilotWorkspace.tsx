import type { FormEvent, MouseEvent } from "react";
import type { CoreCommandV1 } from "../../../../../shared/contracts/generated/contracts.v1.ts";

export type CopilotWorkspaceProps = {
  requestId?: string;
  onSendCommand?: (command: CoreCommandV1) => Promise<void>;
  onOpenEvidence?: (evidenceRef: string) => void;
};

export function CopilotWorkspace({
  requestId,
  onSendCommand,
  onOpenEvidence,
}: CopilotWorkspaceProps) {
  async function submitQuestion(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!requestId || !onSendCommand) return;

    const questionElement = event.currentTarget.elements.namedItem("question");
    const question =
      questionElement && "value" in questionElement
        ? String(questionElement.value)
        : "";

    await onSendCommand({
      requestId,
      type: "AskKairo",
      contractVersion: "v1",
      payload: {
        question,
      },
    });
  }

  async function deepAnalyze(event: MouseEvent<HTMLButtonElement>): Promise<void> {
    event.preventDefault();

    if (!requestId || !onSendCommand) return;

    const questionElement = event.currentTarget.form?.elements.namedItem("question");
    const question =
      questionElement && "value" in questionElement
        ? String(questionElement.value)
        : "";

    await onSendCommand({
      requestId,
      type: "DeepAnalyze",
      contractVersion: "v1",
      payload: {
        question,
      },
    });
  }

  return (
    <section data-testid="copilot-workspace" aria-label="Copilot">
      <h2>Copilot</h2>
      <form onSubmit={submitQuestion}>
        <label>
          Ask Kairo
          <input type="text" name="question" placeholder="Ask Kairo" />
        </label>
        <button type="submit">Ask Kairo</button>
        <button type="button" onClick={deepAnalyze}>Deep Analyze</button>
      </form>
      {onOpenEvidence ? (
        <button type="button" onClick={() => onOpenEvidence("evidence-1")}>
          Open evidence
        </button>
      ) : null}
    </section>
  );
}
