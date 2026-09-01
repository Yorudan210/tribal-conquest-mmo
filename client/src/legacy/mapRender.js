// Génération de balisage (portée quasi verbatim depuis l'ancien index.html : renderMap(),
// missionMarkerPos(), worldMissionMarkerPos(), mapMarkerHTML(), guildRelationFor()) pour la carte du
// monde -- même principe que legacy/villageScene.js : fonctions PURES qui renvoient du HTML (pins,
// marqueurs de mission, décor), injecté par MapTab.jsx via dangerouslySetInnerHTML puis câblé par
// délégation d'évènement (glisser/zoomer/cliquer un pin), plutôt que des centaines de <div> JSX
// individuels pour un rendu à haute fréquence (chaque poussée WebSocket, ~2s).
import { TROOP_ORDER, VILLAGE_TAGS, clamp } from "../gameData.js";
import { RES_ICON, RES_NAME, escapeHtml } from "../formulas.js";
import { villageMapIconSvg, villageIconLevel, villageTagBadgeSvg, mapDecorHtml } from "./art.js";

export const TIER_CLASS = ["weak","weak","medium","strong","strong"];
export const TIER_LABEL = ["Très faible","Faible","Moyen","Fort","Très fort"];
export const BLACK_ARMY_RANK_LABEL = ["I","II","III","IV","V"];
// Table générique de rendu des factions PvE spéciales (pins carte + badge VillageActionModal).
// blackArmy garde exactement son comportement d'avant (cls "blackarmy", label "Armée Noire") --
// bandits/raiders (Phase 1 "variété des cibles PvE") suivent le même pattern.
export const FACTION_PIN = {
  blackArmy: {cls:"blackarmy", icon:"🏴", label:"Armée Noire"},
  bandits: {cls:"bandits", icon:"🗡️", label:"Repaire de brigands"},
  raiders: {cls:"raiders", icon:"🐎", label:"Camp de maraudeurs"},
  legendary: {cls:"legendary", icon:"👑", label:"Campement légendaire"}
};
export const DIPLOMACY_LABEL = {pact:"Pacte de non-agression", alliance:"Alliance", war:"Guerre"};
export const VILLAGE_TAG_MAP = Object.fromEntries(VILLAGE_TAGS.map(t=>[t.key, t]));

/* Relation active de NOTRE guilde avec la guilde propriétaire d'un village (couleur des pins et
   des zones d'influence). Renvoie null si sans guilde, village sans guilde, ou relation non active. */
export function guildRelationFor(snapshot, guildId){
  if(!guildId || !snapshot.guild || !snapshot.guild.diplomacy) return null;
  const rel = snapshot.guild.diplomacy.find(r=>r.status==="active" && r.otherGuild.id===guildId);
  if(!rel) return null;
  const cls = rel.type==="war" ? "war" : (rel.type==="alliance" ? "ally" : "pact");
  return { type:rel.type, cls, label: DIPLOMACY_LABEL[rel.type] };
}

export function findAnyVillage(snapshot, id){
  if(snapshot.village && snapshot.village.id===id) return snapshot.village;
  return (snapshot.villages||[]).find(x=>x.id===id) || null;
}

export function missionMarkerPos(snapshot, now, m){
  if(m.kind!=="attack" && m.kind!=="scout" && m.kind!=="raid") return null;
  const v = snapshot.village;
  let t, fromX,fromY,toX,toY,frac,returning;
  if(m.kind==="raid"){
    t = snapshot.villages.find(x=>x.id===m.sourceVillageId);
    if(!t) return null;
    if(m.resolveDone) return null;
    frac = clamp((now-m.departAt)/Math.max(1,m.travel),0,1);
    fromX=t.x; fromY=t.y; toX=v.x; toY=v.y; returning=false;
  } else {
    t = snapshot.villages.find(x=>x.id===m.targetId);
    if(!t) return null;
    if(!m.resolveDone){
      frac = clamp((now-m.departAt)/Math.max(1,m.travel),0,1);
      fromX=v.x; fromY=v.y; toX=t.x; toY=t.y; returning=false;
    } else {
      const dur = Math.max(1, m.returnAt-m.arriveAt);
      frac = clamp((now-m.arriveAt)/dur,0,1);
      fromX=t.x; fromY=t.y; toX=v.x; toY=v.y; returning=true;
    }
  }
  return { wx: fromX+(toX-fromX)*frac, wy: fromY+(toY-fromY)*frac, returning };
}

export function worldMissionMarkerPos(snapshot, now, m){
  const from = findAnyVillage(snapshot, m.sourceVillageId), to = findAnyVillage(snapshot, m.targetId);
  if(!from || !to) return null;
  const frac = clamp((now-m.departAt)/Math.max(1,m.travel),0,1);
  return { wx: from.x+(to.x-from.x)*frac, wy: from.y+(to.y-from.y)*frac, returning:false };
}

export function mapMarkerHTML(m, pos, minX, minY, ppf, foreign){
  const left=(pos.wx-minX)*ppf, top=(pos.wy-minY)*ppf;
  const kindCls = m.kind==="scout" ? "marker-scout" : "marker-attack";
  const icon = m.kind==="scout" ? "🔭" : (m.kind==="raid" ? "⚠️" : "⚔️");
  const domId = "marker_"+(foreign?"w_":"")+m.id;
  let label;
  if(foreign){
    label = (m.kind==="scout" ? "Reconnaissance" : "Attaque")+" en approche (autre joueur — composition inconnue)";
  } else {
    label = (m.kind==="scout" ? "Reconnaissance" : (m.kind==="raid" ? "Raid barbare" : "Attaque"))+" "+(pos.returning?"(retour)":"(aller)");
  }
  return `<div class="troop-marker ${kindCls} ${foreign?'marker-foreign':''} ${pos.returning?'marker-returning':''}" id="${domId}" style="left:${left}px; top:${top}px;" title="${label}">
    <div class="tdot">${icon}</div>
  </div>`;
}

/* Porte renderMap() : construit le balisage complet de #mapWorld (grille, décor, pins, marqueurs de
   mission) + les dimensions du monde visible, à partir de l'état courant. Les deux <canvas> (zones
   d'influence / lignes d'attaque) sont laissés VIDES ici -- MapTab les dessine ensuite via un effet
   (voir drawMapInfluence/drawMapAttackLines, également portés quasi verbatim). */
export function buildMapMarkup(snapshot, username, mapView, selectedVillage, now){
  const v = snapshot.village, mv = mapView, ppf = mv.ppf;
  const others = snapshot.villages.filter(t=>t.id!==v.id);
  const xs = others.map(t=>t.x).concat(v.x), ys = others.map(t=>t.y).concat(v.y);
  const minX = Math.min(...xs)-3, maxX = Math.max(...xs)+3;
  const minY = Math.min(...ys)-3, maxY = Math.max(...ys)+3;
  const worldW = (maxX-minX)*ppf, worldH = (maxY-minY)*ppf;

  const pins = others.map(t=>{
    const left=(t.x-minX)*ppf, top=(t.y-minY)*ppf;
    const sel = selectedVillage===t.id;
    const mine = t.owner===username;
    const rel = !mine && t.isPlayer ? guildRelationFor(snapshot, t.guildId) : null;
    const factionInfo = !mine && !t.isPlayer && t.faction ? FACTION_PIN[t.faction] : null;
    const cls = mine ? "player" : (rel ? rel.cls : (factionInfo ? factionInfo.cls : (t.isPlayer ? "medium" : TIER_CLASS[t.tier])));
    const iconKind = mine ? "mine" : (factionInfo ? factionInfo.cls : (t.isPlayer ? "player" : "barbarian"));
    const icon = villageMapIconSvg(iconKind, villageIconLevel(t, mine), (t.wallLevel||0)>0);
    const bonusTxt = t.resourceBonus ? (" · gisement riche : +"+Math.round(t.resourceBonus.pct*100)+"% "+RES_NAME[t.resourceBonus.res].toLowerCase()) : "";
    const factionTxt = factionInfo ? (" · "+factionInfo.icon+" "+factionInfo.label+(t.faction==="blackArmy" ? (" — Rang "+BLACK_ARMY_RANK_LABEL[t.tier||0]) : "")) : "";
    const title = t.name+" ("+t.x+"|"+t.y+")"+(mine?' — vous':(t.isPlayer?(' — '+t.owner):''))+(rel?(' · '+rel.label):'')+bonusTxt+factionTxt;
    const badge = t.resourceBonus ? `<span class="resbonus-badge">${RES_ICON[t.resourceBonus.res]}</span>` : "";
    const tagKey = (snapshot.villageTags||{})[t.id];
    const tagBadge = tagKey ? `<span class="village-tag-badge" title="${escapeHtml((VILLAGE_TAG_MAP[tagKey]||{}).label||"")}">${villageTagBadgeSvg(tagKey)}</span>` : "";
    return `<div class="villagePin ${cls} ${sel?'selected':''}" data-village-pin="${t.id}" style="left:${left}px; top:${top}px;" title="${escapeHtml(title)}">
      <div class="dot">${icon}${badge}${tagBadge}</div>
      ${ppf>=20?`<div class="plabel">${escapeHtml(t.x+"|"+t.y)}</div>`:''}
    </div>`;
  }).join("");

  const playerLeft=(v.x-minX)*ppf, playerTop=(v.y-minY)*ppf;
  const playerSel = selectedVillage==="home";
  const playerBonusTxt = v.resourceBonus ? (" · gisement riche : +"+Math.round(v.resourceBonus.pct*100)+"% "+RES_NAME[v.resourceBonus.res].toLowerCase()) : "";
  const playerBadge = v.resourceBonus ? `<span class="resbonus-badge">${RES_ICON[v.resourceBonus.res]}</span>` : "";
  const homeWallLvl = (v.buildings && v.buildings.wall)||0;
  const homeIcon = villageMapIconSvg("mine", homeWallLvl>=10?2:1, homeWallLvl>0);
  const homeTagKey = (snapshot.villageTags||{})[v.id];
  const homeTagBadge = homeTagKey ? `<span class="village-tag-badge" title="${escapeHtml((VILLAGE_TAG_MAP[homeTagKey]||{}).label||"")}">${villageTagBadgeSvg(homeTagKey)}</span>` : "";
  const playerPin = `<div class="villagePin player ${playerSel?'selected':''}" data-village-pin="home" style="left:${playerLeft}px; top:${playerTop}px;" title="${escapeHtml(v.name+" ("+v.x+"|"+v.y+")"+playerBonusTxt)}">
    <div class="dot">${homeIcon}${playerBadge}${homeTagBadge}</div>
    ${ppf>=20?`<div class="plabel">${escapeHtml(v.name)}</div>`:''}
  </div>`;

  const markers = snapshot.missions.map(m=>{
    const pos = missionMarkerPos(snapshot, now, m);
    return pos ? mapMarkerHTML(m, pos, minX, minY, ppf, false) : "";
  }).join("");
  const foreignMarkers = (snapshot.worldMissions||[]).map(m=>{
    const pos = worldMissionMarkerPos(snapshot, now, m);
    return pos ? mapMarkerHTML(m, pos, minX, minY, ppf, true) : "";
  }).join("");

  const gridBg = `
    background-image:
      linear-gradient(to right, rgba(255,255,255,.06) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,.06) 1px, transparent 1px),
      linear-gradient(to right, rgba(255,255,255,.16) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,.16) 1px, transparent 1px);
    background-size:${ppf}px ${ppf}px, ${ppf}px ${ppf}px, ${ppf*10}px ${ppf*10}px, ${ppf*10}px ${ppf*10}px;`;

  const influenceCanvas = `<canvas id="mapInfluence" width="${Math.round(worldW)}" height="${Math.round(worldH)}"></canvas>`;
  const attackLinesCanvas = `<canvas id="mapAttackLines" width="${Math.round(worldW)}" height="${Math.round(worldH)}"></canvas>`;
  const occupiedTiles = new Set(others.map(t=>t.x+","+t.y).concat([v.x+","+v.y]));
  const decor = mapDecorHtml(minX, maxX, minY, maxY, ppf, occupiedTiles);

  const worldHtml = `${influenceCanvas}${attackLinesCanvas}${decor}${pins}${playerPin}${markers}${foreignMarkers}`;
  return { worldHtml, minX, minY, maxX, maxY, worldW, worldH, gridBg, ppf };
}

/* Zones d'influence (drawMapInfluence, portée verbatim) : halos semi-transparents autour de chaque
   village de joueur, dessinés sur le <canvas id="mapInfluence"> après chaque rendu. */
export const ZONE_RGB = { mine:"193,121,62", ally:"107,171,94", pact:"91,147,176", war:"193,91,70", other:"154,117,38" };

export function drawMapInfluence(canvas, snapshot, username, minX, minY, ppf){
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const v = snapshot.village;
  const radius = ppf*3.2;
  const zoneOf = (t, mine) => {
    if(mine) return ZONE_RGB.mine;
    const rel = t.isPlayer ? guildRelationFor(snapshot, t.guildId) : null;
    return rel ? ZONE_RGB[rel.type==="war"?"war":(rel.type==="alliance"?"ally":"pact")] : ZONE_RGB.other;
  };
  const drawZone = (x, y, rgb) => {
    const cx=(x-minX)*ppf, cy=(y-minY)*ppf;
    const grad = ctx.createRadialGradient(cx,cy,0,cx,cy,radius);
    grad.addColorStop(0, "rgba("+rgb+",.30)");
    grad.addColorStop(1, "rgba("+rgb+",0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx,cy,radius,0,Math.PI*2);
    ctx.fill();
  };
  ctx.globalCompositeOperation = "lighter";
  for(const t of snapshot.villages){
    if(t.id===v.id || !t.isPlayer) continue;
    drawZone(t.x, t.y, zoneOf(t, t.owner===username));
  }
  drawZone(v.x, v.y, ZONE_RGB.mine);
  ctx.globalCompositeOperation = "source-over";
}

function missionLineEndpoints(snapshot, m){
  if(m.kind!=="attack" && m.kind!=="raid") return null;
  const v = snapshot.village;
  if(m.kind==="raid"){
    if(m.resolveDone) return null;
    const t = snapshot.villages.find(x=>x.id===m.sourceVillageId);
    if(!t) return null;
    return { x1:t.x, y1:t.y, x2:v.x, y2:v.y };
  }
  const t = snapshot.villages.find(x=>x.id===m.targetId);
  if(!t) return null;
  return { x1:v.x, y1:v.y, x2:t.x, y2:t.y };
}

function worldMissionLineEndpoints(snapshot, m){
  if(m.kind!=="attack") return null;
  const from = findAnyVillage(snapshot, m.sourceVillageId), to = findAnyVillage(snapshot, m.targetId);
  if(!from || !to) return null;
  return { x1:from.x, y1:from.y, x2:to.x, y2:to.y };
}

export function drawMapAttackLines(canvas, snapshot, minX, minY, ppf){
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const drawLine = (x1,y1,x2,y2,color) => {
    ctx.beginPath();
    ctx.setLineDash([6,5]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.moveTo((x1-minX)*ppf,(y1-minY)*ppf);
    ctx.lineTo((x2-minX)*ppf,(y2-minY)*ppf);
    ctx.stroke();
  };
  for(const m of snapshot.missions){
    const seg = missionLineEndpoints(snapshot, m);
    if(seg) drawLine(seg.x1,seg.y1,seg.x2,seg.y2,"rgba(201,92,74,.75)");
  }
  for(const m of (snapshot.worldMissions||[])){
    const seg = worldMissionLineEndpoints(snapshot, m);
    if(seg) drawLine(seg.x1,seg.y1,seg.x2,seg.y2,"rgba(201,92,74,.35)");
  }
  ctx.setLineDash([]);
}
