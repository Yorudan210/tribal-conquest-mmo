import { useEffect, useState } from "react";
const THEME_KEY = "ct_theme";

// Porte applyTheme()/initTheme() de l'ancien index.html : bascule la classe body.theme-maquette
// et se souvient du choix en localStorage. Ici sous forme de hook React (un seul effet DOM), au
// lieu de manipuler document.body.classList à la main depuis plusieurs endroits du code.
export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "classic");
  useEffect(() => {
    document.body.classList.toggle("theme-maquette", theme === "maquette");
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);
  function toggle() {
    setTheme(t => t === "maquette" ? "classic" : "maquette");
  }
  return {
    theme,
    toggle
  };
}