/// <reference types="vite/client" />

// Declaração global para bibliotecas carregadas via CDN
declare global {
	interface Window {
		jspdf?: any; // Fornecido por jspdf.umd.min.js (UMD)
	}
}

export {};
