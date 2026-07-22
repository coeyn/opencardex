package com.example.pokemon_tcg_tracker

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts.OpenDocument
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.pokemon_tcg_tracker.ui.theme.Pokemon_tcg_trackerTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            Pokemon_tcg_trackerTheme {
                val viewModel: MainViewModel = viewModel()
                val launcher = rememberLauncherForActivityResult(OpenDocument()) { uri ->
                    if (uri != null) {
                        viewModel.onDatabasePicked(uri)
                    }
                }

                TrackerApp(
                    state = viewModel.uiState,
                    onPickDatabase = { launcher.launch(arrayOf("*/*")) },
                    onRefreshDatabase = viewModel::refreshDatabase,
                    onSwitchTab = viewModel::switchTab,
                    onSearchChange = viewModel::setSearchTerm,
                    onSortFieldChange = viewModel::setSortField,
                    onSortDirectionChange = viewModel::setSortDirection,
                    onSelectSet = viewModel::selectSet,
                    onBackToCatalogChooser = viewModel::showCatalogChooser,
                    onBudgetChange = viewModel::setBudgetInput,
                    onSearchOpportunities = viewModel::searchOpportunities,
                    onOpenCard = viewModel::openCard,
                    onCloseCardDetail = viewModel::closeCardDetail,
                    onClearError = viewModel::clearError,
                )
            }
        }
    }
}
