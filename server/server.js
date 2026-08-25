"use strict";
/* Conquête Tribale — serveur multijoueur, sans dépendance externe (Node natif
   uniquement : http, fs, path, crypto). Sert le client statique (public/) et
   expose une API JSON pour comptes joueurs + monde partagé + combats. */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const auth = require("./auth.js");
const store = require("./store.js");
const game = require("./gameLogic.js");

const PORT = process.env.PORT || 3000;
// Code secret à saisir dans le jeu (onglet Aide) pour débloquer le panneau Admin sur son compte.
// Définissez la variable d'environnement ADMIN_SECRET sur votre hébergeur pour choisir votre propre code.
const ADMIN_SECRET = process.env.ADMIN_SECRET || "changeme-admin-secret";
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const SHARED_DIR = path.join(__dirname, "..", "shared");
const SECRET_FILE = path.join(__dirname, "..", "data", "secret.txt");

function ensureSecret(){
  fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
  if(fs.existsSync(SECRET_FILE)) return fs.readFileSync(SECRET_FILE, "utf8").trim();
  const s = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(SECRET_FILE, s);
  return s;
}
const SECRET = ensureSecret();

let db = null; // assigné dans startServer(), après une éventuelle restauration distante

async function shutdown(signal){
  console.log("["+signal+"] arrêt en cours, sauvegarde finale...");
  try{ store.save(); }catch(e){ console.error("[shutdown] échec sauvegarde locale:", e.message); }
  try{ await store.backupNowRemote(); }catch(e){ console.error("[shutdown] échec sauvegarde distante:", e.message); }
  process.exit(0);
}
process.on("SIGINT", ()=>shutdown("SIGINT"));
process.on("SIGTERM", ()=>shutdown("SIGTERM"));

async function startServer(){
  if(!store.backupEnabled()){
    console.log("[backup] GITHUB_BACKUP_TOKEN non défini : les comptes ne survivront PAS à un redéploiement (voir README).");
  } else {
    console.log("[backup] sauvegarde distante activée (Gist GitHub).");
  }
  const restoreResult = await store.restoreFromRemoteIfNeeded();
  if(restoreResult.restored) console.log("[backup] base restaurée depuis la sauvegarde distante ("+restoreResult.bytes+" octets).");
  else console.log("[backup] pas de restauration :", restoreResult.reason);

  db = store.load();

  setInterval(()=>{
    try{ game.runTick(db); store.scheduleSave(); }
    catch(e){ console.error("[tick] erreur:", e); }
  }, 2000);

  server.listen(PORT, ()=>{
    console.log("Conquête Tribale (multijoueur) en écoute sur le port "+PORT);
  });
}

const MIME = {
  ".html":"text/html; charset=utf-8", ".js":"application/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8",
  ".svg":"image/svg+xml", ".ico":"image/x-icon",
  ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".png":"image/png", ".webp":"image/webp"
};

function send(res, status, body, headers){
  res.writeHead(status, Object.assign({"Access-Control-Allow-Origin":"*"}, headers||{}));
  res.end(body);
}
function sendJson(res, status, obj){
  send(res, status, JSON.stringify(obj), {"Content-Type":"application/json; charset=utf-8"});
}

function readBody(req){
  return new Promise((resolve, reject)=>{
    let chunks=[];
    let size=0;
    req.on("data", c=>{
      size+=c.length;
      if(size>1e6){ reject(new Error("Corps de requête trop volumineux.")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", ()=>{
      if(!chunks.length) return resolve({});
      try{ resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch(e){ reject(new Error("JSON invalide.")); }
    });
    req.on("error", reject);
  });
}

function authenticate(req){
  const h = req.headers["authorization"]||"";
  const m = /^Bearer\s+(.+)$/.exec(h);
  if(!m) return null;
  const payload = auth.verifyToken(m[1], SECRET);
  if(!payload || !payload.username) return null;
  if(!db.users[payload.username]) return null;
  return payload.username;
}

const USERNAME_RE = /^[A-Za-z0-9_\-]{3,20}$/;

async function handleApi(req, res, pathname, url){
  if(pathname==="/api/register" && req.method==="POST"){
    const body = await readBody(req);
    const username = String(body.username||"").trim();
    const password = String(body.password||"");
    if(!USERNAME_RE.test(username)) return sendJson(res, 400, { error:"Pseudo invalide (3 à 20 caractères : lettres, chiffres, _ ou -)." });
    if(password.length<4) return sendJson(res, 400, { error:"Le mot de passe doit faire au moins 4 caractères." });
    if(db.users[username]) return sendJson(res, 409, { error:"Ce pseudo est déjà pris." });
    const { salt, hash } = auth.hashPassword(password);
    const villageId = store.createPlayerVillage(username);
    db.users[username] = {
      passwordHash: hash, salt, villageId, activeVillageId: villageId, createdAt: Date.now(), isAdmin: false, guildId: null,
      // Compteurs cumulatifs utilisés par les Succès (voir computeAchievements, gameLogic.js) — au
      // niveau du COMPTE (pas du village, contrairement aux anciens Objectifs), pour rester valables
      // même en cas de conquête/perte de village.
      stats: { totalLoot:0, unitsKilled:0, attacksWon:0, supportsSent:0, marketTrades:0, wallLevelsDestroyed:0, opponents:[] }
    };
    store.scheduleSave();
    const token = auth.signToken({ username }, SECRET);
    return sendJson(res, 200, { token, username, snapshot: game.buildSnapshot(db, username) });
  }

  if(pathname==="/api/login" && req.method==="POST"){
    const body = await readBody(req);
    const username = String(body.username||"").trim();
    const password = String(body.password||"");
    const u = db.users[username];
    if(!u || !auth.verifyPassword(password, u.salt, u.passwordHash)) return sendJson(res, 401, { error:"Pseudo ou mot de passe incorrect." });
    const token = auth.signToken({ username }, SECRET);
    return sendJson(res, 200, { token, username, snapshot: game.buildSnapshot(db, username) });
  }

  // tout ce qui suit nécessite d'être connecté
  const username = authenticate(req);
  if(!username) return sendJson(res, 401, { error:"Session expirée ou invalide, reconnectez-vous." });

  if(pathname==="/api/state" && req.method==="GET"){
    return sendJson(res, 200, { snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/player" && req.method==="GET"){
    const target = String((url && url.searchParams.get("username"))||"").trim();
    const info = game.publicPlayerView(db, target);
    if(!info) return sendJson(res, 404, { error:"Joueur introuvable." });
    return sendJson(res, 200, { player: info });
  }
  if(pathname==="/api/build" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doBuild(db, username, body.key);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/train" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doTrain(db, username, body.key, body.count);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/troops/disband" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doDisbandTroops(db, username, body.key, body.count);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/mission" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doMission(db, username, body.targetId, body.kind, body.troops||{});
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/village/rename" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doRename(db, username, body.name);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/village/switch" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doSwitchVillage(db, username, body.villageId);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/chat/send" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doChatSend(db, username, body.text, body.channel);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/reports/delete" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doReportDelete(db, username, body.ids);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, removed: result.removed, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/reports/clear" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doReportClear(db, username, body.kind);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, removed: result.removed, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/build/cancel" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doBuildCancel(db, username, body.index);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/support/send" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doSendSupport(db, username, body.targetId, body.troops||{});
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/support/recall" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doRecallSupport(db, username, body.supportId);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/gift" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doGiveResources(db, username, body.username, body.wood, body.clay, body.iron);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/village/transfer" && req.method==="POST"){
    const body = await readBody(req);
    const source = game.villageByUser(db, username);
    if(!source) return sendJson(res, 400, { error:"Village introuvable." });
    const result = game.doTransferResourcesBetweenVillages(db, username, source.id, body.targetVillageId, body.wood, body.clay, body.iron);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }

  // ---- Marché ----
  if(pathname==="/api/market/offer" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doMarketCreateOffer(db, username, body.giveRes, body.giveAmount, body.wantRes, body.wantAmount);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/market/cancel" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doMarketCancelOffer(db, username, String(body.offerId||""));
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/market/accept" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doMarketAcceptOffer(db, username, String(body.offerId||""));
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }

  // ---- Guildes ----
  if(pathname==="/api/guild/create" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doGuildCreate(db, username, body.name, body.tag);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/guild/invite" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doGuildInvite(db, username, body.username);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/guild/kick" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doGuildKick(db, username, body.username);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/guild/leave" && req.method==="POST"){
    const result = game.doGuildLeave(db, username);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/guild/accept" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doGuildAccept(db, username, body.guildId);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/guild/decline" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doGuildDecline(db, username, body.guildId);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/guild/donate" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doGuildDonate(db, username, body.wood, body.clay, body.iron);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/guild/buy-boost" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doGuildBuyBoost(db, username, String(body.key||""));
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/guild/disband" && req.method==="POST"){
    const result = game.doGuildDisband(db, username);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }

  // ---- Diplomatie de guilde ----
  if(pathname==="/api/guilds" && req.method==="GET"){
    return sendJson(res, 200, { guilds: game.listGuildsPublic(db, username) });
  }
  if(pathname==="/api/guild/diplomacy/propose" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doDiplomacyPropose(db, username, body.targetGuildId, body.type);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/guild/diplomacy/respond" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doDiplomacyRespond(db, username, body.relationId, !!body.accept);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/guild/diplomacy/cancel" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doDiplomacyCancel(db, username, body.relationId);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/guild/diplomacy/declare-war" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doDiplomacyDeclareWar(db, username, body.targetGuildId);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }

  // ---- Administration : débloqué avec le code ADMIN_SECRET, puis réservé aux comptes isAdmin ----
  if(pathname==="/api/admin/claim" && req.method==="POST"){
    const body = await readBody(req);
    const code = String(body.code||"");
    if(!code || code!==ADMIN_SECRET) return sendJson(res, 403, { error:"Code administrateur invalide." });
    const result = game.adminSetAdmin(db, username, true);
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname.startsWith("/api/admin/")){
    if(!game.isAdminUser(db, username)) return sendJson(res, 403, { error:"Accès réservé aux administrateurs." });

    if(pathname==="/api/admin/players" && req.method==="GET"){
      return sendJson(res, 200, { players: game.adminListPlayers(db), speedMultiplier: game.getSpeedMultiplier(db), missions: game.adminListMissions(db) });
    }
    if(pathname==="/api/admin/finish-mission" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminFinishMission(db, String(body.missionId||""));
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, players: game.adminListPlayers(db), missions: game.adminListMissions(db), snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/setadmin" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminSetAdmin(db, String(body.username||""), !!body.isAdmin);
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, players: game.adminListPlayers(db), snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/delete-player" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminDeletePlayer(db, String(body.username||""), username);
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, players: game.adminListPlayers(db), snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/village" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminUpdateVillage(db, String(body.username||""), { resources: body.resources, buildings: body.buildings, troops: body.troops });
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, players: game.adminListPlayers(db), snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/give" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminGiveResources(db, String(body.username||""), body.wood, body.clay, body.iron);
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, players: game.adminListPlayers(db), snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/give-all" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminGiveResourcesToAll(db, body.wood, body.clay, body.iron);
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, players: game.adminListPlayers(db), snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/announce" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminAnnounce(db, username, body.text);
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/finish-build" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminFinishBuildQueue(db, String(body.username||""));
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, players: game.adminListPlayers(db), snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/finish-train" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminFinishTrainQueue(db, String(body.username||""));
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, players: game.adminListPlayers(db), snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/speed" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminSetSpeed(db, body.multiplier);
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, players: game.adminListPlayers(db), speedMultiplier: game.getSpeedMultiplier(db), snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/event/start" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminStartServerEvent(db, String(body.key||""), body);
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/event/stop" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminStopServerEvent(db, String(body.id||""));
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
    }

    // ---- Panneau Admin : gestion de TOUS les villages (pas seulement le village d'origine de
    // chaque joueur comme les routes /api/admin/village, /api/admin/give... ci-dessus) ----
    if(pathname==="/api/admin/villages" && req.method==="GET"){
      return sendJson(res, 200, { villages: game.adminListAllVillages(db) });
    }
    if(pathname==="/api/admin/villages/update" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminUpdateVillageById(db, String(body.villageId||""), { resources: body.resources, buildings: body.buildings, troops: body.troops });
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, villages: game.adminListAllVillages(db), snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/villages/give" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminGiveResourcesToVillageById(db, String(body.villageId||""), body.wood, body.clay, body.iron);
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, villages: game.adminListAllVillages(db), snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/villages/finish-build" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminFinishBuildQueueForVillage(db, String(body.villageId||""));
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, villages: game.adminListAllVillages(db), snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/villages/finish-train" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminFinishTrainQueueForVillage(db, String(body.villageId||""));
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, villages: game.adminListAllVillages(db), snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/villages/bulk-update" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminBulkUpdateVillages(db, String(body.scope||"all"), { resources: body.resources, buildings: body.buildings, troops: body.troops });
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, affected: result.affected, total: result.total, villages: game.adminListAllVillages(db), snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/villages/bulk-give" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminBulkGiveResourcesToVillages(db, String(body.scope||"all"), body.wood, body.clay, body.iron);
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, affected: result.affected, villages: game.adminListAllVillages(db), snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/villages/bulk-finish-build" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminBulkFinishQueues(db, String(body.scope||"all"), "build");
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, affected: result.affected, total: result.total, villages: game.adminListAllVillages(db), snapshot: game.buildSnapshot(db, username) });
    }
    if(pathname==="/api/admin/villages/bulk-finish-train" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminBulkFinishQueues(db, String(body.scope||"all"), "train");
      if(result.error) return sendJson(res, 400, result);
      store.scheduleSave();
      return sendJson(res, 200, { ok:true, affected: result.affected, total: result.total, villages: game.adminListAllVillages(db), snapshot: game.buildSnapshot(db, username) });
    }

    return sendJson(res, 404, { error:"Route Admin inconnue." });
  }

  return sendJson(res, 404, { error:"Route API inconnue." });
}

function serveStatic(req, res, pathname){
  let rel = pathname==="/" ? "/index.html" : pathname;
  let base = PUBLIC_DIR;
  if(rel.startsWith("/shared/")){ base = SHARED_DIR; rel = rel.slice("/shared".length); }
  const filePath = path.normalize(path.join(base, rel));
  if(!filePath.startsWith(base)){ return send(res, 403, "Interdit"); }
  fs.readFile(filePath, (err, data)=>{
    if(err){ return send(res, 404, "Introuvable"); }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, { "Content-Type": MIME[ext]||"application/octet-stream" });
  });
}

const server = http.createServer((req, res)=>{
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;
  if(req.method==="OPTIONS"){
    return send(res, 204, "", { "Access-Control-Allow-Methods":"GET,POST,OPTIONS", "Access-Control-Allow-Headers":"Content-Type,Authorization" });
  }
  if(pathname.startsWith("/api/")){
    handleApi(req, res, pathname, url).catch(err=>{
      console.error("[api] erreur:", err);
      sendJson(res, 400, { error: err.message||"Erreur serveur." });
    });
    return;
  }
  serveStatic(req, res, pathname);
});

startServer().catch(err=>{
  console.error("[startup] erreur fatale au démarrage:", err);
  process.exit(1);
});
