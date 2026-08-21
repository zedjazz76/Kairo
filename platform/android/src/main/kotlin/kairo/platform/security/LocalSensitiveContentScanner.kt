package kairo.platform.security

import kairo.security.SensitiveContentKind
import kairo.security.SensitiveContentMatch
import kairo.security.SensitiveContentScan

class LocalSensitiveContentScanner {
    fun scan(value: String): SensitiveContentScan = SensitiveContentScan(
        patterns.flatMap { (kind, pattern) ->
            pattern.findAll(value).map { SensitiveContentMatch(kind, it.range.first, it.range.last + 1) }.toList()
        }.sortedBy { it.start },
    )

    private companion object {
        val patterns = listOf(
            SensitiveContentKind.PATIENT_NAME to Regex("(?im)\\b(?:patient\\s*(?:name)?|name)\\s*:\\s*[A-Z][a-z]+\\s+[A-Z][a-z]+"),
            SensitiveContentKind.MRN to Regex("(?im)\\bMRN\\s*:\\s*[A-Z0-9-]{4,}"),
            SensitiveContentKind.ACCESSION_NUMBER to Regex("(?im)\\baccession(?:\\s+number)?\\s*:\\s*[A-Z0-9-]{4,}"),
            SensitiveContentKind.ORDER_NUMBER to Regex("(?im)\\border(?:\\s+id|\\s+number)?\\s*:\\s*[A-Z0-9-]{4,}"),
            SensitiveContentKind.DATE_OF_BIRTH to Regex("(?im)\\bDOB\\s*:\\s*\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}"),
            SensitiveContentKind.STUDY_UID to Regex("(?im)\\bstudy(?:\\s+instance)?\\s+uid\\s*:\\s*\\d+(?:\\.\\d+){3,}"),
            SensitiveContentKind.API_KEY to Regex("(?im)\\b(?:api[_-]?key|sk-[a-z]+)\\s*[=:]\\s*[^\\s]+"),
            SensitiveContentKind.TOKEN to Regex("(?im)\\b(?:authorization\\s*:\\s*bearer|token)\\s+[^\\s]+"),
            SensitiveContentKind.PRIVATE_KEY to Regex("-----BEGIN [A-Z ]*PRIVATE KEY-----"),
            SensitiveContentKind.CREDENTIAL_URL to Regex("https?://[^\\s/@:]+:[^\\s/@]+@[^\\s/]+"),
            SensitiveContentKind.CONNECTION_STRING to Regex("(?im)(?:jdbc:[^\\s]+|(?:server|database|user\\s*id|password)\\s*=.+(?:;.+)+)"),
        )
    }
}
