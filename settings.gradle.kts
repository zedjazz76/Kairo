pluginManagement {
    repositories {
        mavenCentral()
        gradlePluginPortal()
        google()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        mavenCentral()
        google()
    }
}

rootProject.name = "kairo"

include(":core:domain")
include(":core:application")
include(":core:security")
include(":core:ingestion")
include(":platform:android")

include(":core:retrieval")

include(":apps:android")
