import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDUxlrsueRr34SybIe0ANszOm7T3WQlT1M",
  authDomain: "opencardex.firebaseapp.com",
  projectId: "opencardex",
  storageBucket: "opencardex.firebasestorage.app",
  messagingSenderId: "164739004882",
  appId: "1:164739004882:web:f02fd543601af7cafdf00b",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const clientId = localStorage.getItem("opencardex_cloud_client_id") || crypto.randomUUID();
localStorage.setItem("opencardex_cloud_client_id", clientId);
let revisionCounter = 0;

function backupRef(uid) {
  return doc(db, "users", uid, "backups", "opencardex");
}

function bindersRef(uid) {
  return collection(db, "users", uid, "binders");
}

function ownedCardsRef(uid) {
  return collection(db, "users", uid, "ownedCards");
}

function publicUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
  };
}

function currentUserOrThrow() {
  if (!auth.currentUser) {
    throw new Error("Connecte-toi avant de synchroniser.");
  }
  return auth.currentUser;
}

function removeUndefinedFields(value) {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedFields);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, removeUndefinedFields(entryValue)]),
  );
}

async function uploadBackup(payload) {
  const user = currentUserOrThrow();
  const revision = `${Date.now()}-${clientId}-${revisionCounter++}`;
  const cleanPayload = removeUndefinedFields(payload);
  const batch = writeBatch(db);
  const [cloudBinders, cloudOwnedCards] = await Promise.all([
    getDocs(bindersRef(user.uid)),
    getDocs(ownedCardsRef(user.uid)),
  ]);
  const nextBinderIds = new Set((cleanPayload.binders || []).map((binder) => binder.id));
  const nextOwnedCardIds = new Set((cleanPayload.ownedCards || []).map((card) => card.id));

  for (const item of cleanPayload.binders || []) {
    batch.set(doc(db, "users", user.uid, "binders", item.id), {
      ...item,
      _syncRevision: revision,
      _originClientId: clientId,
      _updatedAt: serverTimestamp(),
    });
  }
  for (const item of cleanPayload.ownedCards || []) {
    batch.set(doc(db, "users", user.uid, "ownedCards", item.id), {
      ...item,
      _syncRevision: revision,
      _originClientId: clientId,
      _updatedAt: serverTimestamp(),
    });
  }
  cloudBinders.forEach((snapshot) => {
    if (!nextBinderIds.has(snapshot.id)) {
      batch.delete(snapshot.ref);
    }
  });
  cloudOwnedCards.forEach((snapshot) => {
    if (!nextOwnedCardIds.has(snapshot.id)) {
      batch.delete(snapshot.ref);
    }
  });
  batch.set(backupRef(user.uid), {
    revision,
    exportedAt: cleanPayload?.exportedAt || new Date().toISOString(),
    originClientId: clientId,
    app: "OpenCardex",
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

async function saveBinder(binder) {
  const user = currentUserOrThrow();
  const cleanBinder = removeUndefinedFields(binder);
  await setDoc(doc(db, "users", user.uid, "binders", cleanBinder.id), {
    ...cleanBinder,
    _syncRevision: `${Date.now()}-${clientId}-${revisionCounter++}`,
    _originClientId: clientId,
    _updatedAt: serverTimestamp(),
  });
}

async function saveOwnedCard(card) {
  const user = currentUserOrThrow();
  const cleanCard = removeUndefinedFields(card);
  await setDoc(doc(db, "users", user.uid, "ownedCards", cleanCard.id), {
    ...cleanCard,
    _syncRevision: `${Date.now()}-${clientId}-${revisionCounter++}`,
    _originClientId: clientId,
    _updatedAt: serverTimestamp(),
  });
}

async function deleteBinder(id) {
  const user = currentUserOrThrow();
  await deleteDoc(doc(db, "users", user.uid, "binders", id));
}

async function deleteOwnedCard(id) {
  const user = currentUserOrThrow();
  await deleteDoc(doc(db, "users", user.uid, "ownedCards", id));
}

function cleanCloudItem(data) {
  const { _syncRevision, _originClientId, _updatedAt, ...item } = data || {};
  return item;
}

async function readCollectionPayload() {
  const user = currentUserOrThrow();
  const [bindersSnapshot, ownedCardsSnapshot, backupSnapshot] = await Promise.all([
    getDocs(bindersRef(user.uid)),
    getDocs(ownedCardsRef(user.uid)),
    getDoc(backupRef(user.uid)),
  ]);
  const binders = [];
  const ownedCards = [];
  const revisions = [];
  bindersSnapshot.forEach((snapshot) => {
    const data = snapshot.data();
    if (data?._syncRevision) revisions.push(data._syncRevision);
    binders.push(cleanCloudItem({ id: snapshot.id, ...data }));
  });
  ownedCardsSnapshot.forEach((snapshot) => {
    const data = snapshot.data();
    if (data?._syncRevision) revisions.push(data._syncRevision);
    ownedCards.push(cleanCloudItem({ id: snapshot.id, ...data }));
  });
  const backupData = backupSnapshot.exists() ? backupSnapshot.data() : {};
  if (!binders.length && !ownedCards.length && backupData.payload) {
    return {
      payload: backupData.payload,
      revision: backupData.revision || "",
      exportedAt: backupData.exportedAt || backupData.payload.exportedAt || "",
      originClientId: backupData.originClientId || "",
    };
  }
  return {
    payload: {
      schemaVersion: 1,
      exportedAt: backupData.exportedAt || new Date().toISOString(),
      app: "OpenCardex",
      binders,
      ownedCards,
      settings: [],
    },
    revision: backupData.revision || revisions.sort().join("|"),
    exportedAt: backupData.exportedAt || "",
    originClientId: backupData.originClientId || "",
  };
}

async function downloadBackup() {
  const snapshot = await readCollectionPayload();
  return snapshot.payload;
}

async function downloadBackupSnapshot() {
  return readCollectionPayload();
}

function subscribeBackup(callback) {
  const user = currentUserOrThrow();
  let latestBinders = null;
  let latestOwnedCards = null;
  let latestBackup = {};

  const emit = () => {
    if (!latestBinders || !latestOwnedCards) return;
    const revisions = [];
    const binders = latestBinders.docs.map((snapshot) => {
      const data = snapshot.data();
      if (data?._syncRevision) revisions.push(data._syncRevision);
      return cleanCloudItem({ id: snapshot.id, ...data });
    });
    const ownedCards = latestOwnedCards.docs.map((snapshot) => {
      const data = snapshot.data();
      if (data?._syncRevision) revisions.push(data._syncRevision);
      return cleanCloudItem({ id: snapshot.id, ...data });
    });
    if (!binders.length && !ownedCards.length && latestBackup.payload) {
      callback({
        payload: latestBackup.payload,
        revision: latestBackup.revision || "",
        exportedAt: latestBackup.exportedAt || latestBackup.payload.exportedAt || "",
        originClientId: latestBackup.originClientId || "",
      });
      return;
    }
    callback({
      payload: {
        schemaVersion: 1,
        exportedAt: latestBackup.exportedAt || new Date().toISOString(),
        app: "OpenCardex",
        binders,
        ownedCards,
        settings: [],
      },
      revision: latestBackup.revision || revisions.sort().join("|"),
      exportedAt: latestBackup.exportedAt || "",
      originClientId: latestBackup.originClientId || "",
    });
  };

  const onError = (error) => {
    window.dispatchEvent(new CustomEvent("opencardex-cloud-error", { detail: error.message || String(error) }));
  };
  const unsubscribeBinders = onSnapshot(bindersRef(user.uid), (snapshot) => {
    latestBinders = snapshot;
    emit();
  }, onError);
  const unsubscribeOwnedCards = onSnapshot(ownedCardsRef(user.uid), (snapshot) => {
    latestOwnedCards = snapshot;
    emit();
  }, onError);
  const unsubscribeBackup = onSnapshot(backupRef(user.uid), (snapshot) => {
    latestBackup = snapshot.exists() ? snapshot.data() : {};
    emit();
  }, onError);

  return () => {
    unsubscribeBinders();
    unsubscribeOwnedCards();
    unsubscribeBackup();
  };
}

window.OpenCardexCloud = {
  getCurrentUser: () => publicUser(auth.currentUser),
  signInWithEmail: (email, password) => signInWithEmailAndPassword(auth, email, password),
  registerWithEmail: (email, password) => createUserWithEmailAndPassword(auth, email, password),
  signInWithGoogle: () => signInWithPopup(auth, googleProvider),
  signOut: () => signOut(auth),
  uploadBackup,
  downloadBackup,
  downloadBackupSnapshot,
  subscribeBackup,
  saveBinder,
  saveOwnedCard,
  deleteBinder,
  deleteOwnedCard,
  clientId,
};

onAuthStateChanged(auth, (user) => {
  window.dispatchEvent(new CustomEvent("opencardex-cloud-auth", { detail: publicUser(user) }));
});

window.dispatchEvent(new CustomEvent("opencardex-cloud-ready"));
