plugins {
    kotlin("jvm")
}

dependencies {
    api(project(":core:domain"))
    implementation(project(":core:ingestion"))
    implementation(project(":core:retrieval"))
    testImplementation(kotlin("test"))
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
}

tasks.test {
    useJUnitPlatform()
}
