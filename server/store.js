"use strict";
const fs = require("fs");
const path = require("path");
const GameData = require("../shared/gameData.js");
const backup = require("./backup.js");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const WORLD = { minX: 0, maxX: 200, minY: 0, maxY: 200 };
const BARBARIAN_COUNT = 220;
const VILLAGE_NAMES = ["Village abandonné","Campement barbare","Hameau isolé","Ferme fortifiée","Avant-poste","Colonie sauvage","Repaire de pillards","Bourgade en ruine","Camp retranché","Ruines habitées"];

// Village barbare "à bonus" : environ 1 village barbare sur 8 dispose d'un gisement particulièrement
// riche en une ressource tirée au hasard, qui augmente sa production de +10% UNE FOIS CE VILLAGE
// CONQUIS PAR UN NOBLE. Le bonus reste attaché à ce village précis (voir runTick, gameLogic.js) : il
// ne s'applique jamais aux autres villages du joueur qui le conquiert, même une fois converti en
// village de joueur (le champ resourceBonus survit à la conversion barbare -> joueur, voir resolveAttack).
const RESOURCE_BONUS_CHANCE = 0.12;
const RESOURCE_BONUS_PCT = 0.10;
function rollResourceBonus(){
  if(Math.random()>=RESOURCE_BONUS_CHANCE) return null;
  const res = ["wood","clay","iron"][Math.floor(Math.random()*3)];
  return { res, pct: RESOURCE_BONUS_PCT };
}

let db = null;

function emptyDb(){
  return {
    users: {},          // username -> { passwordHash, salt, villageId, createdAt, isAdmin }
    villages: {},        // id (string) -> village object
    nextVillageId: 1,
    missions: [],         // in-flight attack/scout missions
    reports: {},          // username -> [report,...] (most recent first)
    chat: [],             // [{id, username, text, time}, ...] (chronologique, plus ancien en premier)
    announcements: [],   // [{id, author, text, time}, ...] annonces admin (plus récentes en premier)
    guilds: {},           // id -> {id, name, tag, leader, members:[username,...], invites:[username,...], bank:{wood,clay,iron}, totalDonated, createdAt}
    nextGuildId: 1,
    diplomacy: [],        // [{id, guildA, guildB, type:"pact"|"alliance"|"war", status:"pending"|"active", proposedBy, createdAt}, ...]
    settings: { speedMultiplier: 1 }, // réglages globaux modifiables par un administrateur
    serverEvents: [],     // [{id, key, name, icon, affects, multiplier, startAt, endAt}, ...] évènements admin en cours (voir gameLogic.js)
    blackArmyEvent: null, // {active, startAt, endAt, totalSpawned, defeatedCount} | null -- évènement "Armée Noire" (voir gameLogic.js)
    market: [],           // [{id, seller, sellerVillageId, giveRes, giveAmount, wantRes, wantAmount, createdAt}, ...] offres d'échange publiques (voir gameLogic.js)
    lastTickAt: Date.now(),
    nextWorldGrowthAt: Date.now() + 60000
  };
}

function ensureDataDir(){
  if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* Complète les champs manquants sur une base sauvegardée par une version antérieure du
   serveur (avant l'ajout du chat / des réglages admin), pour rester rétro-compatible. */
function migrateDb(){
  if(!db.chat) db.chat = [];
  if(!db.announcements) db.announcements = [];
  if(!db.guilds) db.guilds = {};
  if(!db.nextGuildId) db.nextGuildId = 1;
  if(!db.diplomacy) db.diplomacy = [];
  if(!db.settings) db.settings = {};
  if(!db.settings.speedMultiplier) db.settings.speedMultiplier = 1;
  if(!db.serverEvents) db.serverEvents = [];
  if(!db.market) db.market = [];
  for(const uname in db.users){
    if(db.users[uname].isAdmin == null) db.users[uname].isAdmin = false;
    if(db.users[uname].guildId === undefined) db.users[uname].guildId = null;
    // Compteurs de Succès (voir gameLogic.js/computeAchievements) : absents des comptes créés avant
    // l'introduction des Succès (qui remplacent les anciens Objectifs, jamais migrés) — sans cette
    // ligne, bumpStat() créerait l'objet à la volée, mais on préfère un état initial explicite ici.
    if(!db.users[uname].stats) db.users[uname].stats = { totalLoot:0, unitsKilled:0, attacksWon:0, supportsSent:0, marketTrades:0, wallLevelsDestroyed:0, blackArmyDefeated:0, opponents:[] };
    if(db.users[uname].stats.blackArmyDefeated===undefined) db.users[uname].stats.blackArmyDefeated = 0;
    // Village actuellement géré dans l'interface (peut différer du village d'origine une fois
    // qu'un joueur possède plusieurs villages) : par défaut, son village d'origine.
    if(!db.users[uname].activeVillageId) db.users[uname].activeVillageId = db.users[uname].villageId;
  }
  for(const gid in db.guilds){
    const g = db.guilds[gid];
    if(!g.donations) g.donations = [];
    if(!g.donorTotals) g.donorTotals = {};
    if(!g.activeBoosts) g.activeBoosts = [];
  }
  for(const id in db.villages){
    const v = db.villages[id];
    // Bonus de ressource (voir rollResourceBonus ci-dessus) : absent des mondes générés avant
    // l'introduction de la fonctionnalité. Pour les villages barbares déjà existants, on tire le
    // bonus rétroactivement (comme s'ils avaient été générés avec dès le début) ; pour les villages
    // de joueurs déjà conquis, on se contente de poser le champ à null plutôt que d'accorder un
    // bonus rétroactif surprise sur un village déjà en jeu.
    if(v.resourceBonus===undefined) v.resourceBonus = v.owner==="barbarian" ? rollResourceBonus() : null;
    if(v.owner!=="barbarian" && !v.support) v.support = [];
    // Répare les villages conquis par un Noble avant le correctif qui convertit correctement
    // un village barbare en village de joueur : sans "buildings", runTick() plante à chaque tick.
    if(v.owner!=="barbarian" && !v.buildings){
      v.buildings = {
        hq:1, wood:1, clay:1, iron:1, warehouse:1, farm:1, barracks:0,
        wall: Math.max(0, v.wallLevel||0), hide: Math.max(0, v.hideLevel||0), academy:0
      };
      v.buildQueue = v.buildQueue || [];
      v.trainQueue = v.trainQueue || [];
      v.conqueredCount = v.conqueredCount || 0;
      delete v.wallLevel; delete v.hideLevel; delete v.resCap; delete v.tier;
    }
  }
  // Anciens rapports créés avant l'ajout de la suppression : leur donner un id stable une fois.
  let seq = 0;
  for(const uname in db.reports){
    const arr = db.reports[uname];
    if(!Array.isArray(arr)) continue;
    for(const r of arr){ if(!r.id) r.id = "rpmig"+Date.now()+"_"+(seq++); }
  }
}

/* Si aucune base locale n'existe (disque réinitialisé par un redéploiement) et qu'une
   sauvegarde distante (Gist GitHub) est configurée, la restaure AVANT le premier load() —
   c'est ce qui permet aux comptes de survivre à un redéploiement sur un plan gratuit. */
async function restoreFromRemoteIfNeeded(){
  ensureDataDir();
  if(fs.existsSync(DB_FILE)){
    return { restored:false, reason:"base locale déjà présente" };
  }
  if(!backup.enabled()){
    return { restored:false, reason:"GITHUB_BACKUP_TOKEN non défini : persistance entre redéploiements désactivée" };
  }
  const content = await backup.restoreLatest();
  if(!content){
    return { restored:false, reason:"aucune sauvegarde distante disponible" };
  }
  try{
    JSON.parse(content); // valide avant d'écrire, pour ne jamais écraser avec du contenu corrompu
    fs.writeFileSync(DB_FILE, content);
    return { restored:true, bytes: content.length };
  }catch(e){
    return { restored:false, reason:"sauvegarde distante illisible ("+e.message+")" };
  }
}

function load(){
  ensureDataDir();
  if(fs.existsSync(DB_FILE)){
    try{
      db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      migrateDb();
      console.log("[store] base chargée :", Object.keys(db.villages).length, "villages,", Object.keys(db.users).length, "joueurs.");
      return db;
    }catch(e){
      console.error("[store] échec de lecture de db.json, on repart d'une base neuve.", e.message);
    }
  }
  db = emptyDb();
  generateBarbarians(BARBARIAN_COUNT);
  spawnPermanentFactions();
  save();
  return db;
}

let saveTimer = null;
function save(){
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db));
}

let remoteBackupTimer = null;
let lastRemoteBackupAt = 0;
const REMOTE_BACKUP_MIN_INTERVAL_MS = 60000; // au plus une sauvegarde distante par minute
function scheduleRemoteBackup(){
  if(!backup.enabled()) return;
  if(remoteBackupTimer) return;
  const wait = Math.max(5000, REMOTE_BACKUP_MIN_INTERVAL_MS-(Date.now()-lastRemoteBackupAt));
  remoteBackupTimer = setTimeout(()=>{
    remoteBackupTimer = null;
    lastRemoteBackupAt = Date.now();
    backup.backupNow(JSON.stringify(db)).catch(e=>console.error("[store] échec de sauvegarde distante", e.message));
  }, wait);
}
async function backupNowRemote(){
  if(!backup.enabled()) return false;
  return backup.backupNow(JSON.stringify(db));
}
function scheduleSave(){
  scheduleRemoteBackup();
  if(saveTimer) return;
  saveTimer = setTimeout(()=>{ saveTimer = null; try{ save(); }catch(e){ console.error("[store] échec de sauvegarde", e.message); } }, 2000);
}

function randInt(min, max){ return min + Math.floor(Math.random()*(max-min+1)); }

function isOccupied(x, y){
  for(const id in db.villages){
    const v = db.villages[id];
    if(v.x===x && v.y===y) return true;
  }
  return false;
}

function findFreeCoord(){
  for(let attempt=0; attempt<500; attempt++){
    const x = randInt(WORLD.minX, WORLD.maxX);
    const y = randInt(WORLD.minY, WORLD.maxY);
    if(!isOccupied(x,y)) return {x,y};
  }
  // en dernier recours : balayage systématique
  for(let x=WORLD.minX; x<=WORLD.maxX; x++){
    for(let y=WORLD.minY; y<=WORLD.maxY; y++){
      if(!isOccupied(x,y)) return {x,y};
    }
  }
  throw new Error("Le monde est plein.");
}

function generateBarbarians(count){
  const cx = (WORLD.minX+WORLD.maxX)/2, cy=(WORLD.minY+WORLD.maxY)/2;
  for(let i=0;i<count;i++){
    const {x,y} = findFreeCoord();
    const dist = Math.sqrt((x-cx)*(x-cx)+(y-cy)*(y-cy));
    const maxDist = Math.sqrt(2)*(WORLD.maxX-cx);
    const tier = Math.max(0, Math.min(4, Math.floor((dist/maxDist)*5)));
    const troopBase = tier*7 + Math.random()*8;
    const troops = {
      spear: Math.round(troopBase*(0.3+Math.random()*0.4)),
      sword: Math.round(troopBase*(0.2+Math.random()*0.3)),
      archer: Math.round(troopBase*(0.1+Math.random()*0.2)),
      scout:0, light:0, ram:0, catapult:0, noble:0
    };
    const resBase = 150+tier*250;
    const id = String(db.nextVillageId++);
    db.villages[id] = {
      id, x, y, name: VILLAGE_NAMES[Math.floor(Math.random()*VILLAGE_NAMES.length)],
      owner: "barbarian", tier,
      resources: {
        wood: Math.round(resBase*(0.7+Math.random()*0.6)),
        clay: Math.round(resBase*(0.7+Math.random()*0.6)),
        iron: Math.round(resBase*(0.7+Math.random()*0.6))
      },
      resCap: Math.round(600+tier*500),
      troops, wallLevel: Math.round(Math.random()*tier), hideLevel: 0,
      loyalty: 100, aggro: 0, resourceBonus: rollResourceBonus()
    };
  }
}

/* ------------------- Factions PNJ permanentes (bandits/raiders) -------------------- *
 * Voir PERMANENT_FACTIONS dans shared/gameData.js pour le pourquoi. Un village de ces
 * factions est généré exactement comme un barbare classique (generateBarbarians
 * ci-dessus) mais avec les multiplicateurs de la config, un flag "faction", et un
 * choix de coordonnées biaisé (proche du centre pour "bandits", proche de la
 * périphérie pour "raiders") plutôt qu'uniformément aléatoire sur toute la carte. */
// "legendary" reste volontairement rare (voir PERMANENT_FACTIONS.legendary, shared/gameData.js) --
// contrairement aux bandits/raiders, ces campements ne sont ni topUp-és ni renouvelés : le nombre
// fixé ici (à l'init du monde, ou via une seed rétroactive) est tout ce qui existera sur ce monde.
const PERMANENT_FACTION_COUNTS = { bandits: 60, raiders: 45, legendary: 6 };
// Le top-up périodique des repaires de brigands (topUpBandits) qui garantit qu'il en
// reste toujours près des joueurs, même après plusieurs semaines de jeu, vit dans
// gameLogic.js (runTick) et NON ici : runTick(db) reçoit son "db" en paramètre (celui
// du serveur en cours), alors que toutes les fonctions de CE fichier lisent la
// variable "db" interne au module store.js -- les deux ne sont PAS interchangeables
// (voir le commentaire en tête de gameLogic.js sur ce sujet). spawnPermanentFactions
// ci-dessous reste ici car il n'est appelé QUE par store.js lui-même (load(), à
// l'initialisation d'un monde neuf) ou par la route admin de seed rétroactif, jamais
// depuis le tick de gameLogic.js.

function findFreeCoordBiased(preference){
  const cx = (WORLD.minX+WORLD.maxX)/2, cy = (WORLD.minY+WORLD.maxY)/2;
  const maxRadius = Math.min(WORLD.maxX-WORLD.minX, WORLD.maxY-WORLD.minY)/2;
  for(let attempt=0; attempt<500; attempt++){
    let r;
    if(preference==="near") r = maxRadius*Math.pow(Math.random(),2);       // biaisé vers le centre
    else if(preference==="far") r = maxRadius*(1-Math.pow(Math.random(),2)); // biaisé vers la périphérie
    else r = maxRadius*Math.random();
    const angle = Math.random()*Math.PI*2;
    const x = Math.round(GameData.clamp(cx+r*Math.cos(angle), WORLD.minX, WORLD.maxX));
    const y = Math.round(GameData.clamp(cy+r*Math.sin(angle), WORLD.minY, WORLD.maxY));
    if(!isOccupied(x,y)) return {x,y};
  }
  return findFreeCoord(); // dernier recours : balayage uniforme (voir findFreeCoord)
}

/* Génère UN village pour une faction permanente donnée (cfg = une entrée de
   PERMANENT_FACTIONS), aux coordonnées renvoyées par coordFn() -- même formule de
   tier/troupes/ressources que generateBarbarians ci-dessus, simplement passée au
   crible des multiplicateurs troopMult/resMult/wallGuarantee de la config. */
function spawnFactionVillage(cfg, coordFn){
  const {x,y} = coordFn();
  const cx = (WORLD.minX+WORLD.maxX)/2, cy = (WORLD.minY+WORLD.maxY)/2;
  const dist = Math.sqrt((x-cx)*(x-cx)+(y-cy)*(y-cy));
  const maxDist = Math.sqrt(2)*(WORLD.maxX-cx);
  // "legendary" force son tier au maximum (voir PERMANENT_FACTIONS.legendary) plutôt que de le
  // dériver de la distance au centre comme bandits/raiders -- ces campements doivent rester
  // redoutables même quand ils apparaissent près du centre de la carte (placement "éparse").
  const tier = cfg.forceTier!=null ? cfg.forceTier : Math.max(0, Math.min(4, Math.floor((dist/maxDist)*5)));
  const troopBase = (tier*7+Math.random()*8)*cfg.troopMult;
  const troops = {
    spear: Math.round(troopBase*(0.3+Math.random()*0.4)),
    sword: Math.round(troopBase*(0.2+Math.random()*0.3)),
    archer: Math.round(troopBase*(0.1+Math.random()*0.2)),
    scout:0, light:0, ram:0, catapult:0, noble:0
  };
  const resBase = (150+tier*250)*cfg.resMult;
  const id = String(db.nextVillageId++);
  db.villages[id] = {
    id, x, y, name: VILLAGE_NAMES[Math.floor(Math.random()*VILLAGE_NAMES.length)],
    owner: "barbarian", tier, faction: cfg.key,
    resources: {
      wood: Math.round(resBase*(0.7+Math.random()*0.6)),
      clay: Math.round(resBase*(0.7+Math.random()*0.6)),
      iron: Math.round(resBase*(0.7+Math.random()*0.6))
    },
    resCap: Math.round((600+tier*500)*cfg.resMult),
    troops,
    wallLevel: cfg.wallGuarantee ? Math.max(1, Math.round(Math.random()*tier)+1) : Math.round(Math.random()*tier),
    hideLevel: 0, loyalty: 100, aggro: 0, resourceBonus: rollResourceBonus()
  };
  return db.villages[id];
}

/* "onlyKeys" (optionnel) restreint le peuplement à un sous-ensemble de PERMANENT_FACTIONS -- utilisé
   par adminSeedPermanentFactions (gameLogic.js) pour ne (re)peupler QUE les factions absentes d'un
   monde donné (ex. un monde de production déjà peuplé en bandits/raiders avant l'ajout d'une
   nouvelle faction comme "legendary" : sans ce filtre, la route admin refuserait tout peuplement dès
   qu'UNE SEULE faction est déjà présente, empêchant à jamais de rattraper les nouvelles). */
function spawnPermanentFactions(onlyKeys){
  for(const key in GameData.PERMANENT_FACTIONS){
    if(onlyKeys && !onlyKeys.includes(key)) continue;
    const cfg = GameData.PERMANENT_FACTIONS[key];
    const count = PERMANENT_FACTION_COUNTS[key] || 30;
    for(let i=0;i<count;i++) spawnFactionVillage(cfg, ()=>findFreeCoordBiased(cfg.distancePreference));
  }
}

function createPlayerVillage(username){
  const {x,y} = findFreeCoord();
  const id = String(db.nextVillageId++);
  db.villages[id] = {
    id, x, y, name: username+"'s village",
    owner: username, tier: null,
    buildings: {hq:1,wood:1,clay:1,iron:1,warehouse:1,farm:1,barracks:0,wall:0,hide:0,academy:0},
    resources: {wood:600,clay:600,iron:600},
    troops: Object.fromEntries(GameData.TROOP_ORDER.map(k=>[k,0])),
    buildQueue: [], trainQueue: [], support: [],
    conqueredCount: 0, resourceBonus: null, // jamais de gisement sur un village d'origine, seulement sur une conquête barbare
    createdAt: Date.now()
  };
  return id;
}

function getDb(){ return db; }
function getWorldBounds(){ return WORLD; }

module.exports = {
  load, save, scheduleSave, getDb, getWorldBounds,
  findFreeCoord, createPlayerVillage, generateBarbarians,
  spawnPermanentFactions,
  restoreFromRemoteIfNeeded, backupNowRemote,
  backupEnabled: backup.enabled
};
