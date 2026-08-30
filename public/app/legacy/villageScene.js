/* Porte renderVillageScene() de l'ancien index.html tel quel (génère le SVG de la scène de village
   sous forme de chaîne de markup, à partir des générateurs procéduraux de art.js) — fonction quasi
   pure (dépend seulement de ses paramètres), rendue côté React via dangerouslySetInnerHTML dans
   VillageScene.jsx, qui gère les clics par délégation d'évènement plutôt que par ré-attachement
   manuel de gestionnaires comme le faisait attachTabHandlers(). */
import { BUILD_ORDER, BUILDINGS } from "../gameData.js";
import { getBuildingArt, treeSvg, tinyHouseSvg, villageWallRing } from "./art.js";

/* Disposition circulaire façon Tribal Wars : l'Hôtel de ville trône au centre de la place,
   les 8 autres bâtiments (hors Muraille, qui entoure tout le village) forment un anneau autour. */
const BUILD_LAYOUT = {
  hq: {
    x: 50,
    y: 51.2
  },
  barracks: {
    x: 50,
    y: 22.4
  },
  academy: {
    x: 72.6,
    y: 30.9
  },
  iron: {
    x: 82,
    y: 51.2
  },
  hide: {
    x: 72.6,
    y: 71.5
  },
  warehouse: {
    x: 50,
    y: 80
  },
  farm: {
    x: 27.4,
    y: 71.5
  },
  clay: {
    x: 18,
    y: 51.2
  },
  wood: {
    x: 27.4,
    y: 30.9
  }
};
function svgPos(pos) {
  return {
    x: pos.x / 100 * 1000,
    y: pos.y / 100 * 625
  };
}
export function renderVillageSceneMarkup(v, selectedBuilding, sparkleUntil) {
  const cx = 500,
    cy = 320,
    wallRx = 420,
    wallRy = 250;
  const paths = BUILD_ORDER.filter(k => k !== "hq" && k !== "wall").map(k => {
    const p1 = svgPos(BUILD_LAYOUT.hq),
      p2 = svgPos(BUILD_LAYOUT[k]);
    return `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" class="dirt-path"/>`;
  }).join("");
  const hqLvl = v.buildings.hq || 0;
  const decorList = [treeSvg(45, 45, 0.9), treeSvg(955, 55, 1), treeSvg(40, 580, 0.85), treeSvg(960, 585, 0.95), treeSvg(150, 600, 0.8), treeSvg(850, 595, 0.85), treeSvg(500, 608, 0.7)];
  if (hqLvl >= 5) {
    decorList.push(treeSvg(60, 270, 0.8), treeSvg(940, 270, 0.85));
  }
  if (hqLvl >= 10) {
    decorList.push(treeSvg(200, 50, 0.75), treeSvg(800, 590, 0.8), treeSvg(40, 150, 0.7), treeSvg(960, 150, 0.7));
  }
  const decor = decorList.join("");
  const plaza = `
    <ellipse cx="${cx}" cy="${cy + 10}" rx="150" ry="95" fill="#8a6a3f" opacity=".28"/>
    <g transform="translate(${cx + 100},${cy - 60})" opacity="0.95">
      <ellipse cx="0" cy="4" rx="14" ry="5" fill="#6b6255" opacity=".6"/>
      <circle cx="0" cy="-6" r="11" fill="none" stroke="#8d8172" stroke-width="4"/>
      <rect x="-2" y="-24" width="4" height="18" fill="#6f6558"/>
      <polygon points="-8,-24 0,-34 8,-24" fill="#7d7568" stroke="#2a1c10" stroke-width="1.5"/>
    </g>`;
  const farmLvl = v.buildings.farm || 0;
  const housePositions = [[380, 388], [620, 388], [380, 438], [620, 438]];
  const houseCount = farmLvl >= 15 ? 4 : farmLvl >= 10 ? 3 : farmLvl >= 6 ? 2 : farmLvl >= 3 ? 1 : 0;
  const extraHouses = housePositions.slice(0, houseCount).map(([hx, hy]) => tinyHouseSvg(hx, hy, 0.8)).join("");
  const groups = BUILD_ORDER.filter(k => k !== "wall").map(key => {
    const b = BUILDINGS[key],
      lvl = v.buildings[key] || 0,
      p = svgPos(BUILD_LAYOUT[key]);
    const empty = lvl <= 0;
    const underConstruction = v.buildQueue.length && v.buildQueue[0].key === key;
    const sel = selectedBuilding === key;
    const sparkling = sparkleUntil[key] && Date.now() < sparkleUntil[key];
    return `<g class="plot ${sel ? 'selected' : ''}" data-plot="${key}" transform="translate(${p.x},${p.y})">
      <title>${b.name} — niveau ${lvl}</title>
      <ellipse class="groundmark" cx="0" cy="8" rx="50" ry="15"></ellipse>
      <g class="art ${empty ? 'empty-art' : ''}">${getBuildingArt(key, lvl)}</g>
      ${underConstruction ? `<text class="hammer" x="0" y="-100" text-anchor="middle">🔨</text>` : ''}
      ${sparkling ? `<text class="sparkle" x="0" y="-95" text-anchor="middle">✨</text>` : ''}
      ${!empty ? `<circle class="badge-bg" cx="38" cy="-74" r="14"></circle><text class="badge-text" x="38" y="-69" text-anchor="middle">${lvl}</text>` : ''}
      <rect class="label-bg" x="-58" y="20" width="116" height="19" rx="4"></rect>
      <text class="label-text" x="0" y="34" text-anchor="middle">${b.name}</text>
    </g>`;
  }).join("");
  const wallLvl = v.buildings.wall || 0;
  const wallSelected = selectedBuilding === "wall";
  const wallUnderConstruction = v.buildQueue.length && v.buildQueue[0].key === "wall";
  const wallSparkling = sparkleUntil.wall && Date.now() < sparkleUntil.wall;
  const wallGroup = `<g class="plot wall-ring ${wallSelected ? 'selected' : ''}" data-plot="wall">
    <title>${BUILDINGS.wall.name} — niveau ${wallLvl}</title>
    <ellipse cx="${cx}" cy="${cy}" rx="${wallRx}" ry="${wallRy}" fill="none" stroke="rgba(0,0,0,0.001)" stroke-width="70"/>
    ${villageWallRing(wallLvl)}
    ${wallUnderConstruction ? `<text class="hammer" x="${cx}" y="${cy - wallRy - 42}" text-anchor="middle">🔨</text>` : ''}
    ${wallSparkling ? `<text class="sparkle" x="${cx}" y="${cy - wallRy - 36}" text-anchor="middle">✨</text>` : ''}
    <circle class="badge-bg" cx="${cx}" cy="${cy - wallRy - 14}" r="15"></circle>
    <text class="badge-text" x="${cx}" y="${cy - wallRy - 9}" text-anchor="middle">${wallLvl}</text>
    <rect class="label-bg" x="${cx - 60}" y="${cy - wallRy + 2}" width="120" height="19" rx="4"></rect>
    <text class="label-text" x="${cx}" y="${cy - wallRy + 16}" text-anchor="middle">Muraille</text>
  </g>`;
  return `<svg class="village-svg" viewBox="0 0 1000 625" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="groundGrad" cx="50%" cy="35%" r="75%">
        <stop offset="0%" stop-color="#3d4f26"/>
        <stop offset="55%" stop-color="#2e3d1c"/>
        <stop offset="100%" stop-color="#212c14"/>
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="1000" height="625" fill="url(#groundGrad)"/>
    <ellipse cx="140" cy="500" rx="120" ry="40" fill="#354420" opacity=".6"/>
    <ellipse cx="880" cy="160" rx="140" ry="45" fill="#354420" opacity=".5"/>
    <ellipse cx="820" cy="520" rx="100" ry="35" fill="#2a3618" opacity=".5"/>
    ${decor}
    ${wallGroup}
    <ellipse cx="${cx}" cy="${cy}" rx="${wallRx - 40}" ry="${wallRy - 40}" fill="#3a4a24" opacity=".5"/>
    ${plaza}
    ${paths}
    ${extraHouses}
    ${groups}
    <rect x="10" y="10" width="980" height="605" fill="none" stroke="#5a4632" stroke-width="4" stroke-dasharray="2 11" rx="14"/>
  </svg>`;
}