plugins {
    kotlin("jvm")
}

dependencies {
    api(project(":core:domain"))
    api(project(":core:security"))
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
}
