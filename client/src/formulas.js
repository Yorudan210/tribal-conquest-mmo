// Petites formules/formatteurs qui dépendaient de variables globales mutables dans l'ancien
// index.html (state, username, adminSpeed...) — portées ici en fonctions PURES qui reçoivent
// explicitement ce dont elles ont besoin en paramètre, pour s'intégrer proprement au state React
// (plus de globales mutables partagées entre tous les composants).
import { BUILDINGS, TROOPS, TROOP_ORDER, buildTime, trainTime, prodPerHour } from "./gameData.js";

export const RES_ICON = { wood:"🪵", clay:"🧱", iron:"⛏️" };
export const RES_NAME = { wood:"Bois", clay:"Argile", iron:"Fer" };

// Doit correspondre à NOBLE_CAP_PER_VILLAGE côté serveur (server/gameLogic.js).
export const NOBLE_CAP_PER_VILLAGE = 4;

export function fmt(n){ return Math.floor(n).toLocaleString("fr-FR"); }

/* Heure murale HH:MM à partir d'un timestamp serveur (secondes epoch réelles) — utilisé par le chat. */
export function fmtClock(t){
  if(t==null) return "";
  const d = new Date(t*1000);
  return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
}

export function fmtTime(sec){
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  if(h>0) return h+"h "+String(m).padStart(2,"0")+"m "+String(s).padStart(2,"0")+"s";
  if(m>0) return m+"m "+String(s).padStart(2,"0")+"s";
  return s+"s";
}

export function estimateNow(serverTimeOffset){ return Date.now()/1000 + (serverTimeOffset||0); }

/* buildTime/trainTime dépendent du niveau HQ / Caserne du village actif : petits adaptateurs locaux
   (identiques à vBuildTime/vTrainTime de l'ancien index.html). */
export function vBuildTime(village, key, level, adminSpeed){
  return buildTime(key, level, village.buildings.hq||0) / (adminSpeed||1);
}
export function vTrainTime(village, key, adminSpeed){
  return trainTime(key, village.buildings.barracks||0) / (adminSpeed||1);
}

export function popUsed(state, username){
  const v = state.village;
  let used = 0;
  for(const k of TROOP_ORDER) used += (v.troops[k]||0) * TROOPS[k].pop;
  for(const o of v.trainQueue) used += o.count * TROOPS[o.troop].pop;
  // Ne compte que les troupes parties DEPUIS ce village précis (chaque village a sa propre
  // population/ferme — les troupes d'un autre de vos villages ne doivent pas compter ici).
  for(const m of state.missions){
    if(m.attackerUsername!==username || m.sourceVillageId!==v.id) continue;
    for(const k of TROOP_ORDER) used += (m.troops[k]||0) * TROOPS[k].pop;
  }
  return Math.round(used);
}

export function nobleCount(state, username){
  const v = state.village;
  let n = v.troops.noble||0;
  for(const o of v.trainQueue) if(o.troop==="noble") n += o.count;
  for(const m of state.missions) if(m.attackerUsername===username && m.sourceVillageId===v.id) n += m.troops.noble||0;
  return n;
}

export function canAffordAll(state, cost){
  const r = state.village.resources;
  return r.wood>=cost.wood && r.clay>=cost.clay && r.iron>=cost.iron;
}

/* Gisement riche (voir resourceBonus, gameLogic.js/store.js) : +10% de production sur UNE ressource
   tirée au hasard, propre à ce village barbare précis, conservé après conquête. */
export function villageResourceBonus(state, r){
  const v = state.village;
  return (v.resourceBonus && v.resourceBonus.res===r) ? v.resourceBonus : null;
}
export function resProdRate(state, r){
  const v = state.village;
  const bonus = villageResourceBonus(state, r);
  return prodPerHour(r, v.buildings[r]) * (bonus ? (1+bonus.pct) : 1);
}

export function fmtTroops(troops){
  return TROOP_ORDER.filter(k=>(troops[k]||0)>0).map(k=>TROOPS[k].name+" "+troops[k]).join(", ") || "aucune";
}

export function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
