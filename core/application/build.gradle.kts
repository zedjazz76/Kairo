plugins {
    kotlin("jvm") version "2.2.10"
}

dependencies {
    api(project(":core:domain"))
    implementation(project(":core:ingestion"))
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
}
