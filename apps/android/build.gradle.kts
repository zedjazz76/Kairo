import org.gradle.api.DefaultTask
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.TaskAction

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

abstract class PrepareGenesisAssets : DefaultTask() {
    @get:InputFile
    abstract val manifest: RegularFileProperty

    @get:Optional
    @get:InputFile
    abstract val privateSeed: RegularFileProperty

    @get:OutputDirectory
    abstract val outputDirectory: DirectoryProperty

    @TaskAction
    fun prepare() {
        val seed = privateSeed.orNull?.asFile ?: return
        if (!seed.isFile) return
        val target = outputDirectory.dir("genesis").get().asFile
        project.copy {
            from(manifest)
            into(target)
            rename { "manifest.json" }
        }
        project.copy {
            from(seed)
            into(target)
        }
    }
}

val prepareDebugGenesisAssets = tasks.register<PrepareGenesisAssets>("prepareDebugGenesisAssets") {
    manifest.fileValue(rootProject.file("validation/corpus/genesis-manifest.json"))
    privateSeed.fileValue(rootProject.file(".private/genesis/curated-mana-discovery.v1.json"))
    outputDirectory.set(layout.buildDirectory.dir("generated/kairo/genesis/debug"))
}

android {
    namespace = "kairo.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "kairo.android"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner =
            "androidx.test.runner.AndroidJUnitRunner"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    buildTypes {
        debug {
            buildConfigField("String", "LOCAL_RELAY_URL", "\"http://127.0.0.1:8787\"")
        }
        release {
            buildConfigField("String", "LOCAL_RELAY_URL", "\"\"")
        }
    }
}

androidComponents {
    onVariants(selector().withBuildType("debug")) { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(
            prepareDebugGenesisAssets,
            PrepareGenesisAssets::outputDirectory,
        )
    }
}

dependencies {
    implementation(project(":core:application"))
    implementation(project(":core:retrieval"))
    implementation(project(":core:ingestion"))
    implementation(project(":platform:android"))
    implementation("androidx.room:room-runtime:2.7.2")
    implementation(platform("androidx.compose:compose-bom:2025.08.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    implementation("androidx.biometric:biometric:1.2.0-alpha05")
    implementation("androidx.fragment:fragment-ktx:1.8.9")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.core:core-splashscreen:1.2.0")

    androidTestImplementation(
        platform("androidx.compose:compose-bom:2025.08.00"),
    )
    androidTestImplementation(
        "androidx.compose.ui:ui-test-junit4",
    )
    testImplementation("junit:junit:4.13.2")

    androidTestImplementation(
        "androidx.test.ext:junit:1.2.1",
    )
    androidTestImplementation(
        "androidx.test:runner:1.6.2",
    )

    debugImplementation(
        "androidx.compose.ui:ui-test-manifest",
    )
}

kotlin {
    jvmToolchain(17)
}
