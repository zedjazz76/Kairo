import type { CoreCommandV1 } from "../../../../../shared/contracts/generated/contracts.v1.ts";

export type ProjectSummary = {
  id: string;
  name: string;
  summary: string;
};

export type ProjectsWorkspaceProps = {
  projects: ProjectSummary[];
  requestIdForProject: (projectId: string) => string;
  onSendCommand: (command: CoreCommandV1) => Promise<void>;
};

export function ProjectsWorkspace({
  projects,
  requestIdForProject,
  onSendCommand,
}: ProjectsWorkspaceProps) {
  return (
    <section data-testid="projects-workspace" aria-label="Projects">
      <h1>Projects</h1>
      <ul>
        {projects.map((project) => (
          <li key={project.id}>
            <h2>{project.name}</h2>
            <p>{project.summary}</p>
            <button
              type="button"
              onClick={() =>
                onSendCommand({
                  requestId: requestIdForProject(project.id),
                  type: "GetProject",
                  contractVersion: "v1",
                  payload: {
                    projectId: project.id,
                  },
                })
              }
            >
              Open
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
