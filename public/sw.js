/* ============================================================================
   Service worker minimal pour rendre Conquête Tribale installable (PWA) sur
   téléphone -- icône sur l'écran d'accueil, ouverture plein écran sans barre
   d'adresse, chargement quasi instantané même sur réseau moyen.

   Portée volontairement étroite : ne met en cache QUE la coquille applicative
   statique (HTML/CSS/JS/polices/vendor/icônes), jamais /api/*. Le jeu est un
   monde partagé en temps réel -- servir une réponse d'API depuis le cache
   afficherait des ressources/troupes/attaques obsolètes, ce qui serait pire
   qu'une simple absence de mode hors-ligne. Toute requête /api/ traverse donc
   ce service worker sans jamais passer par le cache (voir le fetch handler
   plus bas) : elle part toujours sur le réseau, exactement comme si ce fichier
   n'existait pas.

   Stratégie pour la coquille : "network-first, cache en secours" -- en ligne,
   toujours la version la plus fraîche (donc un nouveau déploiement du jeu est
   visible immédiatement, pas besoin d'attendre l'expiration d'un cache) ; hors
   ligne ou réseau très mauvais, on retombe sur la dernière version connue,
   plutôt qu'un écran blanc. */
const CACHE_NAME = "ct-shell-v1";
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/app/styles.css",
  "/vendor/react.production.min.js",
  "/vendor/react-dom.production.min.js",
  "/vendor/react-shim.js",
  "/vendor/react-dom-client-shim.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // laisse passer POST/PUT/etc. sans y toucher (actions de jeu)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ne touche pas aux polices Google Fonts etc.
  if (url.pathname.startsWith("/api/")) return; // jamais de cache pour l'état du jeu en temps réel

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
  );
});
