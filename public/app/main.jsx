import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ToastProvider } from "./ToastContext.jsx";
import { GameProvider } from "./GameContext.jsx";
// styles.css n'est PAS importé ici : sans bundler, un navigateur ne sait pas exécuter un CSS comme
// module JS (voir l'erreur MIME que ça produisait) -- la feuille de style est chargée normalement,
// via <link rel="stylesheet" href="/app/styles.css"> dans public/react-preview.html.

ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(React.StrictMode, null, /*#__PURE__*/React.createElement(ToastProvider, null, /*#__PURE__*/React.createElement(GameProvider, null, /*#__PURE__*/React.createElement(App, null)))));