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

async function uploadBackup(payload) {
  const user = currentUserOrThrow();
  await setDoc(backupRef(user.uid), {
    payload,
    updatedAt: serverTimestamp(),
    exportedAt: payload?.exportedAt || new Date().toISOString(),
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

window.OpenCardexCloud = {
  getCurrentUser: () => publicUser(auth.currentUser),
  signInWithEmail: (email, password) => signInWithEmailAndPassword(auth, email, password),
  registerWithEmail: (email, password) => createUserWithEmailAndPassword(auth, email, password),
  signInWithGoogle: () => signInWithPopup(auth, googleProvider),
  signOut: () => signOut(auth),
  uploadBackup,
  downloadBackup,
};

onAuthStateChanged(auth, (user) => {
  window.dispatchEvent(new CustomEvent("opencardex-cloud-auth", { detail: publicUser(user) }));
});

window.dispatchEvent(new CustomEvent("opencardex-cloud-ready"));
