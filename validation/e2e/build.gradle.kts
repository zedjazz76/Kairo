plugins {
    kotlin("jvm")
}

sourceSets {
    test {
        kotlin.srcDir(projectDir)
    }
}

dependencies {
    testImplementation(project(":core:domain"))
    testImplementation(project(":core:ingestion"))
    testImplementation(project(":core:security"))
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
}
