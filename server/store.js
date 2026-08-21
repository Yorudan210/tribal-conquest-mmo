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
    settings: { speedMultiplier: 1 }, // réglages globaux modifiables par un administrateur
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
  if(!db.settings) db.settings = {};
  if(!db.settings.speedMultiplier) db.settings.speedMultiplier = 1;
  for(const uname in db.users){
    if(db.users[uname].isAdmin == null) db.users[uname].isAdmin = false;
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
      loyalty: 100, aggro: 0
    };
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
    buildQueue: [], trainQueue: [],
    conqueredCount: 0,
    claimedQuests: [],
    createdAt: Date.now()
  };
  return id;
}

function getDb(){ return db; }
function getWorldBounds(){ return WORLD; }

module.exports = {
  load, save, scheduleSave, getDb, getWorldBounds,
  findFreeCoord, createPlayerVillage, generateBarbarians,
  restoreFromRemoteIfNeeded, backupNowRemote,
  backupEnabled: backup.enabled
};
