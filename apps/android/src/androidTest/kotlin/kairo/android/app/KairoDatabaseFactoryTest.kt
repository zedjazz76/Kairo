package kairo.android.app

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kairo.platform.db.KairoDatabase
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class KairoDatabaseFactoryTest {

    @Test
    fun factory_opens_kairo_database() {
        val context =
            ApplicationProvider.getApplicationContext<
                android.content.Context
            >()

        val database: KairoDatabase =
            KairoDatabaseFactory.open(
                context = context,
            )

        assertNotNull(database)

        database.close()
    }
}
