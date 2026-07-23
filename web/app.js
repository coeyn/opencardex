const state = {
  series: [],
  activeSetId: null,
  activeSetCards: [],
  activeSetData: null,
  sortField: "avg",
  sortDirection: "desc",
  budget: 10,
  chartTimeline: [],
  selectedChartIndex: -1,
  searchMode: false,
  searchSuggestions: [],
  selectedSuggestionIndex: -1,
  quoteItems: [],
  pendingQuoteDraft: null,
  currentDetailCard: null,
  currentPage: "catalog",
  detailReturnPage: "catalog",
  binders: [],
  ownedCards: [],
  pendingOwnedCardDraft: null,
  ownedCardSearchResults: [],
  cardDetailsCache: new Map(),
  staticSearchIndex: null,
  staticCardDetailsBySet: new Map(),
};

const QUOTE_STORAGE_KEY = "pokemon_tcg_tracker_quote_v1";

function releaseDateValue(value) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getOrderedSeries(series) {
  return [...series]
    .map((serie) => ({
      ...serie,
      sets: [...(serie.sets || [])].sort(
        (left, right) => releaseDateValue(right.release_date) - releaseDateValue(left.release_date),
      ),
    }))
    .sort((left, right) => {
      const leftLatest = Math.max(...left.sets.map((setItem) => releaseDateValue(setItem.release_date)), 0);
      const rightLatest = Math.max(...right.sets.map((setItem) => releaseDateValue(setItem.release_date)), 0);
      if (leftLatest !== rightLatest) {
        return rightLatest - leftLatest;
      }
      return left.name.localeCompare(right.name, "fr", { sensitivity: "base" });
    });
}

const els = {
  seriesSelect: document.querySelector("#series-select"),
  setStrip: document.querySelector("#set-strip"),
  catalogSearchToggle: document.querySelector("#catalog-search-toggle"),
  catalogSearchRow: document.querySelector("#catalog-search-row"),
  setTitle: document.querySelector("#set-title"),
  setMeta: document.querySelector("#set-meta"),
  setSerie: document.querySelector("#set-serie"),
  setCount: document.querySelector("#set-count"),
  navCatalog: document.querySelector("#nav-catalog"),
  navBinders: document.querySelector("#nav-binders"),
  navAccount: document.querySelector("#nav-account"),
  mobileNavCatalog: document.querySelector("#mobile-nav-catalog"),
  mobileNavBinders: document.querySelector("#mobile-nav-binders"),
  mobileNavAccount: document.querySelector("#mobile-nav-account"),
  navQuoteCount: document.querySelector("#nav-quote-count"),
  navQuoteTotal: document.querySelector("#nav-quote-total"),
  catalogPage: document.querySelector("#catalog-page"),
  bindersPage: document.querySelector("#binders-page"),
  accountPage: document.querySelector("#account-page"),
  cardDetailPage: document.querySelector("#card-detail-page"),
  collectionSummary: document.querySelector("#collection-summary"),
  collectionGrid: document.querySelector("#collection-grid"),
  collectionFilterBinder: document.querySelector("#collection-filter-binder"),
  collectionSort: document.querySelector("#collection-sort"),
  collectionExportButton: document.querySelector("#collection-export-button"),
  collectionImportButton: document.querySelector("#collection-import-button"),
  collectionImportInput: document.querySelector("#collection-import-input"),
  binderForm: document.querySelector("#binder-form"),
  binderName: document.querySelector("#binder-name"),
  binderDescription: document.querySelector("#binder-description"),
  binderList: document.querySelector("#binder-list"),
  ownedCardSearch: document.querySelector("#owned-card-search"),
  ownedCardSearchButton: document.querySelector("#owned-card-search-button"),
  ownedCardSearchResults: document.querySelector("#owned-card-search-results"),
  cardTotal: document.querySelector("#card-total"),
  cardsGrid: document.querySelector("#cards-grid"),
  cardSearch: document.querySelector("#card-search"),
  cardSearchSuggestions: document.querySelector("#card-search-suggestions"),
  sortField: document.querySelector("#sort-field"),
  sortDirection: document.querySelector("#sort-direction"),
  setChipTemplate: document.querySelector("#set-chip-template"),
  cardTemplate: document.querySelector("#card-template"),
  dialogClose: document.querySelector("#dialog-close"),
  dialogImage: document.querySelector("#dialog-image"),
  dialogImageNote: document.querySelector("#dialog-image-note"),
  dialogLocalId: document.querySelector("#dialog-local-id"),
  dialogTitle: document.querySelector("#dialog-title"),
  dialogSubtitle: document.querySelector("#dialog-subtitle"),
  dialogSetLogo: document.querySelector("#dialog-set-logo"),
  dialogCardmarket: document.querySelector("#dialog-cardmarket"),
  dialogAddOwned: document.querySelector("#dialog-add-owned"),
  dialogAvg: document.querySelector("#dialog-avg"),
  dialogMean: document.querySelector("#dialog-mean"),
  dialogLow: document.querySelector("#dialog-low"),
  dialogChange: document.querySelector("#dialog-change"),
  dialogHolo: document.querySelector("#dialog-holo"),
  dialogReverse: document.querySelector("#dialog-reverse"),
  dialogHistoryMode: document.querySelector("#dialog-history-mode"),
  dialogHistoryCount: document.querySelector("#dialog-history-count"),
  dialogChart: document.querySelector("#dialog-chart"),
  dialogChartSelection: document.querySelector("#dialog-chart-selection"),
  dialogHistory: document.querySelector("#dialog-history"),
  quoteList: document.querySelector("#quote-list"),
  quoteCount: document.querySelector("#quote-count"),
  quoteTotal: document.querySelector("#quote-total"),
  quoteImportButton: document.querySelector("#quote-import-button"),
  quoteImportInput: document.querySelector("#quote-import-input"),
  quoteSaveButton: document.querySelector("#quote-save-button"),
  quoteExportJsonButton: document.querySelector("#quote-export-json-button"),
  quoteExportButton: document.querySelector("#quote-export-button"),
  quoteResetButton: document.querySelector("#quote-reset-button"),
  quoteDraftPanel: document.querySelector("#quote-draft-panel"),
  quoteDraftTitle: document.querySelector("#quote-draft-title"),
  quoteDraftSubtitle: document.querySelector("#quote-draft-subtitle"),
  quoteDraftPrice: document.querySelector("#quote-draft-price"),
  quoteDraftQuantity: document.querySelector("#quote-draft-quantity"),
  quoteDraftCardmarket: document.querySelector("#quote-draft-cardmarket"),
  quoteDraftConfirm: document.querySelector("#quote-draft-confirm"),
  quoteDraftCancel: document.querySelector("#quote-draft-cancel"),
  ownedCardDraftPanel: document.querySelector("#owned-card-draft-panel"),
  ownedDraftTitle: document.querySelector("#owned-draft-title"),
  ownedDraftSubtitle: document.querySelector("#owned-draft-subtitle"),
  ownedDraftBinder: document.querySelector("#owned-draft-binder"),
  ownedDraftQuantity: document.querySelector("#owned-draft-quantity"),
  ownedDraftCondition: document.querySelector("#owned-draft-condition"),
  ownedDraftLanguage: document.querySelector("#owned-draft-language"),
  ownedDraftVariant: document.querySelector("#owned-draft-variant"),
  ownedDraftPage: document.querySelector("#owned-draft-page"),
  ownedDraftSlot: document.querySelector("#owned-draft-slot"),
  ownedDraftForTrade: document.querySelector("#owned-draft-for-trade"),
  ownedDraftWanted: document.querySelector("#owned-draft-wanted"),
  ownedDraftConfirm: document.querySelector("#owned-draft-confirm"),
  ownedDraftCancel: document.querySelector("#owned-draft-cancel"),
};

async function fetchJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    const staticPayload = await fetchStaticJsonFallback(url);
    if (staticPayload !== null) {
      return staticPayload;
    }
    throw error;
  }
}

async function fetchStaticJsonFallback(url) {
  const parsed = new URL(url, window.location.href);
  const path = parsed.pathname.replace(/^.*\/api\//, "api/");
  if (!path.startsWith("api/")) {
    return null;
  }

  if (path === "api/series") {
    return fetchStaticJson("data/series.json");
  }

  if (path.startsWith("api/sets/")) {
    return fetchStaticJson(`data/sets/${encodeURIComponent(path.replace("api/sets/", ""))}.json`);
  }

  if (path.startsWith("api/cards/")) {
    return loadStaticCardDetail(path.replace("api/cards/", ""));
  }

  if (path === "api/search/cards") {
    const query = parsed.searchParams.get("q") || "";
    const limit = Number(parsed.searchParams.get("limit") || 120);
    return searchStaticCards(query, limit);
  }

  if (path === "api/search/suggestions") {
    const query = parsed.searchParams.get("q") || "";
    const limit = Number(parsed.searchParams.get("limit") || 8);
    return searchStaticSuggestions(query, limit);
  }

  if (path === "api/opportunities") {
    const budget = Number(parsed.searchParams.get("budget") || 10);
    const limit = Number(parsed.searchParams.get("limit") || 18);
    return loadStaticOpportunities(budget, limit);
  }

  return null;
}

async function fetchStaticJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Static data unavailable: ${path}`);
  }
  return response.json();
}

async function loadStaticSearchIndex() {
  if (state.staticSearchIndex) {
    return state.staticSearchIndex;
  }
  const payload = await fetchStaticJson("data/search-index.json");
  state.staticSearchIndex = payload.cards || [];
  return state.staticSearchIndex;
}

async function loadStaticCardDetail(cardId) {
  const cards = await loadStaticSearchIndex();
  const brief = cards.find((card) => card.id === cardId);
  if (!brief?.set_id) {
    throw new Error(`Static card not found: ${cardId}`);
  }
  if (!state.staticCardDetailsBySet.has(brief.set_id)) {
    const payload = await fetchStaticJson(`data/card-details/${encodeURIComponent(brief.set_id)}.json`);
    state.staticCardDetailsBySet.set(brief.set_id, payload.cards || {});
  }
  const details = state.staticCardDetailsBySet.get(brief.set_id);
  const card = details[cardId];
  if (!card) {
    throw new Error(`Static card detail not found: ${cardId}`);
  }
  return card;
}

async function searchStaticCards(query, limit) {
  const normalized = query.trim().toLocaleLowerCase("fr-FR");
  if (!normalized) {
    return { query: "", count: 0, cards: [] };
  }
  const cards = await loadStaticSearchIndex();
  const results = cards
    .filter((card) => `${card.name || ""} ${card.local_id || ""} ${card.set_name || ""}`.toLocaleLowerCase("fr-FR").includes(normalized))
    .sort((left, right) => String(left.name).localeCompare(String(right.name), "fr", { sensitivity: "base" }))
    .slice(0, limit);
  return { query, count: results.length, cards: results };
}

async function searchStaticSuggestions(query, limit) {
  const normalized = query.trim().toLocaleLowerCase("fr-FR");
  if (normalized.length < 2) {
    return { query, suggestions: [] };
  }
  const cards = await loadStaticSearchIndex();
  const byName = new Map();
  for (const card of cards) {
    const name = String(card.name || "");
    if (!name.toLocaleLowerCase("fr-FR").includes(normalized)) continue;
    byName.set(name, (byName.get(name) || 0) + 1);
  }
  const suggestions = [...byName.entries()]
    .map(([name, cardCount]) => ({ name, card_count: cardCount }))
    .sort((left, right) => left.name.localeCompare(right.name, "fr", { sensitivity: "base" }))
    .slice(0, limit);
  return { query, suggestions };
}

async function loadStaticOpportunities(budget, limit) {
  const cards = await loadStaticSearchIndex();
  const minPrice = Math.max(Math.max(budget * 0.7, budget - 3), 0.25);
  const candidates = cards
    .map((card) => {
      const avg = Number(card.latest_price?.avg);
      if (!Number.isFinite(avg) || avg < minPrice || avg > budget) return null;
      const slope = card.slope || {};
      const delta = Number(slope.delta_pct || 0);
      return {
        card_id: card.id,
        local_id: card.local_id,
        name: card.name,
        set_name: card.set_name,
        current_avg: avg,
        current_low: card.latest_price?.low,
        trend: card.latest_price?.trend,
        avg_holo: card.latest_price?.avg_holo,
        reverse_market: card.latest_price?.tcgplayer_reverse_market,
        snapshot_count: slope.points || 0,
        pct7: null,
        pct30: delta,
        score: Math.round((Math.max(delta, 0) + Math.max(budget - avg, 0)) * 100) / 100,
        image_url: card.image_url,
        image_language: card.image_language,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
  return { budget, min_price: minPrice, limit, candidates };
}

let searchSuggestionRequestId = 0;

function clearSearchSuggestions() {
  state.searchSuggestions = [];
  state.selectedSuggestionIndex = -1;
  els.cardSearchSuggestions.innerHTML = "";
  els.cardSearchSuggestions.hidden = true;
}

function renderSearchSuggestions() {
  els.cardSearchSuggestions.innerHTML = "";
  if (!state.searchSuggestions.length) {
    els.cardSearchSuggestions.hidden = true;
    return;
  }

  for (const [index, item] of state.searchSuggestions.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-suggestion";
    if (index === state.selectedSuggestionIndex) {
      button.classList.add("is-active");
    }
    button.innerHTML = `
      <span class="search-suggestion-name">${item.name}</span>
      <span class="search-suggestion-count">${item.card_count} carte(s)</span>
    `;
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      applySearchSuggestion(index);
    });
    els.cardSearchSuggestions.appendChild(button);
  }

  els.cardSearchSuggestions.hidden = false;
}

function applySearchSuggestion(index) {
  const item = state.searchSuggestions[index];
  if (!item) {
    return;
  }
  els.cardSearch.value = item.name;
  clearSearchSuggestions();
  searchCards(item.name).catch((error) => {
    els.setMeta.textContent = String(error);
  });
}

async function updateSearchSuggestions(query) {
  const normalized = query.trim();
  const requestId = ++searchSuggestionRequestId;

  if (normalized.length < 2) {
    clearSearchSuggestions();
    return;
  }

  try {
    const payload = await fetchJson(
      `api/search/suggestions?q=${encodeURIComponent(normalized)}&limit=8`,
    );
    if (requestId !== searchSuggestionRequestId) {
      return;
    }
    state.searchSuggestions = payload.suggestions || [];
    state.selectedSuggestionIndex = state.searchSuggestions.length ? 0 : -1;
    renderSearchSuggestions();
  } catch {
    if (requestId === searchSuggestionRequestId) {
      clearSearchSuggestions();
    }
  }
}

function formatDate(value) {
  if (!value) return "Date inconnue";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatDateTime(value) {
  if (!value) return "Date inconnue";
  return new Date(value).toLocaleString("fr-FR");
}

function formatPrice(value) {
  if (value === null || value === undefined) return "N/A";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatUsdPrice(value) {
  if (value === null || value === undefined) return "N/A";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value) {
  if (value === null || value === undefined) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function getLatestMarketPrice(card) {
  const latest = card?.latest_price || {};
  const candidates = [latest.avg, latest.trend, latest.avg_holo, latest.low];
  for (const candidate of candidates) {
    if (candidate !== null && candidate !== undefined && Number.isFinite(Number(candidate))) {
      return Number(candidate);
    }
  }
  return null;
}

const priceProvider = {
  async getCardPrice(cardId) {
    if (!cardId) return null;
    const detail = await getCardDetailCached(cardId);
    const marketPrice = getLatestMarketPrice(detail);
    if (marketPrice === null) return null;
    return {
      cardId,
      marketPrice,
      currency: "EUR",
      source: "TCGdex/Cardmarket via SQLite local",
      updatedAt: detail.latest_price?.captured_at || null,
    };
  },
  async getLastUpdate() {
    const dates = state.ownedCards
      .map((owned) => state.cardDetailsCache.get(owned.cardId)?.latest_price?.captured_at)
      .filter(Boolean)
      .sort();
    return dates.at(-1) || null;
  },
  async refresh() {
    state.cardDetailsCache.clear();
  },
};

async function getCardDetailCached(cardId) {
  if (state.cardDetailsCache.has(cardId)) {
    return state.cardDetailsCache.get(cardId);
  }
  const detail = await fetchJson(`api/cards/${encodeURIComponent(cardId)}`);
  state.cardDetailsCache.set(cardId, detail);
  return detail;
}

function loadQuote() {
  try {
    const raw = localStorage.getItem(QUOTE_STORAGE_KEY);
    state.quoteItems = raw ? normalizeQuoteItems(JSON.parse(raw)) : [];
  } catch {
    state.quoteItems = [];
  }
}

function saveQuote() {
  localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(state.quoteItems));
  renderQuote();
}

function normalizeQuoteItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => ({
      card_id: String(item.card_id || ""),
      local_id: String(item.local_id || ""),
      name: String(item.name || ""),
      set_name: String(item.set_name || ""),
      image_url: String(item.image_url || ""),
      cardmarket_url: String(item.cardmarket_url || ""),
      market_price_at_quote:
        item.market_price_at_quote === null || item.market_price_at_quote === undefined
          ? null
          : Math.max(0, Number(item.market_price_at_quote) || 0),
      adjustment_percent: Number(item.adjustment_percent) || 0,
      unit_price: Math.max(0, Number(item.unit_price ?? item.offered_unit_price) || 0),
      quantity: Math.max(1, Number(item.quantity) || 1),
      slope: item.slope && typeof item.slope === "object" ? item.slope : null,
      quoted_at: item.quoted_at || new Date().toISOString(),
    }))
    .filter((item) => item.card_id && item.name);
}

function buildQuoteItem(card) {
  const marketPrice = getLatestMarketPrice(card);
  return {
    card_id: card.id,
    local_id: card.local_id || "",
    name: card.name,
    set_name: card.set_name || "",
    image_url: card.image_url || "",
    cardmarket_url: card.cardmarket_url || card.latest_price?.cardmarket_url || "",
    slope: card.slope || null,
    market_price_at_quote: marketPrice,
    adjustment_percent: 0,
    unit_price: marketPrice ?? 0,
    quantity: 1,
    quoted_at: new Date().toISOString(),
  };
}

function addQuoteItem(item) {
  const existing = state.quoteItems.find((entry) => entry.card_id === item.card_id);
  if (existing) {
    existing.quantity += item.quantity;
    existing.unit_price = item.unit_price;
  } else {
    state.quoteItems.push(item);
  }
  saveQuote();
}

function addCardToQuote(card) {
  addQuoteItem(buildQuoteItem(card));
}

function renderPendingQuoteDraft() {
  const draft = state.pendingQuoteDraft;
  if (!draft) {
    els.quoteDraftPanel.hidden = true;
    return;
  }

  els.quoteDraftTitle.textContent = draft.name;
  els.quoteDraftSubtitle.textContent = draft.set_name || draft.local_id || "";
  els.quoteDraftPrice.value = String(draft.unit_price ?? 0);
  els.quoteDraftQuantity.value = String(draft.quantity ?? 1);
  els.quoteDraftCardmarket.href = draft.cardmarket_url || "#";
  els.quoteDraftCardmarket.hidden = !draft.cardmarket_url;
  els.quoteDraftPanel.hidden = false;
}

function prepareQuoteDraft(card) {
  const draft = buildQuoteItem(card);
  state.pendingQuoteDraft = draft;
  renderPendingQuoteDraft();
  if (draft.cardmarket_url) {
    window.open(draft.cardmarket_url, "_blank", "noopener,noreferrer");
  }
}

function confirmPendingQuoteDraft() {
  if (!state.pendingQuoteDraft) {
    return;
  }
  const item = {
    ...state.pendingQuoteDraft,
    unit_price: Math.max(0, Number(String(els.quoteDraftPrice.value).replace(",", ".")) || 0),
    quantity: Math.max(1, Number(els.quoteDraftQuantity.value) || 1),
  };
  addQuoteItem(item);
  state.pendingQuoteDraft = null;
  renderPendingQuoteDraft();
}

function cancelPendingQuoteDraft() {
  state.pendingQuoteDraft = null;
  renderPendingQuoteDraft();
}

function removeQuoteItem(cardId) {
  state.quoteItems = state.quoteItems.filter((item) => item.card_id !== cardId);
  saveQuote();
}

function updateQuoteItem(cardId, field, value) {
  const item = state.quoteItems.find((entry) => entry.card_id === cardId);
  if (!item) {
    return;
  }
  if (field === "quantity") {
    item.quantity = Math.max(1, Number(value) || 1);
  }
  if (field === "unit_price") {
    item.unit_price = Math.max(0, Number(String(value).replace(",", ".")) || 0);
  }
  saveQuote();
}

function renderQuote() {
  const total = state.quoteItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const cardCount = state.quoteItems.reduce((sum, item) => sum + item.quantity, 0);
  els.quoteCount.textContent = `${cardCount} carte(s)`;
  els.quoteTotal.textContent = formatPrice(total);
  els.navQuoteCount.textContent = `${cardCount} carte(s)`;
  els.navQuoteTotal.textContent = formatPrice(total);

  els.quoteList.innerHTML = "";
  if (!state.quoteItems.length) {
    els.quoteList.innerHTML = "<p class='subtitle'>Aucune carte dans le devis.</p>";
    return;
  }

  for (const item of state.quoteItems) {
    const row = document.createElement("article");
    row.className = "quote-row";
    row.dataset.cardId = item.card_id;
    const slope = item.slope || {};
    row.innerHTML = `
      <div class="quote-image-wrap">
        <span class="quote-slope-badge ${slope.state ? `is-${slope.state}` : ""}" title="${
          slope.delta_pct !== null && slope.delta_pct !== undefined
            ? `${formatPercent(slope.delta_pct)} sur ${slope.points || 0} snapshot(s)`
            : ""
        }">${slope.label || ""}</span>
        <img src="${item.image_url || ""}" alt="${item.name}">
      </div>
      <div class="quote-card-copy">
        <p class="card-local-id">${item.local_id || "Sans no"}</p>
        <h3>${item.name}</h3>
        <p class="subtitle">${item.set_name || ""}</p>
      </div>
      <label class="quote-field">
        <span class="history-cell-label">Prix unitaire</span>
        <input data-field="unit_price" data-card-id="${item.card_id}" type="number" min="0" step="0.01" value="${item.unit_price}">
      </label>
      <label class="quote-field">
        <span class="history-cell-label">Quantite</span>
        <input data-field="quantity" data-card-id="${item.card_id}" type="number" min="1" step="1" value="${item.quantity}">
      </label>
      <div class="quote-card-copy">
        <span class="history-cell-label">Total ligne</span>
        <strong>${formatPrice(item.unit_price * item.quantity)}</strong>
      </div>
      <div class="quote-actions">
        ${
          item.cardmarket_url
            ? `<a class="quote-cardmarket" href="${item.cardmarket_url}" target="_blank" rel="noopener noreferrer">Cardmarket</a>`
            : ""
        }
        <button class="quote-remove" type="button" data-remove-card-id="${item.card_id}">X</button>
      </div>
    `;
    els.quoteList.appendChild(row);
  }

  els.quoteList.querySelectorAll(".quote-row").forEach((row) => {
    row.addEventListener("click", () => {
      openCardDetail(row.dataset.cardId).catch((error) => {
        els.setMeta.textContent = String(error);
      });
    });
  });
  els.quoteList.querySelectorAll("input[data-card-id]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", () => {
      updateQuoteItem(input.dataset.cardId, input.dataset.field, input.value);
    });
  });
  els.quoteList.querySelectorAll(".quote-cardmarket").forEach((link) => {
    link.addEventListener("click", (event) => event.stopPropagation());
  });
  els.quoteList.querySelectorAll("button[data-remove-card-id]").forEach((button) => {
    button.addEventListener("click", (event) => event.stopPropagation());
    button.addEventListener("click", () => {
      removeQuoteItem(button.dataset.removeCardId);
    });
  });
}

function exportQuoteCsv() {
  const total = state.quoteItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const lines = [
    ["Nom", "Extension", "Numero", "Prix unitaire (€)", "Quantite", "Total ligne (€)"],
    ...state.quoteItems.map((item) => [
      item.name,
      item.set_name,
      item.local_id,
      formatPrice(item.unit_price),
      String(item.quantity),
      formatPrice(item.unit_price * item.quantity),
    ]),
    [],
    ["TOTAL", "", "", "", "", formatPrice(total)],
  ];
  const csv = lines.map((line) => line.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "devis_pokemon_tcg.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function exportQuoteJson() {
  const payload = {
    exported_at: new Date().toISOString(),
    items: state.quoteItems,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "devis_pokemon_tcg.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importQuoteFile(file) {
  if (!file) {
    return;
  }
  const text = await file.text();
  const parsed = JSON.parse(text);
  const items = normalizeQuoteItems(parsed?.items ?? parsed);
  state.quoteItems = items;
  saveQuote();
}

async function loadCollectionData() {
  if (!window.OpenCardexStore) return;
  state.binders = await OpenCardexStore.getBinders();
  state.ownedCards = await OpenCardexStore.getOwnedCards();
  if (!state.binders.length) {
    state.binders = [
      await OpenCardexStore.saveBinder({
        name: "Classeur principal",
        description: "Classeur cree automatiquement.",
      }),
    ];
  }
  renderCollectionFilters();
  renderOwnedDraftBinderOptions();
  renderBinders();
  await renderCollection();
}

function getBinderName(binderId) {
  return state.binders.find((binder) => binder.id === binderId)?.name || "Sans classeur";
}

async function getOwnedCardView(ownedCard) {
  try {
    const detail = await getCardDetailCached(ownedCard.cardId);
    const price = await priceProvider.getCardPrice(ownedCard.cardId);
    return {
      ownedCard,
      detail,
      price,
      totalValue: price ? price.marketPrice * ownedCard.quantity : null,
    };
  } catch {
    return {
      ownedCard,
      detail: {
        id: ownedCard.cardId,
        name: ownedCard.cardId,
        image_url: "",
        set_name: "Carte temporairement indisponible",
      },
      price: null,
      totalValue: null,
    };
  }
}

async function buildOwnedCardViews() {
  return Promise.all(state.ownedCards.map(getOwnedCardView));
}

function renderCollectionFilters() {
  const current = els.collectionFilterBinder.value || "all";
  els.collectionFilterBinder.innerHTML = [
    `<option value="all">Tous les classeurs</option>`,
    ...state.binders.map((binder) => `<option value="${binder.id}">${escapeHtml(binder.name)}</option>`),
  ].join("");
  els.collectionFilterBinder.value = state.binders.some((binder) => binder.id === current) ? current : "all";
}

async function renderCollection() {
  const selectedBinder = els.collectionFilterBinder.value || "all";
  const views = await buildOwnedCardViews();
  const filtered = views.filter((view) => selectedBinder === "all" || view.ownedCard.binderId === selectedBinder);
  filtered.sort((left, right) => {
    if (els.collectionSort.value === "name_asc") {
      return left.detail.name.localeCompare(right.detail.name, "fr", { sensitivity: "base" });
    }
    if (els.collectionSort.value === "value_desc") {
      return (right.totalValue ?? -1) - (left.totalValue ?? -1);
    }
    return String(right.ownedCard.updatedAt).localeCompare(String(left.ownedCard.updatedAt));
  });

  const totalQuantity = filtered.reduce((sum, view) => sum + view.ownedCard.quantity, 0);
  const knownValue = filtered.reduce((sum, view) => sum + (view.totalValue ?? 0), 0);
  const missingCount = filtered.filter((view) => view.totalValue === null).length;
  els.collectionSummary.textContent =
    `${totalQuantity} carte(s), valeur estimee ${formatPrice(knownValue)}${missingCount ? `, ${missingCount} prix indisponible(s)` : ""}.`;
  els.collectionGrid.innerHTML = "";
  if (!filtered.length) {
    els.collectionGrid.innerHTML = "<p class='subtitle'>Aucune carte dans cette vue.</p>";
    return;
  }
  for (const view of filtered) {
    const { ownedCard, detail, totalValue, price } = view;
    const article = document.createElement("article");
    article.className = "owned-card";
    article.innerHTML = `
      <div class="card-visual-wrap">
        <img class="card-visual" src="${detail.image_url || ""}" alt="${escapeHtml(detail.name)}">
        <p class="card-placeholder">Image indisponible</p>
      </div>
      <div class="card-copy">
        <p class="card-local-id">${escapeHtml(detail.local_id || ownedCard.cardId)}</p>
        <h3 class="card-name">${escapeHtml(detail.name)}</h3>
        <p class="card-set-name">${escapeHtml(detail.set_name || "")}</p>
        <p class="subtitle">${escapeHtml(getBinderName(ownedCard.binderId))} - ${ownedCard.quantity} ex. - ${escapeHtml(ownedCard.condition)} - ${escapeHtml(ownedCard.variant)}</p>
        <p class="subtitle">${price ? `${formatPrice(totalValue)} - ${escapeHtml(price.source)} - ${formatDateTime(price.updatedAt)}` : "Prix indisponible"}</p>
      </div>
      <div class="quote-draft-actions">
        <button class="nav-button" type="button" data-move-owned="${ownedCard.id}">Deplacer</button>
        <button class="quote-remove" type="button" data-delete-owned="${ownedCard.id}">Supprimer</button>
      </div>
    `;
    const image = article.querySelector(".card-visual");
    image.hidden = !detail.image_url;
    article.querySelector("[data-delete-owned]").addEventListener("click", async () => {
      if (!confirm("Supprimer cette carte de la collection ?")) return;
      await OpenCardexStore.deleteOwnedCard(ownedCard.id);
      await loadCollectionData();
    });
    article.querySelector("[data-move-owned]").addEventListener("click", async () => {
      const choices = state.binders.map((binder) => `${binder.id} : ${binder.name}`).join("\n");
      const nextBinderId = prompt(`ID du classeur cible:\n${choices}`, ownedCard.binderId || "");
      if (nextBinderId === null) return;
      await OpenCardexStore.saveOwnedCard({ ...ownedCard, binderId: nextBinderId || undefined });
      await loadCollectionData();
    });
    els.collectionGrid.appendChild(article);
  }
}

function renderBinders() {
  els.binderList.innerHTML = "";
  for (const binder of state.binders) {
    const quantity = state.ownedCards
      .filter((card) => card.binderId === binder.id)
      .reduce((sum, card) => sum + card.quantity, 0);
    const article = document.createElement("article");
    article.className = "binder-card";
    article.innerHTML = `
      <h3>${escapeHtml(binder.name)}</h3>
      <p class="subtitle">${escapeHtml(binder.description || "Aucune description")}</p>
      <p class="subtitle">${quantity} carte(s)</p>
      <div class="quote-draft-actions">
        <button class="nav-button" type="button" data-open-binder="${binder.id}">Voir</button>
        <button class="quote-remove" type="button" data-delete-binder="${binder.id}">Supprimer</button>
      </div>
    `;
    article.querySelector("[data-open-binder]").addEventListener("click", () => {
      switchPage("collection");
      els.collectionFilterBinder.value = binder.id;
      renderCollection();
    });
    article.querySelector("[data-delete-binder]").addEventListener("click", async () => {
      if (!confirm("Supprimer ce classeur ? Les cartes resteront dans la collection sans classeur.")) return;
      await OpenCardexStore.deleteBinder(binder.id);
      for (const card of state.ownedCards.filter((item) => item.binderId === binder.id)) {
        await OpenCardexStore.saveOwnedCard({ ...card, binderId: undefined });
      }
      await loadCollectionData();
    });
    els.binderList.appendChild(article);
  }
}

function renderOwnedDraftBinderOptions() {
  els.ownedDraftBinder.innerHTML = [
    `<option value="">Sans classeur</option>`,
    ...state.binders.map((binder) => `<option value="${binder.id}">${escapeHtml(binder.name)}</option>`),
  ].join("");
}

function prepareOwnedCardDraft(card) {
  state.pendingOwnedCardDraft = card;
  els.ownedDraftTitle.textContent = card.name;
  els.ownedDraftSubtitle.textContent = card.set_name || card.local_id || "";
  els.ownedDraftQuantity.value = "1";
  els.ownedDraftCondition.value = "near_mint";
  els.ownedDraftLanguage.value = "fr";
  els.ownedDraftVariant.value = "normal";
  els.ownedDraftPage.value = "";
  els.ownedDraftSlot.value = "";
  els.ownedDraftForTrade.checked = false;
  els.ownedDraftWanted.checked = false;
  renderOwnedDraftBinderOptions();
  els.ownedCardDraftPanel.hidden = false;
}

async function addCardToBinder(card, binderId) {
  await OpenCardexStore.saveOwnedCard({
    cardId: card.id,
    binderId: binderId || undefined,
    quantity: 1,
    condition: "near_mint",
    language: "fr",
    variant: "normal",
    page: "",
    slot: "",
    forTrade: false,
    wanted: false,
  });
  await loadCollectionData();
}

async function confirmOwnedCardDraft() {
  const card = state.pendingOwnedCardDraft;
  if (!card) return;
  await OpenCardexStore.saveOwnedCard({
    cardId: card.id,
    binderId: els.ownedDraftBinder.value || undefined,
    quantity: els.ownedDraftQuantity.value,
    condition: els.ownedDraftCondition.value,
    language: els.ownedDraftLanguage.value,
    variant: els.ownedDraftVariant.value,
    page: els.ownedDraftPage.value,
    slot: els.ownedDraftSlot.value,
    forTrade: els.ownedDraftForTrade.checked,
    wanted: els.ownedDraftWanted.checked,
  });
  state.pendingOwnedCardDraft = null;
  els.ownedCardDraftPanel.hidden = true;
  await loadCollectionData();
}

async function searchOwnedCards() {
  const query = els.ownedCardSearch.value.trim();
  if (!query) return;
  const payload = await fetchJson(`api/search/cards?q=${encodeURIComponent(query)}&limit=60`);
  els.ownedCardSearchResults.innerHTML = "";
  const cards = payload.cards || [];
  if (!cards.length) {
    els.ownedCardSearchResults.innerHTML = "<p class='subtitle'>Aucune carte trouvee.</p>";
    return;
  }
  for (const card of cards) {
    const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".card-local-id").textContent = card.local_id || "Sans no";
    node.querySelector(".card-name").textContent = card.name;
    node.querySelector(".card-set-name").textContent = card.set_name || "";
    const image = node.querySelector(".card-visual");
    image.src = card.image_url || "";
    image.alt = card.name;
    image.hidden = !card.image_url;
    node.querySelector(".image-price-main").textContent =
      getLatestMarketPrice(card) === null ? "Prix N/A" : formatPrice(getLatestMarketPrice(card));
    node.querySelector(".image-price-reverse").textContent = "";
    node.querySelector(".card-button").addEventListener("click", () => openCardDetail(card.id));
    const addButton = node.querySelector(".card-quote-button");
    addButton.textContent = "+ Collection";
    addButton.addEventListener("click", (event) => {
      event.stopPropagation();
      prepareOwnedCardDraft(card);
    });
    els.ownedCardSearchResults.appendChild(node);
  }
}

async function exportCollectionJson() {
  const payload = await OpenCardexStore.exportBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "opencardex_sauvegarde.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importCollectionJson(file) {
  if (!file) return;
  await OpenCardexStore.importBackup(JSON.parse(await file.text()));
  await loadCollectionData();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function switchPage(page) {
  const normalizedPage = page === "detail"
    ? "detail"
    : page === "account"
    ? "account"
    : ["collection", "binders", "add-cards", "quote"].includes(page)
      ? "binders"
      : "catalog";
  const catalogActive = normalizedPage === "catalog";
  const bindersActive = normalizedPage === "binders";
  const accountActive = normalizedPage === "account";
  const detailActive = normalizedPage === "detail";

  els.catalogPage.hidden = !catalogActive;
  els.bindersPage.hidden = !bindersActive;
  els.accountPage.hidden = !accountActive;
  els.cardDetailPage.hidden = !detailActive;

  els.navBinders.classList.toggle("is-active", bindersActive);
  els.navCatalog.classList.toggle("is-active", catalogActive);
  els.navAccount.classList.toggle("is-active", accountActive);
  els.mobileNavCatalog.classList.toggle("is-active", catalogActive);
  els.mobileNavBinders.classList.toggle("is-active", bindersActive);
  els.mobileNavAccount.classList.toggle("is-active", accountActive);
  document.body.classList.toggle("is-detail-page", detailActive);
  state.currentPage = normalizedPage;

  if (bindersActive) {
    renderCollection().catch((error) => {
      els.collectionSummary.textContent = `Collection indisponible: ${String(error)}`;
    });
  }
}

function trendClass(value) {
  if (value === null || value === undefined || value === 0) return "";
  return value > 0 ? "up" : "down";
}

function addTrendClass(element, value) {
  const klass = trendClass(value);
  if (klass) {
    element.classList.add(`trend-${klass}`);
  }
}

function parseLocalId(value) {
  if (!value) {
    return { group: 1, number: Number.MAX_SAFE_INTEGER, text: "" };
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return { group: 0, number: numeric, text: value };
  }

  const match = value.match(/^([A-Za-z]*)(\d+)$/);
  if (match) {
    return {
      group: 0,
      number: Number(match[2]),
      text: match[1] || "",
    };
  }

  return { group: 1, number: Number.MAX_SAFE_INTEGER, text: value };
}

function compareCards(left, right) {
  const direction = state.sortDirection === "desc" ? -1 : 1;

  if (state.sortField === "name") {
    return direction * left.name.localeCompare(right.name, "fr", { sensitivity: "base" });
  }

  if (state.sortField === "avg") {
    const leftPrice = left.latest_price?.avg;
    const rightPrice = right.latest_price?.avg;
    const leftValue = leftPrice ?? (state.sortDirection === "asc" ? Number.MAX_SAFE_INTEGER : -1);
    const rightValue = rightPrice ?? (state.sortDirection === "asc" ? Number.MAX_SAFE_INTEGER : -1);

    if (leftValue !== rightValue) {
      return direction * (leftValue - rightValue);
    }

    return left.name.localeCompare(right.name, "fr", { sensitivity: "base" });
  }

  const leftId = parseLocalId(left.local_id);
  const rightId = parseLocalId(right.local_id);

  if (leftId.group !== rightId.group) {
    return direction * (leftId.group - rightId.group);
  }

  if (leftId.text !== rightId.text) {
    return direction * leftId.text.localeCompare(rightId.text, "fr", { sensitivity: "base" });
  }

  if (leftId.number !== rightId.number) {
    return direction * (leftId.number - rightId.number);
  }

  return direction * left.name.localeCompare(right.name, "fr", { sensitivity: "base" });
}

function buildPriceTimeline(data) {
  const history = Array.isArray(data.history) ? data.history : [];
  const byDay = new Map();

  for (const entry of history) {
    const chartValue =
      entry.trend !== null && entry.trend !== undefined ? Number(entry.trend) : entry.avg;
    if (chartValue === null || chartValue === undefined || !entry.captured_at) {
      continue;
    }

    const date = new Date(entry.captured_at);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const dayKey = date.toISOString().slice(0, 10);
    const existing = byDay.get(dayKey);
    if (!existing) {
      byDay.set(dayKey, {
        dayKey,
        label: date.toLocaleDateString("fr-FR"),
        value_sum: Number(chartValue),
        value_count: 1,
        avg_sum: entry.avg !== null && entry.avg !== undefined ? Number(entry.avg) : null,
        avg_count: entry.avg !== null && entry.avg !== undefined ? 1 : 0,
        low_sum: entry.low !== null && entry.low !== undefined ? Number(entry.low) : null,
        low_count: entry.low !== null && entry.low !== undefined ? 1 : 0,
        trend_sum: entry.trend !== null && entry.trend !== undefined ? Number(entry.trend) : null,
        trend_count: entry.trend !== null && entry.trend !== undefined ? 1 : 0,
        reverse_sum:
          entry.tcgplayer_reverse_market !== null && entry.tcgplayer_reverse_market !== undefined
            ? Number(entry.tcgplayer_reverse_market)
            : null,
        reverse_count:
          entry.tcgplayer_reverse_market !== null && entry.tcgplayer_reverse_market !== undefined ? 1 : 0,
      });
      continue;
    }

    existing.value_sum += Number(chartValue);
    existing.value_count += 1;

    if (entry.avg !== null && entry.avg !== undefined) {
      existing.avg_sum = (existing.avg_sum ?? 0) + Number(entry.avg);
      existing.avg_count += 1;
    }

    if (entry.low !== null && entry.low !== undefined) {
      existing.low_sum = (existing.low_sum ?? 0) + Number(entry.low);
      existing.low_count += 1;
    }

    if (entry.trend !== null && entry.trend !== undefined) {
      existing.trend_sum = (existing.trend_sum ?? 0) + Number(entry.trend);
      existing.trend_count += 1;
    }

    if (entry.tcgplayer_reverse_market !== null && entry.tcgplayer_reverse_market !== undefined) {
      existing.reverse_sum = (existing.reverse_sum ?? 0) + Number(entry.tcgplayer_reverse_market);
      existing.reverse_count += 1;
    }
  }

  const points = [...byDay.values()]
    .sort((left, right) => left.dayKey.localeCompare(right.dayKey))
    .map((entry) => ({
      label: entry.label,
      value: entry.value_sum / entry.value_count,
      source: "snapshot",
      trend: entry.value_sum / entry.value_count,
      low: entry.low_count > 0 ? entry.low_sum / entry.low_count : null,
      avg: entry.avg_count > 0 ? entry.avg_sum / entry.avg_count : null,
      tcgplayer_reverse_market: entry.reverse_count > 0 ? entry.reverse_sum / entry.reverse_count : null,
      samples: entry.value_count,
    }));

  return {
    mode: "Historique local",
    points,
  };
}

function renderSeries() {
  const orderedSeries = getOrderedSeries(state.series);
  const activeSerie = orderedSeries.find((serie) =>
    serie.sets.some((setItem) => setItem.id === state.activeSetId),
  ) || orderedSeries[0];

  els.seriesSelect.innerHTML = "";
  for (const serie of orderedSeries) {
    const option = document.createElement("option");
    option.value = serie.id || serie.name;
    option.textContent = `${serie.name} (${serie.set_count})`;
    option.selected = activeSerie && (serie.id || serie.name) === (activeSerie.id || activeSerie.name);
    els.seriesSelect.appendChild(option);
  }

  els.setStrip.innerHTML = "";
  for (const setItem of activeSerie?.sets || []) {
    const chip = els.setChipTemplate.content.firstElementChild.cloneNode(true);
    chip.dataset.setId = setItem.id;
    chip.querySelector(".set-chip-label").textContent = setItem.name;

    const chipLogo = chip.querySelector(".set-chip-logo");
    chipLogo.src = setItem.symbol_url || setItem.logo_url || "";
    chipLogo.alt = "";
    chipLogo.hidden = !(setItem.symbol_url || setItem.logo_url);

    if (setItem.id === state.activeSetId) {
      chip.classList.add("is-active");
    }

    chip.addEventListener("click", () => loadSet(setItem.id));
    els.setStrip.appendChild(chip);
  }
}

function renderCards() {
  const term = els.cardSearch.value.trim().toLowerCase();
  const filtered = state.activeSetCards
    .filter((card) => {
      const haystack = `${card.local_id ?? ""} ${card.name} ${card.set_name ?? ""}`.toLowerCase();
      return haystack.includes(term);
    })
    .sort(compareCards);

  els.cardsGrid.innerHTML = "";
  els.cardTotal.textContent = `${filtered.length} cartes affichees`;

  for (const card of filtered) {
    const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
    const button = node.querySelector(".card-button");
    node.querySelector(".card-local-id").textContent = card.local_id || "Sans no";
    node.querySelector(".card-name").textContent = card.name;
    node.querySelector(".card-set-name").textContent = state.searchMode ? card.set_name || "" : "";
    const addQuoteButton = node.querySelector(".card-quote-button");

    const languageBadge = node.querySelector(".card-lang-badge");
    languageBadge.textContent = card.image_language === "en" ? "EN image" : "";

    const slopeBadge = node.querySelector(".card-slope-badge");
    const slope = card.slope || {};
    slopeBadge.className = "card-slope-badge";
    if (slope.state) {
      slopeBadge.classList.add(`is-${slope.state}`);
    }
    slopeBadge.textContent = slope.label || "";
    if (slope.delta_pct !== null && slope.delta_pct !== undefined) {
      slopeBadge.title = `${formatPercent(slope.delta_pct)} sur ${slope.points || 0} snapshot(s)`;
    } else {
      slopeBadge.title = "";
    }

    const image = node.querySelector(".card-visual");
    image.src = card.image_url || "";
    image.alt = `${card.name} (${card.local_id || card.id})`;
    image.hidden = !card.image_url;

    const latest = card.latest_price;
    const mainPriceBadge = node.querySelector(".image-price-main");
    const reversePriceBadge = node.querySelector(".image-price-reverse");
    const priceParts = [];
    if (latest?.avg !== null && latest?.avg !== undefined) {
      priceParts.push(`N ${formatPrice(latest.avg)}`);
    }
    if (latest?.avg_holo !== null && latest?.avg_holo !== undefined) {
      priceParts.push(`H ${formatPrice(latest.avg_holo)}`);
    }
    mainPriceBadge.textContent = priceParts.length > 0 ? priceParts.join(" · ") : "Prix N/A";
    reversePriceBadge.textContent =
      latest?.tcgplayer_reverse_market !== null && latest?.tcgplayer_reverse_market !== undefined
        ? `R ${formatUsdPrice(latest.tcgplayer_reverse_market)}`
        : "";

    button.addEventListener("click", () => openCardDetail(card.id));
    addQuoteButton.remove();

    const marketPrice = getLatestMarketPrice(card);
    const trendSymbol = slope.state === "up" ? "▲" : slope.state === "down" ? "▼" : slope.state === "stable" ? "■" : "";
    const catalogActions = document.createElement("div");
    catalogActions.className = "catalog-card-actions";
    catalogActions.innerHTML = `
      <span class="catalog-price ${slope.state ? `is-${slope.state}` : ""}">
        ${marketPrice === null ? "N/A" : formatPrice(marketPrice)}
        <span class="catalog-trend-icon" aria-hidden="true">${trendSymbol}</span>
      </span>
      <div class="catalog-add-wrap">
        <button class="catalog-add-button" type="button" aria-label="Ajouter au classeur">+</button>
        <div class="catalog-binder-menu" hidden></div>
      </div>
    `;
    const menu = catalogActions.querySelector(".catalog-binder-menu");
    menu.innerHTML = [
      `<button type="button" data-binder-id="">Sans classeur</button>`,
      ...state.binders.map((binder) =>
        `<button type="button" data-binder-id="${binder.id}">${escapeHtml(binder.name)}</button>`,
      ),
    ].join("");
    catalogActions.querySelector(".catalog-add-button").addEventListener("click", (event) => {
      event.stopPropagation();
      document.querySelectorAll(".catalog-binder-menu").forEach((item) => {
        if (item !== menu) item.hidden = true;
      });
      menu.hidden = !menu.hidden;
    });
    menu.querySelectorAll("button").forEach((binderButton) => {
      binderButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        menu.hidden = true;
        await addCardToBinder(card, binderButton.dataset.binderId || "");
      });
    });
    node.appendChild(catalogActions);
    els.cardsGrid.appendChild(node);
  }
}

function buildChart(timeline, selectedIndex = -1) {
  const width = 640;
  const height = 280;
  const padLeft = 58;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 42;
  const points = timeline.filter((item) => item.value !== null && item.value !== undefined);

  if (points.length === 0) {
    return `
      <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="#f8fafc"></rect>
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#607086" font-size="16">
        Aucun historique de prix disponible
      </text>
    `;
  }

  const values = points.map((item) => item.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const min = Math.max(0, rawMin - Math.max((rawMax - rawMin) * 0.12, 0.5));
  const max = rawMax + Math.max((rawMax - rawMin) * 0.12, 0.5);
  const spread = Math.max(max - min, 1);
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const toX = (index) =>
    points.length === 1
      ? width / 2
      : padLeft + (index / (points.length - 1)) * chartWidth;
  const toY = (value) => padTop + chartHeight - ((value - min) / spread) * chartHeight;

  const polyline = points
    .map((item, index) => `${toX(index)},${toY(item.value)}`)
    .join(" ");

  const baseline = padTop + chartHeight;
  const areaPoints = `${padLeft},${baseline} ${polyline} ${padLeft + chartWidth},${baseline}`;

  const yGrid = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = max - ratio * spread;
    const y = padTop + ratio * chartHeight;
    return `
      <line x1="${padLeft}" y1="${y}" x2="${padLeft + chartWidth}" y2="${y}" stroke="#d9dee9" stroke-width="1"></line>
      <text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" fill="#607086" font-size="11">${formatPrice(value)}</text>
    `;
  }).join("");

  const xLabels = points
    .map((item, index) => {
      const step = Math.max(1, Math.ceil((points.length - 1) / 4));
      if (index !== 0 && index !== points.length - 1 && index % step !== 0) return "";
      const x = toX(index);
      const anchor = index === 0 ? "start" : index === points.length - 1 ? "end" : "middle";
      return `<text x="${x}" y="${height - 12}" text-anchor="${anchor}" fill="#607086" font-size="11">${item.label}</text>`;
    })
    .join("");

  const pointMarkers = points
    .map((item, index) => {
      const x = toX(index);
      const y = toY(item.value);
      const isSelected = index === selectedIndex;
      return `
        <circle
          class="chart-point"
          data-point-index="${index}"
          cx="${x}"
          cy="${y}"
          r="${isSelected ? 7 : 4}"
          fill="${isSelected ? "#163f7a" : "#2457a6"}"
          stroke="#ffffff"
          stroke-width="${isSelected ? 3 : 0}"
          style="cursor:pointer"
        ></circle>
      `;
    })
    .join("");

  return `
    <defs>
      <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(36,87,166,0.22)"></stop>
        <stop offset="100%" stop-color="rgba(36,87,166,0.02)"></stop>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="#f8fafc"></rect>
    ${yGrid}
    <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${baseline}" stroke="#a9b5c7" stroke-width="1.5"></line>
    <line x1="${padLeft}" y1="${baseline}" x2="${padLeft + chartWidth}" y2="${baseline}" stroke="#a9b5c7" stroke-width="1.5"></line>
    <polyline points="${areaPoints}" fill="url(#chartFill)" stroke="none"></polyline>
    <polyline
      points="${polyline}"
      fill="none"
      stroke="#2457a6"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
    ></polyline>
    ${pointMarkers}
    ${xLabels}
  `;
}

function renderSelectedChartPoint() {
  const entry = state.chartTimeline[state.selectedChartIndex];
  if (!entry) {
    els.dialogChartSelection.textContent = "Selectionne un point du graphe pour voir le detail.";
    return;
  }

  els.dialogChartSelection.textContent = `${formatPrice(entry.value)} - ${entry.label}`;
}

function bindChartInteractions() {
  const points = els.dialogChart.querySelectorAll(".chart-point");
  for (const point of points) {
    point.addEventListener("click", () => {
      state.selectedChartIndex = Number(point.dataset.pointIndex);
      els.dialogChart.innerHTML = buildChart(state.chartTimeline, state.selectedChartIndex);
      bindChartInteractions();
      renderSelectedChartPoint();
    });
  }
}

function renderHistory(timeline) {
  els.dialogHistory.innerHTML = "";

  if (timeline.length === 0) {
    els.dialogHistory.innerHTML = "<p class='subtitle'>Aucun historique disponible.</p>";
    return;
  }

  const rows = [...timeline].reverse();
  for (const entry of rows) {
    const row = document.createElement("div");
    row.className = "history-row";
    row.innerHTML = `
      <div>
        <div class="history-cell-label">Periode</div>
        <div>${entry.label}</div>
      </div>
      <div>
        <div class="history-cell-label">Moyenne</div>
        <div>${formatPrice(entry.value)}</div>
      </div>
      <div>
        <div class="history-cell-label">Tendance</div>
        <div>${formatPrice(entry.trend)}</div>
      </div>
      <div>
        <div class="history-cell-label">Bas</div>
        <div>${formatPrice(entry.low)}</div>
      </div>
      <div>
        <div class="history-cell-label">Type</div>
        <div>${entry.samples ? `${entry.samples} scan(s)` : "Snapshot"}</div>
      </div>
      <div>
        <div class="history-cell-label">Reverse</div>
        <div>${formatUsdPrice(entry.tcgplayer_reverse_market)}</div>
      </div>
    `;
    els.dialogHistory.appendChild(row);
  }
}

async function openCardDetail(cardId) {
  state.detailReturnPage = state.currentPage === "detail" ? state.detailReturnPage : state.currentPage;
  const data = await fetchJson(`api/cards/${cardId}`);
  const latest = data.latest_price || {};
  const timelineData = buildPriceTimeline(data);
  const timeline = timelineData.points;

  els.dialogLocalId.textContent = data.local_id || "Sans numero";
  els.dialogTitle.textContent = data.name;
  els.dialogSubtitle.textContent = [data.set_name, data.local_id]
    .filter(Boolean)
    .join(" - ");
  const activeSetLogo =
    state.activeSetData?.id === data.set_id
      ? state.activeSetData.symbol_url || state.activeSetData.logo_url || ""
      : "";
  const setLogoUrl = data.set_symbol_url || data.set_logo_url || data.symbol_url || activeSetLogo;
  els.dialogSetLogo.src = setLogoUrl;
  els.dialogSetLogo.hidden = !setLogoUrl;

  els.dialogImage.src = data.image_url || "";
  els.dialogImage.alt = data.name;
  els.dialogImage.hidden = !data.image_url;
  els.dialogImageNote.textContent = [
    data.set_name,
    data.illustrator ? `Illustrateur: ${data.illustrator}` : null,
  ]
    .filter(Boolean)
    .join(" - ") || "Aucun detail disponible.";
  els.dialogCardmarket.hidden = !data.cardmarket_url;
  els.dialogCardmarket.href = data.cardmarket_url || "#";
  state.currentDetailCard = data;

  els.dialogAvg.textContent = formatPrice(latest.avg);
  els.dialogMean.textContent = formatPrice(latest.trend);
  els.dialogLow.textContent = formatPrice(latest.low);
  els.dialogHolo.textContent = [
    latest.avg !== null && latest.avg !== undefined ? `N ${formatPrice(latest.avg)}` : null,
    latest.avg_holo !== null && latest.avg_holo !== undefined ? `H ${formatPrice(latest.avg_holo)}` : null,
  ]
    .filter(Boolean)
    .join(" | ") || "N/A";
  els.dialogReverse.textContent = formatUsdPrice(latest.tcgplayer_reverse_market);
  els.dialogChange.textContent = formatPercent(data.change_pct?.avg);
  els.dialogChange.className = "detail-change";
  addTrendClass(els.dialogChange, data.change_pct?.avg);
  els.dialogHistoryMode.textContent = timelineData.mode;
  els.dialogHistoryCount.textContent = `${timeline.length} points`;
  state.chartTimeline = timeline;
  state.selectedChartIndex = timeline.length > 0 ? timeline.length - 1 : -1;
  els.dialogChart.innerHTML = buildChart(timeline, state.selectedChartIndex);
  bindChartInteractions();
  renderSelectedChartPoint();
  renderHistory(timeline);

  switchPage("detail");
  window.scrollTo({ top: 0, behavior: "auto" });
}

async function loadSet(setId) {
  state.activeSetId = setId;
  state.searchMode = false;
  renderSeries();

  const setData = await fetchJson(`api/sets/${setId}`);
  state.activeSetData = setData;
  state.activeSetCards = setData.cards;

  els.setTitle.textContent = setData.name;
  els.setMeta.textContent = `Sortie le ${formatDate(setData.release_date)}`;
  els.setSerie.textContent = setData.serie.name;
  els.setCount.textContent = `${setData.total_count} cartes`;
  els.cardSearch.value = "";
  renderCards();
}

async function searchCards(query) {
  const payload = await fetchJson(`api/search/cards?q=${encodeURIComponent(query)}&limit=120`);
  state.searchMode = true;
  state.activeSetCards = payload.cards || [];
  els.setTitle.textContent = `Recherche: ${payload.query}`;
  els.setMeta.textContent = `${payload.count} resultat(s)`;
  els.setSerie.textContent = "Toutes extensions";
  els.setCount.textContent = `${payload.count} cartes`;
  renderCards();
}

async function bootstrap() {
  loadQuote();
  await loadCollectionData();
  els.sortField.value = state.sortField;
  els.sortDirection.value = state.sortDirection;

  try {
    const payload = await fetchJson("api/series");
    state.series = payload.series;
    const orderedSeries = getOrderedSeries(state.series);
    const allSets = orderedSeries.flatMap((serie) => serie.sets);
    const preferredSet = allSets[0];
    state.activeSetId = preferredSet?.id ?? null;
    renderSeries();

    if (state.activeSetId) {
      await loadSet(state.activeSetId);
    } else {
      els.setTitle.textContent = "Aucune extension disponible";
    }

  } catch (error) {
    els.setTitle.textContent = "Catalogue indisponible";
    els.setMeta.textContent =
      "Le catalogue et les prix demandent le serveur Python local. La version GitHub Pages sert uniquement l'application statique.";
  }
  renderQuote();
  switchPage("catalog");
}

els.cardSearch.addEventListener("input", () => {
  const query = els.cardSearch.value.trim();
  updateSearchSuggestions(query);
  if (!query) {
    state.searchMode = false;
    if (state.activeSetData) {
      state.activeSetCards = state.activeSetData.cards;
      els.setTitle.textContent = state.activeSetData.name;
      els.setMeta.textContent = `Sortie le ${formatDate(state.activeSetData.release_date)}`;
      els.setSerie.textContent = state.activeSetData.serie.name;
      els.setCount.textContent = `${state.activeSetData.total_count} cartes`;
    }
    renderCards();
  }
});

els.cardSearch.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" && state.searchSuggestions.length) {
    event.preventDefault();
    state.selectedSuggestionIndex = Math.min(
      state.selectedSuggestionIndex + 1,
      state.searchSuggestions.length - 1,
    );
    renderSearchSuggestions();
    return;
  }

  if (event.key === "ArrowUp" && state.searchSuggestions.length) {
    event.preventDefault();
    state.selectedSuggestionIndex = Math.max(state.selectedSuggestionIndex - 1, 0);
    renderSearchSuggestions();
    return;
  }

  if (event.key === "Escape") {
    clearSearchSuggestions();
    return;
  }

  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  if (state.selectedSuggestionIndex >= 0 && state.searchSuggestions.length) {
    applySearchSuggestion(state.selectedSuggestionIndex);
    return;
  }
  const query = els.cardSearch.value.trim();
  if (!query) {
    state.searchMode = false;
    if (state.activeSetData) {
      state.activeSetCards = state.activeSetData.cards;
      els.setTitle.textContent = state.activeSetData.name;
      els.setMeta.textContent = `Sortie le ${formatDate(state.activeSetData.release_date)}`;
      els.setSerie.textContent = state.activeSetData.serie.name;
      els.setCount.textContent = `${state.activeSetData.total_count} cartes`;
    }
    renderCards();
    return;
  }

  searchCards(query).catch((error) => {
    els.setMeta.textContent = String(error);
  });
});
els.cardSearch.addEventListener("blur", () => {
  window.setTimeout(() => {
    clearSearchSuggestions();
  }, 120);
});
els.cardSearch.addEventListener("focus", () => {
  if (state.searchSuggestions.length) {
    renderSearchSuggestions();
  }
});
els.sortField.addEventListener("change", () => {
  state.sortField = els.sortField.value;
  renderCards();
});
els.sortDirection.addEventListener("change", () => {
  state.sortDirection = els.sortDirection.value;
  renderCards();
});
els.seriesSelect.addEventListener("change", async () => {
  const orderedSeries = getOrderedSeries(state.series);
  const selectedSerie = orderedSeries.find((serie) => (serie.id || serie.name) === els.seriesSelect.value);
  const firstSet = selectedSerie?.sets?.[0];
  if (firstSet) {
    await loadSet(firstSet.id);
  }
});
els.catalogSearchToggle.addEventListener("click", () => {
  els.catalogSearchRow.hidden = !els.catalogSearchRow.hidden;
  if (!els.catalogSearchRow.hidden) {
    els.cardSearch.focus();
  }
});
els.navBinders.addEventListener("click", () => switchPage("binders"));
els.navCatalog.addEventListener("click", () => switchPage("catalog"));
els.navAccount.addEventListener("click", () => switchPage("account"));
els.mobileNavCatalog.addEventListener("click", () => switchPage("catalog"));
els.mobileNavBinders.addEventListener("click", () => switchPage("binders"));
els.mobileNavAccount.addEventListener("click", () => switchPage("account"));
els.dialogAddOwned.addEventListener("click", () => {
  if (state.currentDetailCard) {
    prepareOwnedCardDraft(state.currentDetailCard);
  }
});
els.binderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await OpenCardexStore.saveBinder({
    name: els.binderName.value,
    description: els.binderDescription.value,
  });
  els.binderName.value = "";
  els.binderDescription.value = "";
  await loadCollectionData();
});
els.collectionFilterBinder.addEventListener("change", () => renderCollection());
els.collectionSort.addEventListener("change", () => renderCollection());
els.collectionExportButton.addEventListener("click", () => exportCollectionJson());
els.collectionImportButton.addEventListener("click", () => {
  els.collectionImportInput.value = "";
  els.collectionImportInput.click();
});
els.collectionImportInput.addEventListener("change", async () => {
  try {
    await importCollectionJson(els.collectionImportInput.files?.[0]);
  } catch (error) {
    els.collectionSummary.textContent = `Import impossible: ${String(error)}`;
  }
});
els.ownedCardSearchButton.addEventListener("click", () => searchOwnedCards());
els.ownedCardSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchOwnedCards();
  }
});
els.ownedDraftConfirm.addEventListener("click", () => confirmOwnedCardDraft());
els.ownedDraftCancel.addEventListener("click", () => {
  state.pendingOwnedCardDraft = null;
  els.ownedCardDraftPanel.hidden = true;
});
els.quoteImportButton.addEventListener("click", () => {
  els.quoteImportInput.value = "";
  els.quoteImportInput.click();
});
els.quoteImportInput.addEventListener("change", async () => {
  try {
    await importQuoteFile(els.quoteImportInput.files?.[0]);
  } catch (error) {
    els.quoteList.innerHTML = `<p class='subtitle'>Import impossible: ${String(error)}</p>`;
  }
});
els.quoteSaveButton.addEventListener("click", () => saveQuote());
els.quoteExportJsonButton.addEventListener("click", () => exportQuoteJson());
els.quoteExportButton.addEventListener("click", () => exportQuoteCsv());
els.quoteResetButton.addEventListener("click", () => {
  state.quoteItems = [];
  saveQuote();
});
els.quoteDraftConfirm.addEventListener("click", () => confirmPendingQuoteDraft());
els.quoteDraftCancel.addEventListener("click", () => cancelPendingQuoteDraft());
els.dialogClose.addEventListener("click", () => switchPage(state.detailReturnPage || "catalog"));

bootstrap().catch((error) => {
  els.setTitle.textContent = "Erreur de chargement";
  els.setMeta.textContent = String(error);
});
