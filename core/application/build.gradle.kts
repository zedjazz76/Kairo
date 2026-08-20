plugins {
    kotlin("jvm") version "2.2.10"
}

dependencies {
    api(project(":core:domain"))
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
}
