import type { CoreCommandV1 } from "../../../../../shared/contracts/generated/contracts.v1.ts";
import type { CaptureBatch } from "./CaptureBatch.ts";

export type CaptureWorkspaceProps = {
  captureBatch: CaptureBatch;
  onSendCommand?: (command: CoreCommandV1) => Promise<void>;
};

export function CaptureWorkspace({
  captureBatch,
  onSendCommand,
}: CaptureWorkspaceProps) {
  const analyzeTogether = async (): Promise<void> => {
    if (!onSendCommand) return;

    for (const command of captureBatch.commands()) {
      await onSendCommand(command);
    }
  };

  return (
    <section data-testid="capture-workspace" aria-label="Capture">
      <h1>Capture</h1>
      <p>Stage files for analysis by the paired Kairo Core.</p>
      <ul>
        {captureBatch.items.map((item) => (
          <li key={item.sourceRef}>{item.name}</li>
        ))}
      </ul>
      <button type="button" onClick={analyzeTogether}>
        Analyze together
      </button>
    </section>
  );
}
