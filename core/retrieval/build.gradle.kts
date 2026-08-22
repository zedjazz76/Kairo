plugins {
    kotlin("jvm")
}

dependencies {
    api(project(":core:domain"))
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
}
