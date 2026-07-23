(function () {
  const DB_NAME = "opencardex";
  const DB_VERSION = 1;
  const SYSTEM_POKEDEX_BINDER_ID = "system_pokedex";

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function createId(prefix) {
    if (crypto.randomUUID) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("binders")) {
          db.createObjectStore("binders", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("ownedCards")) {
          const store = db.createObjectStore("ownedCards", { keyPath: "id" });
          store.createIndex("binderId", "binderId", { unique: false });
          store.createIndex("cardId", "cardId", { unique: false });
          store.createIndex("forTrade", "forTrade", { unique: false });
          store.createIndex("wanted", "wanted", { unique: false });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function normalizeBinder(input) {
    const timestamp = nowIso();
    const isSystem = Boolean(input.system || input.isSystem || input.id === SYSTEM_POKEDEX_BINDER_ID);
    return {
      id: isSystem ? SYSTEM_POKEDEX_BINDER_ID : String(input.id || createId("binder")),
      name: String(input.name || "Classeur").trim() || "Classeur",
      description: input.description ? String(input.description) : "",
      system: isSystem,
      locked: Boolean(input.locked || isSystem),
      createdAt: input.createdAt || timestamp,
      updatedAt: timestamp,
    };
  }

  function buildSystemPokedexBinder() {
    return normalizeBinder({
      id: SYSTEM_POKEDEX_BINDER_ID,
      name: "Pokédex",
      description: "Classeur automatique, non modifiable.",
      system: true,
      locked: true,
    });
  }

  function normalizeOwnedCard(input) {
    const timestamp = nowIso();
    const quantity = Math.max(1, Number.parseInt(input.quantity, 10) || 1);
    return {
      id: String(input.id || createId("owned")),
      cardId: String(input.cardId || input.card_id || ""),
      binderId: input.binderId || undefined,
      language: String(input.language || "fr"),
      variant: String(input.variant || "normal"),
      condition: String(input.condition || "near_mint"),
      quantity,
      page: input.page === "" || input.page === undefined ? undefined : Number(input.page),
      slot: input.slot === "" || input.slot === undefined ? undefined : Number(input.slot),
      purchasePrice: input.purchasePrice === "" || input.purchasePrice === undefined ? undefined : Number(input.purchasePrice),
      customPrice:
        input.customPrice === "" || input.customPrice === null || input.customPrice === undefined
          ? undefined
          : Number(input.customPrice),
      purchaseDate: input.purchaseDate || undefined,
      forTrade: Boolean(input.forTrade),
      wanted: Boolean(input.wanted),
      notes: input.notes ? String(input.notes) : "",
      createdAt: input.createdAt || timestamp,
      updatedAt: timestamp,
    };
  }

  async function getAll(storeName) {
    const db = await openDb();
    try {
      return await requestToPromise(db.transaction(storeName, "readonly").objectStore(storeName).getAll());
    } finally {
      db.close();
    }
  }

  async function put(storeName, value) {
    const db = await openDb();
    try {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(value);
      await transactionDone(tx);
      return value;
    } finally {
      db.close();
    }
  }

  async function remove(storeName, id) {
    const db = await openDb();
    try {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(id);
      await transactionDone(tx);
    } finally {
      db.close();
    }
  }

  async function exportBackup() {
    const [binders, ownedCards, settings] = await Promise.all([
      getAll("binders"),
      getAll("ownedCards"),
      getAll("settings"),
    ]);
    return {
      schemaVersion: DB_VERSION,
      exportedAt: nowIso(),
      app: "OpenCardex",
      binders,
      ownedCards,
      settings,
    };
  }

  async function importBackup(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("Sauvegarde JSON invalide.");
    }
    const binders = Array.isArray(payload.binders) ? payload.binders.map(normalizeBinder) : [];
    const ownedCards = Array.isArray(payload.ownedCards) ? payload.ownedCards.map(normalizeOwnedCard) : [];
    if (ownedCards.some((card) => !card.cardId)) {
      throw new Error("Sauvegarde invalide: une carte possedee n'a pas de cardId.");
    }

    const db = await openDb();
    try {
      const tx = db.transaction(["binders", "ownedCards", "settings"], "readwrite");
      for (const binder of binders) tx.objectStore("binders").put(binder);
      for (const card of ownedCards) tx.objectStore("ownedCards").put(card);
      tx.objectStore("settings").put({ key: "lastImportAt", value: nowIso(), updatedAt: nowIso() });
      await transactionDone(tx);
    } finally {
      db.close();
    }
  }

  window.OpenCardexStore = {
    schemaVersion: DB_VERSION,
    createId,
    normalizeBinder,
    normalizeOwnedCard,
    getBinders: () => getAll("binders"),
    getOwnedCards: () => getAll("ownedCards"),
    saveBinder: (binder) => put("binders", normalizeBinder(binder)),
    saveOwnedCard: (card) => put("ownedCards", normalizeOwnedCard(card)),
    deleteBinder: (id) => {
      if (id === SYSTEM_POKEDEX_BINDER_ID) {
        return Promise.resolve();
      }
      return remove("binders", id);
    },
    deleteOwnedCard: (id) => remove("ownedCards", id),
    systemPokedexBinderId: SYSTEM_POKEDEX_BINDER_ID,
    buildSystemPokedexBinder,
    exportBackup,
    importBackup,
  };
})();
