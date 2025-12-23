import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/bcb-api": {
        target: "https://api.bcb.gov.br/dados/serie",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bcb-api\//, "bcdata.sgs."),
      },
    },
  },
}));