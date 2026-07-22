package com.example.pokemon_tcg_tracker

import android.app.Application
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = TcgRepository(application)

    var uiState by mutableStateOf(MainUiState())
        private set

    init {
        bootstrap()
    }

    fun bootstrap() {
        viewModelScope.launch {
            val localExists = repository.hasDatabase()
            if (!localExists) {
                uiState = uiState.copy(
                    isLoading = false,
                    isDatabaseReady = false,
                    databaseLabel = repository.getSelectedDatabaseLabel(),
                )
                return@launch
            }
            loadAll(refreshFromSource = true)
        }
    }

    fun onDatabasePicked(uri: Uri) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, errorMessage = null)
            suspendRunCatching {
                repository.importDatabase(uri)
            }.onSuccess {
                loadAll(refreshFromSource = false)
            }.onFailure { error ->
                uiState = uiState.copy(
                    isLoading = false,
                    isDatabaseReady = repository.hasDatabase(),
                    errorMessage = error.message ?: "Erreur lors de l'import de la base.",
                )
            }
        }
    }

    fun refreshDatabase() {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, errorMessage = null)
            suspendRunCatching {
                repository.refreshDatabaseFromStoredUri()
            }.onSuccess {
                loadAll(refreshFromSource = false)
            }.onFailure { error ->
                uiState = uiState.copy(
                    isLoading = false,
                    errorMessage = error.message ?: "Impossible de rafraichir la base.",
                )
            }
        }
    }

    fun switchTab(tab: AppTab) {
        uiState = uiState.copy(
            selectedTab = tab,
            isCatalogChooserVisible = if (tab == AppTab.CATALOG) uiState.activeSet == null else uiState.isCatalogChooserVisible,
        )
    }

    fun setSearchTerm(value: String) {
        uiState = uiState.copy(searchTerm = value)
    }

    fun setSortField(value: SortField) {
        uiState = uiState.copy(sortField = value)
    }

    fun setSortDirection(value: SortDirection) {
        uiState = uiState.copy(sortDirection = value)
    }

    fun setBudgetInput(value: String) {
        uiState = uiState.copy(budgetInput = value)
    }

    fun selectSet(setId: String) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, errorMessage = null)
            suspendRunCatching {
                repository.loadSetCatalog(setId)
            }.onSuccess { catalog ->
                uiState = uiState.copy(
                    isLoading = false,
                    isCatalogChooserVisible = false,
                    activeSet = catalog.set,
                    activeCards = catalog.cards,
                )
            }.onFailure { error ->
                uiState = uiState.copy(
                    isLoading = false,
                    errorMessage = error.message ?: "Impossible de charger l'extension.",
                )
            }
        }
    }

    fun showCatalogChooser() {
        uiState = uiState.copy(
            isCatalogChooserVisible = true,
            searchTerm = "",
        )
    }

    fun searchOpportunities() {
        viewModelScope.launch {
            val budget = uiState.budgetInput.replace(',', '.').toDoubleOrNull() ?: 10.0
            uiState = uiState.copy(isLoading = true, errorMessage = null)
            suspendRunCatching {
                repository.loadOpportunities(budget)
            }.onSuccess { (minPrice, opportunities) ->
                uiState = uiState.copy(
                    isLoading = false,
                    opportunities = opportunities,
                    opportunitiesNote = "Cartes entre ${formatEuro(minPrice)} et ${formatEuro(budget)} avec momentum positif base locale (tendance).",
                )
            }.onFailure { error ->
                uiState = uiState.copy(
                    isLoading = false,
                    errorMessage = error.message ?: "Impossible de charger le screener.",
                )
            }
        }
    }

    fun openCard(cardId: String) {
        viewModelScope.launch {
            uiState = uiState.copy(detailLoading = true, errorMessage = null)
            suspendRunCatching {
                repository.loadCardDetail(cardId)
            }.onSuccess { detail ->
                uiState = uiState.copy(
                    detailLoading = false,
                    selectedCard = detail,
                )
            }.onFailure { error ->
                uiState = uiState.copy(
                    detailLoading = false,
                    errorMessage = error.message ?: "Impossible de charger la fiche carte.",
                )
            }
        }
    }

    fun closeCardDetail() {
        uiState = uiState.copy(selectedCard = null, detailLoading = false)
    }

    fun clearError() {
        uiState = uiState.copy(errorMessage = null)
    }

    private suspend fun loadAll(refreshFromSource: Boolean) {
        uiState = uiState.copy(isLoading = true, errorMessage = null)
        suspendRunCatching {
            if (refreshFromSource) {
                suspendRunCatching { repository.refreshDatabaseFromStoredUri() }
            }
            val series = repository.loadSeries()
            val allSets = series.flatMap { it.sets }
            val preferredSet = allSets.firstOrNull()
            val activeCatalog = preferredSet?.let { repository.loadSetCatalog(it.id) }
            val budget = uiState.budgetInput.replace(',', '.').toDoubleOrNull() ?: 10.0
            val opportunities = repository.loadOpportunities(budget)
            LoadedData(
                series = series,
                activeCatalog = activeCatalog,
                minPrice = opportunities.first,
                opportunities = opportunities.second,
            )
        }.onSuccess { data ->
            uiState = uiState.copy(
                isLoading = false,
                isDatabaseReady = true,
                databaseLabel = repository.getSelectedDatabaseLabel() ?: "tracker_snapshot.db",
                series = data.series,
                isCatalogChooserVisible = true,
                activeSet = data.activeCatalog?.set,
                activeCards = data.activeCatalog?.cards.orEmpty(),
                opportunities = data.opportunities,
                opportunitiesNote = "Cartes entre ${formatEuro(data.minPrice)} et ${formatEuro(uiState.budgetInput.replace(',', '.').toDoubleOrNull() ?: 10.0)} avec momentum positif base locale (tendance).",
            )
        }.onFailure { error ->
            uiState = uiState.copy(
                isLoading = false,
                isDatabaseReady = repository.hasDatabase(),
                errorMessage = error.message ?: "Erreur de chargement.",
            )
        }
    }

    private data class LoadedData(
        val series: List<SerieSummary>,
        val activeCatalog: SetCatalog?,
        val minPrice: Double,
        val opportunities: List<Opportunity>,
    )
}

private suspend fun <T> suspendRunCatching(block: suspend () -> T): Result<T> =
    try {
        Result.success(block())
    } catch (error: Throwable) {
        Result.failure(error)
    }
