"use strict";
/* Sauvegarde/restauration automatique de data/db.json via un Gist GitHub privé ("secret"),
   pour que les comptes survivent aux redéploiements même sur les plans gratuits (dont le
   disque n'est pas persistant), sans avoir besoin d'un disque payant.

   Fonctionnement : toutes les ~60 secondes (au plus) après un changement, le contenu de la
   base est envoyé dans un Gist secret dédié à cette appli. Au démarrage, si aucune base
   locale n'existe (cas d'un redéploiement qui a réinitialisé le disque), le serveur va
   chercher la dernière sauvegarde dans ce Gist et la restaure avant de démarrer.

   Nécessite une seule variable d'environnement : GITHUB_BACKUP_TOKEN — un jeton d'accès
   personnel GitHub (Settings → Developer settings → Personal access tokens) avec UNIQUEMENT
   le scope "gist" (aucun accès aux dépôts n'est nécessaire). Sans cette variable, la
   persistance entre redéploiements reste désactivée et le jeu fonctionne comme avant. */
const https = require("https");

const TOKEN = process.env.GITHUB_BACKUP_TOKEN || "";
const GIST_DESC = "conquete-tribale-backup (ne pas supprimer — sauvegarde automatique du jeu, gérée par le serveur)";
const FILENAME = "db.json";
let cachedGistId = null;

function api(method, apiPath, body){
  return new Promise((resolve, reject)=>{
    if(!TOKEN) return reject(new Error("GITHUB_BACKUP_TOKEN non défini"));
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      "User-Agent": "conquete-tribale-backup",
      "Authorization": "token "+TOKEN,
      "Accept": "application/vnd.github+json"
    };
    if(data){ headers["Content-Type"]="application/json"; headers["Content-Length"]=Buffer.byteLength(data); }
    const req = https.request({ hostname:"api.github.com", path:apiPath, method, headers }, res=>{
      const chunks=[];
      res.on("data", c=>chunks.push(c));
      res.on("end", ()=>{
        const raw = Buffer.concat(chunks).toString("utf8");
        let parsed=null;
        try{ parsed = raw ? JSON.parse(raw) : null; }catch(e){ /* réponse non-JSON, ignorée */ }
        if(res.statusCode>=200 && res.statusCode<300) resolve(parsed);
        else reject(new Error("GitHub API "+res.statusCode+" sur "+apiPath+" : "+((parsed&&parsed.message)||raw||"erreur inconnue")));
      });
    });
    req.on("error", reject);
    if(data) req.write(data);
    req.end();
  });
}

function getRaw(url){
  return new Promise((resolve, reject)=>{
    https.get(url, { headers:{ "User-Agent":"conquete-tribale-backup" } }, res=>{
      const chunks=[];
      res.on("data", c=>chunks.push(c));
      res.on("end", ()=>resolve(Buffer.concat(chunks).toString("utf8")));
    }).on("error", reject);
  });
}

async function findGistId(){
  if(cachedGistId) return cachedGistId;
  const list = await api("GET", "/gists?per_page=100");
  if(Array.isArray(list)){
    const found = list.find(g=>g.description===GIST_DESC);
    if(found){ cachedGistId = found.id; return cachedGistId; }
  }
  return null;
}

async function createGist(initialContent){
  const created = await api("POST", "/gists", {
    description: GIST_DESC,
    public: false,
    files: { [FILENAME]: { content: initialContent } }
  });
  cachedGistId = created.id;
  return cachedGistId;
}

/* Envoie l'état actuel de la base vers le Gist de sauvegarde (le crée s'il n'existe pas encore). */
async function backupNow(jsonString){
  if(!TOKEN) return false;
  try{
    let id = await findGistId();
    if(!id) id = await createGist(jsonString);
    else await api("PATCH", "/gists/"+id, { files: { [FILENAME]: { content: jsonString } } });
    return true;
  }catch(e){
    console.error("[backup] échec de sauvegarde distante :", e.message);
    return false;
  }
}

/* Récupère le contenu JSON le plus récent depuis le Gist de sauvegarde, ou null si indisponible. */
async function restoreLatest(){
  if(!TOKEN) return null;
  try{
    const id = await findGistId();
    if(!id) return null;
    const gist = await api("GET", "/gists/"+id);
    const file = gist && gist.files && gist.files[FILENAME];
    if(!file) return null;
    if(file.truncated && file.raw_url) return await getRaw(file.raw_url);
    return file.content || null;
  }catch(e){
    console.error("[backup] échec de restauration distante :", e.message);
    return null;
  }
}

module.exports = { backupNow, restoreLatest, enabled: ()=>!!TOKEN };
