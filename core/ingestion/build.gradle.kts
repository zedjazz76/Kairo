plugins {
    kotlin("jvm")
}

dependencies {
    api(project(":core:domain"))
    api(project(":core:security"))
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
}
