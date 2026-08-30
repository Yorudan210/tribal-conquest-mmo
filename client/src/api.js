// Petit client HTTP vers l'API du serveur de jeu (server/server.js) — porte fidèlement apiCall()
// de l'ancien index.html : mêmes en-têtes, même gestion d'erreur (le serveur répond {error:"..."}
// avec un code HTTP non 2xx, qu'on transforme en Error() lisible par l'appelant).
export async function apiCall(path, method, body, token){
  const opts = { method, headers:{} };
  if(token) opts.headers["Authorization"] = "Bearer " + token;
  if(body !== undefined){ opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  const res = await fetch(path, opts);
  let data = {};
  try{ data = await res.json(); }catch(e){}
  if(!res.ok) throw new Error(data.error || ("Erreur serveur (" + res.status + ")"));
  return data;
}
