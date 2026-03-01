import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  type Auth,
  browserLocalPersistence,
  inMemoryPersistence,
  setPersistence,
} from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
)

function createFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null
  if (getApps().length > 0) return getApps()[0]!
  return initializeApp(firebaseConfig)
}

export const firebaseApp = createFirebaseApp()
export const firebaseAuth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null
export const firestoreDb: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null

// Avoid hard crashes in environments where storage access is blocked.
// If persistence can't be set, Firebase falls back to default behavior.
if (firebaseAuth) {
  setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {
    setPersistence(firebaseAuth, inMemoryPersistence).catch(() => {})
  })
}
