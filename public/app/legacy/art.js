/* ============================================================================
   Générateurs SVG procéduraux (bâtiments, troupes, carte, marqueurs de village).
   Portés TELS QUELS depuis l'ancien public/index.html (fonctions pures : aucune
   dépendance au DOM ni à l'état de jeu, seulement des paramètres → une chaîne de
   markup SVG) — aucune raison de les retranscrire à la main en JSX, ce qui
   risquerait d'introduire des erreurs de transcription dans des centaines de
   coordonnées de tracé ajustées au pixel près. Rendues côté React via
   dangerouslySetInnerHTML dans un <g>/<div> englobant (voir components/art/*). */
import { VILLAGE_TAGS, clamp } from "../gameData.js";
const VILLAGE_TAG_MAP = Object.fromEntries(VILLAGE_TAGS.map(t => [t.key, t]));
// Clés dont la couleur de badge est claire (voir VILLAGE_TAGS) : le glyphe intérieur y reste sombre
// pour le contraste ; toutes les autres couleurs de badge, plus foncées, reçoivent un glyphe clair.
const VILLAGE_TAG_DARK_GLYPH = new Set(["star", "exclaim", "coin", "crown"]);
const MATERIAL = {
  1: {
    wall: "#6b4a2b",
    wallLight: "#8a6238",
    wallDark: "#4a331d",
    roof: "#7c3527",
    roofDark: "#5a2a20"
  },
  // bois
  2: {
    wall: "#9c9182",
    wallLight: "#b3a898",
    wallDark: "#7d7568",
    roof: "#6b3226",
    roofDark: "#5a2a20"
  },
  // pierre
  3: {
    wall: "#8a3226",
    wallLight: "#a5453a",
    wallDark: "#5a1f18",
    roof: "#4a2018",
    roofDark: "#3a1810"
  } // brique rouge et fer
};
function materialTier(level) {
  return level >= 20 ? 3 : level >= 10 ? 2 : 1;
}
const BUILDING_ART = {
  hq: m => `
    <rect x="-42" y="-52" width="84" height="52" fill="${m.wall}" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="-48,-52 0,-96 48,-52" fill="${m.roof}" stroke="#2a1c10" stroke-width="2"/>
    <rect x="22" y="-80" width="18" height="30" fill="${m.wallLight}" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="20,-80 31,-100 42,-80" fill="#d9a441" stroke="#2a1c10" stroke-width="2"/>
    <line x1="31" y1="-100" x2="31" y2="-112" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="31,-112 46,-107 31,-102" fill="#8a2e22"/>
    <rect x="-11" y="-26" width="22" height="26" rx="2" fill="#3a2414" stroke="#2a1c10" stroke-width="1.5"/>
    <rect x="-33" y="-38" width="12" height="12" fill="#2a1c10" stroke="#d9a441" stroke-width="1"/>
    <rect x="12" y="-38" width="12" height="12" fill="#2a1c10" stroke="#d9a441" stroke-width="1"/>
    <line x1="-42" y1="-52" x2="-20" y2="-30" stroke="${m.wallDark}" stroke-width="3" opacity=".7"/>
    <line x1="42" y1="-52" x2="20" y2="-30" stroke="${m.wallDark}" stroke-width="3" opacity=".7"/>
    <line x1="-36" y1="-58" x2="-6" y2="-88" stroke="${m.roofDark}" stroke-width="2" opacity=".6"/>
    <line x1="36" y1="-58" x2="6" y2="-88" stroke="${m.roofDark}" stroke-width="2" opacity=".6"/>
    <rect x="-16" y="-2" width="32" height="4" rx="1" fill="#3a2414" stroke="#2a1c10" stroke-width="1"/>
    <line x1="0" y1="-26" x2="0" y2="0" stroke="#2a1c10" stroke-width="1"/>
    <circle cx="6" cy="-13" r="1.6" fill="#d9a441"/>
    <line x1="0" y1="-96" x2="0" y2="-104" stroke="#2a1c10" stroke-width="1.5"/>
    <polygon points="0,-104 11,-100 0,-96" fill="#5b93b0" stroke="#2a1c10" stroke-width="1"/>
  `,
  wood: m => `
    <rect x="-18" y="-40" width="30" height="24" fill="${m.wall}" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="-24,-40 -3,-64 18,-40" fill="${m.roof}" stroke="#2a1c10" stroke-width="2"/>
    <g stroke="#2a1c10" stroke-width="1.5">
      <rect x="-46" y="-20" width="34" height="9" rx="4" fill="#8a6238"/>
      <circle cx="-46" cy="-15.5" r="4.5" fill="#c9a15a"/>
      <circle cx="-12" cy="-15.5" r="4.5" fill="#a9764a"/>
      <rect x="-46" y="-10" width="34" height="9" rx="4" fill="#7a5230"/>
      <circle cx="-46" cy="-5.5" r="4.5" fill="#c9a15a"/>
      <circle cx="-12" cy="-5.5" r="4.5" fill="#a9764a"/>
    </g>
    <circle cx="-46" cy="-15.5" r="2.1" fill="none" stroke="#5c3c22" stroke-width=".8"/>
    <circle cx="-12" cy="-15.5" r="2.1" fill="none" stroke="#5c3c22" stroke-width=".8"/>
    <circle cx="-46" cy="-5.5" r="2.1" fill="none" stroke="#5c3c22" stroke-width=".8"/>
    <circle cx="-12" cy="-5.5" r="2.1" fill="none" stroke="#5c3c22" stroke-width=".8"/>
    <rect x="24" y="-30" width="5" height="30" fill="#4a331d"/>
    <polygon points="26.5,-30 14,-46 39,-46" fill="#3f6b34" stroke="#2a1c10" stroke-width="1.5"/>
    <polygon points="26.5,-40 17,-54 36,-54" fill="#4a7a3a" stroke="#2a1c10" stroke-width="1.5"/>
    <rect x="0" y="-70" width="5" height="10" fill="${m.wallDark}" stroke="#2a1c10" stroke-width="1"/>
    <ellipse cx="3" cy="-74" rx="3.5" ry="5" fill="#c9c2b4" opacity=".45"/>
    <ellipse cx="6" cy="-82" rx="4.5" ry="6" fill="#c9c2b4" opacity=".3"/>
    <ellipse cx="-56" cy="-2" rx="7" ry="4" fill="#5c3c22" stroke="#2a1c10" stroke-width="1"/>
    <line x1="-56" y1="-2" x2="-50" y2="-20" stroke="#3a2414" stroke-width="2"/>
    <polygon points="-50,-20 -42,-24 -46,-14" fill="#9c9182" stroke="#2a1c10" stroke-width="1"/>
    <polygon points="-20,2 -16,-1 -18,4" fill="#c9a15a" opacity=".8"/>
    <polygon points="32,3 36,0 35,5" fill="#a9764a" opacity=".8"/>
  `,
  clay: m => `
    <ellipse cx="0" cy="0" rx="44" ry="16" fill="#6b4a2a" stroke="#2a1c10" stroke-width="2"/>
    <ellipse cx="0" cy="0" rx="30" ry="10" fill="#43301c"/>
    <ellipse cx="0" cy="2" rx="20" ry="7" fill="none" stroke="#2a1c10" stroke-width="1" opacity=".4"/>
    <ellipse cx="0" cy="4" rx="11" ry="4" fill="none" stroke="#2a1c10" stroke-width="1" opacity=".3"/>
    <ellipse cx="-30" cy="-4" rx="10" ry="6" fill="#b07a4c" stroke="#2a1c10" stroke-width="1.5"/>
    <ellipse cx="28" cy="-6" rx="9" ry="5" fill="#a06b3f" stroke="#2a1c10" stroke-width="1.5"/>
    <ellipse cx="8" cy="8" rx="8" ry="5" fill="#b07a4c" stroke="#2a1c10" stroke-width="1.5"/>
    <line x1="-38" y1="-14" x2="-30" y2="-32" stroke="${m.wallDark}" stroke-width="4" stroke-linecap="round"/>
    <rect x="-36" y="-34" width="12" height="4" fill="${m.wall}" stroke="#2a1c10" stroke-width="1.2"/>
    <line x1="-44" y1="10" x2="-68" y2="16" stroke="#4a331d" stroke-width="2" opacity=".55"/>
    <line x1="-42" y1="13" x2="-66" y2="19" stroke="#4a331d" stroke-width="2" opacity=".55"/>
    <line x1="34" y1="-30" x2="34" y2="-10" stroke="#5c3c22" stroke-width="2"/>
    <line x1="20" y1="-26" x2="46" y2="-26" stroke="#5c3c22" stroke-width="2"/>
    <ellipse cx="20" cy="-20" rx="5" ry="7" fill="#a06b3f" stroke="#2a1c10" stroke-width="1"/>
    <ellipse cx="46" cy="-20" rx="5" ry="7" fill="#b07a4c" stroke="#2a1c10" stroke-width="1"/>
  `,
  iron: m => `
    <polygon points="-40,4 -30,-38 -6,-56 18,-40 34,4" fill="${m.wall}" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="-6,-56 18,-40 6,-30 -14,-40" fill="${m.wallDark}"/>
    <path d="M -14 4 Q -14 -18 4 -18 Q 22 -18 22 4 Z" fill="#1a1712" stroke="#2a1c10" stroke-width="2"/>
    <circle cx="4" cy="-8" r="4" fill="#e0913f"/>
    <rect x="-2" y="-2" width="16" height="8" rx="2" fill="#4a331d" stroke="#2a1c10" stroke-width="1.2"/>
    <circle cx="2" cy="6" r="3" fill="#2a1c10"/>
    <circle cx="12" cy="6" r="3" fill="#2a1c10"/>
    <rect x="-4" y="-58" width="7" height="14" fill="#3a3a3a" stroke="#2a1c10" stroke-width="1.2"/>
    <ellipse cx="0" cy="-62" rx="5" ry="7" fill="#7d7568" opacity=".4"/>
    <ellipse cx="4" cy="-72" rx="6.5" ry="8" fill="#9c9182" opacity=".26"/>
    <circle cx="10" cy="-14" r="1.3" fill="#ffb347"/>
    <circle cx="14" cy="-20" r="1" fill="#ff8c42"/>
    <circle cx="-2" cy="-22" r="1.1" fill="#ffb347"/>
    <line x1="-20" y1="4" x2="-11" y2="-9" stroke="#5c3c22" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="-16" y="-13" width="9" height="5" fill="#7d7568" stroke="#2a1c10" stroke-width="1"/>
  `,
  warehouse: m => `
    <rect x="-38" y="-44" width="76" height="44" fill="${m.wall}" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="-44,-44 0,-40 0,-66 -20,-66" fill="${m.roof}" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="44,-44 0,-40 0,-66 20,-66" fill="${m.roofDark}" stroke="#2a1c10" stroke-width="2"/>
    <line x1="-38" y1="-42" x2="-4" y2="-40" stroke="${m.roofDark}" stroke-width="1.1" opacity=".5"/>
    <line x1="-28" y1="-51" x2="-2" y2="-47" stroke="${m.roofDark}" stroke-width="1.1" opacity=".5"/>
    <line x1="38" y1="-42" x2="4" y2="-40" stroke="${m.roof}" stroke-width="1.1" opacity=".5"/>
    <line x1="28" y1="-51" x2="2" y2="-47" stroke="${m.roof}" stroke-width="1.1" opacity=".5"/>
    <rect x="-30" y="-34" width="10" height="10" fill="#2a1c10" stroke="#d9a441" stroke-width="1"/>
    <rect x="-15" y="-26" width="13" height="26" fill="#3a2414" stroke="#2a1c10" stroke-width="1.5"/>
    <rect x="2" y="-26" width="13" height="26" fill="#3a2414" stroke="#2a1c10" stroke-width="1.5"/>
    <g stroke="#2a1c10" stroke-width="1.5">
      <circle cx="-52" cy="-8" r="10" fill="#c9a15a"/>
      <line x1="-52" y1="-15" x2="-52" y2="-1"/>
      <rect x="34" y="-16" width="16" height="16" fill="#8a6238"/>
      <line x1="34" y1="-8" x2="50" y2="-8"/>
      <line x1="42" y1="-16" x2="42" y2="0"/>
    </g>
    <rect x="-64" y="-14" width="14" height="14" fill="#7a5230" stroke="#2a1c10" stroke-width="1.2"/>
    <line x1="-64" y1="-7" x2="-50" y2="-7" stroke="#2a1c10" stroke-width="1"/>
    <ellipse cx="60" cy="-4" rx="9" ry="6" fill="#c9a15a" stroke="#2a1c10" stroke-width="1"/>
    <path d="M 54 -8 Q 60 -14 66 -8" fill="none" stroke="#2a1c10" stroke-width="1"/>
  `,
  farm: m => `
    <rect x="-18" y="-34" width="36" height="30" fill="${m.wallLight}" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="-24,-34 0,-54 24,-34" fill="${m.roof}" stroke="#2a1c10" stroke-width="2"/>
    <rect x="-6" y="-16" width="12" height="12" fill="#3a2414" stroke="#2a1c10" stroke-width="1.2"/>
    <line x1="0" y1="-16" x2="0" y2="-4" stroke="#2a1c10" stroke-width="1"/>
    <rect x="10" y="-54" width="5" height="10" fill="${m.wallDark}" stroke="#2a1c10" stroke-width="1"/>
    <ellipse cx="12" cy="-60" rx="4" ry="6" fill="#c9c2b4" opacity=".4"/>
    <g stroke="#8a6a1f" stroke-width="3" stroke-linecap="round">
      <line x1="24" y1="4" x2="24" y2="-14"/>
      <line x1="32" y1="4" x2="32" y2="-18"/>
      <line x1="40" y1="4" x2="40" y2="-13"/>
      <line x1="16" y1="4" x2="16" y2="-16"/>
    </g>
    <g fill="#dfc25a" stroke="#8a6a1f" stroke-width="1">
      <circle cx="24" cy="-15" r="3"/><circle cx="32" cy="-19" r="3"/><circle cx="40" cy="-14" r="3"/><circle cx="16" cy="-17" r="3"/>
    </g>
    <ellipse cx="-32" cy="2" rx="14" ry="9" fill="#e0c060" stroke="#8a6a1f" stroke-width="1.5"/>
    <path d="M -44 2 Q -32 -10 -20 2" fill="none" stroke="#b89a3d" stroke-width="1.2"/>
    <line x1="-52" y1="4" x2="-52" y2="-16" stroke="#5c3c22" stroke-width="2"/>
    <line x1="-58" y1="-8" x2="-46" y2="-8" stroke="#5c3c22" stroke-width="2"/>
    <circle cx="-52" cy="-19" r="4" fill="#c9a15a" stroke="#2a1c10" stroke-width="1"/>
    <polygon points="-58,-3 -46,-3 -52,5" fill="#8a6238" stroke="#2a1c10" stroke-width="1"/>
    <ellipse cx="-2" cy="10" rx="9" ry="6" fill="#e8e2d0" stroke="#2a1c10" stroke-width="1"/>
    <circle cx="6" cy="7" r="3" fill="#3a2414"/>
  `,
  barracks: m => `
    <rect x="-36" y="-42" width="72" height="42" fill="${m.wall}" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="-42,-42 0,-70 42,-42" fill="${m.roofDark}" stroke="#2a1c10" stroke-width="2"/>
    <line x1="0" y1="-70" x2="0" y2="-88" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="0,-88 20,-82 0,-76" fill="#8a2e22" stroke="#2a1c10" stroke-width="1.5"/>
    <rect x="-11" y="-22" width="22" height="22" fill="#2a1c10"/>
    <circle cx="-6" cy="-11" r="1" fill="#8a6238"/><circle cx="6" cy="-11" r="1" fill="#8a6238"/>
    <circle cx="-6" cy="-3" r="1" fill="#8a6238"/><circle cx="6" cy="-3" r="1" fill="#8a6238"/>
    <g stroke="#c9c2b4" stroke-width="4" stroke-linecap="round">
      <line x1="-24" y1="-32" x2="-6" y2="-14"/>
      <line x1="-6" y1="-32" x2="-24" y2="-14"/>
      <line x1="6" y1="-32" x2="24" y2="-14"/>
      <line x1="24" y1="-32" x2="6" y2="-14"/>
    </g>
    <circle cx="26" cy="-20" r="9" fill="#7d7568" stroke="#2a1c10" stroke-width="1.5"/>
    <line x1="26" y1="-29" x2="26" y2="-11" stroke="#2a1c10" stroke-width="1.2"/>
    <line x1="17" y1="-20" x2="35" y2="-20" stroke="#2a1c10" stroke-width="1.2"/>
    <line x1="-48" y1="-38" x2="-48" y2="0" stroke="#5c3c22" stroke-width="2"/>
    <line x1="-52" y1="-40" x2="-44" y2="-40" stroke="#5c3c22" stroke-width="2"/>
    <line x1="-52" y1="-6" x2="-44" y2="-6" stroke="#5c3c22" stroke-width="2"/>
    <polygon points="-48,-40 -52,-50 -44,-50" fill="#9c9182" stroke="#2a1c10" stroke-width="1"/>
  `,
  wall: m => `
    <rect x="-48" y="-10" width="96" height="26" fill="${m.wallLight}" stroke="#2a1c10" stroke-width="2"/>
    <g fill="${m.wallLight}" stroke="#2a1c10" stroke-width="2">
      <rect x="-48" y="-22" width="12" height="12"/>
      <rect x="-30" y="-22" width="12" height="12"/>
      <rect x="-12" y="-22" width="12" height="12"/>
      <rect x="6" y="-22" width="12" height="12"/>
      <rect x="24" y="-22" width="12" height="12"/>
      <rect x="36" y="-22" width="12" height="12"/>
    </g>
    <rect x="-38" y="-46" width="20" height="46" fill="${m.wall}" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="-40,-46 -28,-58 -16,-46" fill="${m.wallDark}" stroke="#2a1c10" stroke-width="2"/>
    <rect x="18" y="-46" width="20" height="46" fill="${m.wall}" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="16,-46 28,-58 40,-46" fill="${m.wallDark}" stroke="#2a1c10" stroke-width="2"/>
    <path d="M -12 16 Q 0 -6 12 16 Z" fill="#1a1712"/>
  `,
  hide: m => `
    <ellipse cx="0" cy="0" rx="40" ry="18" fill="#3f5a2c" stroke="#2a1c10" stroke-width="2"/>
    <ellipse cx="0" cy="-4" rx="26" ry="12" fill="#4a6b34"/>
    <rect x="-16" y="-14" width="32" height="14" rx="3" fill="${m.wall}" stroke="#2a1c10" stroke-width="2"/>
    <line x1="0" y1="-14" x2="0" y2="0" stroke="#2a1c10" stroke-width="1.5"/>
    <circle cx="-6" cy="-7" r="2.5" fill="#d9a441"/>
    <circle cx="6" cy="-7" r="2.5" fill="#d9a441"/>
    <ellipse cx="24" cy="6" rx="6" ry="3" fill="#7d7568" stroke="#2a1c10" stroke-width="1"/>
    <ellipse cx="-26" cy="8" rx="5" ry="2.5" fill="#7d7568" stroke="#2a1c10" stroke-width="1"/>
    <path d="M -32 -10 Q 0 -22 32 -10" fill="none" stroke="#2a1c10" stroke-width="1" stroke-dasharray="3 3" opacity=".55"/>
    <path d="M -28 -3 Q 0 -13 28 -3" fill="none" stroke="#2a1c10" stroke-width="1" stroke-dasharray="3 3" opacity=".45"/>
    <rect x="-8" y="-3" width="16" height="7" rx="1" fill="#6b4a2b" stroke="#2a1c10" stroke-width="1"/>
    <rect x="-8" y="-5" width="16" height="3" fill="#8a6238" stroke="#2a1c10" stroke-width="1"/>
    <ellipse cx="14" cy="10" rx="4" ry="2.5" fill="#5a6b3f" stroke="#2a1c10" stroke-width="1"/>
    <ellipse cx="-18" cy="11" rx="3.5" ry="2" fill="#5a6b3f" stroke="#2a1c10" stroke-width="1"/>
  `,
  academy: m => `
    <rect x="-20" y="-50" width="40" height="50" rx="4" fill="${m.wall}" stroke="#2a1c10" stroke-width="2"/>
    <path d="M -24 -50 Q 0 -80 24 -50 Z" fill="#4f6b8a" stroke="#2a1c10" stroke-width="2"/>
    <circle cx="0" cy="-66" r="4" fill="#d9a441" stroke="#2a1c10" stroke-width="1"/>
    <path d="M -4 -60 Q 0 -66 4 -60 L 3 -54 L -3 -54 Z" fill="#c9a15a" stroke="#2a1c10" stroke-width="1"/>
    <rect x="-9" y="-36" width="18" height="16" fill="#2a1c10" stroke="#d9a441" stroke-width="1"/>
    <line x1="0" y1="-36" x2="0" y2="-20" stroke="#d9a441" stroke-width="1"/>
    <line x1="-9" y1="-28" x2="9" y2="-28" stroke="#d9a441" stroke-width="1"/>
    <rect x="-10" y="-14" width="20" height="14" fill="#3a2414" stroke="#2a1c10" stroke-width="1.5"/>
    <rect x="12" y="-12" width="11" height="9" rx="1" fill="#c9b88a" stroke="#2a1c10" stroke-width="1"/>
    <line x1="14" y1="-7.5" x2="21" y2="-7.5" stroke="#5c3c22" stroke-width="1"/>
    <line x1="14" y1="-5" x2="19" y2="-5" stroke="#5c3c22" stroke-width="1"/>
    <rect x="-22" y="-6" width="10" height="6" fill="#8a2e22" stroke="#2a1c10" stroke-width="1"/>
    <rect x="-22" y="-12" width="10" height="6" fill="#4f6b8a" stroke="#2a1c10" stroke-width="1"/>
    <rect x="20" y="-46" width="6" height="20" fill="#5b93b0" stroke="#2a1c10" stroke-width="1"/>
  `
};

/* Évolution visuelle des bâtiments à mesure qu'ils montent de niveau : chaque bâtiment gagne des
   éléments supplémentaires (annexes, bannières, décors) au niveau 10, puis encore plus au niveau 20. */
const TIER2_EXTRAS = {
  hq: `
    <rect x="-68" y="-38" width="24" height="38" fill="#8b8070" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="-72,-38 -56,-56 -40,-38" fill="#6b3226" stroke="#2a1c10" stroke-width="2"/>
    <line x1="31" y1="-112" x2="46" y2="-112" stroke="#2a1c10" stroke-width="1.5"/>
    <polygon points="46,-112 60,-107 46,-102" fill="#c0503f" stroke="#2a1c10" stroke-width="1"/>
  `,
  wood: `
    <rect x="-70" y="-16" width="26" height="7" rx="3" fill="#8a6238" stroke="#2a1c10" stroke-width="1.2"/>
    <circle cx="-70" cy="-12.5" r="3.5" fill="#c9a15a"/><circle cx="-44" cy="-12.5" r="3.5" fill="#a9764a"/>
    <rect x="-70" y="-8" width="26" height="7" rx="3" fill="#7a5230" stroke="#2a1c10" stroke-width="1.2"/>
    <line x1="30" y1="0" x2="42" y2="-18" stroke="#7a5230" stroke-width="3" stroke-linecap="round"/>
    <polygon points="40,-18 50,-24 46,-12" fill="#9c9182" stroke="#2a1c10" stroke-width="1"/>
  `,
  clay: `
    <ellipse cx="-4" cy="-20" rx="9" ry="6" fill="#a06b3f" stroke="#2a1c10" stroke-width="1.5"/>
    <line x1="-38" y1="-14" x2="-46" y2="-34" stroke="#5c3c22" stroke-width="4" stroke-linecap="round"/>
    <line x1="-46" y1="-34" x2="-30" y2="-30" stroke="#5c3c22" stroke-width="3" stroke-linecap="round"/>
    <line x1="-30" y1="-30" x2="-30" y2="-16" stroke="#2a1c10" stroke-width="1"/>
  `,
  iron: `
    <rect x="-2" y="-70" width="9" height="18" fill="#615a4f" stroke="#2a1c10" stroke-width="1.5"/>
    <ellipse cx="2" cy="-76" rx="7" ry="5" fill="#9c9182" opacity=".55"/>
    <ellipse cx="6" cy="-86" rx="9" ry="6" fill="#b3a898" opacity=".4"/>
    <rect x="-34" y="0" width="14" height="5" fill="#3a3a3a" stroke="#2a1c10" stroke-width="1"/>
  `,
  warehouse: `
    <g stroke="#2a1c10" stroke-width="1.5">
      <rect x="52" y="-30" width="14" height="30" fill="#8a6238"/>
      <polygon points="52,-30 59,-40 66,-30" fill="#6b3226"/>
    </g>
  `,
  farm: `
    <ellipse cx="-46" cy="4" rx="10" ry="7" fill="#e0c060" stroke="#8a6a1f" stroke-width="1.5"/>
    <rect x="44" y="-26" width="18" height="26" fill="#c9b88a" stroke="#2a1c10" stroke-width="1.5"/>
    <polygon points="42,-26 53,-40 64,-26" fill="#7c3527" stroke="#2a1c10" stroke-width="1.5"/>
  `,
  barracks: `
    <g stroke="#2a1c10" stroke-width="1.5">
      <rect x="46" y="-30" width="5" height="30" fill="#6b4a2b"/>
      <rect x="56" y="-34" width="5" height="34" fill="#6b4a2b"/>
      <rect x="66" y="-30" width="5" height="30" fill="#6b4a2b"/>
    </g>
  `,
  hide: `
    <ellipse cx="-34" cy="10" rx="9" ry="5" fill="#3f5a2c" stroke="#2a1c10" stroke-width="1"/>
    <ellipse cx="34" cy="10" rx="9" ry="5" fill="#3f5a2c" stroke="#2a1c10" stroke-width="1"/>
    <path d="M -20 -14 Q 0 -22 20 -14" fill="none" stroke="#2a1c10" stroke-width="1" stroke-dasharray="2 2"/>
  `
};
const TIER3_EXTRAS = {
  hq: `
    <rect x="44" y="-34" width="22" height="34" fill="#8b8070" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="40,-34 55,-52 70,-34" fill="#6b3226" stroke="#2a1c10" stroke-width="2"/>
    <path d="M -80 12 Q 0 30 80 12" fill="none" stroke="#5a4632" stroke-width="5" stroke-linecap="round" opacity=".7"/>
  `,
  wood: `
    <rect x="8" y="-58" width="20" height="5" fill="#4a331d" stroke="#2a1c10" stroke-width="1"/>
    <line x1="10" y1="-58" x2="10" y2="-70" stroke="#2a1c10" stroke-width="1.5"/>
    <line x1="26" y1="-58" x2="26" y2="-70" stroke="#2a1c10" stroke-width="1.5"/>
    <polygon points="8,-70 18,-80 28,-70" fill="#3f6b34" stroke="#2a1c10" stroke-width="1.2"/>
  `,
  clay: `
    <rect x="30" y="-24" width="22" height="16" fill="#6b4a2b" stroke="#2a1c10" stroke-width="1.5"/>
    <polygon points="28,-24 41,-36 54,-24" fill="#52633a" stroke="#2a1c10" stroke-width="1.5"/>
  `,
  iron: `
    <rect x="16" y="-58" width="8" height="14" fill="#615a4f" stroke="#2a1c10" stroke-width="1.5"/>
    <ellipse cx="20" cy="-64" rx="6" ry="4" fill="#9c9182" opacity=".5"/>
    <circle cx="4" cy="-8" r="7" fill="#e0913f" opacity=".35"/>
  `,
  warehouse: `
    <g stroke="#2a1c10" stroke-width="1.2">
      <rect x="-72" y="-14" width="12" height="14" fill="#8a6238"/>
      <rect x="-58" y="-10" width="12" height="10" fill="#7a5230"/>
      <circle cx="-66" cy="-2" r="6" fill="#5c3c22"/>
    </g>
  `,
  farm: `
    <g stroke="#2a1c10" stroke-width="1.5">
      <rect x="-68" y="-30" width="10" height="30" fill="#c9b88a"/>
      <polygon points="-68,-30 -63,-40 -58,-30" fill="#7c3527"/>
      <g stroke-width="2">
        <line x1="-63" y1="-38" x2="-52" y2="-38"/>
        <line x1="-63" y1="-38" x2="-74" y2="-38"/>
        <line x1="-63" y1="-38" x2="-63" y2="-49"/>
        <line x1="-63" y1="-38" x2="-63" y2="-27"/>
      </g>
    </g>
  `,
  barracks: `
    <line x1="20" y1="-88" x2="20" y2="-70" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="20,-88 0,-82 20,-76" fill="#8a2e22" stroke="#2a1c10" stroke-width="1.5"/>
    <circle cx="-52" cy="-24" r="7" fill="#c9a15a" stroke="#2a1c10" stroke-width="1.5"/>
    <line x1="-52" y1="-17" x2="-52" y2="0" stroke="#6b4a2b" stroke-width="4"/>
  `
};
function buildingTierExtra(key, level) {
  let extra = "";
  if (level >= 10 && TIER2_EXTRAS[key]) extra += TIER2_EXTRAS[key];
  if (level >= 20 && TIER3_EXTRAS[key]) extra += TIER3_EXTRAS[key];
  return extra;
}
function buildingIconSvg(key, level) {
  return `<svg viewBox="-92 -132 184 150" xmlns="http://www.w3.org/2000/svg">${getBuildingArt(key, level || 0)}</svg>`;
}

/* ---- Badges de troupe (thème Parchemin uniquement, voir .troop-row .ticon) ----
   Réutilise les mêmes textures (tex-*) que le fond de la carte du monde/village pour donner
   à chaque unité un "matériau" cohérent avec son rôle plutôt qu'une couleur arbitraire. */
const TROOP_ICON_PATHS = {
  spear: '<path d="M12 3V21"/><path d="M8 7L12 3L16 7"/><path d="M9 20H15"/>',
  sword: '<path d="M12 4V15"/><path d="M8 7H16"/><path d="M9 20L12 17L15 20"/>',
  archer: '<path d="M6 4C11 4 11 20 6 20"/><path d="M6 12H15"/><path d="M12 8L16 12L12 16"/>',
  scout: '<circle cx="12" cy="8" r="3"/><path d="M7 20C7 15.5 9 13 12 13C15 13 17 15.5 17 20"/>',
  light: '<path d="M4 17C4 12.5 7.5 10 11 10C13.5 10 14.5 8.5 14.5 6.5" /><path d="M11 10C11 13.5 13 15.5 16.5 15.5L19.5 19"/><circle cx="14.7" cy="6.3" r="1.3"/>',
  ram: '<rect x="4" y="10" width="16" height="4" rx="1.2"/><path d="M4 12H2M22 12H20"/><path d="M12 10V5"/><path d="M9 5H15"/>',
  catapult: '<path d="M4 20H9"/><path d="M6 20V12L15 5"/><circle cx="17" cy="4.6" r="1.6"/><path d="M6 12H10"/>',
  noble: '<path d="M5 10L8 5L12 9L16 5L19 10L17 10L17 19H7L7 10Z"/>'
};
const TROOP_TEX = {
  spear: 'tex-metal',
  sword: 'tex-metal',
  archer: 'tex-wood',
  scout: 'tex-hay',
  light: 'tex-hay',
  ram: 'tex-wood',
  catapult: 'tex-wood',
  noble: 'tex-cloth-burgundy'
};
function troopBadgeSvg(key) {
  const tex = TROOP_TEX[key] || 'tex-metal';
  const iconColor = key === "noble" ? "#7a2530" : "#2a1c10";
  return `<svg width="42" height="42" viewBox="0 0 44 44">
    <circle cx="22" cy="22" r="21" fill="url(#${tex})" stroke="rgba(42,28,16,0.35)" stroke-width="1"></circle>
    <circle cx="22" cy="22" r="15" fill="#f6ecd3"></circle>
    <g transform="translate(10,10)" stroke="${iconColor}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">${TROOP_ICON_PATHS[key] || ''}</g>
  </svg>`;
}

/* ---- Médaille de podium (Classement, thème Parchemin) — nombre seul en Bois sombre ---- */
function rankBadgeSvg(rank) {
  const grad = rank === 1 ? 'grad-gold' : rank === 2 ? 'grad-silver' : 'grad-bronze';
  return `<svg width="28" height="28" viewBox="0 0 28 28" class="rank-medal"><circle cx="14" cy="14" r="13" fill="url(#${grad})" stroke="rgba(42,28,16,.4)"></circle><text x="14" y="19" text-anchor="middle" font-size="12" font-weight="700" fill="#2a1c10">${rank}</text></svg>`;
}
function rankCell(rank) {
  return rank <= 3 ? `${rankBadgeSvg(rank)}<span class="rank-plain">${rank}</span>` : `<span class="rank-plain">${rank}</span>`;
}

/* ---- Badge de bâtiment (Village, thème Parchemin uniquement — voir renderBuildingsList) ----
   Simple pastille texturée (sans glyphe), comme dans la maquette Direction A : le nom suffit à
   identifier le bâtiment, la texture rappelle juste son "matériau". */
const BUILDING_TEX = {
  hq: 'tex-stone',
  wood: 'tex-wood',
  clay: 'tex-clay',
  iron: 'tex-metal',
  warehouse: 'tex-tile',
  farm: 'tex-hay',
  barracks: 'tex-stone-muted',
  wall: 'tex-stone',
  hide: 'tex-wood',
  academy: 'tex-cloth',
  guildHall: 'tex-cloth-burgundy'
};
function buildingBadgeSvg(key) {
  const tex = BUILDING_TEX[key] || 'tex-stone';
  return `<svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="12" fill="url(#${tex})" stroke="rgba(42,28,16,0.3)"></circle></svg>`;
}
function treeSvg(x, y, scale) {
  return `<g transform="translate(${x},${y}) scale(${scale})">
    <rect x="-3" y="-4" width="6" height="16" fill="#4a331d"/>
    <polygon points="0,-46 -18,-14 18,-14" fill="#2c4d25" stroke="#1c2e15" stroke-width="1.5"/>
    <polygon points="0,-34 -14,-6 14,-6" fill="#3f6b34" stroke="#1c2e15" stroke-width="1.5"/>
    <polygon points="0,-22 -10,0 10,0" fill="#4a7a3a" stroke="#1c2e15" stroke-width="1.5"/>
  </g>`;
}
function tinyHouseSvg(x, y, scale) {
  return `<g transform="translate(${x},${y}) scale(${scale})" opacity="0.92">
    <rect x="-10" y="-16" width="20" height="16" fill="#8a6a45" stroke="#2a1c10" stroke-width="1.5"/>
    <polygon points="-13,-16 0,-28 13,-16" fill="#6b3226" stroke="#2a1c10" stroke-width="1.5"/>
    <rect x="-4" y="-9" width="8" height="9" fill="#2a1c10"/>
  </g>`;
}

/* ------------------------- Icônes de village (carte) ------------------------- *
 * Remplace l'ancien pictogramme emoji (🚩/👤/🏯/🏚️) par une petite scène de village
 * originale, en réutilisant le même style de hutte que tinyHouseSvg ci-dessus, qui
 * "évolue" visuellement : le nombre de huttes grandit avec le niveau (0=isolée,
 * 1=hameau, 2=gros village), et une palissade pointillée apparaît dès qu'une
 * muraille est construite (villageIconLevel ci-dessous détermine ces deux niveaux
 * à partir des seules informations publiques déjà envoyées par le serveur — voir
 * publicVillageView : jamais le niveau réel des bâtiments d'un village adverse). */
function villageIconLevel(t, mine) {
  const wl = t.wallLevel || 0;
  if (mine || t.isPlayer) return wl >= 10 ? 2 : wl >= 1 ? 1 : 0;
  const tier = t.tier || 0;
  return tier <= 1 ? 0 : tier <= 2 ? 1 : 2;
}
let _villageIconSeq = 0;
function villageMapIconSvg(kind, level, hasWall) {
  const barb = kind === "barbarian";
  const black = kind === "blackarmy";
  // Repaires de brigands / camps de maraudeurs (Phase 1 "variété des cibles PvE") : deux palettes
  // supplémentaires, sur le même modèle que "Armée Noire" ci-dessous -- brigands en violet sourd
  // (discrets, près du centre), maraudeurs en orange/braise (campement agressif, en périphérie) --
  // voir aussi .villagePin.bandits/.villagePin.raiders dans le CSS.
  const bandits = kind === "bandits";
  const raiders = kind === "raiders";
  // Campement légendaire (Phase 2 "variété des cibles PvE") : palette délibérément la plus intense
  // des quatre (or/vermillon sur obsidienne quasi noire) pour se distinguer au premier coup d'oeil
  // de l'Armée Noire (gris/rouge sombre) comme des deux autres factions permanentes -- voir aussi
  // .villagePin.legendary dans le CSS (lueur dorée, plus large que les autres factions).
  const legendary = kind === "legendary";
  const campKind = barb || bandits || raiders || legendary;
  // "Armée Noire" : silhouette délibérément assombrie (murs quasi noirs, toit rouge sombre) pour
  // qu'un campement se distingue d'un simple coup d'oeil sur la carte, même sans regarder la
  // couleur du point du pin -- voir aussi villagePin.blackarmy dans le CSS.
  // Chaque appel obtient un préfixe d'id unique (uid) pour ses <linearGradient> : plusieurs icônes
  // cohabitent dans le même document (tous les pins de la carte, ou toutes les cartes d'une galerie),
  // et des id de <defs> partagés entre icônes de couleurs différentes se voleraient leur dégradé.
  const uid = "vi" + _villageIconSeq++;
  const wallTop = black ? "#26262b" : legendary ? "#4a3510" : bandits ? "#5a4a63" : raiders ? "#8a5a3a" : barb ? "#8c7752" : "#a8825a";
  const wallBot = black ? "#0a0a0c" : legendary ? "#160e02" : bandits ? "#2e2436" : raiders ? "#4a2e18" : barb ? "#544628" : "#6b4f31";
  const roofTop = black ? "#5c1c1c" : legendary ? "#9a2210" : bandits ? "#3a2440" : raiders ? "#7a2e14" : barb ? "#5c4530" : "#82402e";
  const roofBot = black ? "#280a0a" : legendary ? "#380803" : bandits ? "#1c1220" : raiders ? "#3a1408" : barb ? "#2e2416" : "#42201a";
  const doorStroke = black ? "#0a0a0c" : legendary ? "#160e02" : "#2a1c10";
  const windowCol = black ? "#6a1c1c" : legendary ? "#ffd54a" : bandits ? "#b090d0" : raiders ? "#f0a030" : "#e6c978";
  const groundCol = black ? "#1c1414" : legendary ? "#1e1404" : bandits ? "#2a2030" : raiders ? "#3a2416" : barb ? "#39431f" : "#463822";
  const defs = `<defs>
    <linearGradient id="${uid}w" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${wallTop}"/><stop offset="1" stop-color="${wallBot}"/>
    </linearGradient>
    <linearGradient id="${uid}r" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${roofTop}"/><stop offset="1" stop-color="${roofBot}"/>
    </linearGradient>
  </defs>`;
  // Chaque hutte : mur dégradé, toit dégradé + faîtage, porte, une fenêtre éclairée, et en option
  // une cheminée qui fume légèrement (portée uniquement par la hutte principale du groupe, pour
  // rester lisible à la petite taille réelle des pins).
  const hut = (x, s, chimney) => `<g transform="translate(${x},2) scale(${s})">
    <rect x="-9" y="-14" width="18" height="14" fill="url(#${uid}w)" stroke="${doorStroke}" stroke-width="1.4"/>
    <rect x="3.5" y="-11" width="4" height="4" fill="${windowCol}" stroke="${doorStroke}" stroke-width="0.8"/>
    <polygon points="-11,-14 0,-25 11,-14" fill="url(#${uid}r)" stroke="${doorStroke}" stroke-width="1.4"/>
    <line x1="-11" y1="-14" x2="0" y2="-25" stroke="${roofTop}" stroke-width="0.8" opacity="0.55"/>
    <rect x="-3" y="-8" width="6" height="8" fill="${doorStroke}"/>
    ${chimney ? `<rect x="4.5" y="-22.5" width="3" height="6" fill="${doorStroke}"/><circle cx="6" cy="-25.5" r="2.1" fill="#d8d2c2" opacity="0.45"/><circle cx="7.3" cy="-28.8" r="2.7" fill="#d8d2c2" opacity="0.28"/>` : ""}
  </g>`;
  const huts = level <= 0 ? hut(0, 1, true) : level === 1 ? hut(-9, 0.82, false) + hut(9, 0.9, true) : hut(-14, 0.78, false) + hut(0, 0.95, true) + hut(14, 0.78, false);
  // Parcelle de terre battue sous les huttes : ancre visuellement le groupe au sol (au lieu de
  // huttes qui semblaient "flotter") et grandit avec le niveau, comme le hameau lui-même.
  const groundRx = level <= 0 ? 13 : level === 1 ? 19 : 23;
  const ground = `<ellipse cx="0" cy="6" rx="${groundRx}" ry="4" fill="${groundCol}" opacity="0.55"/>`;
  // Élément central du hameau/village (niveau >= 1) : un puits pour un village (le vôtre ou un
  // joueur), un petit feu de camp pour les barbares -- rien pour l'Armée Noire, dont l'ambiance
  // sombre + la lueur rouge du pin suffisent déjà à la distinguer sans surcharger l'icône.
  const centerpiece = level >= 1 && !black ? campKind ? `<g transform="translate(0,5.5)"><polygon points="-3,3 3,3 1.6,-3.5 -1.6,-3.5" fill="#2a2016" stroke="${doorStroke}" stroke-width="0.7"/><polygon points="0,-3.5 -1.6,1 1.3,0.4" fill="#e0862c" opacity="0.85"/><polygon points="0,-2 -0.9,0.8 0.8,0.5" fill="#f5c25a"/></g>` : `<g transform="translate(0,5)"><ellipse cx="0" cy="1.6" rx="3.6" ry="1.7" fill="#4a3c28" stroke="${doorStroke}" stroke-width="0.8"/><rect x="-2.6" y="-2.6" width="5.2" height="3.6" fill="#352a1a" stroke="${doorStroke}" stroke-width="0.7"/><line x1="-2.6" y1="-2.6" x2="2.6" y2="-2.6" stroke="#6b5533" stroke-width="1"/></g>` : "";
  const palisade = hasWall ? `
    <path d="M -22 4 Q 0 12 22 4" fill="none" stroke="${black ? '#3a1414' : legendary ? '#6b4a12' : raiders ? '#5a2f18' : bandits ? '#453552' : '#5a4326'}" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 3"/>
    <rect x="-24.6" y="-3.5" width="2.8" height="8.5" fill="${black ? '#2a0e0e' : legendary ? '#3a2708' : raiders ? '#432612' : bandits ? '#382a44' : '#48331e'}" stroke="${doorStroke}" stroke-width="0.6"/>
    <rect x="21.8" y="-3.5" width="2.8" height="8.5" fill="${black ? '#2a0e0e' : legendary ? '#3a2708' : raiders ? '#432612' : bandits ? '#382a44' : '#48331e'}" stroke="${doorStroke}" stroke-width="0.6"/>
  ` : "";
  const flag = kind === "mine" ? `<g transform="translate(0,-25)"><line x1="0" y1="0" x2="0" y2="-13" stroke="#4a3320" stroke-width="1.4"/><polygon points="0,-13 9,-9.5 0,-6" fill="#f0cd7c" stroke="#8a6a2a" stroke-width="1"/></g>` : kind === "player" ? `<g transform="translate(0,-23)"><line x1="0" y1="0" x2="0" y2="-10" stroke="#4a3320" stroke-width="1.4"/><polygon points="0,-10 7,-7.3 0,-4.6" fill="#c8c8c8" stroke="#6a6a6a" stroke-width="1"/></g>` : black ? `<g transform="translate(0,-25)"><line x1="0" y1="0" x2="0" y2="-14" stroke="#0a0a0c" stroke-width="1.4"/><polygon points="0,-14 10,-10 0,-6" fill="#1a1a1e" stroke="#9a2b2b" stroke-width="1.2"/></g>` : "";
  return `<svg viewBox="-24 -30 48 40" preserveAspectRatio="xMidYMax meet">${defs}${ground}${palisade}${huts}${centerpiece}${flag}</svg>`;
}

/* ------------------------- Marqueurs personnels de village (carte) ------------------------- *
 * Badge vectoriel affiché sur le pin d'un village pour un marqueur privé posé par le joueur (voir
 * VILLAGE_TAGS, shared/gameData.js, et doSetVillageTag, gameLogic.js). Glyphe volontairement très
 * simple (quelques traits/formes) pour rester lisible à 15px de diamètre sur la carte ; le même
 * SVG, agrandi par le CSS, sert aussi de bouton dans le sélecteur de marqueur du popup de village
 * (voir villageTagPickerHtml) — un seul dessin pour les deux usages. */
function villageTagGlyphSvg(key, glyphColor) {
  const c = glyphColor;
  switch (key) {
    case "star":
      return `<polygon points="10,3 11.8,7.6 16.8,7.9 12.9,11 14.2,15.8 10,13 5.8,15.8 7.1,11 3.2,7.9 8.2,7.6" fill="${c}"/>`;
    // Deux "épées" croisées (lame effilée + garde + poignée), plutôt qu'un simple X : reste
    // distinct du ✕ (aucun marqueur) et du ⊘ interdiction (clé "cross") au premier coup d'oeil,
    // même à la petite taille d'un badge de pin.
    case "swords":
      return `<g fill="${c}">
      <g transform="rotate(45 10 10)"><polygon points="10,2 11.1,5.2 8.9,5.2" /><rect x="9.3" y="5" width="1.4" height="7.6"/><rect x="7.1" y="12.4" width="5.8" height="1.3"/><rect x="9.3" y="13.5" width="1.4" height="2.6"/></g>
      <g transform="rotate(-45 10 10)"><polygon points="10,2 11.1,5.2 8.9,5.2" /><rect x="9.3" y="5" width="1.4" height="7.6"/><rect x="7.1" y="12.4" width="5.8" height="1.3"/><rect x="9.3" y="13.5" width="1.4" height="2.6"/></g>
    </g>`;
    case "shield":
      return `<path d="M10 3.6 L15.2 5.6 V10.4 C15.2 13.8 12.9 15.8 10 16.7 C7.1 15.8 4.8 13.8 4.8 10.4 V5.6 Z" fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"/>`;
    case "exclaim":
      return `<rect x="8.8" y="4" width="2.4" height="7.6" rx="1.2" fill="${c}"/><circle cx="10" cy="15" r="1.4" fill="${c}"/>`;
    case "check":
      return `<path d="M4.8 10.3 L7.8 13.6 L15.2 5.6" fill="none" stroke="${c}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "cross":
      return `<circle cx="10" cy="10" r="6.3" fill="none" stroke="${c}" stroke-width="1.8"/><line x1="5.7" y1="14.3" x2="14.3" y2="5.7" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`;
    case "hourglass":
      return `<path d="M5.8 4.2 H14.2 L10 10 L14.2 15.8 H5.8 L10 10 Z" fill="none" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/>`;
    case "coin":
      return `<polygon points="10,3.8 14.5,8 10,16.2 5.5,8" fill="none" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/><line x1="5.5" y1="8" x2="14.5" y2="8" stroke="${c}" stroke-width="1.1"/>`;
    case "skull":
      return `<circle cx="10" cy="9" r="5.8" fill="none" stroke="${c}" stroke-width="1.6"/><circle cx="7.7" cy="8.6" r="1.2" fill="${c}"/><circle cx="12.3" cy="8.6" r="1.2" fill="${c}"/><rect x="7.9" y="12.4" width="1.3" height="2" fill="${c}"/><rect x="10.8" y="12.4" width="1.3" height="2" fill="${c}"/>`;
    case "peace":
      return `<circle cx="10" cy="10" r="6.3" fill="none" stroke="${c}" stroke-width="1.5"/><line x1="10" y1="4" x2="10" y2="16" stroke="${c}" stroke-width="1.5"/><line x1="10" y1="10" x2="6.2" y2="15.3" stroke="${c}" stroke-width="1.5"/><line x1="10" y1="10" x2="13.8" y2="15.3" stroke="${c}" stroke-width="1.5"/>`;
    case "question":
      return `<text x="10" y="14.6" font-size="12" text-anchor="middle" fill="${c}" font-family="Georgia,'Times New Roman',serif" font-weight="bold">?</text>`;
    case "crown":
      return `<path d="M5 15 H15 V12.6 L12.4 14 L10 8 L7.6 14 L5 12.6 Z" fill="none" stroke="${c}" stroke-width="1.4" stroke-linejoin="round"/><circle cx="5" cy="12" r="1" fill="${c}"/><circle cx="10" cy="7.6" r="1" fill="${c}"/><circle cx="15" cy="12" r="1" fill="${c}"/>`;
    default:
      return "";
  }
}
function villageTagBadgeSvg(key) {
  const t = VILLAGE_TAG_MAP[key];
  if (!t) return "";
  const glyphColor = VILLAGE_TAG_DARK_GLYPH.has(key) ? "#2a1c10" : "#f5edd8";
  return `<svg viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="9.3" fill="${t.color}" stroke="#1a140d" stroke-width="1.3"/>
    ${villageTagGlyphSvg(key, glyphColor)}
  </svg>`;
}

/* ------------------------- Décor de la carte du monde ------------------------- *
 * Quelques arbres/collines/rochers/buissons dispersés sur la carte, purement
 * cosmétiques (aucune information, aucune interaction). Placement pseudo-aléatoire
 * mais STABLE (dérivé des coordonnées, pas de Math.random) pour ne pas "sauter"
 * d'un rendu à l'autre — voir mapDecorHtml, appelé depuis renderMap(). */
function mapPseudoRandom(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
const MAP_DECOR_TYPES = ["tree", "hill", "rock", "bush"];
function mapDecorSvg(type) {
  if (type === "tree") return `<svg viewBox="-14 -34 28 34"><rect x="-2" y="-6" width="4" height="10" fill="#4a331d"/><polygon points="0,-34 -11,-14 11,-14" fill="#2c4d25" stroke="#1c2e15" stroke-width="1"/><polygon points="0,-24 -9,-6 9,-6" fill="#3f6b34" stroke="#1c2e15" stroke-width="1"/></svg>`;
  if (type === "hill") return `<svg viewBox="-18 -13 36 17"><ellipse cx="0" cy="2" rx="17" ry="9" fill="#5a6b3a" stroke="#3a4526" stroke-width="1"/><ellipse cx="-5" cy="-1" rx="9" ry="5" fill="#6d8047" opacity="0.65"/></svg>`;
  if (type === "rock") return `<svg viewBox="-12 -13 24 17"><polygon points="-10,4 -6,-8 4,-9 10,2 6,4" fill="#8a8577" stroke="#4a463c" stroke-width="1"/><polygon points="-6,-8 -1,-4 4,-9" fill="#a29c8c" opacity="0.7"/></svg>`;
  return `<svg viewBox="-12 -13 24 15"><ellipse cx="-4" cy="0" rx="7" ry="6" fill="#3f6b34" stroke="#1c2e15" stroke-width="1"/><ellipse cx="5" cy="1" rx="6" ry="5" fill="#4a7a3a" stroke="#1c2e15" stroke-width="1"/></svg>`; // bush
}
/* Un nombre FIXE d'éléments de décor est échantillonné (jamais une boucle sur toutes les cases du
   monde, dont l'étendue n'est pas bornée) pour rester performant quelle que soit la taille de la
   zone visible ; les cases déjà occupées par un village (occupied) sont simplement ignorées. */
function mapDecorHtml(minX, maxX, minY, maxY, ppf, occupied) {
  const spanX = Math.max(1, maxX - minX),
    spanY = Math.max(1, maxY - minY);
  const count = Math.min(60, Math.round(spanX * spanY * 0.06));
  let html = "";
  for (let i = 0; i < count; i++) {
    const gx = Math.round(minX + mapPseudoRandom(i * 7.13, 3.31) * spanX);
    const gy = Math.round(minY + mapPseudoRandom(i * 3.71, 11.9) * spanY);
    if (occupied.has(gx + "," + gy)) continue;
    const typeIdx = Math.floor(mapPseudoRandom(gx * 1.7 + 0.3, gy * 2.3 + 0.7) * MAP_DECOR_TYPES.length);
    const type = MAP_DECOR_TYPES[clamp(typeIdx, 0, MAP_DECOR_TYPES.length - 1)];
    const size = ppf * (0.8 + mapPseudoRandom(gx, gy) * 0.4);
    const left = (gx - minX) * ppf,
      top = (gy - minY) * ppf + ppf * 0.4;
    html += `<div class="mapDecor" style="left:${left}px; top:${top}px; width:${size}px; height:${size}px;">${mapDecorSvg(type)}</div>`;
  }
  return html;
}
/* La muraille s'agrandit visuellement avec son niveau (davantage de créneaux, tours plus hautes,
   tourelles supplémentaires avec bannières à partir du niveau 10). */
function wallArt(level) {
  const tier = materialTier(level);
  const m = MATERIAL[tier];
  if (tier === 1) return BUILDING_ART.wall(m);
  const extraTowers = tier === 3 ? `
    <polygon points="-46,-56 -34,-70 -22,-56" fill="${m.wallDark}" stroke="#2a1c10" stroke-width="2"/>
    <line x1="-34" y1="-70" x2="-34" y2="-80" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="-34,-80 -20,-75 -34,-70" fill="#8a2e22" stroke="#2a1c10" stroke-width="1.5"/>
    <polygon points="46,-56 34,-70 22,-56" fill="${m.wallDark}" stroke="#2a1c10" stroke-width="2"/>
    <line x1="34" y1="-70" x2="34" y2="-80" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="34,-80 20,-75 34,-70" fill="#8a2e22" stroke="#2a1c10" stroke-width="1.5"/>
  ` : "";
  return `
    <rect x="-64" y="-10" width="128" height="26" fill="${m.wallLight}" stroke="#2a1c10" stroke-width="2"/>
    <g fill="${m.wallLight}" stroke="#2a1c10" stroke-width="2">
      <rect x="-64" y="-22" width="12" height="12"/><rect x="-46" y="-22" width="12" height="12"/>
      <rect x="-28" y="-22" width="12" height="12"/><rect x="-10" y="-22" width="12" height="12"/>
      <rect x="8" y="-22" width="12" height="12"/><rect x="26" y="-22" width="12" height="12"/>
      <rect x="44" y="-22" width="12" height="12"/><rect x="52" y="-22" width="12" height="12"/>
    </g>
    <rect x="-54" y="-46" width="20" height="46" fill="${m.wall}" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="-56,-46 -44,-58 -32,-46" fill="${m.wallDark}" stroke="#2a1c10" stroke-width="2"/>
    <rect x="34" y="-46" width="20" height="46" fill="${m.wall}" stroke="#2a1c10" stroke-width="2"/>
    <polygon points="32,-46 44,-58 56,-46" fill="${m.wallDark}" stroke="#2a1c10" stroke-width="2"/>
    <path d="M -12 16 Q 0 -6 12 16 Z" fill="#1a1712"/>
    ${extraTowers}
  `;
}
function getBuildingArt(key, level) {
  if (key === "wall") return wallArt(level || 0);
  const fn = BUILDING_ART[key];
  if (!fn) return "";
  return fn(MATERIAL[materialTier(level || 0)]) + buildingTierExtra(key, level || 0);
}

/* Muraille circulaire qui entoure tout le village (au lieu d'une simple hutte) — se renforce avec le niveau
   et change de matériau : bois (1-9), pierre (10-19), brique et fer (20+). */
function villageWallRing(level) {
  const cx = 500,
    cy = 320,
    rx = 420,
    ry = 250;
  const tier = materialTier(level);
  const m = MATERIAL[tier];
  const towerCount = tier === 3 ? 12 : tier === 2 ? 8 : 6;
  const merlonCount = tier >= 2 ? 48 : 30;
  const bannered = tier === 3;
  const towers = [];
  for (let i = 0; i < towerCount; i++) {
    const a = i / towerCount * Math.PI * 2 - Math.PI / 2;
    const x = (cx + rx * Math.cos(a)).toFixed(1),
      y = (cy + ry * Math.sin(a)).toFixed(1);
    towers.push(`<g transform="translate(${x},${y})">
      <rect x="-15" y="-32" width="30" height="32" fill="${m.wall}" stroke="#2a1c10" stroke-width="2"/>
      <polygon points="-17,-32 0,-48 17,-32" fill="${m.wallDark}" stroke="#2a1c10" stroke-width="2"/>
      ${bannered ? `<line x1="0" y1="-48" x2="0" y2="-60" stroke="#2a1c10" stroke-width="2"/><polygon points="0,-60 13,-55 0,-50" fill="#8a2e22"/>` : ''}
    </g>`);
  }
  const merlons = [];
  for (let i = 0; i < merlonCount; i++) {
    const a = i / merlonCount * Math.PI * 2 - Math.PI / 2;
    const x = cx + rx * Math.cos(a),
      y = cy + ry * Math.sin(a);
    merlons.push(`<rect x="${(x - 6).toFixed(1)}" y="${(y - 6).toFixed(1)}" width="12" height="12" fill="${m.wallLight}" stroke="#2a1c10" stroke-width="1.5"/>`);
  }
  return `
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#2a1c10" stroke-width="42"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${m.wallLight}" stroke-width="34"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx - 9}" ry="${ry - 9}" fill="none" stroke="${m.wall}" stroke-width="7" opacity="0.55"/>
    ${merlons.join("")}
    ${towers.join("")}
  `;
}

/* ------------------------- Scène du campement légendaire (Phase 2) ------------------------- *
 * Illustration isométrique affichée dans la fiche d'un campement légendaire (VillageActionModal,
 * cas 3, quand t.faction==="legendary") -- reprend EXACTEMENT la palette obsidienne + or/vermillon
 * déjà utilisée par villageMapIconSvg() pour kind==="legendary" (mêmes teintes que le pin sur la
 * carte : voir wallTop/wallBot/roofTop/roofBot/windowCol ci-dessus, et le glyphe 👑 doré #f2c94c
 * déjà utilisé pour cette faction dans mapRender.js/styles.css), pour que ce grand rendu et le
 * petit pin se lisent comme la même faction plutôt que comme deux styles différents.
 * Technique de rendu (mur en véritable extrusion : courtine + chemin de ronde + créneaux en
 * relief, portail à vantaux cloutés, tours à toit pointu, donjon, douves) reprise d'une maquette
 * de concept validée séparément avec l'utilisateur -- fonction pure, un seul appel par ouverture
 * de fenêtre, volontairement PAS branchée sur villageMapIconSvg (qui doit rester une icône légère
 * de 20px répétée pour chaque pin de la carte : cette scène est réservée aux endroits qui ont la
 * place de l'afficher en grand). */
const LC_ISO_X = 0.87,
  LC_ISO_Y = 0.5;
const lcIsoRight = n => ({
  x: n * LC_ISO_X,
  y: -n * LC_ISO_Y
});
const lcIsoLeft = n => ({
  x: -n * LC_ISO_X,
  y: -n * LC_ISO_Y
});
const lcAdd = (a, b) => ({
  x: a.x + b.x,
  y: a.y + b.y
});
const lcRaise = (p, dy) => ({
  x: p.x,
  y: p.y - dy
});
const lcLerp = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t
});
const lcPoly = (pts, fill, stroke) => `<polygon points="${pts.map(p => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ")}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="1"` : ""}/>`;
function lcPt(cx, cy, rx, ry, deg) {
  const a = deg * Math.PI / 180;
  return {
    x: cx + rx * Math.cos(a),
    y: cy + ry * Math.sin(a)
  };
}
function lcGateAngles(gapDeg) {
  return {
    start: 90 + gapDeg / 2,
    end: 90 + gapDeg / 2 + (360 - gapDeg)
  };
}
function lcBuilding(x, y, s, roofLit, roofShade, wallLit, wallShade, doorCol, opts) {
  opts = opts || {};
  const W = (opts.w || 24) * s,
    D = (opts.d || 20) * s,
    H = (opts.h || 16) * s,
    RH = (opts.roofH == null ? 15 : opts.roofH) * s;
  const edge = opts.edge || "#160f08";
  // x,y = centre de l'empreinte au sol (pas le coin avant) -- sans ce recentrage chaque bâtiment
  // se lit visuellement décalé en haut à gauche du point où il est posé.
  const fx = x - 0.435 * (W - D),
    fy = y + 0.25 * (W + D);
  const F = {
      x: fx,
      y: fy
    },
    R = lcAdd(F, lcIsoRight(W)),
    L = lcAdd(F, lcIsoLeft(D)),
    K = lcAdd(R, lcIsoLeft(D));
  const Ft = lcRaise(F, H),
    Rt = lcRaise(R, H),
    Lt = lcRaise(L, H),
    Kt = lcRaise(K, H);
  let out = "";
  out += lcPoly([F, R, Rt, Ft], wallLit, edge);
  out += lcPoly([F, L, Lt, Ft], wallShade, edge);
  if (opts.door !== false) {
    const d0 = lcLerp(F, R, .16),
      d1 = lcLerp(F, R, .42),
      dh = H * 0.52;
    out += lcPoly([d0, d1, lcRaise(d1, dh), lcRaise(d0, dh)], doorCol, edge);
  }
  if (opts.window !== false) {
    const w0 = lcLerp(F, L, .5),
      w1 = lcLerp(F, L, .76),
      wy0 = H * .4,
      wy1 = H * .72;
    out += lcPoly([lcRaise(w0, wy0), lcRaise(w1, wy0), lcRaise(w1, wy1), lcRaise(w0, wy1)], opts.windowCol || "#f0cd7c", edge);
  }
  if (RH > 0) {
    const apex = {
      x: (Ft.x + Kt.x) / 2,
      y: (Ft.y + Kt.y) / 2 - RH
    };
    out += lcPoly([Ft, Rt, apex], roofLit, edge);
    out += lcPoly([Ft, Lt, apex], roofShade, edge);
    out += `<line x1="${Ft.x.toFixed(1)}" y1="${Ft.y.toFixed(1)}" x2="${apex.x.toFixed(1)}" y2="${apex.y.toFixed(1)}" stroke="${edge}" stroke-width=".7" opacity=".5"/>`;
    if (opts.banner) {
      const bx = apex.x,
        by = apex.y;
      out += `<line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${(by - 13 * s).toFixed(1)}" stroke="#3a2814" stroke-width="${(1.6 * s).toFixed(2)}"/>`;
      out += lcPoly([{
        x: bx,
        y: by - 13 * s
      }, {
        x: bx + 10 * s,
        y: by - 8 * s
      }, {
        x: bx,
        y: by - 4 * s
      }], opts.banner);
    }
    return {
      svg: out,
      anchor: Ft
    };
  }
  out += lcPoly([Ft, Rt, Kt, Lt], wallShade, edge);
  return {
    svg: out,
    anchor: Ft
  };
}
function lcHut(x, y, s, roofA, roofB, wallA, wallB, doorCol) {
  return lcBuilding(x, y, s, roofA, roofB, wallA, wallB, doorCol, {
    w: 23,
    d: 19,
    h: 15,
    roofH: 15
  }).svg;
}
function lcKeep(x, y, s, roofA, roofB, wallA, wallB, bannerCol) {
  const base = lcBuilding(x, y, s, roofA, roofB, wallA, wallB, "#1c130a", {
    w: 32,
    d: 25,
    h: 16,
    roofH: 0,
    window: false
  });
  const upperS = s * 0.6;
  const upper = lcBuilding(base.anchor.x, base.anchor.y, upperS, roofA, roofB, wallA, wallB, "#1c130a", {
    w: 32 * 0.62,
    d: 25 * 0.62,
    h: 16 * 1.35,
    roofH: 19,
    window: false,
    banner: bannerCol
  });
  return base.svg + upper.svg;
}
function lcTower(x, y, s, wallCol, wallEdge, roofCol, bannerCol) {
  return lcBuilding(x, y, s, roofCol, roofCol, wallCol, wallEdge, "#160f08", {
    w: 19,
    d: 17,
    h: 34,
    roofH: 16,
    door: false,
    window: true,
    windowCol: "#ffd54a",
    edge: wallEdge,
    banner: bannerCol
  }).svg;
}
function lcPine(x, y, s) {
  return `<g transform="translate(${x},${y}) scale(${s})">
    <polygon points="0,-27 9,-6 -9,-6" fill="#182a14"/>
    <polygon points="0,-19 7.5,3 -7.5,3" fill="#213a1b"/>
    <rect x="-1.8" y="3" width="3.6" height="6" fill="#2c2013"/>
  </g>`;
}
function lcGateDoor(bs, be, h, ironCol) {
  const x0 = Math.min(bs.x, be.x),
    x1 = Math.max(bs.x, be.x),
    w = x1 - x0;
  const yBase = (bs.y + be.y) / 2,
    dh = Math.min(h * 0.85, 30);
  const woodA = "#3a280f",
    woodB = "#1c1206";
  let out = `<rect x="${x0.toFixed(1)}" y="${(yBase - dh).toFixed(1)}" width="${w.toFixed(1)}" height="${dh.toFixed(1)}" fill="${woodA}" stroke="${woodB}" stroke-width="1.2"/>`;
  out += `<line x1="${(x0 + w / 2).toFixed(1)}" y1="${(yBase - dh).toFixed(1)}" x2="${(x0 + w / 2).toFixed(1)}" y2="${yBase.toFixed(1)}" stroke="${woodB}" stroke-width="1.4"/>`;
  for (let i = 1; i < 4; i++) {
    const px = x0 + w * i / 4;
    out += `<line x1="${px.toFixed(1)}" y1="${(yBase - dh).toFixed(1)}" x2="${px.toFixed(1)}" y2="${yBase.toFixed(1)}" stroke="${woodB}" stroke-width=".6" opacity=".55"/>`;
  }
  [x0 + w * 0.22, x0 + w * 0.5, x0 + w * 0.78].forEach(cx2 => {
    [yBase - dh * 0.78, yBase - dh * 0.36].forEach(cy2 => {
      out += `<circle cx="${cx2.toFixed(1)}" cy="${cy2.toFixed(1)}" r="1.3" fill="${ironCol}"/>`;
    });
  });
  out += `<rect x="${(x0 - 3).toFixed(1)}" y="${(yBase - dh - 4.5).toFixed(1)}" width="${(w + 6).toFixed(1)}" height="5" fill="${woodB}" stroke="#0a0603" stroke-width="1"/>`;
  return out;
}
function lcWallToppers(cx, topCy, rx, ry, gapDeg, count, colBase, colShade, colRim) {
  const startA = 90 + gapDeg / 2,
    span = 360 - gapDeg,
    pairSpan = span / count,
    tooth = pairSpan * 0.56;
  const depth = Math.max(2.4, rx * 0.05),
    mh = Math.max(7, ry * 0.12);
  let out = "";
  for (let i = 0; i < count; i++) {
    const a0 = startA + i * pairSpan,
      a1 = a0 + tooth;
    const bo0 = lcPt(cx, topCy, rx, ry, a0),
      bo1 = lcPt(cx, topCy, rx, ry, a1);
    const to0 = lcRaise(bo0, mh),
      to1 = lcRaise(bo1, mh);
    const ti0 = lcPt(cx, topCy - mh, rx - depth, ry - depth, a0),
      ti1 = lcPt(cx, topCy - mh, rx - depth, ry - depth, a1);
    out += lcPoly([bo0, bo1, to1, to0], colBase, colShade); // face avant du créneau
    out += lcPoly([to0, to1, ti1, ti0], colRim, colShade); // dessus, le plus lumineux
  }
  return out;
}
function lcWallBand(cx, cy, rx, ry, gapDeg, h, colBase, colShade, colRim, gateBanner) {
  const g = lcGateAngles(gapDeg);
  const topCy = cy - h;
  const thick = Math.max(7, h * 0.42);
  const irx = Math.max(4, rx - thick),
    iry = Math.max(4, ry - thick);
  const ts = lcPt(cx, topCy, rx, ry, g.start),
    te = lcPt(cx, topCy, rx, ry, g.end);
  const bs = lcPt(cx, cy, rx, ry, g.start),
    be = lcPt(cx, cy, rx, ry, g.end);
  const its = lcPt(cx, topCy, irx, iry, g.start),
    ite = lcPt(cx, topCy, irx, iry, g.end);
  const gradId = "lcwg" + Math.abs(cx * 1000 + cy * 7 + rx * 13 + ry * 17 + h * 31 | 0).toString(36);
  let out = `<defs><linearGradient id="${gradId}" x1="0" y1="${topCy.toFixed(1)}" x2="0" y2="${cy.toFixed(1)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${colBase}"/><stop offset="1" stop-color="${colShade}"/>
    </linearGradient></defs>`;
  // ombre portée au sol, courtine (extrusion réelle sol -> chemin de ronde), lignes d'assise pour
  // vendre le volume, chemin de ronde (anneau donut), créneaux en relief, portail + tours.
  out += `<path d="M ${bs.x.toFixed(1)} ${bs.y.toFixed(1)} A ${rx} ${ry} 0 1 1 ${be.x.toFixed(1)} ${be.y.toFixed(1)}" fill="none" stroke="rgba(0,0,0,.32)" stroke-width="${(thick * 0.6).toFixed(1)}" stroke-linecap="round" transform="translate(0,2)"/>`;
  out += `<path d="M ${ts.x.toFixed(1)} ${ts.y.toFixed(1)} A ${rx} ${ry} 0 1 1 ${te.x.toFixed(1)} ${te.y.toFixed(1)} L ${be.x.toFixed(1)} ${be.y.toFixed(1)} A ${rx} ${ry} 0 1 0 ${bs.x.toFixed(1)} ${bs.y.toFixed(1)} Z" fill="url(#${gradId})" stroke="${colShade}" stroke-width="1"/>`;
  for (let k = 1; k <= 2; k++) {
    const yy = topCy + h * (k / 3);
    const cA = lcPt(cx, yy, rx, ry, g.start),
      cB = lcPt(cx, yy, rx, ry, g.end);
    out += `<path d="M ${cA.x.toFixed(1)} ${cA.y.toFixed(1)} A ${rx} ${ry} 0 1 1 ${cB.x.toFixed(1)} ${cB.y.toFixed(1)}" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="1"/>`;
  }
  out += `<path d="M ${ts.x.toFixed(1)} ${ts.y.toFixed(1)} A ${rx} ${ry} 0 1 1 ${te.x.toFixed(1)} ${te.y.toFixed(1)} L ${ite.x.toFixed(1)} ${ite.y.toFixed(1)} A ${irx} ${iry} 0 1 0 ${its.x.toFixed(1)} ${its.y.toFixed(1)} Z" fill="${colBase}" stroke="${colRim}" stroke-width="1" opacity=".97"/>`;
  out += `<path d="M ${its.x.toFixed(1)} ${its.y.toFixed(1)} A ${irx} ${iry} 0 1 1 ${ite.x.toFixed(1)} ${ite.y.toFixed(1)}" fill="none" stroke="${colShade}" stroke-width="1.3" opacity=".55"/>`;
  const topperCount = Math.max(5, Math.round((360 - gapDeg) / 15));
  out += lcWallToppers(cx, topCy, rx, ry, gapDeg, topperCount, colBase, colShade, colRim);
  out += lcGateDoor(bs, be, h, colRim);
  const ts_ = Math.max(0.55, Math.min(1.15, h / 24));
  out += lcTower(bs.x, bs.y, ts_, colBase, colShade, colShade, gateBanner);
  out += lcTower(be.x, be.y, ts_, colBase, colShade, colShade, gateBanner);
  return out;
}
function legendaryCampSceneSvg() {
  // Mêmes teintes que villageMapIconSvg(kind="legendary") : wallTop/wallBot, roofTop/roofBot,
  // windowCol -- voir plus haut dans ce fichier.
  const wallBase = "#4a3510",
    wallShade = "#160e02",
    gold = "#f2c94c",
    roofA = "#9a2210",
    roofB = "#380803";
  const wallA = "#2a1f10",
    wallB = "#160e02",
    groundA = "#241a06",
    groundB = "#120c02";
  const CX = 160,
    CY = 150;
  const gradId = "lcground" + Math.round(Math.random() * 1e6);
  let out = `<svg viewBox="0 0 320 250" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">`;
  out += `<defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${groundA}"/><stop offset="1" stop-color="${groundB}"/></linearGradient>
    <radialGradient id="lcglow" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="${gold}" stop-opacity=".38"/><stop offset="1" stop-color="${gold}" stop-opacity="0"/></radialGradient>
    <linearGradient id="lcmoat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a4a4e"/><stop offset="1" stop-color="#0e2224"/></linearGradient>
  </defs>`;
  out += lcPine(24, 166, 0.72) + lcPine(300, 144, 0.7);
  out += `<ellipse cx="${CX}" cy="${CY - 6}" rx="150" ry="108" fill="url(#lcglow)"/>`;
  out += `<ellipse cx="${CX}" cy="${CY}" rx="146" ry="92" fill="url(#lcmoat)" stroke="#081617" stroke-width="1.5"/>`;
  out += `<rect x="${CX - 9}" y="${CY + 60}" width="18" height="36" fill="#2a1c10" stroke="#160e02" stroke-width="1"/>`;
  out += `<ellipse cx="${CX}" cy="${CY}" rx="116" ry="70" fill="url(#${gradId})" stroke="#0c0800" stroke-width="1.5" opacity=".96"/>`;
  out += lcWallBand(CX, CY, 106, 64, 32, 29, wallBase, wallShade, gold, gold);
  out += lcHut(CX - 42, CY - 14, 0.66, roofA, roofB, wallA, wallB, "#0e0904");
  out += lcHut(CX + 40, CY - 8, 0.66, roofA, roofB, wallA, wallB, "#0e0904");
  out += lcHut(CX - 42, CY - 38, 0.58, roofA, roofB, wallA, wallB, "#0e0904");
  out += lcHut(CX + 40, CY - 40, 0.58, roofA, roofB, wallA, wallB, "#0e0904");
  out += lcKeep(CX, CY - 22, 1.05, roofA, roofB, "#3a2a12", wallB, gold);
  [132, 48, 164, 16].forEach((ang, i) => {
    const p = lcPt(CX, CY - 29, 106, 64, ang);
    out += lcTower(p.x, p.y, i < 2 ? 0.8 : 0.68, wallA, wallB, roofB, gold);
  });
  out += `</svg>`;
  return out;
}

/* ------------------------- Scènes de village par palier (tier 0-4) ------------------------- *
 * Grande illustration isométrique affichée dans VillageActionModal pour n'importe quel campement
 * ciblé (barbare simple, Armée Noire, brigands, maraudeurs) qui n'est PAS un campement légendaire --
 * celui-ci garde sa propre scène dédiée, legendaryCampSceneSvg() ci-dessus. Les 5 paliers
 * correspondent 1-pour-1 à TIER_CLASS/TIER_LABEL (mapRender.js, 0="Très faible" à 4="Très fort") :
 * plus le village est fort, plus la palissade grandit (bois -> bois+pierre -> pierre crénelée),
 * jusqu'au donjon et aux quatre tours d'angle du palier 4. Même technique de rendu que
 * legendaryCampSceneSvg (mur en véritable extrusion, portail à vantaux + tours de guet, donjon en
 * isométrique) -- réutilisée depuis la maquette de concept validée séparément avec l'utilisateur
 * ("Villages modulables"), avec ses propres primitives préfixées vs* pour ne pas interférer avec
 * les fonctions lc* / MATERIAL déjà utilisées ailleurs dans ce fichier (building tiers du joueur).
 * L'identité de faction (brigands/maraudeurs/Armée Noire) reste portée par le pin de la carte, le
 * badge de la fiche et le liseré coloré de son cadre (.village-scene.<faction>, styles.css) --
 * volontairement PAS injectée dans le SVG lui-même pour garder une seule scène par palier, simple
 * à mettre en cache (VILLAGE_SCENE_STAGES est calculé une seule fois, au chargement du module). */
const VILLAGE_SCENE_STAGES = function () {
  function vsPt(cx, cy, rx, ry, deg) {
    const a = deg * Math.PI / 180;
    return {
      x: cx + rx * Math.cos(a),
      y: cy + ry * Math.sin(a)
    };
  }
  function vsRingAngles(count, gapDeg) {
    const usable = 360 - gapDeg,
      start = 90 + gapDeg / 2,
      out = [];
    for (let i = 0; i < count; i++) out.push(start + usable * (i / (count - 1)));
    return out;
  }
  const VS_ISO_X = 0.87,
    VS_ISO_Y = 0.5;
  const vsIsoRight = n => ({
    x: n * VS_ISO_X,
    y: -n * VS_ISO_Y
  });
  const vsIsoLeft = n => ({
    x: -n * VS_ISO_X,
    y: -n * VS_ISO_Y
  });
  const vsAdd = (a, b) => ({
    x: a.x + b.x,
    y: a.y + b.y
  });
  const vsRaise = (p, dy) => ({
    x: p.x,
    y: p.y - dy
  });
  const vsLerp = (a, b, t) => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  });
  const vsPoly = (pts, fill, stroke) => `<polygon points="${pts.map(p => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ")}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="1"` : ""}/>`;
  function vsIsoBuilding(x, y, s, roofLit, roofShade, wallLit, wallShade, doorCol, opts) {
    opts = opts || {};
    const W = (opts.w || 24) * s,
      D = (opts.d || 20) * s,
      H = (opts.h || 16) * s,
      RH = (opts.roofH == null ? 15 : opts.roofH) * s;
    const edge = opts.edge || "#160f08";
    const fx = x - 0.435 * (W - D),
      fy = y + 0.25 * (W + D);
    const F = {
        x: fx,
        y: fy
      },
      R = vsAdd(F, vsIsoRight(W)),
      L = vsAdd(F, vsIsoLeft(D)),
      K = vsAdd(R, vsIsoLeft(D));
    const Ft = vsRaise(F, H),
      Rt = vsRaise(R, H),
      Lt = vsRaise(L, H),
      Kt = vsRaise(K, H);
    let out = "";
    out += vsPoly([F, R, Rt, Ft], wallLit, edge);
    out += vsPoly([F, L, Lt, Ft], wallShade, edge);
    if (opts.door !== false) {
      const d0 = vsLerp(F, R, .16),
        d1 = vsLerp(F, R, .42),
        dh = H * 0.52;
      out += vsPoly([d0, d1, vsRaise(d1, dh), vsRaise(d0, dh)], doorCol, edge);
    }
    if (opts.window !== false) {
      const w0 = vsLerp(F, L, .5),
        w1 = vsLerp(F, L, .76),
        wy0 = H * .4,
        wy1 = H * .72;
      out += vsPoly([vsRaise(w0, wy0), vsRaise(w1, wy0), vsRaise(w1, wy1), vsRaise(w0, wy1)], opts.windowCol || "#f0cd7c", edge);
    }
    if (RH > 0) {
      const apex = {
        x: (Ft.x + Kt.x) / 2,
        y: (Ft.y + Kt.y) / 2 - RH
      };
      out += vsPoly([Ft, Rt, apex], roofLit, edge);
      out += vsPoly([Ft, Lt, apex], roofShade, edge);
      out += `<line x1="${Ft.x.toFixed(1)}" y1="${Ft.y.toFixed(1)}" x2="${apex.x.toFixed(1)}" y2="${apex.y.toFixed(1)}" stroke="${edge}" stroke-width=".7" opacity=".5"/>`;
      if (opts.banner) {
        const bx = apex.x,
          by = apex.y;
        out += `<line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${(by - 13 * s).toFixed(1)}" stroke="#3a2814" stroke-width="${(1.6 * s).toFixed(2)}"/>`;
        out += vsPoly([{
          x: bx,
          y: by - 13 * s
        }, {
          x: bx + 10 * s,
          y: by - 8 * s
        }, {
          x: bx,
          y: by - 4 * s
        }], opts.banner);
      }
      return {
        svg: out,
        topY: apex.y - (opts.banner ? 13 * s : 0),
        anchor: Ft
      };
    }
    out += vsPoly([Ft, Rt, Kt, Lt], wallShade, edge);
    return {
      svg: out,
      topY: Ft.y,
      anchor: Ft
    };
  }
  function vsHut(x, y, s, roofA, roofB, wallA, wallB, doorCol) {
    return vsIsoBuilding(x, y, s, roofA, roofB, wallA, wallB, doorCol, {
      w: 23,
      d: 19,
      h: 15,
      roofH: 15
    }).svg;
  }
  function vsLonghouse(x, y, s, roofA, roofB, wallA, wallB, doorCol) {
    return vsIsoBuilding(x, y, s, roofA, roofB, wallA, wallB, doorCol, {
      w: 40,
      d: 21,
      h: 17,
      roofH: 15
    }).svg;
  }
  function vsKeep(x, y, s, roofA, roofB, wallA, wallB, bannerCol) {
    const base = vsIsoBuilding(x, y, s, roofA, roofB, wallA, wallB, "#1c130a", {
      w: 32,
      d: 25,
      h: 16,
      roofH: 0,
      window: false
    });
    const upperS = s * 0.6;
    const upper = vsIsoBuilding(base.anchor.x, base.anchor.y, upperS, roofA, roofB, wallA, wallB, "#1c130a", {
      w: 32 * 0.62,
      d: 25 * 0.62,
      h: 16 * 1.35,
      roofH: 19,
      window: false,
      banner: bannerCol
    });
    return base.svg + upper.svg;
  }
  function vsPine(x, y, s) {
    return `<g transform="translate(${x},${y}) scale(${s})">
      <polygon points="0,-27 9,-6 -9,-6" fill="#213a1b"/>
      <polygon points="0,-19 7.5,3 -7.5,3" fill="#2c4a24"/>
      <rect x="-1.8" y="3" width="3.6" height="6" fill="#42311d"/>
    </g>`;
  }
  function vsTower(x, y, s, wallCol, wallEdge, roofCol, bannerCol) {
    return vsIsoBuilding(x, y, s, roofCol, roofCol, wallCol, wallEdge, "#160f08", {
      w: 15,
      d: 13,
      h: 29,
      roofH: 17,
      door: false,
      window: false,
      edge: wallEdge,
      banner: bannerCol
    }).svg;
  }
  function vsGateTower(x, y, s, wallCol, wallEdge, roofCol, accentCol) {
    return vsIsoBuilding(x, y, s, roofCol, roofCol, wallCol, wallEdge, "#160f08", {
      w: 19,
      d: 17,
      h: 34,
      roofH: 16,
      door: false,
      window: true,
      windowCol: "#2a1c10",
      edge: wallEdge,
      banner: accentCol
    }).svg;
  }
  function vsGateDoor(bs, be, h, ironCol) {
    const x0 = Math.min(bs.x, be.x),
      x1 = Math.max(bs.x, be.x),
      w = x1 - x0;
    const yBase = (bs.y + be.y) / 2,
      dh = Math.min(h * 0.85, 30);
    const woodA = "#5c4025",
      woodB = "#33220f";
    let out = `<rect x="${x0.toFixed(1)}" y="${(yBase - dh).toFixed(1)}" width="${w.toFixed(1)}" height="${dh.toFixed(1)}" fill="${woodA}" stroke="${woodB}" stroke-width="1.2"/>`;
    out += `<line x1="${(x0 + w / 2).toFixed(1)}" y1="${(yBase - dh).toFixed(1)}" x2="${(x0 + w / 2).toFixed(1)}" y2="${yBase.toFixed(1)}" stroke="${woodB}" stroke-width="1.4"/>`;
    for (let i = 1; i < 4; i++) {
      const px = x0 + w * i / 4;
      out += `<line x1="${px.toFixed(1)}" y1="${(yBase - dh).toFixed(1)}" x2="${px.toFixed(1)}" y2="${yBase.toFixed(1)}" stroke="${woodB}" stroke-width=".6" opacity=".55"/>`;
    }
    [x0 + w * 0.22, x0 + w * 0.5, x0 + w * 0.78].forEach(cx2 => {
      [yBase - dh * 0.78, yBase - dh * 0.36].forEach(cy2 => {
        out += `<circle cx="${cx2.toFixed(1)}" cy="${cy2.toFixed(1)}" r="1.3" fill="${ironCol}"/>`;
      });
    });
    out += `<rect x="${(x0 - 3).toFixed(1)}" y="${(yBase - dh - 4.5).toFixed(1)}" width="${(w + 6).toFixed(1)}" height="5" fill="${woodB}" stroke="#160f08" stroke-width="1"/>`;
    return out;
  }
  function vsGateAngles(gapDeg) {
    return {
      start: 90 + gapDeg / 2,
      end: 90 + gapDeg / 2 + (360 - gapDeg)
    };
  }
  function vsWallToppers(cx, topCy, rx, ry, gapDeg, count, style, colBase, colShade, colRim) {
    if (style === "spike") {
      return vsRingAngles(count, gapDeg).map(a => {
        const p = vsPt(cx, topCy, rx, ry, a);
        return `<polygon points="${(p.x - 2.6).toFixed(1)},${p.y.toFixed(1)} ${p.x.toFixed(1)},${(p.y - 10).toFixed(1)} ${(p.x + 2.6).toFixed(1)},${p.y.toFixed(1)}" fill="${colRim}" stroke="${colShade}" stroke-width=".6"/>`;
      }).join("");
    }
    const startA = 90 + gapDeg / 2,
      span = 360 - gapDeg,
      pairSpan = span / count,
      tooth = pairSpan * 0.56;
    const depth = Math.max(2.4, rx * 0.05),
      mh = Math.max(7, ry * 0.12);
    let out = "";
    for (let i = 0; i < count; i++) {
      const a0 = startA + i * pairSpan,
        a1 = a0 + tooth;
      const bo0 = vsPt(cx, topCy, rx, ry, a0),
        bo1 = vsPt(cx, topCy, rx, ry, a1);
      const to0 = vsRaise(bo0, mh),
        to1 = vsRaise(bo1, mh);
      const ti0 = vsPt(cx, topCy - mh, rx - depth, ry - depth, a0),
        ti1 = vsPt(cx, topCy - mh, rx - depth, ry - depth, a1);
      out += vsPoly([bo0, bo1, to1, to0], colBase, colShade);
      out += vsPoly([to0, to1, ti1, ti0], colRim, colShade);
    }
    return out;
  }
  function vsWallBand(cx, cy, rx, ry, gapDeg, h, colBase, colShade, colRim, topperStyle, gateOpts) {
    const g = vsGateAngles(gapDeg);
    const topCy = cy - h;
    const thick = Math.max(7, h * 0.42);
    const irx = Math.max(4, rx - thick),
      iry = Math.max(4, ry - thick);
    const ts = vsPt(cx, topCy, rx, ry, g.start),
      te = vsPt(cx, topCy, rx, ry, g.end);
    const bs = vsPt(cx, cy, rx, ry, g.start),
      be = vsPt(cx, cy, rx, ry, g.end);
    const its = vsPt(cx, topCy, irx, iry, g.start),
      ite = vsPt(cx, topCy, irx, iry, g.end);
    const gradId = "vswg" + Math.abs(cx * 1000 + cy * 7 + rx * 13 + ry * 17 + h * 31 | 0).toString(36);
    let out = `<defs><linearGradient id="${gradId}" x1="0" y1="${topCy.toFixed(1)}" x2="0" y2="${cy.toFixed(1)}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${colBase}"/><stop offset="1" stop-color="${colShade}"/>
      </linearGradient></defs>`;
    out += `<path d="M ${bs.x.toFixed(1)} ${bs.y.toFixed(1)} A ${rx} ${ry} 0 1 1 ${be.x.toFixed(1)} ${be.y.toFixed(1)}" fill="none" stroke="rgba(0,0,0,.32)" stroke-width="${(thick * 0.6).toFixed(1)}" stroke-linecap="round" transform="translate(0,2)"/>`;
    out += `<path d="M ${ts.x.toFixed(1)} ${ts.y.toFixed(1)} A ${rx} ${ry} 0 1 1 ${te.x.toFixed(1)} ${te.y.toFixed(1)} L ${be.x.toFixed(1)} ${be.y.toFixed(1)} A ${rx} ${ry} 0 1 0 ${bs.x.toFixed(1)} ${bs.y.toFixed(1)} Z" fill="url(#${gradId})" stroke="${colShade}" stroke-width="1"/>`;
    for (let k = 1; k <= 2; k++) {
      const yy = topCy + h * (k / 3);
      const cA = vsPt(cx, yy, rx, ry, g.start),
        cB = vsPt(cx, yy, rx, ry, g.end);
      out += `<path d="M ${cA.x.toFixed(1)} ${cA.y.toFixed(1)} A ${rx} ${ry} 0 1 1 ${cB.x.toFixed(1)} ${cB.y.toFixed(1)}" fill="none" stroke="rgba(0,0,0,.24)" stroke-width="1"/>`;
    }
    out += `<path d="M ${ts.x.toFixed(1)} ${ts.y.toFixed(1)} A ${rx} ${ry} 0 1 1 ${te.x.toFixed(1)} ${te.y.toFixed(1)} L ${ite.x.toFixed(1)} ${ite.y.toFixed(1)} A ${irx} ${iry} 0 1 0 ${its.x.toFixed(1)} ${its.y.toFixed(1)} Z" fill="${colBase}" stroke="${colRim}" stroke-width="1" opacity=".97"/>`;
    out += `<path d="M ${its.x.toFixed(1)} ${its.y.toFixed(1)} A ${irx} ${iry} 0 1 1 ${ite.x.toFixed(1)} ${ite.y.toFixed(1)}" fill="none" stroke="${colShade}" stroke-width="1.3" opacity=".55"/>`;
    const topperCount = topperStyle === "merlon" ? Math.max(5, Math.round((360 - gapDeg) / 15)) : Math.round((360 - gapDeg) / 9);
    out += vsWallToppers(cx, topCy, rx, ry, gapDeg, topperCount, topperStyle, colBase, colShade, colRim);
    const drawGate = !gateOpts || gateOpts.gate !== false;
    if (!drawGate) {
      for (const [tp, bp] of [[ts, bs], [te, be]]) {
        out += `<rect x="${(tp.x - thick * 0.42).toFixed(1)}" y="${tp.y.toFixed(1)}" width="${(thick * 0.84).toFixed(1)}" height="${(bp.y - tp.y).toFixed(1)}" fill="${colRim}" stroke="${colShade}" stroke-width="1"/>`;
      }
      return out;
    }
    out += vsGateDoor(bs, be, h, colRim);
    const ts_ = Math.max(0.55, Math.min(1.15, h / 24));
    out += vsGateTower(bs.x, bs.y, ts_, colBase, colShade, colShade, gateOpts && gateOpts.banner);
    out += vsGateTower(be.x, be.y, ts_, colBase, colShade, colShade, gateOpts && gateOpts.banner);
    return out;
  }
  function vsGroundEllipse(cx, cy, rx, ry, colA, colB) {
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${colA})" stroke="${colB}" stroke-width="1.5" opacity=".95"/>`;
  }
  function vsDefsGrad(id, c1, c2) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
  }
  const VCX = 160,
    VCY = 192;
  function vsScene({
    groundGrad,
    groundEdge,
    groundRx,
    groundRy,
    wall,
    huts,
    extraTowers,
    pines,
    keepEl
  }) {
    let defs = `<defs>${vsDefsGrad(groundGrad.id, groundGrad.c1, groundGrad.c2)}</defs>`;
    let out = `<svg viewBox="0 0 320 300" xmlns="http://www.w3.org/2000/svg">${defs}`;
    out += pines.map(p => vsPine(p[0], p[1], p[2])).join("");
    out += vsGroundEllipse(VCX, VCY, groundRx, groundRy, groundGrad.id, groundEdge);
    if (wall) out += wall;
    out += huts.join("");
    if (keepEl) out += keepEl;
    if (extraTowers) out += extraTowers.join("");
    out += `</svg>`;
    return out;
  }
  const THATCH = {
    rA: "#c9932f",
    rB: "#875a1f",
    wA: "#8a6a48",
    wB: "#5c4429",
    door: "#2a1c10"
  };
  const TIMBER = {
    rA: "#a2622f",
    rB: "#5c3018",
    wA: "#6b4423",
    wB: "#432a15",
    door: "#1c130a"
  };
  const SLATE = {
    rA: "#6f6f68",
    rB: "#3a3a35",
    wA: "#7a5636",
    wB: "#4a3320",
    door: "#150f08"
  };
  const STONE = {
    rA: "#5a5a55",
    rB: "#302f2a",
    wA: "#8f8a7c",
    wB: "#5c5850",
    door: "#120d08"
  };
  const WOOD_WALL = {
    base: "#7c5a36",
    shade: "#33230f",
    rim: "#a9855a"
  };
  const TIMBER_WALL = {
    base: "#5f4023",
    shade: "#28190c",
    rim: "#8a6238"
  };
  const STONE_FOOT = {
    base: "#6b6660",
    shade: "#26221c",
    rim: "#8f8a80"
  };
  const STONE_WALL = {
    base: "#726c60",
    shade: "#242019",
    rim: "#a29c8c"
  };
  return [
  // Tier 0 · Très faible -- campement isolé, sans palissade.
  vsScene({
    groundGrad: {
      id: "vsg1",
      c1: "#5c7a3a",
      c2: "#3f5a26"
    },
    groundEdge: "#2c4018",
    groundRx: 88,
    groundRy: 52,
    wall: null,
    huts: [vsHut(136, 188, 0.95, THATCH.rA, THATCH.rB, THATCH.wA, THATCH.wB, THATCH.door), vsHut(184, 190, 0.85, THATCH.rA, THATCH.rB, THATCH.wA, THATCH.wB, THATCH.door)],
    pines: [[52, 224, 0.9], [262, 214, 0.8], [150, 258, 0.7], [214, 150, 0.6]]
  }),
  // Tier 1 · Faible -- hameau cerné d'une palissade basse en pieux.
  vsScene({
    groundGrad: {
      id: "vsg2",
      c1: "#6b8046",
      c2: "#485c2a"
    },
    groundEdge: "#2c4018",
    groundRx: 104,
    groundRy: 62,
    wall: vsWallBand(VCX, VCY, 98, 58, 50, 18, WOOD_WALL.base, WOOD_WALL.shade, WOOD_WALL.rim, "spike"),
    huts: [vsHut(126, 188, 0.85, THATCH.rA, THATCH.rB, THATCH.wA, THATCH.wB, THATCH.door), vsHut(196, 188, 0.85, THATCH.rA, THATCH.rB, THATCH.wA, THATCH.wB, THATCH.door), vsHut(160, 206, 0.78, THATCH.rA, THATCH.rB, THATCH.wA, THATCH.wB, THATCH.door), vsHut(160, 170, 0.72, THATCH.rA, THATCH.rB, THATCH.wA, THATCH.wB, THATCH.door)],
    pines: [[40, 226, 0.9], [276, 210, 0.85], [130, 266, 0.7], [236, 150, 0.6], [70, 140, 0.55]]
  }),
  // Tier 2 · Moyen -- palissade plus haute, logis commun, bannière rouge au portail.
  vsScene({
    groundGrad: {
      id: "vsg3",
      c1: "#6e6144",
      c2: "#493f2a"
    },
    groundEdge: "#2c2417",
    groundRx: 114,
    groundRy: 68,
    wall: vsWallBand(VCX, VCY, 106, 63, 44, 24, TIMBER_WALL.base, TIMBER_WALL.shade, TIMBER_WALL.rim, "spike", {
      banner: "#8a2e2e"
    }),
    huts: [vsHut(120, 184, 0.8, THATCH.rA, THATCH.rB, THATCH.wA, THATCH.wB, THATCH.door), vsHut(200, 184, 0.8, THATCH.rA, THATCH.rB, THATCH.wA, THATCH.wB, THATCH.door), vsHut(126, 152, 0.7, THATCH.rA, THATCH.rB, THATCH.wA, THATCH.wB, THATCH.door), vsHut(194, 152, 0.7, THATCH.rA, THATCH.rB, THATCH.wA, THATCH.wB, THATCH.door), vsLonghouse(160, 160, 0.82, TIMBER.rA, TIMBER.rB, TIMBER.wA, TIMBER.wB, TIMBER.door)],
    pines: [[36, 222, 0.9], [286, 204, 0.85], [122, 272, 0.7], [248, 142, 0.6]]
  }),
  // Tier 3 · Fort -- soubassement de pierre + palissade de bois, deux tours de garde au portail.
  vsScene({
    groundGrad: {
      id: "vsg4",
      c1: "#6b6459",
      c2: "#463f36"
    },
    groundEdge: "#241d15",
    groundRx: 122,
    groundRy: 74,
    wall: vsWallBand(VCX, VCY, 113, 69, 40, 10, STONE_FOOT.base, STONE_FOOT.shade, STONE_FOOT.rim, "merlon", {
      gate: false
    }) + vsWallBand(VCX, VCY, 112, 64, 40, 20, TIMBER_WALL.base, TIMBER_WALL.shade, TIMBER_WALL.rim, "spike", {
      banner: "#8a2e2e"
    }),
    huts: [vsHut(120, 180, 0.76, TIMBER.rA, TIMBER.rB, TIMBER.wA, TIMBER.wB, TIMBER.door), vsHut(200, 180, 0.76, TIMBER.rA, TIMBER.rB, TIMBER.wA, TIMBER.wB, TIMBER.door), vsHut(160, 196, 0.74, TIMBER.rA, TIMBER.rB, TIMBER.wA, TIMBER.wB, TIMBER.door), vsHut(128, 148, 0.68, TIMBER.rA, TIMBER.rB, TIMBER.wA, TIMBER.wB, TIMBER.door), vsHut(192, 148, 0.68, TIMBER.rA, TIMBER.rB, TIMBER.wA, TIMBER.wB, TIMBER.door), vsLonghouse(160, 158, 0.86, SLATE.rA, SLATE.rB, SLATE.wA, SLATE.wB, SLATE.door)],
    pines: [[30, 218, 0.85], [296, 198, 0.8], [112, 278, 0.65], [258, 132, 0.55]]
  }),
  // Tier 4 · Très fort -- muraille de pierre crénelée, quatre tours d'angle, donjon central.
  vsScene({
    groundGrad: {
      id: "vsg5",
      c1: "#736c60",
      c2: "#463f36"
    },
    groundEdge: "#1e1810",
    groundRx: 126,
    groundRy: 78,
    wall: vsWallBand(VCX, VCY, 116, 71, 34, 28, STONE_WALL.base, STONE_WALL.shade, STONE_WALL.rim, "merlon", {
      banner: "#c9a227"
    }),
    huts: [vsHut(122, 180, 0.7, TIMBER.rA, TIMBER.rB, TIMBER.wA, TIMBER.wB, TIMBER.door), vsHut(198, 180, 0.7, TIMBER.rA, TIMBER.rB, TIMBER.wA, TIMBER.wB, TIMBER.door), vsHut(122, 150, 0.62, TIMBER.rA, TIMBER.rB, TIMBER.wA, TIMBER.wB, TIMBER.door), vsHut(198, 150, 0.62, TIMBER.rA, TIMBER.rB, TIMBER.wA, TIMBER.wB, TIMBER.door)],
    keepEl: vsKeep(160, 168, 1.0, STONE.rA, STONE.rB, STONE.wA, STONE.wB, "#c9a227"),
    extraTowers: [vsTower(vsPt(VCX, VCY - 28, 116, 71, 132).x, vsPt(VCX, VCY - 28, 116, 71, 132).y, 0.78, STONE.wA, STONE.wB, STONE.rB, "#c9a227"), vsTower(vsPt(VCX, VCY - 28, 116, 71, 48).x, vsPt(VCX, VCY - 28, 116, 71, 48).y, 0.78, STONE.wA, STONE.wB, STONE.rB, "#c9a227"), vsTower(vsPt(VCX, VCY - 28, 116, 71, 164).x, vsPt(VCX, VCY - 28, 116, 71, 164).y, 0.66, STONE.wA, STONE.wB, STONE.rB, null), vsTower(vsPt(VCX, VCY - 28, 116, 71, 16).x, vsPt(VCX, VCY - 28, 116, 71, 16).y, 0.66, STONE.wA, STONE.wB, STONE.rB, null)],
    pines: [[24, 214, 0.8], [304, 192, 0.75]]
  })];
}();
function villageSceneSvg(tier) {
  return VILLAGE_SCENE_STAGES[Math.max(0, Math.min(VILLAGE_SCENE_STAGES.length - 1, tier | 0))];
}
export { BUILDING_ART, TIER2_EXTRAS, TIER3_EXTRAS, MATERIAL, materialTier, buildingTierExtra, buildingIconSvg, getBuildingArt, TROOP_ICON_PATHS, TROOP_TEX, troopBadgeSvg, rankBadgeSvg, rankCell, BUILDING_TEX, buildingBadgeSvg, treeSvg, tinyHouseSvg, villageIconLevel, villageMapIconSvg, villageTagGlyphSvg, villageTagBadgeSvg, mapPseudoRandom, MAP_DECOR_TYPES, mapDecorSvg, mapDecorHtml, wallArt, villageWallRing, legendaryCampSceneSvg, villageSceneSvg };