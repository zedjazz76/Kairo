plugins {
    kotlin("jvm")
}

dependencies {
    api(project(":core:domain"))
    implementation(project(":core:ingestion"))
    implementation(project(":core:retrieval"))
    testImplementation(kotlin("test"))
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
}

tasks.test {
    useJUnitPlatform()
}
