// Pont entre le global UMD window.React (chargé juste avant par react.production.min.js, en
// script classique) et les modules ES du reste de l'appli, qui font `import React, {useState,...}
// from "react"` comme avec un vrai bundler — voir l'import map dans public/app.html qui fait
// pointer le spécificateur "react" vers ce fichier. Pas de bundler ici (voir scripts/build-client.js
// : aucun accès npm dans ce dépôt), donc ce petit pont fait tout le travail qu'un bundler ferait
// normalement pour résoudre le paquet "react".
const React = window.React;
export default React;
export const {
  useState, useEffect, useCallback, useRef, useContext, useMemo, useReducer, useLayoutEffect,
  createContext, createElement, Fragment, StrictMode, Children, cloneElement, isValidElement
} = React;
