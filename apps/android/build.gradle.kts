plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
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
    }
}

dependencies {
    implementation(project(":core:application"))
    implementation(project(":core:retrieval"))
    implementation(platform("androidx.compose:compose-bom:2025.08.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("androidx.biometric:biometric:1.2.0-alpha05")
    implementation("androidx.fragment:fragment-ktx:1.8.9")
    implementation("androidx.activity:activity-compose:1.10.1")

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
