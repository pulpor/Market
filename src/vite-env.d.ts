/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_FIREBASE_API_KEY?: string
	readonly VITE_FIREBASE_AUTH_DOMAIN?: string
	readonly VITE_FIREBASE_PROJECT_ID?: string
	readonly VITE_FIREBASE_STORAGE_BUCKET?: string
	readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
	readonly VITE_FIREBASE_APP_ID?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}

// Declaração global para bibliotecas carregadas via CDN
declare global {
	interface Window {
		jspdf?: unknown; // Fornecido por jspdf.umd.min.js (UMD)
	}
}

export {};
