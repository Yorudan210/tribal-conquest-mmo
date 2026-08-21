/* Authentification maison : hachage de mot de passe (PBKDF2, natif Node,
   pas besoin de bcrypt) + jetons de session signés (HMAC-SHA256, façon JWT
   minimaliste). Aucune dépendance externe requise. */
"use strict";
const crypto = require("crypto");

const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = "sha256";

function hashPassword(password){
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash){
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString("hex");
  const a = Buffer.from(hash, "hex"), b = Buffer.from(expectedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function base64url(buf){
  return buf.toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function fromBase64url(str){
  str = str.replace(/-/g,"+").replace(/_/g,"/");
  while(str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

function signToken(payload, secret, ttlSeconds){
  const body = { ...payload, exp: Math.floor(Date.now()/1000) + (ttlSeconds||60*60*24*30) };
  const bodyB64 = base64url(Buffer.from(JSON.stringify(body)));
  const sig = base64url(crypto.createHmac("sha256", secret).update(bodyB64).digest());
  return bodyB64 + "." + sig;
}

function verifyToken(token, secret){
  if(!token || typeof token !== "string" || !token.includes(".")) return null;
  const [bodyB64, sig] = token.split(".");
  const expectedSig = base64url(crypto.createHmac("sha256", secret).update(bodyB64).digest());
  const a = Buffer.from(sig||""), b = Buffer.from(expectedSig);
  if(a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let body;
  try{ body = JSON.parse(fromBase64url(bodyB64).toString("utf8")); } catch(e){ return null; }
  if(!body.exp || Math.floor(Date.now()/1000) > body.exp) return null;
  return body;
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
