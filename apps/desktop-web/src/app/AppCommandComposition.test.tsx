import assert from "node:assert/strict";
import test from "node:test";
import type { ReactElement, ReactNode } from "react";
import type {
  CoreCommandV1,
  CoreResultV1,
} from "../../../../shared/contracts/generated/contracts.v1.ts";
import { CaptureBatch } from "../features/capture/CaptureBatch.ts";
import { MemoryInbox } from "../features/memory/MemoryInbox.tsx";
import { ProjectsWorkspace } from "../features/projects/ProjectsWorkspace.tsx";
import { SearchWorkspace } from "../features/search/SearchWorkspace.tsx";
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
    request: async () => {
      throw new Error("request_not_expected");
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

test("desktop shell stores live Search results returned by the paired Core request path", async () => {
  const requested: CoreCommandV1[] = [];
  const result: CoreResultV1 = {
    requestId: "81d0bab9-6025-42ef-bf74-7d9793822f78",
    type: "SearchKnowledge",
    contractVersion: "v1",
    status: "SUCCESS",
    data: { resultRefs: ["conversation-routing"] },
  };
  const commandSender = {
    connectionState: "CONNECTED" as const,
    send: async () => {},
    request: async (command: CoreCommandV1) => {
      requested.push(command);
      return result;
    },
    disconnect: async () => {},
  };
  const workspace = new DesktopWorkspace();
  workspace.navigate("search");
  let refreshes = 0;
  const app = App({
    workspace,
    captureBatch: new CaptureBatch({ captureSessionId: "capture-1" }),
    commandSender,
    createRequestId: () => result.requestId,
    onWorkspaceChange: () => {
      refreshes += 1;
    },
  }) as ReactElement;
  const search = childOfType(app, SearchWorkspace);
  assert.ok(search);
  const command: CoreCommandV1 = {
    requestId: result.requestId,
    type: "SearchKnowledge",
    contractVersion: "v1",
    payload: { query: "routing" },
  };

  assert.deepEqual(await search.props.onRequestCommand(command), result);
  search.props.onResults([
    {
      id: "conversation-routing",
      kind: "Conversation",
      title: "conversation-routing",
      summary: "Returned by Kairo Core",
      evidenceRef: "conversation-routing",
    },
  ]);

  assert.deepEqual(requested, [command]);
  assert.equal(workspace.hasLiveSearchResults, true);
  assert.equal(refreshes, 1);

  const refreshedApp = App({
    workspace,
    captureBatch: new CaptureBatch({ captureSessionId: "capture-1" }),
    commandSender,
    createRequestId: () => result.requestId,
  }) as ReactElement;
  const refreshedSearch = childOfType(refreshedApp, SearchWorkspace);
  assert.deepEqual(refreshedSearch?.props.results, workspace.searchResults);
});
