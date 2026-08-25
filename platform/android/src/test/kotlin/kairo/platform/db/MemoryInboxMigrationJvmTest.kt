package kairo.platform.db

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlin.test.assertEquals

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class MemoryInboxMigrationJvmTest {

    private val context =
        ApplicationProvider.getApplicationContext<Context>()

    private val databaseName =
        "memory-inbox-migration-jvm.db"

    @After
    fun cleanUp() {
        context.deleteDatabase(databaseName)
    }

    @Test
    fun `migrates v4 memory candidates with backward compatible proposal defaults`() {
        createVersionFourFixture()

        val database = Room.databaseBuilder(
            context,
            KairoDatabase::class.java,
            databaseName,
        )
            .addMigrations(
                KairoDatabase.MIGRATION_4_5,
                KairoDatabase.MIGRATION_5_6,
                KairoDatabase.MIGRATION_6_7,
            )
            .allowMainThreadQueries()
            .build()

        val candidate = RoomMemoryInboxStore(database).pending().single().draft
        assertEquals("session-existing", candidate.sessionId.value)
        assertEquals(kairo.domain.KnowledgeScope.MANA_PRODUCTION, candidate.proposedScope)
        assertEquals(kairo.domain.EvidenceState.OBSERVED, candidate.proposedState)

        assertEquals(
            0,
            count(database, "memory_decisions"),
        )

        assertEquals(
            setOf(
                "proposed_scope",
                "proposed_state",
                "proposed_predicate",
                "proposed_object_value",
            ),
            candidateProposalColumns(database),
        )
        assertEquals(
            setOf("authority"),
            sourceAuthorityColumns(database),
        )

        database.close()
    }

    private fun createVersionFourFixture() {
        context.deleteDatabase(databaseName)

        val database = Room.databaseBuilder(
            context,
            KairoDatabase::class.java,
            databaseName,
        )
            .allowMainThreadQueries()
            .build()

        database.openHelper.writableDatabase.execSQL(
            """
            ALTER TABLE memory_candidates DROP COLUMN proposed_scope
            """.trimIndent(),
        )
        database.openHelper.writableDatabase.execSQL(
            """
            ALTER TABLE memory_candidates DROP COLUMN proposed_state
            """.trimIndent(),
        )
        database.openHelper.writableDatabase.execSQL(
            """
            ALTER TABLE memory_candidates DROP COLUMN proposed_predicate
            """.trimIndent(),
        )
        database.openHelper.writableDatabase.execSQL(
            """
            ALTER TABLE memory_candidates DROP COLUMN proposed_object_value
            """.trimIndent(),
        )
        database.openHelper.writableDatabase.execSQL(
            """
            ALTER TABLE sources DROP COLUMN authority
            """.trimIndent(),
        )
        database.openHelper.writableDatabase.execSQL(
            """
            INSERT INTO memory_candidates(
                candidate_id,
                session_id,
                subject_label,
                text
            )
            VALUES (
                'candidate-existing',
                'session-existing',
                'Existing candidate',
                'Existing candidate text'
            )
            """.trimIndent(),
        )

        database.close()

        context.openOrCreateDatabase(
            databaseName,
            Context.MODE_PRIVATE,
            null,
        ).use { db ->
            db.version = 4
        }
    }

    private fun count(
        database: KairoDatabase,
        table: String,
    ): Int =
        database.openHelper.readableDatabase
            .query("SELECT COUNT(*) FROM $table")
            .use { cursor ->
                cursor.moveToFirst()
                cursor.getInt(0)
            }

    private fun candidateProposalColumns(database: KairoDatabase): Set<String> =
        database.openHelper.readableDatabase
            .query("PRAGMA table_info(memory_candidates)")
            .use { cursor ->
                generateSequence {
                    if (cursor.moveToNext()) cursor.getString(cursor.getColumnIndexOrThrow("name")) else null
                }.filter {
                    it in setOf(
                        "proposed_scope",
                        "proposed_state",
                        "proposed_predicate",
                        "proposed_object_value",
                    )
                }.toSet()
            }

    private fun sourceAuthorityColumns(database: KairoDatabase): Set<String> =
        database.openHelper.readableDatabase
            .query("PRAGMA table_info(sources)")
            .use { cursor ->
                generateSequence {
                    if (cursor.moveToNext()) cursor.getString(cursor.getColumnIndexOrThrow("name")) else null
                }.filter { it == "authority" }.toSet()
            }
}
