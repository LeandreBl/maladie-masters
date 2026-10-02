import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const firebaseAuth = getAuth(
  initializeApp(isFirebaseConfigured ? firebaseConfig : { apiKey: "missing", projectId: "missing" }),
);

const google = new GoogleAuthProvider();
google.setCustomParameters({ prompt: "select_account" });

export const signInWithGoogle = () => signInWithPopup(firebaseAuth, google);
export const logout = () => signOut(firebaseAuth);
