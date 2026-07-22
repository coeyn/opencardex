package com.example.pokemon_tcg_tracker

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrackerApp(
    state: MainUiState,
    onPickDatabase: () -> Unit,
    onRefreshDatabase: () -> Unit,
    onSwitchTab: (AppTab) -> Unit,
    onSearchChange: (String) -> Unit,
    onSortFieldChange: (SortField) -> Unit,
    onSortDirectionChange: (SortDirection) -> Unit,
    onSelectSet: (String) -> Unit,
    onBackToCatalogChooser: () -> Unit,
    onBudgetChange: (String) -> Unit,
    onSearchOpportunities: () -> Unit,
    onOpenCard: (String) -> Unit,
    onCloseCardDetail: () -> Unit,
    onClearError: () -> Unit,
) {
    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(state.errorMessage) {
        val message = state.errorMessage ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        onClearError()
    }

    if (state.selectedCard != null) {
        CardDetailScreen(detail = state.selectedCard, onBack = onCloseCardDetail)
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Pokemon TCG Tracker")
                        Text(
                            text = state.databaseLabel ?: "Aucune base selectionnee",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                actions = {
                    TextButton(onClick = onPickDatabase) {
                        Text("Base")
                    }
                    if (state.isDatabaseReady) {
                        TextButton(onClick = onRefreshDatabase) {
                            Text("Rafraichir")
                        }
                    }
                },
            )
        },
        bottomBar = {
            if (state.isDatabaseReady) {
                NavigationBar {
                    NavigationBarItem(
                        selected = state.selectedTab == AppTab.CATALOG,
                        onClick = { onSwitchTab(AppTab.CATALOG) },
                        icon = {},
                        label = { Text("Catalogue") },
                    )
                    NavigationBarItem(
                        selected = state.selectedTab == AppTab.SCREENER,
                        onClick = { onSwitchTab(AppTab.SCREENER) },
                        icon = {},
                        label = { Text("Screener") },
                    )
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            when {
                !state.isDatabaseReady -> DatabasePickerScreen(
                    isLoading = state.isLoading,
                    onPickDatabase = onPickDatabase,
                )

                state.selectedTab == AppTab.CATALOG -> CatalogScreen(
                    state = state,
                    onSearchChange = onSearchChange,
                    onSortFieldChange = onSortFieldChange,
                    onSortDirectionChange = onSortDirectionChange,
                    onSelectSet = onSelectSet,
                    onBackToCatalogChooser = onBackToCatalogChooser,
                    onOpenCard = onOpenCard,
                )

                else -> ScreenerScreen(
                    state = state,
                    onBudgetChange = onBudgetChange,
                    onSearch = onSearchOpportunities,
                    onOpenCard = onOpenCard,
                )
            }

            if (state.isLoading) {
                LinearProgressIndicator(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.TopCenter),
                )
            }
        }
    }
}

@Composable
private fun DatabasePickerScreen(
    isLoading: Boolean,
    onPickDatabase: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Card(
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text(
                    text = "Choisir tracker_snapshot.db",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = "Choisis le fichier SQLite depuis le telephone ou Google Drive via le picker Android. L'app en gardera une copie locale pour les requetes.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Button(onClick = onPickDatabase, enabled = !isLoading) {
                    Text("Selectionner la base")
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CatalogScreen(
    state: MainUiState,
    onSearchChange: (String) -> Unit,
    onSortFieldChange: (SortField) -> Unit,
    onSortDirectionChange: (SortDirection) -> Unit,
    onSelectSet: (String) -> Unit,
    onBackToCatalogChooser: () -> Unit,
    onOpenCard: (String) -> Unit,
) {
    if (state.isCatalogChooserVisible) {
        CatalogChooserScreen(
            series = state.series,
            onSelectSet = onSelectSet,
        )
        return
    }

    val filteredCards = remember(state.activeCards, state.searchTerm, state.sortField, state.sortDirection) {
        state.activeCards
            .filter {
                val haystack = "${it.localId.orEmpty()} ${it.name}".lowercase()
                haystack.contains(state.searchTerm.trim().lowercase())
            }
            .sortedWith(cardComparator(state.sortField, state.sortDirection))
    }

    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 156.dp),
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = state.activeSet?.name ?: "Catalogue",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                )
                TextButton(
                    onClick = onBackToCatalogChooser,
                    modifier = Modifier.align(Alignment.Start),
                ) {
                    Text("Retour au catalogue")
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    state.activeSet?.releaseDate?.let { MetaChip("Sortie ${formatDateLong(it)}") }
                    state.activeSet?.totalCount?.let { MetaChip("$it cartes") }
                }
                OutlinedTextField(
                    value = state.searchTerm,
                    onValueChange = onSearchChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Filtrer par nom ou numero") },
                    singleLine = true,
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    SortField.entries.forEach { field ->
                        FilterChip(
                            selected = state.sortField == field,
                            onClick = { onSortFieldChange(field) },
                            label = {
                                Text(
                                    when (field) {
                                        SortField.LOCAL_ID -> "Numero"
                                        SortField.NAME -> "Nom"
                                        SortField.AVG -> "Prix"
                                    }
                                )
                            },
                        )
                    }
                    SortDirection.entries.forEach { direction ->
                        FilterChip(
                            selected = state.sortDirection == direction,
                            onClick = { onSortDirectionChange(direction) },
                            label = { Text(if (direction == SortDirection.ASC) "Croissant" else "Decroissant") },
                        )
                    }
                }
            }
        }

        item(span = { GridItemSpan(maxLineSpan) }) {
            Text(
                text = "${filteredCards.size} cartes affichees",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
        }

        gridItems(filteredCards, key = { it.id }) { card ->
            CardTile(card = card, onClick = { onOpenCard(card.id) })
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CatalogChooserScreen(
    series: List<SerieSummary>,
    onSelectSet: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text(
                text = "Choisir une extension",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )
        }
        item {
            Text(
                text = "Blocs et extensions FR du plus recent au plus ancien.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        items(series, key = { it.id }) { serie ->
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(serie.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text(
                        "${serie.setCount} extensions - ${serie.totalCards} cartes",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        serie.sets.forEach { set ->
                            FilterChip(
                                selected = false,
                                onClick = { onSelectSet(set.id) },
                                label = {
                                    Text(
                                        text = buildString {
                                            append(set.name)
                                            set.releaseDate?.let { append(" - ${formatDateLong(it)}") }
                                        },
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ScreenerScreen(
    state: MainUiState,
    onBudgetChange: (String) -> Unit,
    onSearch: () -> Unit,
    onOpenCard: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text(
                text = "Cartes interessantes a acheter",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )
        }
        item {
                Text(
                    text = "Budget cible + score de momentum tendance locale pour sortir des candidats.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
        }
        item {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = state.budgetInput,
                    onValueChange = onBudgetChange,
                    modifier = Modifier.weight(1f),
                    label = { Text("Budget cible") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
                Button(onClick = onSearch) {
                    Text("Chercher")
                }
            }
        }
        item {
            Text(state.opportunitiesNote, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        items(items = state.opportunities, key = { it.cardId }) { item ->
            OpportunityRow(item = item, onClick = { onOpenCard(item.cardId) })
        }
    }
}

@Composable
private fun CardTile(card: CardListItem, onClick: () -> Unit) {
    Card(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Box {
                AsyncImage(
                    model = card.imageUrl,
                    contentDescription = card.name,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(0.72f)
                        .clip(RoundedCornerShape(18.dp))
                        .background(MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f)),
                    contentScale = ContentScale.Crop,
                )
                card.slope?.let { slope ->
                    SlopeBadge(
                        slope = slope,
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(8.dp),
                    )
                }
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    PriceBadge(
                        text = buildMainPriceBadge(card.latestPrice),
                        background = Color(0xCC20140D),
                    )
                    card.latestPrice?.tcgplayerReverseMarket?.let {
                        PriceBadge(
                            text = "R ${formatUsd(it)}",
                            background = Color(0xCC8B3E18),
                        )
                    }
                }
            }
            Text(
                text = card.localId ?: "Sans no",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = card.name,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun SlopeBadge(slope: SlopeStatus, modifier: Modifier = Modifier) {
    val background = when (slope.state) {
        "up" -> Color(0xE61C7B4D)
        "down" -> Color(0xE6B3432F)
        else -> Color(0xD26F5B49)
    }

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(999.dp),
        color = background,
    ) {
        Text(
            text = slope.label,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            color = Color.White,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun OpportunityRow(item: Opportunity, onClick: () -> Unit) {
    Card(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AsyncImage(
                model = item.imageUrl,
                contentDescription = item.name,
                modifier = Modifier
                    .size(width = 78.dp, height = 108.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f)),
                contentScale = ContentScale.Crop,
            )
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = item.localId ?: "Sans no",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold,
                )
                Text(item.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(item.setName, color = MaterialTheme.colorScheme.onSurfaceVariant)
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    MetaChip("Prix ${formatEuro(item.currentAvg)}")
                    MetaChip("7j ${formatPercent(item.pct7)}")
                    MetaChip("30j ${formatPercent(item.pct30)}")
                    MetaChip("Score ${item.score}")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CardDetailScreen(detail: CardDetail, onBack: () -> Unit) {
    val context = LocalContext.current
    val timeline = remember(detail) { buildPriceTimeline(detail) }
    var selectedPointIndex by remember(detail.id, timeline.points.size) {
        mutableStateOf(if (timeline.points.isNotEmpty()) timeline.points.lastIndex else -1)
    }
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(detail.name, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(
                            detail.localId ?: "Sans numero",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("Retour")
                    }
                },
                actions = {
                    detail.cardmarketUrl?.let { url ->
                        TextButton(onClick = {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        }) {
                            Text("Cardmarket")
                        }
                    }
                },
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            AsyncImage(
                model = detail.imageUrl,
                contentDescription = detail.name,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(28.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .aspectRatio(0.72f),
                contentScale = ContentScale.Fit,
            )
            Text(
                text = listOfNotNull(detail.setName, detail.rarity, detail.illustrator).joinToString(" - "),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = if (detail.imageLanguage == "en") {
                    "Visuel anglais affiche car le scan FR manque dans TCGdex."
                } else {
                    "Visuel francais."
                },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            StatGrid(detail)

            Card(shape = RoundedCornerShape(24.dp)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text("Historique de tendance", fontWeight = FontWeight.Bold)
                        Text("${timeline.mode} - ${timeline.points.size} points", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    PriceChart(
                        points = timeline.points,
                        selectedIndex = selectedPointIndex,
                        onSelectPoint = { selectedPointIndex = it },
                    )
                    ChartSelectionCard(
                        point = timeline.points.getOrNull(selectedPointIndex),
                    )
                }
            }

            Card(shape = RoundedCornerShape(24.dp)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Snapshots", fontWeight = FontWeight.Bold)
                    timeline.points.asReversed().forEach { point ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(point.label)
                            Text(formatEuro(point.value))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChartSelectionCard(point: TimelinePoint?) {
    val text = if (point == null) {
        "Selectionne un point du graphe pour voir le detail."
    } else {
        buildList {
            add(point.label)
            add("Tendance ${formatEuro(point.value)}")
            add("Moyenne ${formatEuro(point.avg)}")
            add("Bas ${formatEuro(point.low)}")
            add("Reverse ${formatUsd(point.reverseMarket)}")
            if (point.samples > 0) {
                add("${point.samples} scan(s)")
            }
        }.joinToString(" · ")
    }

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = 1.dp,
                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.35f),
                shape = RoundedCornerShape(14.dp),
            ),
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun StatGrid(detail: CardDetail) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatBox("Prix moyen", formatEuro(detail.latestPrice?.avg), Modifier.weight(1f))
            StatBox("Prix bas", formatEuro(detail.latestPrice?.low), Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatBox("Tendance", formatEuro(detail.latestPrice?.trend), Modifier.weight(1f))
            StatBox("Variation", formatPercent(detail.changePctAvg), Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatBox("Holo", buildMainPriceBadge(detail.latestPrice), Modifier.weight(1f))
            StatBox("Reverse", formatUsd(detail.latestPrice?.tcgplayerReverseMarket), Modifier.weight(1f))
        }
    }
}

@Composable
private fun StatBox(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier, shape = RoundedCornerShape(20.dp)) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun PriceChart(
    points: List<TimelinePoint>,
    selectedIndex: Int,
    onSelectPoint: (Int) -> Unit,
) {
    if (points.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(180.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text("Aucun historique de prix disponible")
        }
        return
    }

    val minValue = points.minOf { it.value }
    val maxValue = points.maxOf { it.value }
    val spread = maxOf(maxValue - minValue, 1.0)
    val primary = MaterialTheme.colorScheme.primary
    val tertiary = MaterialTheme.colorScheme.tertiary
    val selectedPointColor = MaterialTheme.colorScheme.onSurface
    val labelStep = maxOf(1, kotlin.math.ceil(points.size / 6.0).toInt())

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp)
                .pointerInput(points, selectedIndex) {
                    detectTapGestures { offset ->
                        val width = size.width.toFloat()
                        val padX = 24f
                        fun x(index: Int): Float =
                            if (points.size == 1) width / 2f else padX + (index.toFloat() / (points.size - 1)) * (width - padX * 2)
                        val nearestIndex = points.indices.minByOrNull { index ->
                            kotlin.math.abs(x(index) - offset.x)
                        } ?: return@detectTapGestures
                        onSelectPoint(nearestIndex)
                    }
                },
        ) {
            val width = size.width
            val height = size.height
            val padX = 24f
            val padY = 24f
            fun x(index: Int): Float =
                if (points.size == 1) width / 2f else padX + (index.toFloat() / (points.size - 1)) * (width - padX * 2)
            fun y(value: Double): Float =
                (height - padY - (((value - minValue) / spread).toFloat() * (height - padY * 2)))

            val path = Path()
            points.forEachIndexed { index, point ->
                val px = x(index)
                val py = y(point.value)
                if (index == 0) path.moveTo(px, py) else path.lineTo(px, py)
            }
            drawPath(
                path = path,
                color = primary,
                style = Stroke(width = 6f, cap = StrokeCap.Round),
            )
            points.forEachIndexed { index, point ->
                drawCircle(
                    color = if (index == selectedIndex) selectedPointColor else tertiary,
                    radius = if (index == selectedIndex) 9f else 7f,
                    center = Offset(x(index), y(point.value)),
                )
                if (index == selectedIndex) {
                    drawCircle(
                        color = Color.White,
                        radius = 13f,
                        center = Offset(x(index), y(point.value)),
                        style = Stroke(width = 4f),
                    )
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("Min ${formatEuro(minValue)}", style = MaterialTheme.typography.labelMedium)
            Text("Max ${formatEuro(maxValue)}", style = MaterialTheme.typography.labelMedium)
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            points.forEachIndexed { index, point ->
                Text(
                    text = if (index == 0 || index == points.lastIndex || index % labelStep == 0) point.label else "",
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
    }
}

@Composable
private fun PriceBadge(text: String, background: Color) {
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = background,
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            color = Color.White,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun MetaChip(text: String) {
    AssistChip(
        onClick = {},
        label = { Text(text) },
    )
}
