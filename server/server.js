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
  ".svg":"image/svg+xml", ".ico":"image/x-icon"
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

async function handleApi(req, res, pathname){
  if(pathname==="/api/register" && req.method==="POST"){
    const body = await readBody(req);
    const username = String(body.username||"").trim();
    const password = String(body.password||"");
    if(!USERNAME_RE.test(username)) return sendJson(res, 400, { error:"Pseudo invalide (3 à 20 caractères : lettres, chiffres, _ ou -)." });
    if(password.length<4) return sendJson(res, 400, { error:"Le mot de passe doit faire au moins 4 caractères." });
    if(db.users[username]) return sendJson(res, 409, { error:"Ce pseudo est déjà pris." });
    const { salt, hash } = auth.hashPassword(password);
    const villageId = store.createPlayerVillage(username);
    db.users[username] = { passwordHash: hash, salt, villageId, createdAt: Date.now(), isAdmin: false };
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
  if(pathname==="/api/mission" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doMission(db, username, body.targetId, body.kind, body.troops||{});
    if(result.error) return sendJson(res, 400, result);
    store.scheduleSave();
    return sendJson(res, 200, { ok:true, snapshot: game.buildSnapshot(db, username) });
  }
  if(pathname==="/api/quest/claim" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doClaimQuest(db, username, body.key);
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
  if(pathname==="/api/chat/send" && req.method==="POST"){
    const body = await readBody(req);
    const result = game.doChatSend(db, username, body.text);
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
      return sendJson(res, 200, { players: game.adminListPlayers(db), speedMultiplier: game.getSpeedMultiplier(db) });
    }
    if(pathname==="/api/admin/setadmin" && req.method==="POST"){
      const body = await readBody(req);
      const result = game.adminSetAdmin(db, String(body.username||""), !!body.isAdmin);
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
    handleApi(req, res, pathname).catch(err=>{
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
