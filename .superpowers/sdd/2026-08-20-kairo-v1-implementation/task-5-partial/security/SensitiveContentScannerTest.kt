package kairo.platform.security

import kairo.security.SensitiveContentKind
import kairo.security.SensitiveContentPolicy
import kairo.security.StorageDisposition
import kairo.security.UserSensitiveChoice
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SensitiveContentScannerTest {
    private val scanner = LocalSensitiveContentScanner()
    private val policy = SensitiveContentPolicy()

    @Test
    fun `scanner detects patient identifiers and labeled names locally`() {
        val scan = scanner.scan(
            """
            Patient Name: Jane Doe
            MRN: 12345678
            Accession Number: ACC-778899
            Order ID: ORD-991122
            DOB: 03/14/1982
            Study Instance UID: 1.2.840.113619.2.55.3.604688123.123.1599752123.467
            """.trimIndent(),
        )

        assertEquals(
            setOf(
                SensitiveContentKind.PATIENT_NAME,
                SensitiveContentKind.MRN,
                SensitiveContentKind.ACCESSION_NUMBER,
                SensitiveContentKind.ORDER_NUMBER,
                SensitiveContentKind.DATE_OF_BIRTH,
                SensitiveContentKind.STUDY_UID,
            ),
            scan.matches.mapTo(linkedSetOf()) { it.kind },
        )
        assertTrue(scan.containsLikelyPhi)
    }

    @Test
    fun `scanner detects secrets private keys credential URLs and connection strings`() {
        val syntheticApiKey = "sk-proj-" + "abcdefghijklmnop123456"
        val scan = scanner.scan(
            """
            api_key=$syntheticApiKey
            Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature
            -----BEGIN PRIVATE KEY-----
            https://admin:secret@example.internal/path
            jdbc:postgresql://db.internal/kairo?user=svc&password=secret
            Server=db.internal;Database=RIS;User Id=svc;Password=secret;
            """.trimIndent(),
        )

        assertEquals(
            setOf(
                SensitiveContentKind.API_KEY,
                SensitiveContentKind.TOKEN,
                SensitiveContentKind.PRIVATE_KEY,
                SensitiveContentKind.CREDENTIAL_URL,
                SensitiveContentKind.CONNECTION_STRING,
            ),
            scan.matches.mapTo(linkedSetOf()) { it.kind },
        )
        assertTrue(scan.containsCredential)
    }

    @Test
    fun `temporary choice blocks durable embedding backup and external reasoning`() {
        val scan = scanner.scan("MRN: 12345678")

        assertEquals(
            StorageDisposition.TEMPORARY_ONLY,
            policy.decide(scan, UserSensitiveChoice.TEMPORARY_USE),
        )
        val decision = policy.evaluate(scan, UserSensitiveChoice.TEMPORARY_USE)
        assertFalse(decision.mayEnterDurableVault)
        assertFalse(decision.mayEnterEmbeddingQueue)
        assertFalse(decision.mayEnterBackupOrArchive)
        assertFalse(decision.mayEnterExternalReasoning)
    }

    @Test
    fun `redaction permits only a sanitized derivative and cancel rejects processing`() {
        val scan = scanner.scan("Patient: Jane Doe, MRN: 12345678")

        val redact = policy.evaluate(scan, UserSensitiveChoice.REDACT)
        val cancel = policy.evaluate(scan, UserSensitiveChoice.CANCEL)

        assertEquals(StorageDisposition.DURABLE, redact.disposition)
        assertTrue(redact.requiresRedactedDerivative)
        assertTrue(redact.mayEnterEmbeddingQueue)
        assertEquals(StorageDisposition.REJECTED, cancel.disposition)
        assertFalse(cancel.mayEnterDurableVault)
        assertFalse(cancel.mayEnterExternalReasoning)
    }

    @Test
    fun `non sensitive content can enter durable processing without redaction`() {
        val decision = policy.evaluate(
            scanner.scan("Merge PACS routes DMWL traffic to the modality."),
            UserSensitiveChoice.REDACT,
        )

        assertFalse(decision.scan.hasSensitiveContent)
        assertFalse(decision.requiresRedactedDerivative)
        assertTrue(decision.mayEnterDurableVault)
        assertTrue(decision.mayEnterEmbeddingQueue)
        assertTrue(decision.mayEnterBackupOrArchive)
        assertTrue(decision.mayEnterExternalReasoning)
    }
}
