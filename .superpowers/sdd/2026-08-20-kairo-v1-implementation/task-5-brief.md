### Task 5: Implement encrypted immutable Source Vault and PHI/session guard

**Files:**
- Create: `core/security/src/main/kotlin/kairo/security/SensitiveContentPolicy.kt`
- Create: `platform/android/src/main/kotlin/kairo/platform/vault/SourceVault.kt`
- Create: `platform/android/src/main/kotlin/kairo/platform/vault/EncryptedSourceVault.kt`
- Create: `platform/android/src/main/kotlin/kairo/platform/vault/KairoArchive.kt`
- Create: `platform/android/src/main/kotlin/kairo/platform/security/LocalSensitiveContentScanner.kt`
- Test: `platform/android/src/test/kotlin/kairo/platform/vault/SourceVaultTest.kt`
- Test: `platform/android/src/test/kotlin/kairo/platform/security/SensitiveContentScannerTest.kt`

**Interfaces:**
- Consumes: `Source`, `SourceVariant`, and anchors.
- Produces: `SourceVault.importDurable()`, `createDerivative()`, `open()`, `KairoArchive.exportEncrypted()`, `importEncrypted()`, `SensitiveContentDecision`, and `TemporarySessionStore.clear()`.

- [ ] **Step 1: Write failing hash, immutability, and boundary tests**

```kotlin
@Test fun `same bytes share blob but retain import records`() = runTest {
    val first = vault.importDurable(bytes, metadataA)
    val second = vault.importDurable(bytes, metadataB)
    assertEquals(first.contentHash, second.contentHash)
    assertNotEquals(first.importId, second.importId)
}

@Test fun `temporary PHI is excluded from durable vault and embedding queue`() {
    assertEquals(StorageDisposition.TEMPORARY_ONLY, policy.decide(scanWithMrn, TEMPORARY_USE))
}

@Test fun `encrypted archive round trip preserves evidence and excludes temporary sessions`() = runTest {
    val restored = archive.importEncrypted(archive.exportEncrypted(passphrase))
    assertEquals(durableEvidenceIds, restored.evidenceIds)
    assertTrue(restored.temporarySessionIds.isEmpty())
}
```

- [ ] **Step 2: Verify tests fail**

Run: `.\gradlew.bat :platform:android:testDebugUnitTest --tests "*SourceVaultTest" --tests "*SensitiveContentScannerTest"`
Expected: FAIL.

- [ ] **Step 3: Implement AES-GCM vault encryption and local scan policy**

Use an Android Keystore-wrapped master key, SHA-256 content addressing, authenticated metadata, immutable originals, explicit redacted derivatives, and a separate cache-backed temporary session store. Encrypted archives use a passphrase-derived wrapping key, authenticated manifest, per-object hashes, and an atomic validate-then-import transaction; they exclude temporary sessions. Detect names/patient-label patterns, MRN/accession/order/DOB/Study UID patterns, API keys, tokens, private keys, URLs containing credentials, and connection strings.

```kotlin
enum class UserSensitiveChoice { REDACT, TEMPORARY_USE, CANCEL }
sealed interface StorageDisposition { data object Durable : StorageDisposition; data object TemporaryOnly : StorageDisposition; data object Rejected : StorageDisposition }
```

- [ ] **Step 4: Run vault/security tests and confirm temporary cleanup**

Run: `.\gradlew.bat :platform:android:testDebugUnitTest`
Expected: PASS, including a process-restart test showing the temporary store is clearable and absent from backup manifests.

- [ ] **Step 5: Commit**

```bash
git add core/security platform/android
git commit -m "feat: add encrypted source vault and PHI boundary"
```
