plugins {
    base

    id("com.android.application") version "9.3.1" apply false
    id("com.android.library") version "9.3.1" apply false
    id("org.jetbrains.kotlin.android") version "2.2.20" apply false
    id("org.jetbrains.kotlin.jvm") version "2.2.20" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.20" apply false
}

val contractCommand = if (System.getProperty("os.name").startsWith("Windows")) {
    listOf("cmd", "/d", "/c", "pnpm", "test", "--filter", "@kairo/contracts")
} else {
    listOf("pnpm", "test", "--filter", "@kairo/contracts")
}

val verifyContracts = tasks.register<Exec>("verifyContracts") {
    group = "verification"
    description = "Runs the root Kairo contract suite."
    workingDir = rootDir
    commandLine(contractCommand)
}

tasks.named("check") {
    dependsOn(verifyContracts)
}
