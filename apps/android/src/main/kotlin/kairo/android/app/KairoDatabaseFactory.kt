package kairo.android.app

import android.content.Context
import androidx.room.Room
import kairo.platform.db.KairoDatabase

object KairoDatabaseFactory {

    fun open(
        context: Context,
    ): KairoDatabase =
        Room.databaseBuilder(
            context.applicationContext,
            KairoDatabase::class.java,
            "kairo.db",
        )
            .addMigrations(
                KairoDatabase.MIGRATION_1_2,
                KairoDatabase.MIGRATION_2_3,
                KairoDatabase.MIGRATION_3_4,
                KairoDatabase.MIGRATION_4_5,
                KairoDatabase.MIGRATION_5_6,
                KairoDatabase.MIGRATION_6_7,
                KairoDatabase.MIGRATION_7_8,
            )
            .build()
}
