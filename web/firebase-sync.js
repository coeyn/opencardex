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
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
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
  await setDoc(backupRef(user.uid), {
    payload: cleanPayload,
    revision,
    updatedAt: serverTimestamp(),
    exportedAt: cleanPayload?.exportedAt || new Date().toISOString(),
    originClientId: clientId,
    app: "OpenCardex",
  });
}

async function downloadBackup() {
  const user = currentUserOrThrow();
  const snapshot = await getDoc(backupRef(user.uid));
  if (!snapshot.exists()) {
    return null;
  }
  return snapshot.data()?.payload || null;
}

function subscribeBackup(callback) {
  const user = currentUserOrThrow();
  return onSnapshot(backupRef(user.uid), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    const data = snapshot.data();
    callback({
      payload: data?.payload || null,
      revision: data?.revision || "",
      exportedAt: data?.exportedAt || data?.payload?.exportedAt || "",
      originClientId: data?.originClientId || "",
    });
  }, (error) => {
    window.dispatchEvent(new CustomEvent("opencardex-cloud-error", { detail: error.message || String(error) }));
  });
}

window.OpenCardexCloud = {
  getCurrentUser: () => publicUser(auth.currentUser),
  signInWithEmail: (email, password) => signInWithEmailAndPassword(auth, email, password),
  registerWithEmail: (email, password) => createUserWithEmailAndPassword(auth, email, password),
  signInWithGoogle: () => signInWithPopup(auth, googleProvider),
  signOut: () => signOut(auth),
  uploadBackup,
  downloadBackup,
  subscribeBackup,
  clientId,
};

onAuthStateChanged(auth, (user) => {
  window.dispatchEvent(new CustomEvent("opencardex-cloud-auth", { detail: publicUser(user) }));
});

window.dispatchEvent(new CustomEvent("opencardex-cloud-ready"));
