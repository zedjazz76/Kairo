import type { ChangeEvent } from "react";
import type { CoreCommandV1 } from "../../../../../shared/contracts/generated/contracts.v1.ts";
import type { CaptureBatch } from "./CaptureBatch.ts";

export type CaptureWorkspaceProps = {
  captureBatch: CaptureBatch;
  onSendCommand?: (command: CoreCommandV1) => Promise<void>;
  sourceRefForFile?: (file: File, index: number) => string;
};

export function CaptureWorkspace({
  captureBatch,
  onSendCommand,
  sourceRefForFile,
}: CaptureWorkspaceProps) {
  const stageSelectedFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.currentTarget.files ?? []);

    files.forEach((file, index) => {
      captureBatch.stage({
        sourceRef:
          sourceRefForFile?.(file, index) ??
          `browser-file-${captureBatch.items.length + 1}`,
        name: file.name,
        sizeBytes: file.size,
        mediaType: file.type,
      });
    });
  };

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
      <label>
        Add files
        <input type="file" multiple onChange={stageSelectedFiles} />
      </label>
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
