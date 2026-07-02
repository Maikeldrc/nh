import { initializeApp } from 'firebase/app';
import {
  browserSessionPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const missingFirebaseConfig = Object.values(firebaseConfig).some(value => !value);

if (missingFirebaseConfig) {
  throw new Error('Identity Platform configuration is incomplete.');
}

const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

void setPersistence(auth, browserSessionPersistence);

export function observeAuthenticatedUser(
  callback: (user: FirebaseUser | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function loginWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export async function getIdentityToken(forceRefresh = false): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required.');
  return user.getIdToken(forceRefresh);
}
