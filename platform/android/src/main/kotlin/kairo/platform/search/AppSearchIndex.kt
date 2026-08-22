package kairo.platform.search

import android.content.Context
import androidx.appsearch.app.AppSearchSchema
import androidx.appsearch.app.GenericDocument
import androidx.appsearch.app.PutDocumentsRequest
import androidx.appsearch.app.RemoveByDocumentIdRequest
import androidx.appsearch.app.SearchSpec
import androidx.appsearch.app.SetSchemaRequest
import androidx.appsearch.localstorage.LocalStorage
import kairo.retrieval.SearchDocument
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.guava.await
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext

class AppSearchIndex(
    context: Context,
) {
    private val sessionFuture =
        LocalStorage.createSearchSessionAsync(
            LocalStorage.SearchContext.Builder(
                context,
                DATABASE_NAME,
            ).build(),
        )

    fun rebuild(
        documents: List<SearchDocument>,
    ) = runBlocking {
        withContext(Dispatchers.IO) {
            val session = sessionFuture.await()

            session.setSchemaAsync(
                SetSchemaRequest.Builder()
                    .addSchemas(schema())
                    .setForceOverride(true)
                    .build(),
            ).await()

            clearInternal(session)

            if (documents.isNotEmpty()) {
                session.putAsync(
                    PutDocumentsRequest.Builder()
                        .addGenericDocuments(
                            documents.map(::toDocument),
                        )
                        .build(),
                ).await()
            }
        }
    }

    fun clear() = runBlocking {
        withContext(Dispatchers.IO) {
            clearInternal(sessionFuture.await())
        }
    }

    fun search(
        query: String,
    ): List<SearchDocument> = runBlocking {
        require(query.isNotBlank()) {
            "Search query must not be blank"
        }

        withContext(Dispatchers.IO) {
            val session = sessionFuture.await()

            val results = session.search(
                query,
                SearchSpec.Builder()
                    .setTermMatch(SearchSpec.TERM_MATCH_PREFIX)
                    .addFilterSchemas(SCHEMA_TYPE)
                    .setResultCountPerPage(100)
                    .build(),
            )

            val page = results.nextPageAsync.await()

            page.map { result ->
                val document = result.genericDocument

                SearchDocument(
                    id = document.id,
                    text = document.getPropertyString(PROPERTY_TEXT)
                        ?: "",
                )
            }
        }
    }

    private suspend fun clearInternal(
        session: androidx.appsearch.app.AppSearchSession,
    ) {
        val results = session.search(
            "",
            SearchSpec.Builder()
                .setTermMatch(SearchSpec.TERM_MATCH_PREFIX)
                .addFilterSchemas(SCHEMA_TYPE)
                .setResultCountPerPage(100)
                .build(),
        )

        while (true) {
            val page = results.nextPageAsync.await()

            if (page.isEmpty()) {
                break
            }

            session.removeAsync(
                RemoveByDocumentIdRequest.Builder(NAMESPACE)
                    .addIds(
                        page.map {
                            it.genericDocument.id
                        },
                    )
                    .build(),
            ).await()
        }
    }

    private fun toDocument(
        document: SearchDocument,
    ): GenericDocument =
        GenericDocument.Builder<GenericDocument.Builder<*>>(
            NAMESPACE,
            document.id,
            SCHEMA_TYPE,
        )
            .setPropertyString(
                PROPERTY_TEXT,
                document.text,
            )
            .build()


    private fun schema(): AppSearchSchema {
        val textProperty:
            androidx.appsearch.app.AppSearchSchema.StringPropertyConfig =
            androidx.appsearch.app.AppSearchSchema.StringPropertyConfig
                .Builder(PROPERTY_TEXT)
                .setCardinality(
                    androidx.appsearch.app.AppSearchSchema.PropertyConfig
                        .CARDINALITY_REQUIRED,
                )
                .setIndexingType(
                    androidx.appsearch.app.AppSearchSchema.StringPropertyConfig
                        .INDEXING_TYPE_PREFIXES,
                )
                .setTokenizerType(
                    androidx.appsearch.app.AppSearchSchema.StringPropertyConfig
                        .TOKENIZER_TYPE_PLAIN,
                )
                .build()

        return androidx.appsearch.app.AppSearchSchema
            .Builder(SCHEMA_TYPE)
            .addProperty(textProperty)
            .build()
    }

    companion object {
        private const val DATABASE_NAME =
            "kairo-search"

        private const val NAMESPACE =
            "kairo"

        private const val SCHEMA_TYPE =
            "KairoSearchDocument"

        private const val PROPERTY_TEXT =
            "text"
    }
}
