#!/usr/bin/env node
"use strict";
/* ============================================================================
   "Build" du client React — SANS npm/Vite (le bac à sable n'a pas accès au
   registre npm, voir la conversation qui a mené à ce choix). On utilise
   @babel/standalone (vendorisé une fois pour toutes dans public/vendor/babel.min.js,
   il fonctionne aussi bien en Node — CommonJS — que dans un navigateur — UMD) comme
   simple transformateur JSX -> React.createElement, appliqué à chaque fichier
   source de client/src/. Le reste (imports/exports ES, résolution de modules)
   n'est PAS touché : les fichiers compilés restent des modules ES natifs, servis
   tels quels par le navigateur (<script type="module">, voir public/app.html),
   sans bundler ni minification — un fichier HTTP par module, comme le ferait le
   serveur de dev de Vite en mode non-bundlé.

   Usage : node scripts/build-client.js
   Source : client/src/ (récursif) -- fichiers .js/.jsx
   Sortie : public/app/ (récursif) -- fichiers .js/.jsx  (même arborescence, mêmes extensions — donc
            les chemins d'import relatifs déjà écrits dans le source, ex.
            `from "./GameContext.jsx"`, restent valides sans aucune réécriture). */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(ROOT, "client", "src");
const OUT_DIR = path.join(ROOT, "public", "app");
const Babel = require(path.join(ROOT, "public", "vendor", "babel.min.js"));

function walk(dir){
  let out = [];
  for(const name of fs.readdirSync(dir)){
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if(st.isDirectory()) out = out.concat(walk(full));
    else if(/\.(jsx?|css)$/.test(name)) out.push(full);
  }
  return out;
}

function compileOne(srcFile){
  const rel = path.relative(SRC_DIR, srcFile);
  const outFile = path.join(OUT_DIR, rel);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  if(srcFile.endsWith(".css")){
    fs.copyFileSync(srcFile, outFile);
    return { rel, bytes: fs.statSync(outFile).size, jsx: false };
  }
  const source = fs.readFileSync(srcFile, "utf8");
  const result = Babel.transform(source, {
    filename: rel,
    presets: [["react", { runtime: "classic" }]],
    // Uniquement la transformation JSX -> React.createElement : import/export ES et le reste de la
    // syntaxe moderne (déjà supportée nativement par tout navigateur récent) ne sont PAS touchés.
    sourceType: "module"
  });
  fs.writeFileSync(outFile, result.code, "utf8");
  return { rel, bytes: Buffer.byteLength(result.code), jsx: /<[A-Za-z]/.test(source) };
}

function main(){
  if(!fs.existsSync(SRC_DIR)){ console.error("Introuvable :", SRC_DIR); process.exit(1); }
  const files = walk(SRC_DIR);
  if(!files.length){ console.error("Aucun fichier source trouvé dans", SRC_DIR); process.exit(1); }
  let total = 0;
  for(const f of files){
    const info = compileOne(f);
    total += info.bytes;
    console.log((info.jsx ? "[jsx] " : "[js]  ") + info.rel + " -> " + info.bytes + " o");
  }
  console.log(`\n${files.length} fichier(s) compilé(s), ${total} octets au total -> ${path.relative(ROOT, OUT_DIR)}/`);
}

main();
