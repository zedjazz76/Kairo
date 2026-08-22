import org.gradle.api.tasks.testing.Test
import org.gradle.api.tasks.Sync

plugins {
    id("com.android.library") version "9.3.1"
    id("com.google.devtools.ksp") version "2.2.10-2.0.2"
}

android {
    namespace = "kairo.platform"
    compileSdk = 36

    defaultConfig {
        minSdk = 26
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        targetSdk = 36
        unitTests.isIncludeAndroidResources = true
    }
}

val robolectricRuntime = configurations.create("robolectricRuntime")
val prepareRobolectricRuntime = tasks.register<Sync>("prepareRobolectricRuntime") {
    from(robolectricRuntime)
    into(layout.buildDirectory.dir("robolectric-runtime"))
}

tasks.withType<Test>().configureEach {
    val testUserHome = layout.buildDirectory.dir("test-user-home")
    val testTempDirectory = providers.gradleProperty("kairo.testTempDir")
        .map(::file)
        .getOrElse(layout.buildDirectory.dir("test-tmp").get().asFile)
    dependsOn(prepareRobolectricRuntime)
    systemProperty("user.home", testUserHome.get().asFile.absolutePath)
    systemProperty("java.io.tmpdir", testTempDirectory.absolutePath)
    systemProperty("robolectric.offline", "true")
    systemProperty(
        "robolectric.dependency.dir",
        layout.buildDirectory.dir("robolectric-runtime").get().asFile.absolutePath,
    )
    doFirst {
        testUserHome.get().asFile.mkdirs()
        testTempDirectory.mkdirs()
    }
}

ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
}

dependencies {
    robolectricRuntime("org.robolectric:android-all-instrumented:15-robolectric-13954326-i7@jar")
    implementation(project(":core:application"))
    implementation(project(":core:domain"))
    implementation(project(":core:ingestion"))
    implementation(project(":core:security"))
    implementation("com.tom-roush:pdfbox-android:2.0.27.0")
    implementation("com.google.mlkit:text-recognition:16.0.1")
    implementation("androidx.room:room-runtime:2.8.4")
    implementation("androidx.room:room-ktx:2.8.4")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    ksp("androidx.room:room-compiler:2.8.4")

    testImplementation(kotlin("test"))
    testImplementation("junit:junit:4.13.2")
    testImplementation("androidx.test:core-ktx:1.6.1")
    testImplementation("androidx.room:room-testing:2.8.4")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
    testImplementation("org.robolectric:robolectric:4.16.1")
    testImplementation("androidx.work:work-testing:2.10.0")

    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.room:room-testing:2.8.4")
    androidTestImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
}
