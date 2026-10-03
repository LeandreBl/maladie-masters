import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

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
export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(firebaseAuth, email, password);

/**
 * The backend refuses any token without a verified address, so a new account
 * gets its verification link straight away.
 */
export async function signUpWithEmail(email: string, password: string): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  await sendEmailVerification(user);
}

export const resetPassword = (email: string) => sendPasswordResetEmail(firebaseAuth, email);
export const resendVerification = (user: User) => sendEmailVerification(user);

/**
 * Picks up a verification done in another tab: the cached ID token still says
 * `email_verified: false` until it is re-issued.
 */
export async function reloadVerification(user: User): Promise<boolean> {
  await user.reload();
  if (!user.emailVerified) return false;
  await user.getIdToken(true);
  return true;
}

/** Firebase writes its emails (verification, reset) in this language. */
export function setAuthLanguage(locale: string): void {
  firebaseAuth.languageCode = locale === "zh" ? "zh-CN" : locale;
}

/** Translates a Firebase error by its code, falling back to its message. */
export function authErrorText(caught: unknown, errors: Record<string, string>): string {
  const code = (caught as { code?: string }).code;
  return (code && errors[code]) || (caught instanceof Error ? caught.message : String(caught));
}

export const logout = () => signOut(firebaseAuth);
