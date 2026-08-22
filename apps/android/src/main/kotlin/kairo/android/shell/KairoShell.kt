package kairo.android.shell

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import kairo.android.offline.ConnectivityCapability

@Composable
fun KairoShell(
    connectivity: ConnectivityCapability,
) {
    val offline =
        connectivity == ConnectivityCapability.Offline

    Column {
        if (offline) {
            Text("Offline mode")
        }

        Button(
            onClick = {},
            enabled = true,
        ) {
            Text("Systems")
        }

        Button(
            onClick = {},
            enabled = true,
        ) {
            Text("Workflows")
        }

        Button(
            onClick = {},
            enabled = !offline,
        ) {
            Text("Deep Analyze")
        }
    }
}
