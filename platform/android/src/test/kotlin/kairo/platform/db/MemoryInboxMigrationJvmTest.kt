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
    fun `migrates v3 to memory inbox schema`() {
        createVersionThreeFixture()

        val database = Room.databaseBuilder(
            context,
            KairoDatabase::class.java,
            databaseName,
        )
            .addMigrations(KairoDatabase.MIGRATION_3_4)
            .allowMainThreadQueries()
            .build()

        assertEquals(
            0,
            count(database, "memory_candidates"),
        )

        assertEquals(
            0,
            count(database, "memory_decisions"),
        )

        assertEquals(
            1,
            count(database, "ingestion_checkpoints"),
        )

        database.close()
    }

    private fun createVersionThreeFixture() {
        context.deleteDatabase(databaseName)

        val database = Room.databaseBuilder(
            context,
            KairoDatabase::class.java,
            databaseName,
        )
            .addMigrations(
                KairoDatabase.MIGRATION_1_2,
                KairoDatabase.MIGRATION_2_3,
            )
            .fallbackToDestructiveMigrationOnDowngrade()
            .allowMainThreadQueries()
            .build()

        database.openHelper.writableDatabase.execSQL(
            """
            INSERT OR REPLACE INTO ingestion_checkpoints(
                session_id,
                captured_at,
                stage,
                sensitive_choice
            )
            VALUES (
                'session-existing',
                '2026-08-22T12:00:00Z',
                'COMPLETE',
                NULL
            )
            """.trimIndent(),
        )

        database.close()

        context.openOrCreateDatabase(
            databaseName,
            Context.MODE_PRIVATE,
            null,
        ).use { db ->
            db.version = 3
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
}
