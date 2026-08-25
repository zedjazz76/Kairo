package kairo.platform.db

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        ContentIdentityEntity::class,
        SourceEntity::class,
        SourceVariantEntity::class,
        SourceAnchorEntity::class,
        FactVersionEntity::class,
        FactEvidenceEntity::class,
        CaptureSessionEntity::class,
        CaptureSessionAnchorEntity::class,
        AuditEventEntity::class,
        IngestionCheckpointEntity::class,
        IngestionCheckpointArtifactEntity::class,
        MemoryCandidateEntity::class,
        MemoryDecisionEntity::class,
        MemoryCandidateAnchorEntity::class,
    ],
    version = 6,
    exportSchema = true,
)
abstract class KairoDatabase : RoomDatabase() {
    abstract fun knowledgeDao(): KnowledgeDao
    abstract fun ingestionCheckpointDao(): IngestionCheckpointDao
    abstract fun memoryInboxDao(): MemoryInboxDao

    companion object {
        @JvmField
        val MIGRATION_1_2: Migration = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """CREATE TABLE IF NOT EXISTS `source_variants` (
                        `variant_id` TEXT NOT NULL,
                        `source_id` TEXT NOT NULL,
                        `version` INTEGER NOT NULL,
                        `content_hash` TEXT NOT NULL,
                        `imported_at` TEXT NOT NULL,
                        `parent_variant_id` TEXT,
                        `extraction_status` TEXT NOT NULL,
                        PRIMARY KEY(`variant_id`),
                        FOREIGN KEY(`source_id`) REFERENCES `sources`(`source_id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
                        FOREIGN KEY(`content_hash`) REFERENCES `content_identities`(`content_hash`) ON UPDATE NO ACTION ON DELETE NO ACTION,
                        FOREIGN KEY(`parent_variant_id`) REFERENCES `source_variants`(`variant_id`) ON UPDATE NO ACTION ON DELETE NO ACTION
                    )""".trimIndent(),
                )
                db.execSQL(
                    """INSERT INTO `source_variants` (
                        `variant_id`, `source_id`, `version`, `content_hash`, `imported_at`, `parent_variant_id`, `extraction_status`
                    ) SELECT `source_id` || ':v1', `source_id`, 1, `content_hash`, `imported_at`, NULL, 'NOT_REQUESTED' FROM `sources`""".trimIndent(),
                )
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_source_variants_source_id_version` ON `source_variants` (`source_id`, `version`)")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_source_variants_source_id_variant_id` ON `source_variants` (`source_id`, `variant_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_source_variants_source_id` ON `source_variants` (`source_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_source_variants_content_hash` ON `source_variants` (`content_hash`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_source_variants_parent_variant_id` ON `source_variants` (`parent_variant_id`)")
                db.execSQL(
                    """CREATE TABLE IF NOT EXISTS `source_anchors` (
                        `source_id` TEXT NOT NULL,
                        `variant_id` TEXT NOT NULL,
                        `anchor_key` TEXT NOT NULL,
                        `locator_type` TEXT NOT NULL,
                        `page` INTEGER,
                        `left` REAL,
                        `top` REAL,
                        `right` REAL,
                        `bottom` REAL,
                        `width` INTEGER,
                        `height` INTEGER,
                        `sheet` TEXT,
                        `first_row` INTEGER,
                        `first_column` INTEGER,
                        `last_row` INTEGER,
                        `last_column` INTEGER,
                        `start_offset` INTEGER,
                        `end_offset` INTEGER,
                        `conversation_id` TEXT,
                        `turn_number` INTEGER,
                        PRIMARY KEY(`source_id`, `variant_id`, `anchor_key`),
                        FOREIGN KEY(`source_id`, `variant_id`) REFERENCES `source_variants`(`source_id`, `variant_id`) ON UPDATE NO ACTION ON DELETE NO ACTION
                    )""".trimIndent(),
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_source_anchors_variant_id` ON `source_anchors` (`variant_id`)")
                db.execSQL(
                    """CREATE TABLE IF NOT EXISTS `capture_sessions` (
                        `capture_session_id` TEXT NOT NULL,
                        `captured_at` TEXT NOT NULL,
                        `title` TEXT,
                        PRIMARY KEY(`capture_session_id`)
                    )""".trimIndent(),
                )
                db.execSQL(
                    """CREATE TABLE IF NOT EXISTS `capture_session_anchors` (
                        `capture_session_id` TEXT NOT NULL,
                        `source_id` TEXT NOT NULL,
                        `variant_id` TEXT NOT NULL,
                        `anchor_key` TEXT NOT NULL,
                        `locator_type` TEXT NOT NULL,
                        `page` INTEGER,
                        `left` REAL,
                        `top` REAL,
                        `right` REAL,
                        `bottom` REAL,
                        `width` INTEGER,
                        `height` INTEGER,
                        `sheet` TEXT,
                        `first_row` INTEGER,
                        `first_column` INTEGER,
                        `last_row` INTEGER,
                        `last_column` INTEGER,
                        `start_offset` INTEGER,
                        `end_offset` INTEGER,
                        `conversation_id` TEXT,
                        `turn_number` INTEGER,
                        PRIMARY KEY(`capture_session_id`, `source_id`, `variant_id`, `anchor_key`),
                        FOREIGN KEY(`capture_session_id`) REFERENCES `capture_sessions`(`capture_session_id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
                        FOREIGN KEY(`source_id`, `variant_id`) REFERENCES `source_variants`(`source_id`, `variant_id`) ON UPDATE NO ACTION ON DELETE NO ACTION
                    )""".trimIndent(),
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_capture_session_anchors_source_id` ON `capture_session_anchors` (`source_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_capture_session_anchors_variant_id` ON `capture_session_anchors` (`variant_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_capture_session_anchors_source_id_variant_id` ON `capture_session_anchors` (`source_id`, `variant_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_sources_content_hash` ON `sources` (`content_hash`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_sources_origin_source_type` ON `sources` (`origin`, `source_type`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_fact_versions_subject_predicate_object_type_object_value` ON `fact_versions` (`subject`, `predicate`, `object_type`, `object_value`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_fact_versions_scope` ON `fact_versions` (`scope`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_fact_versions_evidence_state` ON `fact_versions` (`evidence_state`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_fact_versions_effective_from` ON `fact_versions` (`effective_from`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_fact_versions_recorded_at` ON `fact_versions` (`recorded_at`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_fact_versions_lineage_id` ON `fact_versions` (`lineage_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_fact_versions_supersedes_fact_id` ON `fact_versions` (`supersedes_fact_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_fact_evidence_source_id` ON `fact_evidence` (`source_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_audit_events_correlation_id` ON `audit_events` (`correlation_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_audit_events_target_type_target_id` ON `audit_events` (`target_type`, `target_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_audit_events_occurred_at` ON `audit_events` (`occurred_at`)")
            }
        }
        @JvmField val MIGRATION_2_3: Migration = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("CREATE TABLE IF NOT EXISTS ingestion_checkpoints (session_id TEXT NOT NULL PRIMARY KEY, captured_at TEXT NOT NULL, stage TEXT NOT NULL, sensitive_choice TEXT)")
                db.execSQL("CREATE TABLE IF NOT EXISTS ingestion_checkpoint_artifacts (session_id TEXT NOT NULL, source_id TEXT NOT NULL, variant_id TEXT NOT NULL, file_name TEXT NOT NULL, media_type TEXT, payload_ref TEXT NOT NULL, extraction_ref TEXT, PRIMARY KEY(session_id, variant_id))")
            }
        }

        @JvmField val MIGRATION_3_4: Migration = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS memory_candidates (
                        candidate_id TEXT NOT NULL PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        subject_label TEXT NOT NULL,
                        text TEXT NOT NULL
                    )
                    """.trimIndent(),
                )

                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS memory_decisions (
                        decision_id TEXT NOT NULL PRIMARY KEY,
                        candidate_id TEXT NOT NULL,
                        decision_type TEXT NOT NULL,
                        reviewer TEXT NOT NULL,
                        decided_at TEXT NOT NULL,
                        original_text TEXT,
                        approved_text TEXT
                    )
                    """.trimIndent(),
                )

                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS memory_candidate_anchors (
                        candidate_id TEXT NOT NULL,
                        ordinal INTEGER NOT NULL,
                        source_id TEXT NOT NULL,
                        variant_id TEXT NOT NULL,
                        locator_type TEXT NOT NULL,
                        page INTEGER,
                        left REAL,
                        top REAL,
                        right REAL,
                        bottom REAL,
                        width INTEGER,
                        height INTEGER,
                        sheet TEXT,
                        first_row INTEGER,
                        first_column INTEGER,
                        last_row INTEGER,
                        last_column INTEGER,
                        start_offset INTEGER,
                        end_offset INTEGER,
                        conversation_id TEXT,
                        turn_number INTEGER,
                        PRIMARY KEY(candidate_id, ordinal)
                    )
                    """.trimIndent(),
                )
            }
        }

        @JvmField val MIGRATION_4_5: Migration = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "ALTER TABLE memory_candidates ADD COLUMN proposed_scope TEXT NOT NULL DEFAULT 'MANA_PRODUCTION'",
                )
                db.execSQL(
                    "ALTER TABLE memory_candidates ADD COLUMN proposed_state TEXT NOT NULL DEFAULT 'OBSERVED'",
                )
            }
        }

        @JvmField val MIGRATION_5_6: Migration = object : Migration(5, 6) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "ALTER TABLE sources ADD COLUMN authority TEXT NOT NULL DEFAULT 'UNSPECIFIED'",
                )
            }
        }
    }
}

@Dao
interface KnowledgeDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertContentIdentities(rows: List<ContentIdentityEntity>)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSource(row: SourceEntity)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSourceVariants(rows: List<SourceVariantEntity>)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertSourceAnchors(rows: List<SourceAnchorEntity>)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertFact(row: FactVersionEntity)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertFactEvidence(rows: List<FactEvidenceEntity>)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertCaptureSession(row: CaptureSessionEntity)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertCaptureSessionAnchors(rows: List<CaptureSessionAnchorEntity>)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertAuditEvent(row: AuditEventEntity)

    @Query("SELECT * FROM fact_versions WHERE fact_id = :factId")
    suspend fun fact(factId: String): FactVersionEntity?

    @Query("SELECT * FROM fact_versions WHERE lineage_id = :lineageId ORDER BY recorded_at, fact_id")
    suspend fun history(lineageId: String): List<FactVersionEntity>

    @Query("SELECT * FROM fact_versions ORDER BY recorded_at, fact_id")
    suspend fun factsForProjection(): List<FactVersionEntity>

    @Query("SELECT * FROM fact_evidence WHERE fact_id = :factId ORDER BY ordinal")
    suspend fun evidenceForFact(factId: String): List<FactEvidenceEntity>

    @Query("SELECT * FROM sources WHERE source_id = :sourceId")
    suspend fun source(sourceId: String): SourceEntity?

    @Query("SELECT * FROM source_variants WHERE source_id = :sourceId ORDER BY version, variant_id")
    suspend fun sourceVariants(sourceId: String): List<SourceVariantEntity>

    @Query("SELECT * FROM source_anchors WHERE source_id = :sourceId ORDER BY variant_id, anchor_key")
    suspend fun sourceAnchors(sourceId: String): List<SourceAnchorEntity>

    @Query("SELECT * FROM capture_sessions WHERE capture_session_id = :captureSessionId")
    suspend fun captureSession(captureSessionId: String): CaptureSessionEntity?

    @Query("SELECT * FROM capture_session_anchors WHERE capture_session_id = :captureSessionId ORDER BY source_id, variant_id, anchor_key")
    suspend fun captureSessionAnchors(captureSessionId: String): List<CaptureSessionAnchorEntity>
}

@Dao
interface IngestionCheckpointDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE) fun save(checkpoint: IngestionCheckpointEntity)
    @Insert(onConflict = OnConflictStrategy.REPLACE) fun saveArtifacts(rows: List<IngestionCheckpointArtifactEntity>)
    @Query("DELETE FROM ingestion_checkpoint_artifacts WHERE session_id = :sessionId") fun deleteArtifacts(sessionId: String)
    @Query("SELECT * FROM ingestion_checkpoints WHERE session_id = :sessionId") fun checkpoint(sessionId: String): IngestionCheckpointEntity?
    @Query("SELECT * FROM ingestion_checkpoint_artifacts WHERE session_id = :sessionId ORDER BY variant_id") fun artifacts(sessionId: String): List<IngestionCheckpointArtifactEntity>
}


@Dao
interface MemoryInboxDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun saveCandidate(row: MemoryCandidateEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun saveCandidateAnchors(rows: List<MemoryCandidateAnchorEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun saveDecision(row: MemoryDecisionEntity)

    @Query("DELETE FROM memory_candidates WHERE candidate_id = :candidateId")
    fun deleteCandidate(candidateId: String)

    @Query("DELETE FROM memory_candidate_anchors WHERE candidate_id = :candidateId")
    fun deleteCandidateAnchors(candidateId: String)

    @Query("SELECT * FROM memory_candidates ORDER BY candidate_id")
    fun candidates(): List<MemoryCandidateEntity>

    @Query(
        "SELECT * FROM memory_candidate_anchors " +
            "WHERE candidate_id = :candidateId ORDER BY ordinal"
    )
    fun anchors(candidateId: String): List<MemoryCandidateAnchorEntity>

    @Query("SELECT * FROM memory_decisions ORDER BY decided_at, decision_id")
    fun decisions(): List<MemoryDecisionEntity>
}
