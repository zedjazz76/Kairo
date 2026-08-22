package kairo.application

import java.time.Instant
import kairo.domain.EvidenceState
import kairo.domain.KnowledgeScope
import kairo.retrieval.EvidenceBundle

sealed interface ValidationResult {
    data object Accepted : ValidationResult

    data class Rejected(
        val reasons: List<String>,
    ) : ValidationResult
}

class AnswerValidator {

    fun validate(
        answer: KairoAnswer,
        bundle: EvidenceBundle,
        at: Instant = Instant.now(),
    ): ValidationResult {
        val reasons =
            answer.claims.flatMap { claim ->
                validateClaim(
                    claim = claim,
                    bundle = bundle,
                    at = at,
                )
            }

        return if (reasons.isEmpty()) {
            ValidationResult.Accepted
        } else {
            ValidationResult.Rejected(reasons)
        }
    }

    private fun validateClaim(
        claim: AnswerClaim,
        bundle: EvidenceBundle,
        at: Instant,
    ): List<String> {
        if (claim.action == AnswerAction.PRODUCTION_WRITE) {
            return listOf(
                "Production clinical-system writes are prohibited.",
            )
        }

        if (
            claim.scope == KnowledgeScope.MANA_PRODUCTION &&
            claim.evidenceRefs.isEmpty()
        ) {
            return listOf(
                "MANA production claim has no evidence",
            )
        }

        val supportingFacts =
            bundle.rankedClaims
                .map { it.fact }
                .filter { fact ->
                    fact.evidence.any { evidence ->
                        evidence in claim.evidenceRefs
                    }
                }

        if (
            claim.scope == KnowledgeScope.MANA_PRODUCTION &&
            supportingFacts.isEmpty()
        ) {
            return listOf(
                "MANA production claim references unavailable evidence",
            )
        }

        val scopeMatched =
            supportingFacts.filter { fact ->
                fact.scope == claim.scope
            }

        if (
            supportingFacts.isNotEmpty() &&
            scopeMatched.isEmpty()
        ) {
            return listOf(
                "Claim scope is not supported by cited evidence",
            )
        }

        val temporallyApplicable =
            scopeMatched.filter { fact ->
                isApplicable(
                    fact = fact,
                    at = at,
                )
            }

        if (
            scopeMatched.isNotEmpty() &&
            temporallyApplicable.isEmpty()
        ) {
            return listOf(
                "Claim is not supported by evidence applicable at the requested time",
            )
        }

        if (
            temporallyApplicable.isNotEmpty() &&
            temporallyApplicable.none { fact ->
                fact.state.supportsActiveClaim()
            }
        ) {
            return listOf(
                "Claim is supported only by contradicted or deprecated evidence",
            )
        }

        return emptyList()
    }


    private fun EvidenceState.supportsActiveClaim(): Boolean =
        this != EvidenceState.CONTRADICTED &&
            this != EvidenceState.DEPRECATED

    private fun isApplicable(
        fact: kairo.domain.FactVersion,
        at: Instant,
    ): Boolean {
        val startsAfter =
            fact.effectiveFrom?.isAfter(at) == true

        val endedBefore =
            fact.effectiveTo?.isBefore(at) == true

        return !startsAfter && !endedBefore
    }
}
