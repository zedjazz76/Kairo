import type { SearchResultSummary } from "../features/search/SearchWorkspace.tsx";

export type DesktopWorkspaceDestination =
  | "home"
  | "knowledge"
  | "work"
  | "sources"
  | "capture"
  | "search"
  | "copilot"
  | "memory"
  | "projects";

export class DesktopWorkspace {
  readonly destinations: DesktopWorkspaceDestination[] = [
    "home",
    "knowledge",
    "projects",
    "work",
    "sources",
    "capture",
    "search",
    "copilot",
    "memory",
  ];

  activeWorkspace: DesktopWorkspaceDestination = "home";
  activeEvidenceRef: string | null = null;
  copilotVisible = true;
  evidencePaneVisible = false;
  private liveSearchResults: readonly SearchResultSummary[] = [];
  private receivedLiveSearchResults = false;

  get searchResults(): readonly SearchResultSummary[] {
    return this.liveSearchResults;
  }

  get hasLiveSearchResults(): boolean {
    return this.receivedLiveSearchResults;
  }

  navigate(destination: DesktopWorkspaceDestination): void {
    this.activeWorkspace = destination;
  }

  openEvidence(evidenceRef: string): void {
    this.activeEvidenceRef = evidenceRef;
    this.evidencePaneVisible = true;
    this.copilotVisible = true;
  }

  replaceSearchResults(results: readonly SearchResultSummary[]): void {
    this.liveSearchResults = [...results];
    this.receivedLiveSearchResults = true;
  }
}
