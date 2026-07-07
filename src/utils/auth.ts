import { initializeApp } from 'firebase/app';
import {
  browserSessionPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User as FirebaseUser
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const missingFirebaseConfig = Object.values(firebaseConfig).some(value => !value);

const configurationError = 'Identity Platform configuration is incomplete.';

const firebaseApp = missingFirebaseConfig ? null : initializeApp(firebaseConfig);
export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;

if (auth) {
  void setPersistence(auth, browserSessionPersistence);
}

export function getAuthConfigurationError(): string {
  return missingFirebaseConfig ? configurationError : '';
}

function requireAuth(): Auth {
  if (!auth) throw new Error(configurationError);
  return auth;
}

export function observeAuthenticatedUser(
  callback: (user: FirebaseUser | null) => void
): () => void {
  if (!auth) {
    window.queueMicrotask(() => callback(null));
    return () => undefined;
  }
  return onAuthStateChanged(auth, callback);
}

export async function loginWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(requireAuth(), email.trim(), password);
}

export async function logout(): Promise<void> {
  await signOut(requireAuth());
}

export async function getIdentityToken(forceRefresh = false): Promise<string> {
  const user = requireAuth().currentUser;
  if (!user) throw new Error('Authentication required.');
  return user.getIdToken(forceRefresh);
}
