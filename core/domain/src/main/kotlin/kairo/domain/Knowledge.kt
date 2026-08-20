package kairo.domain

@JvmInline
value class EntityId(val value: String) {
    init {
        require(value.isNotBlank()) { "EntityId must not be blank" }
    }
}

@JvmInline
value class FactId(val value: String) {
    init {
        require(value.isNotBlank()) { "FactId must not be blank" }
    }
}

enum class KnowledgeScope {
    MANA_PRODUCTION,
    PRODUCT,
    PROJECT,
    INCIDENT,
    EXTERNAL_RESEARCH,
}

enum class EvidenceState {
    CONFIRMED,
    OBSERVED,
    PLANNED,
    PROPOSED,
    HYPOTHESIS,
    VERIFY,
    DEPRECATED,
    CONTRADICTED,
}
