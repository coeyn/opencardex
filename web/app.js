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
  cloudUser: null,
  cloudReady: false,
  cloudApplyingRemote: false,
  cloudUploadTimer: null,
  cloudUnsubscribe: null,
  cloudLastRemoteExportedAt: "",
  cloudLastRevision: "",
  cloudStoreWrapped: false,
  detailReturnPage: "catalog",
  binders: [],
  ownedCards: [],
  pokedexPage: 0,
  binderDetailPage: 0,
  binderSortField: "date",
  binderSortDirection: "desc",
  activeBinderId: null,
  nationalPokedex: null,
  pendingOwnedCardDraft: null,
  pendingBinderDeleteId: null,
  pendingBinderPriceOwnedId: null,
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
  catalogPage: document.querySelector("#catalog-page"),
  bindersPage: document.querySelector("#binders-page"),
  pokedexPage: document.querySelector("#pokedex-page"),
  binderDetailPage: document.querySelector("#binder-detail-page"),
  accountPage: document.querySelector("#account-page"),
  accountStatus: document.querySelector("#account-status"),
  accountSignedOut: document.querySelector("#account-signed-out"),
  accountSignedIn: document.querySelector("#account-signed-in"),
  accountUser: document.querySelector("#account-user"),
  accountEmail: document.querySelector("#account-email"),
  accountPassword: document.querySelector("#account-password"),
  accountEmailLogin: document.querySelector("#account-email-login"),
  accountEmailRegister: document.querySelector("#account-email-register"),
  accountGoogleLogin: document.querySelector("#account-google-login"),
  accountLogout: document.querySelector("#account-logout"),
  accountSyncMeta: document.querySelector("#account-sync-meta"),
  accountSyncUpload: document.querySelector("#account-sync-upload"),
  accountSyncDownload: document.querySelector("#account-sync-download"),
  cardDetailPage: document.querySelector("#card-detail-page"),
  pokedexBanner: document.querySelector("#pokedex-banner"),
  pokedexBannerMeta: document.querySelector("#pokedex-banner-meta"),
  pokedexBack: document.querySelector("#pokedex-back"),
  pokedexContent: document.querySelector("#pokedex-content"),
  binderDetailBack: document.querySelector("#binder-detail-back"),
  binderDetailTitle: document.querySelector("#binder-detail-title"),
  binderDetailContent: document.querySelector("#binder-detail-content"),
  binderSortToggle: document.querySelector("#binder-sort-toggle"),
  binderSortModal: document.querySelector("#binder-sort-modal"),
  binderSortField: document.querySelector("#binder-sort-field"),
  binderSortDirection: document.querySelector("#binder-sort-direction"),
  binderSortApply: document.querySelector("#binder-sort-apply"),
  binderSortCancel: document.querySelector("#binder-sort-cancel"),
  binderSortCancelSecondary: document.querySelector("#binder-sort-cancel-secondary"),
  binderCardPriceModal: document.querySelector("#binder-card-price-modal"),
  binderCardPriceSubtitle: document.querySelector("#binder-card-price-subtitle"),
  binderCardCustomPrice: document.querySelector("#binder-card-custom-price"),
  binderCardMarketPrice: document.querySelector("#binder-card-market-price"),
  binderCardPriceSave: document.querySelector("#binder-card-price-save"),
  binderCardPriceReset: document.querySelector("#binder-card-price-reset"),
  binderCardOpenDetail: document.querySelector("#binder-card-open-detail"),
  binderCardPriceCancel: document.querySelector("#binder-card-price-cancel"),
  binderCreateToggle: document.querySelector("#binder-create-toggle"),
  binderCreateModal: document.querySelector("#binder-create-modal"),
  binderCreateCancel: document.querySelector("#binder-create-cancel"),
  binderCreateCancelSecondary: document.querySelector("#binder-create-cancel-secondary"),
  binderDeleteModal: document.querySelector("#binder-delete-modal"),
  binderDeleteCopy: document.querySelector("#binder-delete-copy"),
  binderDeleteConfirm: document.querySelector("#binder-delete-confirm"),
  binderDeleteCancel: document.querySelector("#binder-delete-cancel"),
  binderDeleteCancelSecondary: document.querySelector("#binder-delete-cancel-secondary"),
  binderForm: document.querySelector("#binder-form"),
  binderName: document.querySelector("#binder-name"),
  binderDescription: document.querySelector("#binder-description"),
  binderList: document.querySelector("#binder-list"),
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
  ownedDraftCustomPrice: document.querySelector("#owned-draft-custom-price"),
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

function parseOptionalPrice(value) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : undefined;
}

function getOwnedCardCustomPrice(ownedCard) {
  const value = ownedCard?.customPrice;
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function getOwnedCardEffectivePrice(view) {
  const customPrice = getOwnedCardCustomPrice(view?.ownedCard);
  if (customPrice !== null) {
    return customPrice;
  }
  return view?.price?.marketPrice ?? getLatestMarketPrice(view?.detail) ?? null;
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
  if (els.quoteCount) els.quoteCount.textContent = `${cardCount} carte(s)`;
  if (els.quoteTotal) els.quoteTotal.textContent = formatPrice(total);
  if (els.navQuoteCount) els.navQuoteCount.textContent = `${cardCount} carte(s)`;
  if (els.navQuoteTotal) els.navQuoteTotal.textContent = formatPrice(total);

  if (!els.quoteList) {
    return;
  }
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
  const pokedexId = OpenCardexStore.systemPokedexBinderId;
  if (pokedexId && !state.binders.some((binder) => binder.id === pokedexId)) {
    const pokedexBinder = await OpenCardexStore.saveBinder(OpenCardexStore.buildSystemPokedexBinder());
    state.binders = [pokedexBinder, ...state.binders];
  }
  renderCollectionFilters();
  renderOwnedDraftBinderOptions();
  await renderPokedexBanner();
  await renderBinders();
  if (els.collectionGrid) {
    await renderCollection();
  }
  await refreshCurrentCollectionView();
}

async function refreshCurrentCollectionView() {
  if (state.currentPage === "catalog") {
    renderCards();
    return;
  }
  if (state.currentPage === "binder-detail") {
    await renderBinderDetailPage();
    return;
  }
  if (state.currentPage === "pokedex") {
    await renderPokedexPage();
    return;
  }
  if (state.currentPage === "detail" && state.currentDetailCard) {
    renderOwnershipStatus(state.currentDetailCard);
  }
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
      totalValue: null,
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
  const views = await Promise.all(state.ownedCards.map(getOwnedCardView));
  return views.map((view) => ({
    ...view,
    totalValue: getOwnedCardEffectivePrice(view) === null ? null : getOwnedCardEffectivePrice(view) * view.ownedCard.quantity,
  }));
}

function renderCollectionFilters() {
  if (!els.collectionFilterBinder) {
    return;
  }
  const current = els.collectionFilterBinder.value || "all";
  els.collectionFilterBinder.innerHTML = [
    `<option value="all">Tous les classeurs</option>`,
    ...state.binders.map((binder) => `<option value="${binder.id}">${escapeHtml(binder.name)}</option>`),
  ].join("");
  els.collectionFilterBinder.value = state.binders.some((binder) => binder.id === current) ? current : "all";
}

async function renderCollection() {
  if (!els.collectionGrid || !els.collectionFilterBinder || !els.collectionSort || !els.collectionSummary) {
    return;
  }
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
    const customPrice = getOwnedCardCustomPrice(ownedCard);
    const priceLabel = totalValue === null
      ? "Prix indisponible"
      : `${formatPrice(totalValue)} - ${customPrice !== null ? "prix perso" : escapeHtml(price?.source || "prix tendance")}${customPrice === null && price?.updatedAt ? ` - ${formatDateTime(price.updatedAt)}` : ""}`;
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
        <p class="subtitle">${priceLabel}</p>
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
      await syncCloudNow("delete-owned-card");
      await loadCollectionData();
    });
    article.querySelector("[data-move-owned]").addEventListener("click", async () => {
      const choices = state.binders.map((binder) => `${binder.id} : ${binder.name}`).join("\n");
      const nextBinderId = prompt(`ID du classeur cible:\n${choices}`, ownedCard.binderId || "");
      if (nextBinderId === null) return;
      await OpenCardexStore.saveOwnedCard({ ...ownedCard, binderId: nextBinderId || undefined });
      await syncCloudNow("move-owned-card");
      await loadCollectionData();
    });
    els.collectionGrid.appendChild(article);
  }
}

async function loadNationalPokedex() {
  if (state.nationalPokedex) {
    return state.nationalPokedex;
  }
  const payload = await fetchStaticJson("data/national-pokedex.json");
  state.nationalPokedex = Array.isArray(payload.pokedex) ? payload.pokedex : [];
  return state.nationalPokedex;
}

function normalizePokemonKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[-]/g, " ")
    .replace(/[^a-z0-9♀♂. -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cardNameToPokemonKey(cardName, dexKeySet) {
  let candidate = normalizePokemonKey(cardName)
    .replace(/\bmega\b/g, " ")
    .replace(/\b(ex|vmax|vstar|v union|v|gx|tag team|prisme|radieux|radiant|shiny|y|x)\b/g, " ")
    .replace(/\s+(d|de|du|des|la|le|les|l)\s+.*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (dexKeySet.has(candidate)) {
    return candidate;
  }
  for (const dexKey of dexKeySet) {
    if (candidate === dexKey || candidate.startsWith(`${dexKey} `) || candidate.endsWith(` ${dexKey}`)) {
      return dexKey;
    }
  }
  return null;
}

async function buildPokedexEntries() {
  const nationalPokedex = await loadNationalPokedex();
  const dexKeyByNumber = new Map(nationalPokedex.map((entry) => [entry.number, normalizePokemonKey(entry.name)]));
  const dexKeySet = new Set(dexKeyByNumber.values());
  const views = await buildOwnedCardViews();
  const bestByNumber = new Map();
  for (const view of views) {
    const pokemonKey = cardNameToPokemonKey(view.detail.name, dexKeySet);
    if (!pokemonKey) continue;
    const dexEntry = nationalPokedex.find((entry) => dexKeyByNumber.get(entry.number) === pokemonKey);
    if (!dexEntry) continue;
    const value = getOwnedCardEffectivePrice(view) ?? 0;
    const current = bestByNumber.get(dexEntry.number);
    if (!current || value > current.value) {
      bestByNumber.set(dexEntry.number, { ...view, value });
    }
  }
  return nationalPokedex.map((entry) => ({
    ...entry,
    owned: bestByNumber.get(entry.number) || null,
  }));
}

async function renderPokedexBinder(article) {
  const entries = await buildPokedexEntries();
  const pageSize = 9;
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  state.pokedexPage = Math.min(Math.max(state.pokedexPage, 0), pageCount - 1);
  const pageEntries = entries.slice(state.pokedexPage * pageSize, state.pokedexPage * pageSize + pageSize);
  const startNumber = pageEntries[0]?.number || 0;
  const endNumber = pageEntries.at(-1)?.number || 0;
  article.innerHTML = `
    <div class="pokedex-grid">
      ${pageEntries
        .map((entry) => {
          const owned = entry.owned;
          return `
            <button class="pokedex-slot${owned ? " has-card" : ""}" type="button" ${owned ? `data-card-id="${owned.detail.id}"` : "disabled"}>
              <span class="pokedex-number">${String(entry.number).padStart(3, "0")}</span>
              ${
                owned?.detail.image_url
                  ? `<img src="${owned.detail.image_url}" alt="${escapeHtml(owned.detail.name)}" loading="lazy">`
                  : `<span class="pokedex-empty-card">${escapeHtml(entry.name)}</span>`
              }
              <span class="pokedex-slot-name">${escapeHtml(entry.name)}</span>
            </button>
          `;
        })
        .join("")}
    </div>
    <div class="pokedex-pager">
      <button class="icon-button" type="button" data-pokedex-prev aria-label="Page precedente">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>
      </button>
      <span>${String(startNumber).padStart(3, "0")} - ${String(endNumber).padStart(3, "0")}</span>
      <button class="icon-button" type="button" data-pokedex-next aria-label="Page suivante">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>
      </button>
    </div>
  `;
  article.querySelector("[data-pokedex-prev]").disabled = state.pokedexPage <= 0;
  article.querySelector("[data-pokedex-next]").disabled = state.pokedexPage >= pageCount - 1;
  article.querySelector("[data-pokedex-prev]").addEventListener("click", async () => {
    state.pokedexPage -= 1;
    await renderPokedexBinder(article);
  });
  article.querySelector("[data-pokedex-next]").addEventListener("click", async () => {
    state.pokedexPage += 1;
    await renderPokedexBinder(article);
  });
  article.querySelectorAll("[data-card-id]").forEach((button) => {
    button.addEventListener("click", () => openCardDetail(button.dataset.cardId));
  });
}

async function renderPokedexBanner() {
  if (!els.pokedexBannerMeta) return;
  const entries = await buildPokedexEntries();
  const ownedCount = entries.filter((entry) => entry.owned).length;
  els.pokedexBannerMeta.textContent = `${ownedCount} / ${entries.length} Pokémon représenté(s).`;
}

async function renderPokedexPage() {
  if (!els.pokedexContent) return;
  const article = document.createElement("article");
  article.className = "binder-card is-system-binder pokedex-dedicated";
  article.innerHTML = "<p class='subtitle'>Chargement du Pokédex...</p>";
  els.pokedexContent.replaceChildren(article);
  await renderPokedexBinder(article);
}

async function renderBinders() {
  els.binderList.innerHTML = "";
  const sortedBinders = [...state.binders].sort((left, right) => {
    if (left.system && !right.system) return -1;
    if (!left.system && right.system) return 1;
    return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
  });
  for (const binder of sortedBinders) {
    const isSystemBinder = Boolean(binder.system || binder.id === OpenCardexStore.systemPokedexBinderId);
    if (isSystemBinder) {
      continue;
    }
    const ownedCards = state.ownedCards.filter((card) => card.binderId === binder.id);
    const quantity = ownedCards.reduce((sum, card) => sum + card.quantity, 0);
    const views = await Promise.all(ownedCards.map(getOwnedCardView));
    const binderValue = views.reduce((sum, view) => {
      const price = getOwnedCardEffectivePrice(view);
      return price === null ? sum : sum + price * view.ownedCard.quantity;
    }, 0);
    const missingPrices = views.filter((view) => getOwnedCardEffectivePrice(view) === null).length;
    const valueLabel = quantity
      ? `${formatPrice(binderValue)}${missingPrices ? " + prix manquants" : ""}`
      : formatPrice(0);
    const article = document.createElement("article");
    article.className = "binder-card";
    article.innerHTML = `
      <button class="binder-delete-button" type="button" data-delete-binder="${binder.id}" aria-label="Supprimer ${escapeHtml(binder.name)}">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18"></path>
          <path d="M8 6V4h8v2"></path>
          <path d="M19 6l-1 14H6L5 6"></path>
          <path d="M10 11v5"></path>
          <path d="M14 11v5"></path>
        </svg>
      </button>
      <div class="binder-card-head">
        <h3>${escapeHtml(binder.name)}</h3>
      </div>
      <p class="subtitle">${escapeHtml(binder.description || "Aucune description")}</p>
      <p class="subtitle">${quantity} carte(s)</p>
      <p class="binder-card-value">${valueLabel}</p>
    `;
    article.addEventListener("click", () => openBinderDetail(binder.id));
    article.querySelector("[data-delete-binder]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      openBinderDeleteModal(binder.id);
    });
    els.binderList.appendChild(article);
  }
}

function renderOwnedDraftBinderOptions() {
  const pokedexId = OpenCardexStore.systemPokedexBinderId || "";
  const userBinders = state.binders.filter((binder) => binder.id !== pokedexId);
  els.ownedDraftBinder.innerHTML = userBinders.length
    ? userBinders.map((binder) => `<option value="${binder.id}">${escapeHtml(binder.name)}</option>`).join("")
    : `<option value="">Crée un classeur avant d'ajouter une carte</option>`;
  els.ownedDraftBinder.disabled = !userBinders.length;
}

function getBinderById(binderId) {
  return state.binders.find((binder) => binder.id === binderId) || null;
}

function binderOwnedCards(binderId) {
  return state.ownedCards.filter((card) => card.binderId === binderId);
}

function setBinderPage(nextPage, pageCount, direction = 0) {
  const boundedPage = Math.min(Math.max(nextPage, 0), pageCount - 1);
  if (boundedPage === state.binderDetailPage) return;
  state.binderPageDirection = direction || (boundedPage > state.binderDetailPage ? 1 : -1);
  state.binderDetailPage = boundedPage;
  renderBinderDetailPage().catch((error) => {
    els.binderDetailContent.innerHTML = `<p class='subtitle'>Classeur indisponible: ${escapeHtml(String(error))}</p>`;
  });
}

function openBinderDetail(binderId) {
  state.activeBinderId = binderId;
  state.binderDetailPage = 0;
  switchPage("binder-detail");
}

function compareBinderCardViews(left, right) {
  const direction = state.binderSortDirection === "asc" ? 1 : -1;
  if (state.binderSortField === "name") {
    return direction * left.detail.name.localeCompare(right.detail.name, "fr", { sensitivity: "base" });
  }
  if (state.binderSortField === "price") {
    const leftPrice = getOwnedCardEffectivePrice(left) ?? -1;
    const rightPrice = getOwnedCardEffectivePrice(right) ?? -1;
    return direction * (leftPrice - rightPrice);
  }
  return direction * String(left.ownedCard.createdAt || "").localeCompare(String(right.ownedCard.createdAt || ""));
}

function openBinderSortModal() {
  els.binderSortField.value = state.binderSortField;
  els.binderSortDirection.value = state.binderSortDirection;
  els.binderSortModal.hidden = false;
}

function closeBinderSortModal() {
  els.binderSortModal.hidden = true;
}

async function applyBinderSort() {
  state.binderSortField = els.binderSortField.value;
  state.binderSortDirection = els.binderSortDirection.value;
  state.binderDetailPage = 0;
  closeBinderSortModal();
  await renderBinderDetailPage();
}

async function renderBinderDetailPage() {
  const binder = getBinderById(state.activeBinderId);
  if (!binder || !els.binderDetailContent) return;
  els.binderDetailTitle.textContent = binder.name;
  const views = await Promise.all(binderOwnedCards(binder.id).map(getOwnedCardView));
  views.sort(compareBinderCardViews);
  const pageSize = 9;
  const pageCount = Math.max(1, Math.ceil(views.length / pageSize));
  state.binderDetailPage = Math.min(Math.max(state.binderDetailPage, 0), pageCount - 1);
  const pageNumber = state.binderDetailPage + 1;
  const pageViews = views.slice(state.binderDetailPage * pageSize, state.binderDetailPage * pageSize + pageSize);
  const article = document.createElement("article");
  article.className = "binder-page-board";
  if (state.binderPageDirection) {
    article.classList.add(state.binderPageDirection > 0 ? "is-page-in-next" : "is-page-in-prev");
    window.setTimeout(() => {
      article.classList.remove("is-page-in-next", "is-page-in-prev");
    }, 260);
    state.binderPageDirection = 0;
  }
  article.dataset.pageCount = String(pageCount);
  article.innerHTML = `
    <div class="binder-page-grid">
      ${Array.from({ length: 9 }, (_, index) => {
        const slot = index + 1;
        const view = pageViews[index];
        return `
          <button class="binder-slot${view ? " has-card" : ""}" type="button" data-slot="${slot}" ${view ? `data-card-id="${view.detail.id}" data-owned-id="${view.ownedCard.id}"` : ""}>
            ${
              view?.detail.image_url
                ? `<img src="${view.detail.image_url}" alt="${escapeHtml(view.detail.name)}" loading="lazy">`
                : `<span class="binder-empty-slot"></span>`
            }
            ${view ? `<span class="binder-slot-price${getOwnedCardCustomPrice(view.ownedCard) !== null ? " is-custom" : ""}" data-owned-price="${view.ownedCard.id}">${formatPrice(getOwnedCardEffectivePrice(view))}</span>` : ""}
          </button>
        `;
      }).join("")}
    </div>
    <div class="pokedex-pager binder-pager">
      <button class="icon-button" type="button" data-binder-prev aria-label="Page precedente">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>
      </button>
      <span>Page ${pageNumber} / ${pageCount}</span>
      <button class="icon-button" type="button" data-binder-next aria-label="Page suivante">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>
      </button>
    </div>
  `;
  els.binderDetailContent.replaceChildren(article);

  article.querySelector("[data-binder-prev]").disabled = state.binderDetailPage <= 0;
  article.querySelector("[data-binder-next]").disabled = state.binderDetailPage >= pageCount - 1;
  article.querySelector("[data-binder-prev]").addEventListener("click", async () => {
    setBinderPage(state.binderDetailPage - 1, pageCount, -1);
  });
  article.querySelector("[data-binder-next]").addEventListener("click", async () => {
    setBinderPage(state.binderDetailPage + 1, pageCount, 1);
  });

  let swipeStartX = 0;
  article.addEventListener("touchstart", (event) => {
    swipeStartX = event.touches[0]?.clientX || 0;
  }, { passive: true });
  article.addEventListener("touchend", async (event) => {
    const endX = event.changedTouches[0]?.clientX || swipeStartX;
    const delta = endX - swipeStartX;
    if (Math.abs(delta) < 50) return;
    const nextPage = Math.min(Math.max(state.binderDetailPage + (delta < 0 ? 1 : -1), 0), pageCount - 1);
    if (nextPage !== state.binderDetailPage) {
      setBinderPage(nextPage, pageCount, delta < 0 ? 1 : -1);
    }
  }, { passive: true });

  article.querySelectorAll(".binder-slot").forEach((slotButton) => {
    slotButton.addEventListener("click", () => {
      if (slotButton.dataset.cardId) {
        openCardDetail(slotButton.dataset.cardId);
      }
    });
  });
  article.querySelectorAll("[data-owned-price]").forEach((priceButton) => {
    priceButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openBinderCardPriceModal(priceButton.dataset.ownedPrice);
    });
  });
}

async function openBinderCardPriceModal(ownedCardId) {
  const ownedCard = state.ownedCards.find((card) => card.id === ownedCardId);
  if (!ownedCard || !els.binderCardPriceModal) return;
  state.pendingBinderPriceOwnedId = ownedCard.id;
  const view = await getOwnedCardView(ownedCard);
  const customPrice = getOwnedCardCustomPrice(ownedCard);
  const marketPrice = view.price?.marketPrice ?? getLatestMarketPrice(view.detail);
  els.binderCardPriceSubtitle.textContent = `${view.detail.name} - ${getBinderName(ownedCard.binderId)}`;
  els.binderCardCustomPrice.value = customPrice === null ? "" : String(customPrice);
  els.binderCardMarketPrice.textContent = `Prix tendance actuel: ${formatPrice(marketPrice)}`;
  els.binderCardPriceModal.hidden = false;
  els.binderCardCustomPrice.focus();
}

function closeBinderCardPriceModal() {
  state.pendingBinderPriceOwnedId = null;
  if (els.binderCardPriceModal) {
    els.binderCardPriceModal.hidden = true;
  }
}

async function saveBinderCardCustomPrice({ reset = false } = {}) {
  const ownedCard = state.ownedCards.find((card) => card.id === state.pendingBinderPriceOwnedId);
  if (!ownedCard) return;
  const customPrice = reset ? undefined : parseOptionalPrice(els.binderCardCustomPrice.value);
  await OpenCardexStore.saveOwnedCard({
    ...ownedCard,
    customPrice,
  });
  await syncCloudNow("custom-card-price");
  closeBinderCardPriceModal();
  await loadCollectionData();
  if (state.currentPage === "binder-detail") {
    await renderBinderDetailPage();
  }
}

function openBinderCardDetail() {
  const ownedCard = state.ownedCards.find((card) => card.id === state.pendingBinderPriceOwnedId);
  if (!ownedCard) return;
  closeBinderCardPriceModal();
  openCardDetail(ownedCard.cardId);
}

function prepareOwnedCardDraft(card) {
  state.pendingOwnedCardDraft = card;
  els.ownedDraftTitle.textContent = card.name;
  els.ownedDraftSubtitle.textContent = card.set_name || card.local_id || "";
  els.ownedDraftQuantity.value = "1";
  els.ownedDraftCondition.value = "near_mint";
  els.ownedDraftLanguage.value = "fr";
  els.ownedDraftVariant.value = "normal";
  els.ownedDraftCustomPrice.value = "";
  els.ownedDraftPage.value = "";
  els.ownedDraftSlot.value = "";
  els.ownedDraftForTrade.checked = false;
  els.ownedDraftWanted.checked = false;
  renderOwnedDraftBinderOptions();
  els.ownedCardDraftPanel.hidden = false;
}

async function addCardToBinder(card, binderId) {
  if (!binderId || binderId === OpenCardexStore.systemPokedexBinderId) {
    alert("Crée ou choisis un classeur avant d'ajouter une carte.");
    return;
  }
  await OpenCardexStore.saveOwnedCard({
    cardId: card.id,
    binderId,
    quantity: 1,
    condition: "near_mint",
    language: "fr",
    variant: "normal",
    customPrice: undefined,
    page: "",
    slot: "",
    forTrade: false,
    wanted: false,
  });
  await syncCloudNow("quick-add-card");
  await loadCollectionData();
}

async function confirmOwnedCardDraft() {
  const card = state.pendingOwnedCardDraft;
  if (!card) return;
  if (!els.ownedDraftBinder.value) {
    alert("Crée un classeur avant d'ajouter une carte.");
    return;
  }
  await OpenCardexStore.saveOwnedCard({
    cardId: card.id,
    binderId: els.ownedDraftBinder.value,
    quantity: els.ownedDraftQuantity.value,
    condition: els.ownedDraftCondition.value,
    language: els.ownedDraftLanguage.value,
    variant: els.ownedDraftVariant.value,
    customPrice: parseOptionalPrice(els.ownedDraftCustomPrice.value),
    page: els.ownedDraftPage.value,
    slot: els.ownedDraftSlot.value,
    forTrade: els.ownedDraftForTrade.checked,
    wanted: els.ownedDraftWanted.checked,
  });
  await syncCloudNow("add-card-draft");
  state.pendingOwnedCardDraft = null;
  els.ownedCardDraftPanel.hidden = true;
  await loadCollectionData();
  if (state.currentPage === "detail" && state.currentDetailCard) {
    renderOwnershipStatus(state.currentDetailCard);
  }
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

function setAccountMessage(message) {
  if (els.accountStatus) {
    els.accountStatus.textContent = message;
  }
}

function setAccountSyncMessage(message) {
  if (els.accountSyncMeta) {
    els.accountSyncMeta.textContent = message;
  }
}

function renderAccount() {
  const cloud = window.OpenCardexCloud;
  const user = state.cloudUser || cloud?.getCurrentUser?.() || null;
  state.cloudUser = user;
  const isReady = state.cloudReady && Boolean(cloud);
  const isSignedIn = Boolean(user);
  if (els.accountSignedOut) els.accountSignedOut.hidden = !isReady || isSignedIn;
  if (els.accountSignedIn) els.accountSignedIn.hidden = !isReady || !isSignedIn;
  if (els.accountUser) {
    els.accountUser.textContent = user
      ? `${user.displayName || user.email || "Compte connecte"}`
      : "";
  }
  if (els.accountSyncUpload) els.accountSyncUpload.disabled = !isSignedIn;
  if (els.accountSyncDownload) els.accountSyncDownload.disabled = !isSignedIn;
  if (els.accountSyncMeta) {
    els.accountSyncMeta.textContent = isSignedIn
      ? "Synchronisation automatique active."
      : "Connecte-toi pour sauvegarder tes classeurs dans le cloud.";
  }
  if (!isReady) {
    setAccountMessage("Connexion Firebase en cours...");
  } else if (isSignedIn) {
    setAccountMessage("Compte connecte.");
  } else {
    setAccountMessage("Connecte-toi pour synchroniser ta collection.");
  }
}

function getAccountCredentials() {
  return {
    email: els.accountEmail?.value.trim() || "",
    password: els.accountPassword?.value || "",
  };
}

async function signInAccountWithEmail() {
  const { email, password } = getAccountCredentials();
  if (!email || !password) {
    setAccountMessage("Renseigne ton email et ton mot de passe.");
    return;
  }
  setAccountMessage("Connexion en cours...");
  await window.OpenCardexCloud.signInWithEmail(email, password);
  if (els.accountPassword) els.accountPassword.value = "";
}

async function registerAccountWithEmail() {
  const { email, password } = getAccountCredentials();
  if (!email || password.length < 6) {
    setAccountMessage("Mot de passe: 6 caracteres minimum.");
    return;
  }
  setAccountMessage("Creation du compte...");
  await window.OpenCardexCloud.registerWithEmail(email, password);
  if (els.accountPassword) els.accountPassword.value = "";
}

async function signInAccountWithGoogle() {
  setAccountMessage("Connexion Google en cours...");
  await window.OpenCardexCloud.signInWithGoogle();
}

async function signOutAccount() {
  setAccountMessage("Deconnexion...");
  await window.OpenCardexCloud.signOut();
}

function hasActiveCloudSession() {
  return state.cloudReady && Boolean(state.cloudUser) && Boolean(window.OpenCardexCloud);
}

function scheduleCloudUpload(reason = "local-change") {
  if (!hasActiveCloudSession() || state.cloudApplyingRemote) {
    return;
  }
  window.clearTimeout(state.cloudUploadTimer);
  state.cloudUploadTimer = window.setTimeout(() => {
    uploadCollectionToCloud(reason).catch((error) => {
      setAccountSyncMessage(`Synchronisation impossible: ${error.message}`);
    });
  }, 900);
}

async function uploadCollectionToCloud(reason = "local-change") {
  if (!hasActiveCloudSession() || state.cloudApplyingRemote) {
    return;
  }
  window.clearTimeout(state.cloudUploadTimer);
  setAccountSyncMessage("Synchronisation en cours...");
  const payload = await OpenCardexStore.exportBackup();
  state.cloudLastRemoteExportedAt = payload.exportedAt || state.cloudLastRemoteExportedAt;
  await window.OpenCardexCloud.uploadBackup(payload);
  setAccountSyncMessage(`Synchronise: ${formatDateTime(new Date().toISOString())}.`);
}

async function applyCloudBackup(snapshot) {
  if (!snapshot?.payload) {
    scheduleCloudUpload("initial-empty-cloud");
    return;
  }
  const exportedAt = snapshot.exportedAt || snapshot.payload.exportedAt || "";
  const revision = snapshot.revision || exportedAt;
  const cloudBinders = Array.isArray(snapshot.payload.binders) ? snapshot.payload.binders : [];
  const cloudOwnedCards = Array.isArray(snapshot.payload.ownedCards) ? snapshot.payload.ownedCards : [];
  const localUserBinders = state.binders.filter((binder) => binder.id !== OpenCardexStore.systemPokedexBinderId);
  if (!revision && cloudBinders.length === 0 && cloudOwnedCards.length === 0 && (localUserBinders.length || state.ownedCards.length)) {
    scheduleCloudUpload("empty-cloud-bootstrap");
    return;
  }
  if (revision && revision === state.cloudLastRevision) {
    return;
  }
  if (snapshot.originClientId === window.OpenCardexCloud?.clientId) {
    state.cloudLastRevision = revision || state.cloudLastRevision;
    state.cloudLastRemoteExportedAt = exportedAt || state.cloudLastRemoteExportedAt;
    return;
  }
  if (!revision && exportedAt && exportedAt <= state.cloudLastRemoteExportedAt) {
    return;
  }
  state.cloudApplyingRemote = true;
  try {
    setAccountSyncMessage("Mise a jour cloud recue...");
    await OpenCardexStore.importBackup(snapshot.payload);
    state.cloudLastRevision = revision || state.cloudLastRevision;
    state.cloudLastRemoteExportedAt = exportedAt || state.cloudLastRemoteExportedAt;
    await loadCollectionData();
    setAccountSyncMessage(`Synchronise depuis le cloud: ${formatDateTime(new Date().toISOString())}.`);
  } finally {
    state.cloudApplyingRemote = false;
  }
}

function stopCloudSubscription() {
  if (state.cloudUnsubscribe) {
    state.cloudUnsubscribe();
    state.cloudUnsubscribe = null;
  }
}

function startCloudSubscription() {
  stopCloudSubscription();
  if (!hasActiveCloudSession() || !window.OpenCardexCloud?.subscribeBackup) {
    return;
  }
  state.cloudUnsubscribe = window.OpenCardexCloud.subscribeBackup((snapshot) => {
    applyCloudBackup(snapshot).catch((error) => {
      setAccountSyncMessage(`Reception cloud impossible: ${error.message}`);
    });
  });
}

function wrapOpenCardexStoreForCloudSync() {
  if (!window.OpenCardexStore || state.cloudStoreWrapped) {
    return;
  }
  state.cloudStoreWrapped = true;
  ["saveBinder", "saveOwnedCard", "deleteBinder", "deleteOwnedCard", "importBackup"].forEach((methodName) => {
    const original = OpenCardexStore[methodName];
    OpenCardexStore[methodName] = async (...args) => {
      const result = await original(...args);
      if (!state.cloudApplyingRemote) {
        syncLocalMutationToCloud(methodName, result, args).catch((error) => {
          setAccountSyncMessage(`Synchronisation impossible: ${error.message}`);
        });
      }
      return result;
    };
  });
}

async function syncLocalMutationToCloud(methodName, result, args) {
  if (!hasActiveCloudSession() || state.cloudApplyingRemote) {
    return;
  }
  if (methodName === "saveBinder" && window.OpenCardexCloud.saveBinder) {
    await window.OpenCardexCloud.saveBinder(result);
    setAccountSyncMessage("Classeur synchronise.");
    return;
  }
  if (methodName === "saveOwnedCard" && window.OpenCardexCloud.saveOwnedCard) {
    await window.OpenCardexCloud.saveOwnedCard(result);
    setAccountSyncMessage("Carte synchronisee.");
    return;
  }
  if (methodName === "deleteBinder" && window.OpenCardexCloud.deleteBinder) {
    await window.OpenCardexCloud.deleteBinder(args[0]);
    setAccountSyncMessage("Classeur supprime du cloud.");
    return;
  }
  if (methodName === "deleteOwnedCard" && window.OpenCardexCloud.deleteOwnedCard) {
    await window.OpenCardexCloud.deleteOwnedCard(args[0]);
    setAccountSyncMessage("Carte supprimee du cloud.");
    return;
  }
  await uploadCollectionToCloud(methodName);
}

function collectionSummary(payload) {
  const binders = Array.isArray(payload?.binders) ? payload.binders.length : 0;
  const cards = Array.isArray(payload?.ownedCards) ? payload.ownedCards.length : 0;
  return `${binders} classeur(s), ${cards} carte(s)`;
}

async function syncCloudNow(reason = "local-change") {
  scheduleCloudUpload(reason);
  if (hasActiveCloudSession() && !state.cloudApplyingRemote) {
    await uploadCollectionToCloud(reason);
  }
}

async function manualUploadCollection() {
  if (!hasActiveCloudSession()) {
    setAccountSyncMessage("Connexion requise.");
    return;
  }
  const payload = await OpenCardexStore.exportBackup();
  setAccountSyncMessage(`Envoi: ${collectionSummary(payload)}...`);
  await uploadCollectionToCloud("manual-upload");
  setAccountSyncMessage(`Cloud mis a jour: ${collectionSummary(payload)}.`);
}

async function manualDownloadCollection() {
  if (!hasActiveCloudSession()) {
    setAccountSyncMessage("Connexion requise.");
    return;
  }
  const snapshot = await window.OpenCardexCloud.downloadBackupSnapshot();
  if (!snapshot?.payload) {
    setAccountSyncMessage("Aucune sauvegarde cloud trouvee.");
    return;
  }
  setAccountSyncMessage(`Reception: ${collectionSummary(snapshot.payload)}...`);
  state.cloudApplyingRemote = true;
  try {
    await OpenCardexStore.importBackup(snapshot.payload);
    state.cloudLastRevision = snapshot.revision || state.cloudLastRevision;
    state.cloudLastRemoteExportedAt = snapshot.exportedAt || state.cloudLastRemoteExportedAt;
    await loadCollectionData();
    setAccountSyncMessage(`Local mis a jour: ${collectionSummary(snapshot.payload)}.`);
  } finally {
    state.cloudApplyingRemote = false;
  }
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
    : page === "binder-detail"
    ? "binder-detail"
    : page === "pokedex"
    ? "pokedex"
    : page === "account"
    ? "account"
    : ["collection", "binders", "add-cards", "quote"].includes(page)
      ? "binders"
      : "catalog";
  const catalogActive = normalizedPage === "catalog";
  const bindersActive = normalizedPage === "binders";
  const binderDetailActive = normalizedPage === "binder-detail";
  const pokedexActive = normalizedPage === "pokedex";
  const accountActive = normalizedPage === "account";
  const detailActive = normalizedPage === "detail";
  const bindersNavActive = bindersActive || pokedexActive || binderDetailActive;

  els.catalogPage.hidden = !catalogActive;
  els.bindersPage.hidden = !bindersActive;
  els.pokedexPage.hidden = !pokedexActive;
  els.binderDetailPage.hidden = !binderDetailActive;
  els.accountPage.hidden = !accountActive;
  els.cardDetailPage.hidden = !detailActive;

  els.navBinders.classList.toggle("is-active", bindersNavActive);
  els.navCatalog.classList.toggle("is-active", catalogActive);
  els.navAccount.classList.toggle("is-active", accountActive);
  els.mobileNavCatalog.classList.toggle("is-active", catalogActive);
  els.mobileNavBinders.classList.toggle("is-active", bindersNavActive);
  els.mobileNavAccount.classList.toggle("is-active", accountActive);
  document.body.classList.toggle("is-detail-page", detailActive);
  state.currentPage = normalizedPage;

  if (bindersActive) {
    loadCollectionData().catch((error) => {
      if (els.binderList) {
        els.binderList.innerHTML = `<p class='subtitle'>Classeurs indisponibles: ${escapeHtml(String(error))}</p>`;
      }
    });
  }
  if (pokedexActive) {
    renderPokedexPage().catch((error) => {
      els.pokedexContent.innerHTML = `<p class='subtitle'>Pokédex indisponible: ${escapeHtml(String(error))}</p>`;
    });
  }
  if (accountActive) {
    renderAccount();
  }
  if (binderDetailActive) {
    renderBinderDetailPage().catch((error) => {
      els.binderDetailContent.innerHTML = `<p class='subtitle'>Classeur indisponible: ${escapeHtml(String(error))}</p>`;
    });
  }
}

function openBinderCreateModal() {
  els.binderName.value = "";
  els.binderDescription.value = "";
  els.binderCreateModal.hidden = false;
  els.binderName.focus();
}

function closeBinderCreateModal() {
  els.binderCreateModal.hidden = true;
}

function openBinderDeleteModal(binderId) {
  const binder = state.binders.find((item) => item.id === binderId);
  if (!binder) return;
  state.pendingBinderDeleteId = binderId;
  els.binderDeleteCopy.textContent = `Supprimer "${binder.name}" ? Les cartes resteront dans ta collection, sans classeur.`;
  els.binderDeleteModal.hidden = false;
  els.binderDeleteConfirm.focus();
}

function closeBinderDeleteModal() {
  state.pendingBinderDeleteId = null;
  els.binderDeleteModal.hidden = true;
}

async function confirmBinderDelete() {
  const binderId = state.pendingBinderDeleteId;
  if (!binderId) return;
  await OpenCardexStore.deleteBinder(binderId);
  for (const card of state.ownedCards.filter((item) => item.binderId === binderId)) {
    await OpenCardexStore.saveOwnedCard({ ...card, binderId: undefined });
  }
  await syncCloudNow("delete-binder");
  closeBinderDeleteModal();
  await loadCollectionData();
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
    const userBinders = state.binders.filter((binder) => binder.id !== OpenCardexStore.systemPokedexBinderId);
    menu.innerHTML = userBinders.length
      ? userBinders
          .map((binder) => `<button type="button" data-binder-id="${binder.id}">${escapeHtml(binder.name)}</button>`)
          .join("")
      : `<button type="button" disabled>Crée un classeur</button>`;
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

function renderOwnershipStatus(card) {
  els.dialogHistory.innerHTML = "";
  const ownedMatches = state.ownedCards.filter((ownedCard) => ownedCard.cardId === card.id);

  if (!ownedMatches.length) {
    els.dialogHistory.innerHTML = `
      <div class="ownership-empty">
        <strong>Pas encore dans ta collection</strong>
        <span>Utilise le bouton + en haut pour l'ajouter a un classeur.</span>
      </div>
    `;
    return;
  }

  const byBinder = new Map();
  for (const ownedCard of ownedMatches) {
    const key = ownedCard.binderId || "";
    const current = byBinder.get(key) || { quantity: 0, cards: [] };
    current.quantity += Number(ownedCard.quantity) || 0;
    current.cards.push(ownedCard);
    byBinder.set(key, current);
  }

  els.dialogHistory.innerHTML = [...byBinder.entries()]
    .map(([binderId, item]) => `
      <article class="ownership-row">
        <div>
          <strong>${escapeHtml(getBinderName(binderId))}</strong>
          <span>${item.quantity} exemplaire(s)</span>
        </div>
        <span class="ownership-chip">Possedee</span>
      </article>
    `)
    .join("");
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
  renderOwnershipStatus(data);

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
els.accountEmailLogin?.addEventListener("click", () => {
  signInAccountWithEmail().catch((error) => setAccountMessage(`Connexion impossible: ${error.message}`));
});
els.accountEmailRegister?.addEventListener("click", () => {
  registerAccountWithEmail().catch((error) => setAccountMessage(`Creation impossible: ${error.message}`));
});
els.accountGoogleLogin?.addEventListener("click", () => {
  signInAccountWithGoogle().catch((error) => setAccountMessage(`Connexion Google impossible: ${error.message}`));
});
els.accountLogout?.addEventListener("click", () => {
  signOutAccount().catch((error) => setAccountMessage(`Deconnexion impossible: ${error.message}`));
});
els.pokedexBanner?.addEventListener("click", () => switchPage("pokedex"));
els.pokedexBack?.addEventListener("click", () => switchPage("binders"));
els.binderDetailBack?.addEventListener("click", () => switchPage("binders"));
els.binderSortToggle?.addEventListener("click", () => openBinderSortModal());
els.accountSyncUpload?.addEventListener("click", () => {
  manualUploadCollection().catch((error) => {
    setAccountSyncMessage(`Envoi impossible: ${error.message}`);
  });
});
els.accountSyncDownload?.addEventListener("click", () => {
  manualDownloadCollection().catch((error) => {
    setAccountSyncMessage(`Reception impossible: ${error.message}`);
  });
});
els.dialogAddOwned.addEventListener("click", () => {
  if (state.currentDetailCard) {
    prepareOwnedCardDraft(state.currentDetailCard);
  }
});
els.binderCreateToggle?.addEventListener("click", () => openBinderCreateModal());
els.binderCreateCancel?.addEventListener("click", () => closeBinderCreateModal());
els.binderCreateCancelSecondary?.addEventListener("click", () => closeBinderCreateModal());
els.binderCreateModal?.addEventListener("click", (event) => {
  if (event.target === els.binderCreateModal) {
    closeBinderCreateModal();
  }
});
els.binderDeleteCancel?.addEventListener("click", () => closeBinderDeleteModal());
els.binderDeleteCancelSecondary?.addEventListener("click", () => closeBinderDeleteModal());
els.binderDeleteConfirm?.addEventListener("click", () => {
  confirmBinderDelete().catch((error) => {
    els.binderDeleteCopy.textContent = `Suppression impossible: ${String(error)}`;
  });
});
els.binderDeleteModal?.addEventListener("click", (event) => {
  if (event.target === els.binderDeleteModal) {
    closeBinderDeleteModal();
  }
});
els.binderSortCancel?.addEventListener("click", () => closeBinderSortModal());
els.binderSortCancelSecondary?.addEventListener("click", () => closeBinderSortModal());
els.binderSortApply?.addEventListener("click", () => {
  applyBinderSort().catch((error) => {
    els.binderDetailContent.innerHTML = `<p class='subtitle'>Tri impossible: ${escapeHtml(String(error))}</p>`;
  });
});
els.binderSortModal?.addEventListener("click", (event) => {
  if (event.target === els.binderSortModal) {
    closeBinderSortModal();
  }
});
els.binderCardPriceCancel?.addEventListener("click", () => closeBinderCardPriceModal());
els.binderCardPriceSave?.addEventListener("click", () => {
  saveBinderCardCustomPrice().catch((error) => {
    els.binderCardMarketPrice.textContent = `Enregistrement impossible: ${String(error)}`;
  });
});
els.binderCardPriceReset?.addEventListener("click", () => {
  saveBinderCardCustomPrice({ reset: true }).catch((error) => {
    els.binderCardMarketPrice.textContent = `Enregistrement impossible: ${String(error)}`;
  });
});
els.binderCardOpenDetail?.addEventListener("click", () => openBinderCardDetail());
els.binderCardPriceModal?.addEventListener("click", (event) => {
  if (event.target === els.binderCardPriceModal) {
    closeBinderCardPriceModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.binderCreateModal.hidden) {
    closeBinderCreateModal();
  }
  if (event.key === "Escape" && !els.binderDeleteModal.hidden) {
    closeBinderDeleteModal();
  }
  if (event.key === "Escape" && !els.binderSortModal.hidden) {
    closeBinderSortModal();
  }
  if (event.key === "Escape" && els.binderCardPriceModal && !els.binderCardPriceModal.hidden) {
    closeBinderCardPriceModal();
  }
});
window.addEventListener("opencardex-cloud-ready", () => {
  state.cloudReady = true;
  wrapOpenCardexStoreForCloudSync();
  startCloudSubscription();
  renderAccount();
});
window.addEventListener("opencardex-cloud-auth", (event) => {
  state.cloudReady = true;
  state.cloudUser = event.detail || null;
  wrapOpenCardexStoreForCloudSync();
  if (state.cloudUser) {
    startCloudSubscription();
  } else {
    stopCloudSubscription();
  }
  renderAccount();
});
window.addEventListener("opencardex-cloud-error", (event) => {
  setAccountSyncMessage(`Erreur Firebase: ${event.detail || "sync interrompue"}`);
});
els.binderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await OpenCardexStore.saveBinder({
    name: els.binderName.value,
    description: els.binderDescription.value,
  });
  await syncCloudNow("create-binder");
  els.binderName.value = "";
  els.binderDescription.value = "";
  closeBinderCreateModal();
  await loadCollectionData();
});
els.collectionFilterBinder?.addEventListener("change", () => renderCollection());
els.collectionSort?.addEventListener("change", () => renderCollection());
els.collectionExportButton?.addEventListener("click", () => exportCollectionJson());
els.collectionImportButton?.addEventListener("click", () => {
  els.collectionImportInput.value = "";
  els.collectionImportInput.click();
});
els.collectionImportInput?.addEventListener("change", async () => {
  try {
    await importCollectionJson(els.collectionImportInput.files?.[0]);
  } catch (error) {
    if (els.collectionSummary) els.collectionSummary.textContent = `Import impossible: ${String(error)}`;
  }
});
els.ownedCardSearchButton?.addEventListener("click", () => searchOwnedCards());
els.ownedCardSearch?.addEventListener("keydown", (event) => {
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
els.quoteImportButton?.addEventListener("click", () => {
  els.quoteImportInput.value = "";
  els.quoteImportInput.click();
});
els.quoteImportInput?.addEventListener("change", async () => {
  try {
    await importQuoteFile(els.quoteImportInput.files?.[0]);
  } catch (error) {
    if (els.quoteList) els.quoteList.innerHTML = `<p class='subtitle'>Import impossible: ${String(error)}</p>`;
  }
});
els.quoteSaveButton?.addEventListener("click", () => saveQuote());
els.quoteExportJsonButton?.addEventListener("click", () => exportQuoteJson());
els.quoteExportButton?.addEventListener("click", () => exportQuoteCsv());
els.quoteResetButton?.addEventListener("click", () => {
  state.quoteItems = [];
  saveQuote();
});
els.quoteDraftConfirm.addEventListener("click", () => confirmPendingQuoteDraft());
els.quoteDraftCancel.addEventListener("click", () => cancelPendingQuoteDraft());
els.dialogClose.addEventListener("click", () => switchPage(state.detailReturnPage || "catalog"));

if (window.OpenCardexCloud) {
  state.cloudReady = true;
  state.cloudUser = window.OpenCardexCloud.getCurrentUser?.() || null;
  wrapOpenCardexStoreForCloudSync();
  startCloudSubscription();
  renderAccount();
}

bootstrap().catch((error) => {
  els.setTitle.textContent = "Erreur de chargement";
  els.setMeta.textContent = String(error);
});
