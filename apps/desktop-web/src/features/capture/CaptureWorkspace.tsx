import type { CaptureBatch } from "./CaptureBatch.ts";

export type CaptureWorkspaceProps = {
  captureBatch: CaptureBatch;
};

export function CaptureWorkspace({ captureBatch }: CaptureWorkspaceProps) {
  return (
    <section data-testid="capture-workspace" aria-label="Capture">
      <h1>Capture</h1>
      <p>Stage files for analysis by the paired Kairo Core.</p>
      <ul>
        {captureBatch.items.map((item) => (
          <li key={item.sourceRef}>{item.name}</li>
        ))}
      </ul>
    </section>
  );
}
