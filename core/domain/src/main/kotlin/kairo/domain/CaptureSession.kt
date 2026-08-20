package kairo.domain

import java.time.Instant

@JvmInline
value class CaptureSessionId(val value: String) {
    init {
        require(value.isNotBlank()) { "CaptureSessionId must not be blank" }
    }
}

@JvmInline
value class CaptureCandidateId(val value: String) {
    init {
        require(value.isNotBlank()) { "CaptureCandidateId must not be blank" }
    }
}

class CaptureSession(
    val id: CaptureSessionId,
    val capturedAt: Instant,
    anchors: Set<SourceAnchor>,
    val title: String? = null,
) {
    val anchors: Set<SourceAnchor> = contextSetSnapshot(anchors)

    init {
        require(title == null || title.isNotBlank()) { "Capture session title must not be blank" }
        require(this.anchors.isNotEmpty()) { "Capture session must retain at least one source anchor" }
    }
}

class CaptureCandidate private constructor(
    val id: CaptureCandidateId,
    val captureSessionId: CaptureSessionId,
    val text: String,
    val scope: KnowledgeScope,
    val state: EvidenceState,
    evidenceAnchors: Set<SourceAnchor>,
) {
    val evidenceAnchors: Set<SourceAnchor> = contextSetSnapshot(evidenceAnchors)

    init {
        require(text.isNotBlank()) { "Capture candidate text must not be blank" }
        require(evidenceAnchors.isNotEmpty()) { "Capture candidate must retain contributing source anchors" }
    }

    companion object {
        fun from(
            id: CaptureCandidateId,
            captureSession: CaptureSession,
            text: String,
            scope: KnowledgeScope,
            state: EvidenceState,
            evidenceAnchors: Set<SourceAnchor>,
        ): CaptureCandidate {
            require(captureSession.anchors.containsAll(evidenceAnchors)) {
                "Capture candidate anchors must belong to its capture session"
            }
            return CaptureCandidate(
                id = id,
                captureSessionId = captureSession.id,
                text = text,
                scope = scope,
                state = state,
                evidenceAnchors = evidenceAnchors,
            )
        }
    }
}
