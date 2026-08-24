import type { CoreCommandV1 } from "../../../../../shared/contracts/generated/contracts.v1.ts";

export type MemoryCandidate = {
  id: string;
  summary: string;
};

export type MemoryInboxProps = {
  candidates: readonly MemoryCandidate[];
  requestIdForCandidate: (candidateId: string) => string;
  onSendCommand: (command: CoreCommandV1) => Promise<void>;
};

export function MemoryInbox({
  candidates,
  requestIdForCandidate,
  onSendCommand,
}: MemoryInboxProps) {
  return (
    <section data-testid="memory-inbox" aria-label="Memory Inbox">
      <h2>Memory Inbox</h2>
      <ul>
        {candidates.map((candidate) => (
          <li key={candidate.id}>
            <p>{candidate.summary}</p>
            <button
              type="button"
              onClick={() =>
                onSendCommand({
                  requestId: requestIdForCandidate(candidate.id),
                  type: "ReviewMemoryCandidate",
                  contractVersion: "v1",
                  payload: {
                    candidateId: candidate.id,
                  },
                })
              }
            >
              Review
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
