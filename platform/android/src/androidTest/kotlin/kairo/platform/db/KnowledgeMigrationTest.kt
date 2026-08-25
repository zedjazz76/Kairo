package kairo.platform.db

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kairo.domain.FactLineageId
import kairo.domain.SourceAuthority
import kairo.domain.SourceId
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class KnowledgeMigrationTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val databaseName = "knowledge-migration-instrumented.db"

    @After
    fun cleanUp() {
        context.deleteDatabase(databaseName)
    }

    @Test
    fun migration_preserves_authoritative_history() = runTest {
        context.deleteDatabase(databaseName)
        context.openOrCreateDatabase(databaseName, Context.MODE_PRIVATE, null).use { db ->
            createVersionOneSchema(db)
            db.execSQL("INSERT INTO content_identities(content_hash) VALUES ('hash-device')")
            db.execSQL(
                "INSERT INTO sources(source_id, origin, source_type, content_hash, imported_at, classification) " +
                    "VALUES ('source-device', 'IMPORT', 'PDF', 'hash-device', '2026-08-20T09:00:00Z', 'INTERNAL')",
            )
            db.execSQL(
                "INSERT INTO fact_versions(fact_id, lineage_id, subject, predicate, object_type, object_value, scope, evidence_state, " +
                    "effective_from, effective_to, recorded_at, last_validated_at, supersedes_fact_id) VALUES " +
                    "('fact-device', 'lineage-device', 'system-ris', 'USES', 'LITERAL', 'Merge RIS', 'MANA_PRODUCTION', " +
                    "'CONFIRMED', NULL, NULL, '2026-08-20T10:00:00Z', NULL, NULL)",
            )
            db.execSQL(
                "INSERT INTO fact_evidence(fact_id, ordinal, source_id, anchor, extraction_confidence) " +
                    "VALUES ('fact-device', 0, 'source-device', 'page-1', 0.95)",
            )
            db.execSQL(
                "INSERT INTO audit_events(audit_id, action, target_type, target_id, occurred_at, correlation_id) " +
                    "VALUES ('audit-device', 'APPEND_FACT', 'KNOWLEDGE', 'fact-device', '2026-08-20T12:00:00Z', 'correlation-device')",
            )
            db.version = 1
        }

        val database = Room.databaseBuilder(context, KairoDatabase::class.java, databaseName)
            .addMigrations(
                KairoDatabase.MIGRATION_1_2,
                KairoDatabase.MIGRATION_2_3,
                KairoDatabase.MIGRATION_3_4,
                KairoDatabase.MIGRATION_4_5,
                KairoDatabase.MIGRATION_5_6,
            )
            .build()

        val history = RoomKnowledgeRepository(database).history(FactLineageId("lineage-device"))
        assertEquals(listOf("fact-device"), history.map { it.id.value })
        assertEquals(
            SourceAuthority.UNSPECIFIED,
            RoomKnowledgeRepository(database).source(SourceId("source-device"))?.authority,
        )
        database.close()
    }

    private fun createVersionOneSchema(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE content_identities(content_hash TEXT NOT NULL, PRIMARY KEY(content_hash))")
        db.execSQL(
            """CREATE TABLE sources(
                source_id TEXT NOT NULL, origin TEXT NOT NULL, source_type TEXT NOT NULL, content_hash TEXT NOT NULL,
                imported_at TEXT NOT NULL, classification TEXT NOT NULL, PRIMARY KEY(source_id),
                FOREIGN KEY(content_hash) REFERENCES content_identities(content_hash) ON UPDATE NO ACTION ON DELETE NO ACTION
            )""".trimIndent(),
        )
        db.execSQL(
            """CREATE TABLE fact_versions(
                fact_id TEXT NOT NULL, lineage_id TEXT NOT NULL, subject TEXT NOT NULL, predicate TEXT NOT NULL,
                object_type TEXT NOT NULL, object_value TEXT NOT NULL, scope TEXT NOT NULL, evidence_state TEXT NOT NULL,
                effective_from TEXT, effective_to TEXT, recorded_at TEXT NOT NULL, last_validated_at TEXT,
                supersedes_fact_id TEXT, PRIMARY KEY(fact_id),
                FOREIGN KEY(supersedes_fact_id) REFERENCES fact_versions(fact_id) ON UPDATE NO ACTION ON DELETE NO ACTION
            )""".trimIndent(),
        )
        db.execSQL(
            """CREATE TABLE fact_evidence(
                fact_id TEXT NOT NULL, ordinal INTEGER NOT NULL, source_id TEXT NOT NULL, anchor TEXT,
                extraction_confidence REAL, PRIMARY KEY(fact_id, ordinal),
                FOREIGN KEY(fact_id) REFERENCES fact_versions(fact_id) ON UPDATE NO ACTION ON DELETE NO ACTION,
                FOREIGN KEY(source_id) REFERENCES sources(source_id) ON UPDATE NO ACTION ON DELETE NO ACTION
            )""".trimIndent(),
        )
        db.execSQL(
            """CREATE TABLE audit_events(
                audit_id TEXT NOT NULL, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL,
                occurred_at TEXT NOT NULL, correlation_id TEXT NOT NULL, PRIMARY KEY(audit_id)
            )""".trimIndent(),
        )
    }
}
