package kairo.platform.db

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import java.time.Instant
import kairo.domain.FactLineageId
import kairo.domain.SourceId
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class KnowledgeMigrationJvmTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val databaseName = "knowledge-migration-jvm.db"

    @After
    fun cleanUp() {
        context.deleteDatabase(databaseName)
    }

    @Test
    fun `migrates v1 to v2`() = runTest {
        createVersionOneFixture()

        val database = Room.databaseBuilder(context, KairoDatabase::class.java, databaseName)
            .addMigrations(KairoDatabase.MIGRATION_1_2)
            .allowMainThreadQueries()
            .build()
        val repository = RoomKnowledgeRepository(database)

        val history = repository.history(FactLineageId("lineage-migration"))
        assertEquals(1, history.size)
        assertEquals("fact-migration", history.single().id.value)
        assertEquals("MANA_PRODUCTION", history.single().scope.name)
        assertEquals("source-migration", history.single().evidence.single().sourceId)
        assertEquals("hash-migration", assertNotNull(repository.source(SourceId("source-migration"))).contentHash)
        assertEquals(1, count(database, "audit_events", "audit_id = 'audit-migration'"))
        assertEquals(1, count(database, "fact_evidence", "fact_id = 'fact-migration'"))
        database.close()
    }

    private fun createVersionOneFixture() {
        context.deleteDatabase(databaseName)
        context.openOrCreateDatabase(databaseName, Context.MODE_PRIVATE, null).use { db ->
            createVersionOneSchema(db)
            db.execSQL("INSERT INTO content_identities(content_hash) VALUES ('hash-migration')")
            db.execSQL(
                "INSERT INTO sources(source_id, origin, source_type, content_hash, imported_at, classification) " +
                    "VALUES ('source-migration', 'IMPORT', 'PDF', 'hash-migration', '2026-08-20T09:00:00Z', 'INTERNAL')",
            )
            db.execSQL(
                "INSERT INTO fact_versions(fact_id, lineage_id, subject, predicate, object_type, object_value, scope, evidence_state, " +
                    "effective_from, effective_to, recorded_at, last_validated_at, supersedes_fact_id) VALUES " +
                    "('fact-migration', 'lineage-migration', 'system-ris', 'USES', 'LITERAL', 'Merge RIS', 'MANA_PRODUCTION', " +
                    "'CONFIRMED', '2026-01-01T00:00:00Z', NULL, '2026-08-20T10:00:00Z', '2026-08-20T11:00:00Z', NULL)",
            )
            db.execSQL(
                "INSERT INTO fact_evidence(fact_id, ordinal, source_id, anchor, extraction_confidence) " +
                    "VALUES ('fact-migration', 0, 'source-migration', 'page-1', 0.95)",
            )
            db.execSQL(
                "INSERT INTO audit_events(audit_id, action, target_type, target_id, occurred_at, correlation_id) " +
                    "VALUES ('audit-migration', 'APPEND_FACT', 'KNOWLEDGE', 'fact-migration', '2026-08-20T12:00:00Z', 'correlation-migration')",
            )
            db.version = 1
        }
    }

    private fun count(database: KairoDatabase, table: String, where: String): Int =
        database.openHelper.readableDatabase.query("SELECT COUNT(*) FROM $table WHERE $where").use { cursor ->
            cursor.moveToFirst()
            cursor.getInt(0)
        }

    private fun createVersionOneSchema(db: SQLiteDatabase) {
        createVersionOneTables(db)
    }
}

private fun createVersionOneTables(db: SQLiteDatabase) {
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
