plugins {
    base
}

tasks.register("verifyContracts") {
    group = "verification"
    description = "Reserves the Gradle entry point for Kairo contract verification."
}
