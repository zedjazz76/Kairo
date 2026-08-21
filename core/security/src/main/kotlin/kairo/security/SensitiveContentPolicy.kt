package kairo.security

enum class SensitiveContentKind {
    PATIENT_NAME,
    MRN,
    ACCESSION_NUMBER,
    ORDER_NUMBER,
    DATE_OF_BIRTH,
    STUDY_UID,
    API_KEY,
    TOKEN,
    PRIVATE_KEY,
    CREDENTIAL_URL,
    CONNECTION_STRING,
}

data class SensitiveContentMatch(
    val kind: SensitiveContentKind,
    val start: Int,
    val end: Int,
)

data class SensitiveContentScan(val matches: List<SensitiveContentMatch>) {
    val hasSensitiveContent: Boolean get() = matches.isNotEmpty()
    val containsLikelyPhi: Boolean get() = matches.any { it.kind in phiKinds }
    val containsCredential: Boolean get() = matches.any { it.kind in credentialKinds }

    private companion object {
        val phiKinds = setOf(
            SensitiveContentKind.PATIENT_NAME,
            SensitiveContentKind.MRN,
            SensitiveContentKind.ACCESSION_NUMBER,
            SensitiveContentKind.ORDER_NUMBER,
            SensitiveContentKind.DATE_OF_BIRTH,
            SensitiveContentKind.STUDY_UID,
        )
        val credentialKinds = setOf(
            SensitiveContentKind.API_KEY,
            SensitiveContentKind.TOKEN,
            SensitiveContentKind.PRIVATE_KEY,
            SensitiveContentKind.CREDENTIAL_URL,
            SensitiveContentKind.CONNECTION_STRING,
        )
    }
}

enum class UserSensitiveChoice { REDACT, TEMPORARY_USE, CANCEL }

sealed interface StorageDisposition {
    data object Durable : StorageDisposition
    data object TemporaryOnly : StorageDisposition
    data object Rejected : StorageDisposition

    companion object {
        val DURABLE: StorageDisposition get() = Durable
        val TEMPORARY_ONLY: StorageDisposition get() = TemporaryOnly
        val REJECTED: StorageDisposition get() = Rejected
    }
}

data class SensitiveContentDecision(
    val scan: SensitiveContentScan,
    val disposition: StorageDisposition,
    val requiresRedactedDerivative: Boolean,
    val mayEnterDurableVault: Boolean,
    val mayEnterEmbeddingQueue: Boolean,
    val mayEnterBackupOrArchive: Boolean,
    val mayEnterExternalReasoning: Boolean,
)

class SensitiveContentPolicy {
    fun decide(scan: SensitiveContentScan, choice: UserSensitiveChoice): StorageDisposition =
        evaluate(scan, choice).disposition

    fun evaluate(scan: SensitiveContentScan, choice: UserSensitiveChoice): SensitiveContentDecision = when {
        choice == UserSensitiveChoice.CANCEL -> SensitiveContentDecision(
            scan, StorageDisposition.Rejected, false, false, false, false, false,
        )
        scan.hasSensitiveContent && choice == UserSensitiveChoice.TEMPORARY_USE -> SensitiveContentDecision(
            scan, StorageDisposition.TemporaryOnly, false, false, false, false, false,
        )
        scan.hasSensitiveContent -> SensitiveContentDecision(
            scan, StorageDisposition.Durable, true, true, true, true, true,
        )
        else -> SensitiveContentDecision(
            scan, StorageDisposition.Durable, false, true, true, true, true,
        )
    }
}
