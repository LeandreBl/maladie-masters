import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";

/**
 * Firebase web config. Publishable by design — access is decided server-side
 * by the ADMIN role, never here.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** false when the VITE_FIREBASE_* are missing: the sign-in screen says so
 * instead of offering a button that will fail. */
export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
);

export const firebaseApp = initializeApp(
  firebaseConfigured ? firebaseConfig : { apiKey: "missing", projectId: "missing" },
);
export const auth = getAuth(firebaseApp);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/**
 * "Keep me signed in". Local persistence survives closing the browser; session
 * persistence ends with the tab. Set before the sign-in call, or the
 * credential is already stored under the previous policy.
 */
async function applyPersistence(keepSignedIn: boolean): Promise<void> {
  await setPersistence(
    auth,
    keepSignedIn ? browserLocalPersistence : browserSessionPersistence,
  );
}

export async function signInWithGoogle(keepSignedIn: boolean) {
  await applyPersistence(keepSignedIn);
  return signInWithPopup(auth, googleProvider);
}

export async function signInWithPassword(
  email: string,
  password: string,
  keepSignedIn: boolean,
) {
  await applyPersistence(keepSignedIn);
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(auth, email.trim());
}

export function logout() {
  return signOut(auth);
}
