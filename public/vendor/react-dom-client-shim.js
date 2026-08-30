// Même principe que react-shim.js, pour le spécificateur "react-dom/client" (voir l'import map dans
// public/app.html) — pont vers le global UMD window.ReactDOM (chargé juste avant, en script
// classique, par react-dom.production.min.js).
const ReactDOM = window.ReactDOM;
export default ReactDOM;
export const { createRoot, hydrateRoot } = ReactDOM;
