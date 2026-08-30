"use strict";
/* Serveur WebSocket minimal, écrit à la main (poignée de main RFC 6455 + trames texte), sans la
   moindre dépendance externe (pas de paquet "ws") -- même philosophie "Node natif uniquement" que
   le reste du serveur (voir auth.js, qui réimplémente un JWT minimaliste au lieu d'utiliser une
   librairie). Sert UNIQUEMENT à POUSSER des instantanés vers les clients déjà connectés (voir
   server.js : diffusion à chaque tick, et immédiatement après un message de chat) -- toutes les
   actions de jeu continuent de passer par l'API HTTP existante, inchangée ; le WebSocket est un
   canal de LECTURE en plus pour le client, jamais un second chemin d'écriture.

   Ne gère que ce dont ce jeu a besoin : des messages texte JSON de petite taille dans les deux
   sens, plus les trames de contrôle de base (ping/pong/close). La fragmentation multi-trames est
   prise en charge en RÉCEPTION (au cas, rarissime pour de si petits messages, où le navigateur
   fragmenterait un envoi), mais le serveur n'émet lui-même jamais que des trames non fragmentées. */
const crypto = require("crypto");

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const AUTH_TIMEOUT_MS = 8000;

function acceptKeyFor(clientKey){
  return crypto.createHash("sha1").update(clientKey + WS_GUID).digest("base64");
}

function encodeFrame(payload, opcode){
  opcode = opcode==null ? 0x1 : opcode; // texte par défaut
  const payloadBuf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf8");
  const len = payloadBuf.length;
  let header;
  if(len < 126){
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode; // FIN=1, pas de fragmentation côté serveur
    header[1] = len; // MASK=0 : un serveur n'a jamais le droit de masquer ses trames (RFC 6455)
  } else if(len < 65536){
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payloadBuf]);
}

/* Essaie d'extraire UNE trame complète en tête de `buf` (les données TCP arrivent en morceaux
   arbitraires, qui ne coïncident pas forcément avec les limites de trame). Renvoie null si `buf`
   ne contient pas encore assez d'octets pour une trame entière -- on rappellera cette fonction
   dès que davantage de données seront arrivées, sans rien perdre de ce qui est déjà là. */
function tryParseFrame(buf){
  if(buf.length < 2) return null;
  const b0 = buf[0], b1 = buf[1];
  const fin = (b0 & 0x80) !== 0;
  const opcode = b0 & 0x0f;
  const masked = (b1 & 0x80) !== 0;
  let len = b1 & 0x7f;
  let offset = 2;
  if(len === 126){
    if(buf.length < offset+2) return null;
    len = buf.readUInt16BE(offset); offset += 2;
  } else if(len === 127){
    if(buf.length < offset+8) return null;
    len = Number(buf.readBigUInt64BE(offset)); offset += 8; // messages de jeu : jamais assez gros pour dépasser Number.MAX_SAFE_INTEGER
  }
  let maskKey = null;
  if(masked){
    if(buf.length < offset+4) return null;
    maskKey = buf.slice(offset, offset+4); offset += 4;
  }
  if(buf.length < offset+len) return null;
  let payload = buf.slice(offset, offset+len);
  if(masked){
    const unmasked = Buffer.alloc(len);
    for(let i=0;i<len;i++) unmasked[i] = payload[i] ^ maskKey[i%4];
    payload = unmasked;
  }
  return { frame: { fin, opcode, payload }, rest: buf.slice(offset+len) };
}

/* Attache le serveur WS à un serveur HTTP existant (voir server.js) : intercepte l'évènement
   "upgrade" pour le chemin /ws UNIQUEMENT -- tout le reste (fichiers statiques, /api/*) continue de
   passer par le serveur HTTP normal, inchangé. onAuth(token) doit renvoyer un nom d'utilisateur
   valide, ou une valeur fausse si le jeton est invalide/expiré (même vérification que l'API HTTP,
   voir authenticate() dans server.js). */
function attach(httpServer, { onAuth }){
  const socketsByUser = new Map(); // username -> Set<net.Socket>

  function removeSocket(username, socket){
    const set = socketsByUser.get(username);
    if(!set) return;
    set.delete(socket);
    if(set.size===0) socketsByUser.delete(username);
  }

  httpServer.on("upgrade", (req, socket, head) => {
    let pathname;
    try{ pathname = new URL(req.url, "http://x").pathname; }catch(e){ socket.destroy(); return; }
    if(pathname !== "/ws"){ socket.destroy(); return; }
    const key = req.headers["sec-websocket-key"];
    if(!key || (req.headers["upgrade"]||"").toLowerCase()!=="websocket"){ socket.destroy(); return; }

    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n"+
      "Upgrade: websocket\r\n"+
      "Connection: Upgrade\r\n"+
      "Sec-WebSocket-Accept: "+acceptKeyFor(key)+"\r\n\r\n"
    );

    let username = null; // renseigné une fois le premier message {type:"auth", token} validé
    let buf = (head && head.length) ? Buffer.from(head) : Buffer.alloc(0);
    let fragmentChunks = null; // pour les rares messages fragmentés (voir tryParseFrame)

    const authTimer = setTimeout(()=>{ if(!username) socket.destroy(); }, AUTH_TIMEOUT_MS);

    function handleMessage(text){
      let msg;
      try{ msg = JSON.parse(text); }catch(e){ return; }
      if(!username){
        if(msg && msg.type==="auth" && msg.token){
          const u = onAuth(msg.token);
          if(u){
            username = u;
            clearTimeout(authTimer);
            if(!socketsByUser.has(username)) socketsByUser.set(username, new Set());
            socketsByUser.get(username).add(socket);
            try{ socket.write(encodeFrame(JSON.stringify({type:"authOk"}))); }catch(e){}
          } else {
            try{ socket.write(encodeFrame(JSON.stringify({type:"authError"}))); }catch(e){}
            socket.destroy();
          }
        }
        return; // tout message reçu avant authentification, autre qu'un "auth", est ignoré
      }
      // Aucun message client authentifié n'a d'effet aujourd'hui : le jeu reste entièrement piloté
      // par l'API HTTP existante (voir en-tête de fichier). Ce canal ne sert qu'à pousser des
      // instantanés VERS le client -- {type:"ping"} est simplement toléré sans effet, au cas où le
      // client voudrait un jour un keep-alive applicatif au-dessus du ping/pong du protocole.
    }

    socket.on("data", (chunk) => {
      buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
      let parsed;
      while((parsed = tryParseFrame(buf)) !== null){
        buf = parsed.rest;
        const { frame } = parsed;
        if(frame.opcode === 0x8){ socket.end(); return; } // close
        if(frame.opcode === 0x9){ try{ socket.write(encodeFrame(frame.payload, 0xA)); }catch(e){} continue; } // ping -> pong
        if(frame.opcode === 0xA) continue; // pong reçu : rien à faire
        if(frame.opcode === 0x1 || frame.opcode === 0x2){
          if(frame.fin) handleMessage(frame.payload.toString("utf8"));
          else fragmentChunks = [frame.payload];
        } else if(frame.opcode === 0x0 && fragmentChunks){
          fragmentChunks.push(frame.payload);
          if(frame.fin){
            handleMessage(Buffer.concat(fragmentChunks).toString("utf8"));
            fragmentChunks = null;
          }
        }
      }
    });
    socket.on("error", ()=>{ clearTimeout(authTimer); if(username) removeSocket(username, socket); });
    socket.on("close", ()=>{ clearTimeout(authTimer); if(username) removeSocket(username, socket); });
  });

  return {
    isConnected(username){ const s = socketsByUser.get(username); return !!s && s.size>0; },
    connectedUsernames(){ return Array.from(socketsByUser.keys()); },
    sendTo(username, obj){
      const set = socketsByUser.get(username);
      if(!set || !set.size) return false;
      const frame = encodeFrame(JSON.stringify(obj));
      for(const s of set){ try{ s.write(frame); }catch(e){} }
      return true;
    }
  };
}

module.exports = { attach };
