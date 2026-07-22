package com.example.pokemon_tcg_tracker

import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import kotlin.math.max
import java.text.NumberFormat
import java.util.Locale

private const val EXCLUDED_SERIE_ID = "tcgp"
private const val PREFS_NAME = "tracker_prefs"
private const val PREF_DB_URI = "selected_db_uri"
private const val LOCAL_DB_NAME = "tracker_snapshot.db"

enum class AppTab { CATALOG, SCREENER }

enum class SortField { LOCAL_ID, NAME, AVG }

enum class SortDirection { ASC, DESC }

data class SerieSummary(
    val id: String,
    val name: String,
    val setCount: Int,
    val totalCards: Int,
    val sets: List<SetSummary>,
)

data class SetSummary(
    val id: String,
    val serieId: String,
    val name: String,
    val releaseDate: String?,
    val officialCount: Int?,
    val totalCount: Int?,
    val pricedCount: Int,
    val logoUrl: String?,
    val symbolUrl: String?,
)

data class LatestPrice(
    val capturedAt: String?,
    val avg: Double?,
    val low: Double?,
    val trend: Double?,
    val avg1: Double?,
    val avg7: Double?,
    val avg30: Double?,
    val avgHolo: Double?,
    val lowHolo: Double?,
    val trendHolo: Double?,
    val avg1Holo: Double?,
    val avg7Holo: Double?,
    val avg30Holo: Double?,
    val tcgplayerCurrency: String?,
    val tcgplayerNormalMarket: Double?,
    val tcgplayerReverseMarket: Double?,
    val cardmarketUrl: String?,
)

data class CardListItem(
    val id: String,
    val localId: String?,
    val name: String,
    val imageUrl: String?,
    val imageLanguage: String?,
    val latestPrice: LatestPrice?,
    val slope: SlopeStatus?,
)

data class SlopeStatus(
    val state: String,
    val label: String,
    val deltaPct: Double?,
    val points: Int,
)

data class CardHistoryEntry(
    val capturedAt: String,
    val avg: Double?,
    val low: Double?,
    val trend: Double?,
    val avg1: Double?,
    val avg7: Double?,
    val avg30: Double?,
    val avgHolo: Double?,
    val lowHolo: Double?,
    val trendHolo: Double?,
    val avg1Holo: Double?,
    val avg7Holo: Double?,
    val avg30Holo: Double?,
    val tcgplayerCurrency: String?,
    val tcgplayerNormalMarket: Double?,
    val tcgplayerReverseMarket: Double?,
    val cardmarketUrl: String?,
)

data class CardHistoryMeta(
    val snapshotCount: Int,
    val local30d: Double?,
    val local90d: Double?,
    val local180d: Double?,
)

data class CardDetail(
    val id: String,
    val localId: String?,
    val name: String,
    val setId: String,
    val setName: String,
    val rarity: String?,
    val illustrator: String?,
    val types: String?,
    val hp: String?,
    val stage: String?,
    val suffix: String?,
    val imageUrl: String?,
    val imageLanguage: String?,
    val latestPrice: LatestPrice?,
    val cardmarketUrl: String?,
    val history: List<CardHistoryEntry>,
    val historyMeta: CardHistoryMeta,
    val changePctAvg: Double?,
)

data class Opportunity(
    val cardId: String,
    val localId: String?,
    val name: String,
    val setName: String,
    val currentAvg: Double,
    val currentLow: Double?,
    val trend: Double?,
    val avg7: Double?,
    val avg30: Double?,
    val avgHolo: Double?,
    val reverseMarket: Double?,
    val snapshotCount: Int,
    val pct7: Double?,
    val pct30: Double?,
    val score: Double,
    val imageUrl: String?,
    val imageLanguage: String?,
)

data class SetCatalog(
    val set: SetSummary,
    val cards: List<CardListItem>,
)

data class TimelinePoint(
    val label: String,
    val value: Double,
    val source: String,
    val trend: Double?,
    val avg: Double?,
    val low: Double?,
    val reverseMarket: Double?,
    val samples: Int = 0,
)

data class PriceTimeline(
    val mode: String,
    val points: List<TimelinePoint>,
)

data class MainUiState(
    val isLoading: Boolean = false,
    val isDatabaseReady: Boolean = false,
    val databaseLabel: String? = null,
    val errorMessage: String? = null,
    val selectedTab: AppTab = AppTab.CATALOG,
    val series: List<SerieSummary> = emptyList(),
    val isCatalogChooserVisible: Boolean = true,
    val activeSet: SetSummary? = null,
    val activeCards: List<CardListItem> = emptyList(),
    val searchTerm: String = "",
    val sortField: SortField = SortField.AVG,
    val sortDirection: SortDirection = SortDirection.DESC,
    val budgetInput: String = "10",
    val opportunities: List<Opportunity> = emptyList(),
    val opportunitiesNote: String = "",
    val selectedCard: CardDetail? = null,
    val detailLoading: Boolean = false,
)

class TcgRepository(private val context: Context) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val dbFile = File(context.filesDir, LOCAL_DB_NAME)

    fun getSelectedDatabaseUri(): Uri? = prefs.getString(PREF_DB_URI, null)?.let(Uri::parse)

    fun getSelectedDatabaseLabel(): String? = getSelectedDatabaseUri()?.lastPathSegment?.substringAfterLast('/')

    fun hasDatabase(): Boolean = dbFile.exists()

    suspend fun importDatabase(uri: Uri): String = withContext(Dispatchers.IO) {
        takePersistableReadPermission(uri)
        copyUriToLocalDatabase(uri)
        prefs.edit().putString(PREF_DB_URI, uri.toString()).apply()
        uri.lastPathSegment?.substringAfterLast('/') ?: LOCAL_DB_NAME
    }

    suspend fun refreshDatabaseFromStoredUri(): String? = withContext(Dispatchers.IO) {
        val uri = getSelectedDatabaseUri() ?: return@withContext null
        copyUriToLocalDatabase(uri)
        uri.lastPathSegment?.substringAfterLast('/') ?: LOCAL_DB_NAME
    }

    suspend fun loadSeries(): List<SerieSummary> = withContext(Dispatchers.IO) {
        requireDatabase()
        openDb().use { db ->
            val setsRows = mutableListOf<SetSummary>()
            db.rawQuery(
                """
                SELECT
                    s.set_id,
                    s.serie_id,
                    s.name,
                    s.release_date,
                    s.official_count,
                    s.total_count,
                    s.logo_url,
                    s.symbol_url,
                    COUNT(DISTINCT ps.card_id) AS priced_count
                FROM sets s
                LEFT JOIN cards c ON c.set_id = s.set_id
                LEFT JOIN price_snapshots ps ON ps.card_id = c.card_id
                WHERE s.serie_id != ?
                GROUP BY
                    s.set_id,
                    s.serie_id,
                    s.name,
                    s.release_date,
                    s.official_count,
                    s.total_count,
                    s.logo_url,
                    s.symbol_url
                ORDER BY s.release_date DESC, s.name
                """.trimIndent(),
                arrayOf(EXCLUDED_SERIE_ID),
            ).use { cursor ->
                while (cursor.moveToNext()) {
                    setsRows += SetSummary(
                        id = cursor.string("set_id"),
                        serieId = cursor.string("serie_id"),
                        name = cursor.string("name"),
                        releaseDate = cursor.stringOrNull("release_date"),
                        officialCount = cursor.intOrNull("official_count"),
                        totalCount = cursor.intOrNull("total_count"),
                        pricedCount = cursor.intOrNull("priced_count") ?: 0,
                        logoUrl = buildAssetUrl(cursor.stringOrNull("logo_url")),
                        symbolUrl = buildAssetUrl(cursor.stringOrNull("symbol_url")),
                    )
                }
            }

            val setsBySerie = setsRows.groupBy { it.serieId }
            val series = mutableListOf<SerieSummary>()
            db.rawQuery(
                """
                SELECT
                    s.serie_id,
                    s.name,
                    COUNT(st.set_id) AS set_count,
                    SUM(COALESCE(st.total_count, 0)) AS total_cards
                FROM series s
                LEFT JOIN sets st ON st.serie_id = s.serie_id
                WHERE s.serie_id != ?
                GROUP BY s.serie_id, s.name
                ORDER BY MAX(COALESCE(st.release_date, '0000-01-01')) DESC, s.name
                """.trimIndent(),
                arrayOf(EXCLUDED_SERIE_ID),
            ).use { cursor ->
                while (cursor.moveToNext()) {
                    val serieId = cursor.string("serie_id")
                    series += SerieSummary(
                        id = serieId,
                        name = cursor.string("name"),
                        setCount = cursor.intOrNull("set_count") ?: 0,
                        totalCards = cursor.intOrNull("total_cards") ?: 0,
                        sets = setsBySerie[serieId].orEmpty(),
                    )
                }
            }
            orderSeries(series)
        }
    }

    suspend fun loadSetCatalog(setId: String): SetCatalog = withContext(Dispatchers.IO) {
        requireDatabase()
        openDb().use { db ->
            val setCursor = db.rawQuery(
                """
                SELECT set_id, serie_id, name, release_date, official_count, total_count, logo_url, symbol_url
                FROM sets
                WHERE set_id = ?
                """.trimIndent(),
                arrayOf(setId),
            )
            val set = setCursor.use { cursor ->
                if (!cursor.moveToFirst()) error("Extension introuvable")
                SetSummary(
                    id = cursor.string("set_id"),
                    serieId = cursor.string("serie_id"),
                    name = cursor.string("name"),
                    releaseDate = cursor.stringOrNull("release_date"),
                    officialCount = cursor.intOrNull("official_count"),
                    totalCount = cursor.intOrNull("total_count"),
                    pricedCount = 0,
                    logoUrl = buildAssetUrl(cursor.stringOrNull("logo_url")),
                    symbolUrl = buildAssetUrl(cursor.stringOrNull("symbol_url")),
                )
            }

            val cards = mutableListOf<CardListItem>()
            val historyByCard = mutableMapOf<String, MutableList<Map<String, Any?>>>()
            db.rawQuery(
                """
                SELECT
                    ps.card_id,
                    ps.captured_at,
                    ps.avg,
                    ps.trend
                FROM price_snapshots ps
                INNER JOIN cards c ON c.card_id = ps.card_id
                WHERE c.set_id = ?
                ORDER BY ps.card_id, ps.captured_at ASC
                """.trimIndent(),
                arrayOf(setId),
            ).use { cursor ->
                while (cursor.moveToNext()) {
                    val cardId = cursor.string("card_id")
                    historyByCard.getOrPut(cardId) { mutableListOf() }.add(
                        mapOf(
                            "captured_at" to cursor.string("captured_at"),
                            "avg" to cursor.doubleOrNull("avg"),
                            "trend" to cursor.doubleOrNull("trend"),
                        )
                    )
                }
            }

            db.rawQuery(
                """
                SELECT
                    c.card_id,
                    c.local_id,
                    c.name,
                    c.image_url,
                    ps.captured_at,
                    ps.avg,
                    ps.low,
                    ps.trend,
                    ps.avg1,
                    ps.avg7,
                    ps.avg30,
                    ps.avg_holo,
                    ps.low_holo,
                    ps.trend_holo,
                    ps.avg1_holo,
                    ps.avg7_holo,
                    ps.avg30_holo,
                    ps.tcgplayer_currency,
                    ps.tcgplayer_normal_market,
                    ps.tcgplayer_reverse_market,
                    ps.raw_pricing_json
                FROM cards c
                LEFT JOIN (
                    SELECT ps1.*
                    FROM price_snapshots ps1
                    INNER JOIN (
                        SELECT card_id, MAX(captured_at) AS max_captured_at
                        FROM price_snapshots
                        GROUP BY card_id
                    ) latest
                        ON latest.card_id = ps1.card_id
                        AND latest.max_captured_at = ps1.captured_at
                ) ps
                    ON ps.card_id = c.card_id
                WHERE c.set_id = ?
                """.trimIndent(),
                arrayOf(setId),
            ).use { cursor ->
                while (cursor.moveToNext()) {
                    cards += CardListItem(
                        id = cursor.string("card_id"),
                        localId = cursor.stringOrNull("local_id"),
                        name = cursor.string("name"),
                        imageUrl = buildCardImageUrl(cursor.stringOrNull("image_url")),
                        imageLanguage = if (cursor.stringOrNull("image_url") != null) "fr" else null,
                        latestPrice = cursor.toLatestPrice(),
                        slope = buildCatalogSlopeStatus(historyByCard[cursor.string("card_id")].orEmpty()),
                    )
                }
            }
            SetCatalog(set = set, cards = cards)
        }
    }

    suspend fun loadCardDetail(cardId: String): CardDetail? = withContext(Dispatchers.IO) {
        requireDatabase()
        openDb().use { db ->
            val cardRow = db.rawQuery(
                """
                SELECT
                    card_id,
                    local_id,
                    name,
                    set_id,
                    set_name,
                    rarity,
                    illustrator,
                    image_url,
                    types,
                    hp,
                    stage,
                    suffix
                FROM cards
                WHERE card_id = ?
                """.trimIndent(),
                arrayOf(cardId),
            ).use { cursor ->
                if (!cursor.moveToFirst()) return@withContext null
                mapOf(
                    "card_id" to cursor.string("card_id"),
                    "local_id" to cursor.stringOrNull("local_id"),
                    "name" to cursor.string("name"),
                    "set_id" to cursor.string("set_id"),
                    "set_name" to cursor.string("set_name"),
                    "rarity" to cursor.stringOrNull("rarity"),
                    "illustrator" to cursor.stringOrNull("illustrator"),
                    "image_url" to cursor.stringOrNull("image_url"),
                    "types" to cursor.stringOrNull("types"),
                    "hp" to cursor.stringOrNull("hp"),
                    "stage" to cursor.stringOrNull("stage"),
                    "suffix" to cursor.stringOrNull("suffix"),
                )
            }

            val history = mutableListOf<CardHistoryEntry>()
            db.rawQuery(
                """
                SELECT
                    captured_at,
                    avg,
                    low,
                    trend,
                    avg1,
                    avg7,
                    avg30,
                    avg_holo,
                    low_holo,
                    trend_holo,
                    avg1_holo,
                    avg7_holo,
                    avg30_holo,
                    raw_pricing_json,
                    tcgplayer_currency,
                    tcgplayer_normal_market,
                    tcgplayer_reverse_market
                FROM price_snapshots
                WHERE card_id = ?
                ORDER BY captured_at ASC
                """.trimIndent(),
                arrayOf(cardId),
            ).use { cursor ->
                while (cursor.moveToNext()) {
                    history += CardHistoryEntry(
                        capturedAt = cursor.string("captured_at"),
                        avg = cursor.doubleOrNull("avg"),
                        low = cursor.doubleOrNull("low"),
                        trend = cursor.doubleOrNull("trend"),
                        avg1 = cursor.doubleOrNull("avg1"),
                        avg7 = cursor.doubleOrNull("avg7"),
                        avg30 = cursor.doubleOrNull("avg30"),
                        avgHolo = cursor.doubleOrNull("avg_holo"),
                        lowHolo = cursor.doubleOrNull("low_holo"),
                        trendHolo = cursor.doubleOrNull("trend_holo"),
                        avg1Holo = cursor.doubleOrNull("avg1_holo"),
                        avg7Holo = cursor.doubleOrNull("avg7_holo"),
                        avg30Holo = cursor.doubleOrNull("avg30_holo"),
                        tcgplayerCurrency = cursor.stringOrNull("tcgplayer_currency"),
                        tcgplayerNormalMarket = cursor.doubleOrNull("tcgplayer_normal_market"),
                        tcgplayerReverseMarket = cursor.doubleOrNull("tcgplayer_reverse_market"),
                        cardmarketUrl = extractCardmarketUrl(cursor.stringOrNull("raw_pricing_json")),
                    )
                }
            }

            val latest = history.lastOrNull()?.toLatestPrice()
            val imageBase = cardRow["image_url"] as String?
            val frImage = buildCardImageUrl(imageBase)
            val finalImage = frImage ?: fetchEnglishFallbackImage(cardId)
            val finalLanguage = when {
                frImage != null -> "fr"
                finalImage != null -> "en"
                else -> null
            }

            CardDetail(
                id = cardRow["card_id"] as String,
                localId = cardRow["local_id"] as String?,
                name = cardRow["name"] as String,
                setId = cardRow["set_id"] as String,
                setName = cardRow["set_name"] as String,
                rarity = cardRow["rarity"] as String?,
                illustrator = cardRow["illustrator"] as String?,
                types = cardRow["types"] as String?,
                hp = cardRow["hp"] as String?,
                stage = cardRow["stage"] as String?,
                suffix = cardRow["suffix"] as String?,
                imageUrl = finalImage,
                imageLanguage = finalLanguage,
                latestPrice = latest,
                cardmarketUrl = latest?.cardmarketUrl,
                history = history,
                historyMeta = buildHistoryMeta(history),
                changePctAvg = computePercentChange(latest?.avg, history.firstOrNull()?.avg),
            )
        }
    }

    suspend fun loadOpportunities(budget: Double, limit: Int = 18): Pair<Double, List<Opportunity>> =
        withContext(Dispatchers.IO) {
            requireDatabase()
            val minPrice = max(max(budget * 0.7, budget - 3.0), 0.25)
            openDb().use { db ->
                val opportunities = mutableListOf<Opportunity>()
                val rows = mutableListOf<Map<String, Any?>>()
                db.rawQuery(
                    """
                    SELECT
                        c.card_id,
                        c.local_id,
                        c.name,
                        c.image_url,
                        c.set_name,
                        latest.avg,
                        latest.low,
                        latest.trend,
                        latest.avg_holo,
                        latest.tcgplayer_reverse_market,
                        counts.snapshot_count
                    FROM cards c
                    INNER JOIN (
                        SELECT ps1.*
                        FROM price_snapshots ps1
                        INNER JOIN (
                            SELECT card_id, MAX(captured_at) AS max_captured_at
                            FROM price_snapshots
                            GROUP BY card_id
                        ) last_ps
                            ON last_ps.card_id = ps1.card_id
                            AND last_ps.max_captured_at = ps1.captured_at
                    ) latest
                        ON latest.card_id = c.card_id
                    INNER JOIN (
                        SELECT card_id, COUNT(*) AS snapshot_count
                        FROM price_snapshots
                        GROUP BY card_id
                    ) counts
                        ON counts.card_id = c.card_id
                    WHERE latest.avg IS NOT NULL
                      AND latest.avg > 0
                      AND latest.avg >= ?
                      AND latest.avg <= ?
                    """.trimIndent(),
                    arrayOf(minPrice.toString(), budget.toString()),
                ).use { cursor ->
                    while (cursor.moveToNext()) {
                        rows += mapOf(
                            "card_id" to cursor.string("card_id"),
                            "local_id" to cursor.stringOrNull("local_id"),
                            "name" to cursor.string("name"),
                            "set_name" to cursor.string("set_name"),
                            "avg" to cursor.doubleOrNull("avg"),
                            "low" to cursor.doubleOrNull("low"),
                            "trend" to cursor.doubleOrNull("trend"),
                            "avg_holo" to cursor.doubleOrNull("avg_holo"),
                            "tcgplayer_reverse_market" to cursor.doubleOrNull("tcgplayer_reverse_market"),
                            "snapshot_count" to cursor.intOrNull("snapshot_count"),
                            "image_url" to cursor.stringOrNull("image_url"),
                        )
                    }
                }

                val cardIds = rows.mapNotNull { it["card_id"] as String? }
                val trendHistoryByCard = mutableMapOf<String, MutableList<Map<String, Any?>>>()
                if (cardIds.isNotEmpty()) {
                    val placeholders = cardIds.joinToString(",") { "?" }
                    db.rawQuery(
                        """
                        SELECT
                            card_id,
                            captured_at,
                            avg,
                            trend
                        FROM price_snapshots
                        WHERE card_id IN ($placeholders)
                        ORDER BY captured_at ASC
                        """.trimIndent(),
                        cardIds.toTypedArray(),
                    ).use { cursor ->
                        while (cursor.moveToNext()) {
                            val cardId = cursor.string("card_id")
                            trendHistoryByCard.getOrPut(cardId) { mutableListOf() }.add(
                                mapOf(
                                    "captured_at" to cursor.string("captured_at"),
                                    "avg" to cursor.doubleOrNull("avg"),
                                    "trend" to cursor.doubleOrNull("trend"),
                                )
                            )
                        }
                    }
                }

                for (row in rows) {
                    val avg = row["avg"] as Double? ?: continue
                    val localTrends = buildLocalTrendRanges(trendHistoryByCard[row["card_id"] as String].orEmpty())
                    val currentTrend = localTrends.currentTrend
                    val trend7 = localTrends.trend7d
                    val trend30 = localTrends.trend30d
                    val pct7 = computePercentChange(currentTrend, trend7)
                    val pct30 = computePercentChange(currentTrend, trend30)
                        val positive7 = max(pct7 ?: 0.0, 0.0)
                        val positive30 = max(pct30 ?: 0.0, 0.0)
                        val snapshotCount = row["snapshot_count"] as Int? ?: 0
                        val snapshotBonus = minOf(snapshotCount, 24) * 0.6
                        val priceEfficiency = max(budget - avg, 0.0) / max(budget, 0.01) * 10
                        val score = positive7 * 0.45 + positive30 * 0.35 + snapshotBonus + priceEfficiency

                        opportunities += Opportunity(
                            cardId = row["card_id"] as String,
                            localId = row["local_id"] as String?,
                            name = row["name"] as String,
                            setName = row["set_name"] as String,
                            currentAvg = avg,
                            currentLow = row["low"] as Double?,
                            trend = currentTrend,
                            avg7 = trend7,
                            avg30 = trend30,
                            avgHolo = row["avg_holo"] as Double?,
                            reverseMarket = row["tcgplayer_reverse_market"] as Double?,
                            snapshotCount = snapshotCount,
                            pct7 = pct7,
                            pct30 = pct30,
                            score = (score * 100.0).toInt() / 100.0,
                            imageUrl = buildCardImageUrl(row["image_url"] as String?),
                            imageLanguage = if ((row["image_url"] as String?) != null) "fr" else null,
                        )
                    
                }

                minPrice to opportunities.sortedWith(
                    compareByDescending<Opportunity> { it.score }
                        .thenByDescending { it.pct7 ?: 0.0 }
                        .thenByDescending { it.pct30 ?: 0.0 }
                ).take(limit)
            }
        }

    private fun requireDatabase() {
        if (!dbFile.exists()) {
            error("Base de donnees introuvable. Selectionne tracker_snapshot.db.")
        }
    }

    private fun openDb(): SQLiteDatabase =
        SQLiteDatabase.openDatabase(dbFile.absolutePath, null, SQLiteDatabase.OPEN_READONLY)

    private fun takePersistableReadPermission(uri: Uri) {
        try {
            context.contentResolver.takePersistableUriPermission(
                uri,
                android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION,
            )
        } catch (_: SecurityException) {
        }
    }

    private fun copyUriToLocalDatabase(uri: Uri) {
        val tempFile = File(context.filesDir, "$LOCAL_DB_NAME.tmp")
        context.contentResolver.openInputStream(uri)?.use { input ->
            FileOutputStream(tempFile).use { output ->
                input.copyTo(output)
            }
        } ?: error("Impossible de lire le fichier selectionne.")

        if (dbFile.exists()) {
            dbFile.delete()
        }
        tempFile.renameTo(dbFile)
    }

    private fun fetchEnglishFallbackImage(cardId: String): String? {
        val encodedId = URLEncoder.encode(cardId, Charsets.UTF_8.name())
        val connection = URL("https://api.tcgdex.net/v2/en/cards/$encodedId").openConnection() as HttpURLConnection
        return try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 10_000
            connection.readTimeout = 10_000
            connection.setRequestProperty("Accept", "application/json")
            if (connection.responseCode !in 200..299) {
                null
            } else {
                val body = connection.inputStream.bufferedReader().use { it.readText() }
                val imageBase = JSONObject(body).optString("image").takeIf { it.isNotBlank() }
                buildCardImageUrl(imageBase)
            }
        } catch (_: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }
}

private fun Cursor.toLatestPrice(): LatestPrice =
    LatestPrice(
        capturedAt = stringOrNull("captured_at"),
        avg = doubleOrNull("avg"),
        low = doubleOrNull("low"),
        trend = doubleOrNull("trend"),
        avg1 = doubleOrNull("avg1"),
        avg7 = doubleOrNull("avg7"),
        avg30 = doubleOrNull("avg30"),
        avgHolo = doubleOrNull("avg_holo"),
        lowHolo = doubleOrNull("low_holo"),
        trendHolo = doubleOrNull("trend_holo"),
        avg1Holo = doubleOrNull("avg1_holo"),
        avg7Holo = doubleOrNull("avg7_holo"),
        avg30Holo = doubleOrNull("avg30_holo"),
        tcgplayerCurrency = stringOrNull("tcgplayer_currency"),
        tcgplayerNormalMarket = doubleOrNull("tcgplayer_normal_market"),
        tcgplayerReverseMarket = doubleOrNull("tcgplayer_reverse_market"),
        cardmarketUrl = extractCardmarketUrl(stringOrNull("raw_pricing_json")),
    )

private fun CardHistoryEntry.toLatestPrice(): LatestPrice =
    LatestPrice(
        capturedAt = capturedAt,
        avg = avg,
        low = low,
        trend = trend,
        avg1 = avg1,
        avg7 = avg7,
        avg30 = avg30,
        avgHolo = avgHolo,
        lowHolo = lowHolo,
        trendHolo = trendHolo,
        avg1Holo = avg1Holo,
        avg7Holo = avg7Holo,
        avg30Holo = avg30Holo,
        tcgplayerCurrency = tcgplayerCurrency,
        tcgplayerNormalMarket = tcgplayerNormalMarket,
        tcgplayerReverseMarket = tcgplayerReverseMarket,
        cardmarketUrl = cardmarketUrl,
    )

private fun Cursor.string(column: String): String = getString(getColumnIndexOrThrow(column))

private fun Cursor.stringOrNull(column: String): String? =
    getColumnIndex(column).takeIf { it >= 0 }?.let { index -> if (isNull(index)) null else getString(index) }

private fun Cursor.intOrNull(column: String): Int? =
    getColumnIndex(column).takeIf { it >= 0 }?.let { index -> if (isNull(index)) null else getInt(index) }

private fun Cursor.doubleOrNull(column: String): Double? =
    getColumnIndex(column).takeIf { it >= 0 }?.let { index -> if (isNull(index)) null else getDouble(index) }

fun buildCardImageUrl(base: String?): String? = base?.takeIf { it.isNotBlank() }?.let { "$it/high.webp" }

fun buildAssetUrl(base: String?): String? = base?.takeIf { it.isNotBlank() }?.let { "$it.webp" }

fun extractCardmarketUrl(rawPricingJson: String?): String? {
    if (rawPricingJson.isNullOrBlank()) return null
    return try {
        val productId = JSONObject(rawPricingJson).optJSONObject("cardmarket")?.opt("idProduct")
        productId?.toString()?.takeIf { it.isNotBlank() }
            ?.let { "https://www.cardmarket.com/fr/Pokemon/Products?idProduct=$it&language=2" }
    } catch (_: Exception) {
        null
    }
}

fun computePercentChange(current: Double?, reference: Double?): Double? {
    if (current == null || reference == null || reference == 0.0) return null
    return ((current - reference) / reference) * 100.0
}

private fun buildHistoryMeta(history: List<CardHistoryEntry>): CardHistoryMeta {
    if (history.isEmpty()) {
        return CardHistoryMeta(0, null, null, null)
    }

    val points = history.mapNotNull { entry ->
        val avg = entry.avg ?: return@mapNotNull null
        runCatching { OffsetDateTime.parse(entry.capturedAt) }.getOrNull()?.let { it to avg }
    }
    if (points.isEmpty()) {
        return CardHistoryMeta(history.size, null, null, null)
    }

    val latest = points.maxBy { it.first }
    fun nearestValue(days: Long): Double? {
        val target = latest.first.minusDays(days)
        return points.filter { it.first <= target }.maxByOrNull { it.first }?.second
    }

    return CardHistoryMeta(
        snapshotCount = history.size,
        local30d = nearestValue(30),
        local90d = nearestValue(90),
        local180d = nearestValue(180),
    )
}

data class LocalTrendRanges(
    val currentTrend: Double?,
    val trend7d: Double?,
    val trend30d: Double?,
)

private fun buildLocalTrendRanges(history: List<Map<String, Any?>>): LocalTrendRanges {
    if (history.isEmpty()) {
        return LocalTrendRanges(null, null, null)
    }

    val points = history.mapNotNull { entry ->
        val capturedAt = entry["captured_at"] as String?
        val trend = entry["trend"] as Double?
        val avg = entry["avg"] as Double?
        val value = trend ?: avg ?: return@mapNotNull null
        runCatching { OffsetDateTime.parse(capturedAt) }.getOrNull()?.let { it to value }
    }.sortedBy { it.first }

    if (points.isEmpty()) {
        return LocalTrendRanges(null, null, null)
    }

    val latest = points.last()

    fun nearestValue(days: Long): Double? {
        val target = latest.first.minusDays(days)
        return points.filter { it.first <= target }.maxByOrNull { it.first }?.second
    }

    return LocalTrendRanges(
        currentTrend = latest.second,
        trend7d = nearestValue(7),
        trend30d = nearestValue(30),
    )
}

fun buildPriceTimeline(detail: CardDetail): PriceTimeline {
    val byDay = linkedMapOf<String, MutableMap<String, Any>>()

    for (entry in detail.history) {
        val chartValue = entry.trend ?: entry.avg ?: continue
        val date = runCatching { OffsetDateTime.parse(entry.capturedAt) }.getOrNull() ?: continue
        val dayKey = date.toLocalDate().toString()
        val day = byDay.getOrPut(dayKey) {
            mutableMapOf(
                "label" to date.format(DateTimeFormatter.ofPattern("dd/MM")),
                "valueSum" to 0.0,
                "valueCount" to 0,
                "avgSum" to 0.0,
                "avgCount" to 0,
                "lowSum" to 0.0,
                "lowCount" to 0,
                "reverseSum" to 0.0,
                "reverseCount" to 0,
            )
        }
        day["valueSum"] = (day["valueSum"] as Double) + chartValue
        day["valueCount"] = (day["valueCount"] as Int) + 1
        entry.avg?.let {
            day["avgSum"] = (day["avgSum"] as Double) + it
            day["avgCount"] = (day["avgCount"] as Int) + 1
        }
        entry.low?.let {
            day["lowSum"] = (day["lowSum"] as Double) + it
            day["lowCount"] = (day["lowCount"] as Int) + 1
        }
        entry.tcgplayerReverseMarket?.let {
            day["reverseSum"] = (day["reverseSum"] as Double) + it
            day["reverseCount"] = (day["reverseCount"] as Int) + 1
        }
    }

    val points = byDay.entries.sortedBy { it.key }.map { (_, day) ->
        val valueCount = day["valueCount"] as Int
        val avgCount = day["avgCount"] as Int
        val lowCount = day["lowCount"] as Int
        val reverseCount = day["reverseCount"] as Int
        val trendValue = (day["valueSum"] as Double) / valueCount
        TimelinePoint(
            label = day["label"] as String,
            value = trendValue,
            source = "snapshot",
            trend = trendValue,
            avg = if (avgCount > 0) (day["avgSum"] as Double) / avgCount else null,
            low = if (lowCount > 0) (day["lowSum"] as Double) / lowCount else null,
            reverseMarket = if (reverseCount > 0) (day["reverseSum"] as Double) / reverseCount else null,
            samples = valueCount,
        )
    }
    return PriceTimeline("Historique local", points)
}

fun formatDateLabel(value: String): String =
    runCatching { OffsetDateTime.parse(value).format(DateTimeFormatter.ofPattern("dd/MM")) }.getOrDefault(value)

fun formatDateLong(value: String): String =
    runCatching { OffsetDateTime.parse(value).format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) }.getOrDefault(value)

fun formatEuro(value: Double?): String {
    if (value == null) return "N/A"
    return NumberFormat.getCurrencyInstance(Locale.FRANCE).apply {
        currency = java.util.Currency.getInstance("EUR")
        maximumFractionDigits = 2
    }.format(value)
}

fun formatUsd(value: Double?): String {
    if (value == null) return "N/A"
    return NumberFormat.getCurrencyInstance(Locale.FRANCE).apply {
        currency = java.util.Currency.getInstance("USD")
        maximumFractionDigits = 2
    }.format(value)
}

fun formatPercent(value: Double?): String {
    if (value == null) return "N/A"
    val sign = if (value > 0) "+" else ""
    return "$sign${"%.1f".format(Locale.US, value)}%"
}

fun releaseDateValue(value: String?): Long {
    if (value.isNullOrBlank()) return 0L
    return runCatching { OffsetDateTime.parse("${value}T00:00:00+00:00").toInstant().toEpochMilli() }
        .getOrDefault(0L)
}

fun orderSeries(series: List<SerieSummary>): List<SerieSummary> =
    series.map { serie ->
        serie.copy(
            sets = serie.sets.sortedWith(
                compareByDescending<SetSummary> { releaseDateValue(it.releaseDate) }
                    .thenBy { it.name.lowercase(Locale.ROOT) }
            )
        )
    }.sortedWith(
        compareByDescending<SerieSummary> {
            it.sets.maxOfOrNull { setItem -> releaseDateValue(setItem.releaseDate) } ?: 0L
        }.thenBy { it.name.lowercase(Locale.ROOT) }
    )

fun buildMainPriceBadge(price: LatestPrice?): String {
    if (price == null) return "Prix N/A"
    val parts = buildList {
        price.avg?.let { add("N ${formatEuro(it)}") }
        price.avgHolo?.let { add("H ${formatEuro(it)}") }
    }
    return parts.ifEmpty { listOf("Prix N/A") }.joinToString(" · ")
}

private data class ParsedLocalId(
    val group: Int,
    val number: Int,
    val text: String,
)

private fun buildCatalogSlopeStatus(history: List<Map<String, Any?>>): SlopeStatus {
    if (history.isEmpty()) {
        return SlopeStatus("stable", "=", null, 0)
    }

    val pointsByDay = linkedMapOf<String, MutableList<Double>>()
    for (entry in history) {
        val capturedAt = entry["captured_at"] as String?
        val trend = entry["trend"] as Double?
        val avg = entry["avg"] as Double?
        val value = trend ?: avg ?: continue
        val dt = runCatching { OffsetDateTime.parse(capturedAt) }.getOrNull() ?: continue
        pointsByDay.getOrPut(dt.toLocalDate().toString()) { mutableListOf() }.add(value)
    }

    val points = pointsByDay.entries.map { (day, values) ->
        day to (values.sum() / values.size)
    }.sortedBy { it.first }

    if (points.size < 2) {
        return SlopeStatus("stable", "=", null, points.size)
    }

    val window = points.takeLast(6)
    val xValues = window.indices.map { it.toDouble() }
    val yValues = window.map { it.second }
    val xMean = xValues.average()
    val yMean = yValues.average()
    val denominator = xValues.sumOf { (it - xMean) * (it - xMean) }
    if (denominator == 0.0) {
        return SlopeStatus("stable", "=", null, window.size)
    }

    val slope = xValues.zip(yValues).sumOf { (x, y) -> (x - xMean) * (y - yMean) } / denominator
    val projectedFirst = yMean + slope * (xValues.first() - xMean)
    val projectedLast = yMean + slope * (xValues.last() - xMean)
    val deltaPct = computePercentChange(projectedLast, projectedFirst)

    return when {
        deltaPct == null || kotlin.math.abs(deltaPct) < 2.0 -> SlopeStatus("stable", "=", deltaPct, window.size)
        deltaPct > 0 -> SlopeStatus("up", "↑", deltaPct, window.size)
        else -> SlopeStatus("down", "↓", deltaPct, window.size)
    }
}

private fun parseLocalId(value: String?): ParsedLocalId {
    if (value.isNullOrBlank()) return ParsedLocalId(1, Int.MAX_VALUE, "")
    value.toIntOrNull()?.let { return ParsedLocalId(0, it, value) }
    val match = Regex("^([A-Za-z]*)(\\d+)$").matchEntire(value)
    if (match != null) {
        return ParsedLocalId(0, match.groupValues[2].toInt(), match.groupValues[1])
    }
    return ParsedLocalId(1, Int.MAX_VALUE, value)
}

fun cardComparator(sortField: SortField, sortDirection: SortDirection): Comparator<CardListItem> {
    val direction = if (sortDirection == SortDirection.DESC) -1 else 1
    return Comparator { left, right ->
        when (sortField) {
            SortField.NAME -> direction * left.name.compareTo(right.name, ignoreCase = true)
            SortField.AVG -> {
                val leftValue = left.latestPrice?.avg ?: if (sortDirection == SortDirection.ASC) Double.MAX_VALUE else -1.0
                val rightValue = right.latestPrice?.avg ?: if (sortDirection == SortDirection.ASC) Double.MAX_VALUE else -1.0
                when {
                    leftValue != rightValue -> direction * leftValue.compareTo(rightValue)
                    else -> left.name.compareTo(right.name, ignoreCase = true)
                }
            }
            SortField.LOCAL_ID -> {
                val leftId = parseLocalId(left.localId)
                val rightId = parseLocalId(right.localId)
                when {
                    leftId.group != rightId.group -> direction * leftId.group.compareTo(rightId.group)
                    leftId.text != rightId.text -> direction * leftId.text.compareTo(rightId.text, ignoreCase = true)
                    leftId.number != rightId.number -> direction * leftId.number.compareTo(rightId.number)
                    else -> direction * left.name.compareTo(right.name, ignoreCase = true)
                }
            }
        }
    }
}
