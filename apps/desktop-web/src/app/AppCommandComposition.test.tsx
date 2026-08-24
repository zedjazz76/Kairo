import assert from "node:assert/strict";
import test from "node:test";
import type { ReactElement, ReactNode } from "react";
import type { CoreCommandV1 } from "../../../../shared/contracts/generated/contracts.v1.ts";
import { CaptureBatch } from "../features/capture/CaptureBatch.ts";
import { MemoryInbox } from "../features/memory/MemoryInbox.tsx";
import { ProjectsWorkspace } from "../features/projects/ProjectsWorkspace.tsx";
import { App } from "./App.tsx";
import { DesktopWorkspace } from "./DesktopWorkspace.ts";

function childOfType(node: ReactNode, type: ReactElement["type"]): ReactElement | undefined {
  const children = (node as ReactElement).props.children;
  const list = Array.isArray(children) ? children : [children];
  return list.find((child: ReactElement | null) => child?.type === type);
}

test("desktop shell routes Memory and Projects through the same paired command sender", async () => {
  const sent: CoreCommandV1[] = [];
  const commandSender = {
    connectionState: "CONNECTED" as const,
    send: async (command: CoreCommandV1) => {
      sent.push(command);
    },
    disconnect: async () => {},
  };
  const createRequestId = () => "f0a36846-8b3c-479f-9d52-1b737f57a495";
  const workspace = new DesktopWorkspace();
  const appProps = {
    captureBatch: new CaptureBatch({ captureSessionId: "capture-1" }),
    commandSender,
    createRequestId,
    memoryCandidates: [{ id: "candidate-1", summary: "Review routing observation" }],
    projects: [{ id: "project-abbadox", name: "AbbaDox", summary: "RIS transition" }],
  };

  workspace.navigate("memory");
  const memoryApp = App({ workspace, ...appProps } as never) as ReactElement;
  const memory = childOfType(memoryApp, MemoryInbox);
  assert.ok(memory, "Memory Inbox should be active in the desktop shell");
  await memory.props.onSendCommand({
    requestId: memory.props.requestIdForCandidate("candidate-1"),
    type: "ReviewMemoryCandidate",
    contractVersion: "v1",
    payload: { candidateId: "candidate-1" },
  });

  workspace.navigate("projects");
  const projectsApp = App({ workspace, ...appProps } as never) as ReactElement;
  const projects = childOfType(projectsApp, ProjectsWorkspace);
  assert.ok(projects, "Projects should be active in the desktop shell");
  await projects.props.onSendCommand({
    requestId: projects.props.requestIdForProject("project-abbadox"),
    type: "GetProject",
    contractVersion: "v1",
    payload: { projectId: "project-abbadox" },
  });

  assert.deepEqual(sent, [
    {
      requestId: "f0a36846-8b3c-479f-9d52-1b737f57a495",
      type: "ReviewMemoryCandidate",
      contractVersion: "v1",
      payload: { candidateId: "candidate-1" },
    },
    {
      requestId: "f0a36846-8b3c-479f-9d52-1b737f57a495",
      type: "GetProject",
      contractVersion: "v1",
      payload: { projectId: "project-abbadox" },
    },
  ]);
});
