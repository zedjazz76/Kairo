export type DesktopWorkspaceDestination =
  | "capture"
  | "copilot"
  | "memory"
  | "projects";

export class DesktopWorkspace {
  readonly destinations: DesktopWorkspaceDestination[] = [
    "capture",
    "copilot",
    "memory",
    "projects",
  ];

  activeWorkspace: DesktopWorkspaceDestination = "capture";
  activeEvidenceRef: string | null = null;
  copilotVisible = true;
  evidencePaneVisible = false;

  navigate(destination: DesktopWorkspaceDestination): void {
    this.activeWorkspace = destination;
  }

  openEvidence(evidenceRef: string): void {
    this.activeEvidenceRef = evidenceRef;
    this.evidencePaneVisible = true;
    this.copilotVisible = true;
  }
}
