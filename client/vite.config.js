import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build vers ../public : le serveur Node (server/server.js, jamais modifié pour ça) sert déjà
// tout le contenu de public/ tel quel via serveStatic() — faire pointer le build directement là
// évite d'avoir à toucher au serveur ou à sa config pour publier le nouveau client React.
// En dev, /api/* et /ws sont redirigés vers le serveur de jeu Node qui tourne en local (voir README
// du dossier client) : le serveur de dev Vite ne sert QUE le front, jamais l'API/le jeu lui-même.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../public",
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/ws": { target: "ws://localhost:3000", ws: true }
    }
  }
});
