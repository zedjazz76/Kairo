plugins {
    base
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
