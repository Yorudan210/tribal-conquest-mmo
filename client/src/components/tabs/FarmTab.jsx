import { useMemo, useState } from "react";
import { useGame } from "../../GameContext.jsx";
import { useToast } from "../../ToastContext.jsx";
import { TROOP_ORDER, TROOPS } from "../../gameData.js";
import { villageTagBadgeSvg } from "../../legacy/art.js";
import Audio from "../../legacy/audio.js";

// Indexés par t.tier (0-4), pas par nom — voir la même définition dans l'ancien index.html.
const TIER_CLASS = ["weak","weak","medium","strong","strong"];
const TIER_LABEL = ["Très faible","Faible","Moyen","Fort","Très fort"];

function formatDurationShort(sec){
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  if(h>0) return `${h}h${String(m).padStart(2,"0")}`;
  if(m>0) return `${m}min${String(s).padStart(2,"0")}`;
  return `${s}s`;
}

function emptyComposition(){
  const c = {};
  for(const k of TROOP_ORDER) if(k!=="noble") c[k]=0;
  return c;
}

// Porte fidèlement l'assistant de pillage (renderFarm/attachFarmHandlers de l'ancien index.html,
// déjà corrigé cette session pour le bug de re-cochage automatique — voir farmDeselectedIds) : la
// composition de troupes, le rayon de recherche et la sélection vivent maintenant en state React,
// qui persiste naturellement entre deux rendus déclenchés par le WebSocket/sondage — exactement le
// bug qu'on avait dû corriger à la main côté ancien DOM disparaît de lui-même avec un vrai state.
export default function FarmTab(){
  const { snapshot, applySnapshot, call } = useGame();
  const toast = useToast();
  const v = snapshot.village;

  const [composition, setComposition] = useState(emptyComposition);
  const [radius, setRadius] = useState(15);
  const [deselectedIds, setDeselectedIds] = useState(() => new Set());
  const [sending, setSending] = useState(false);

  const targets = useMemo(() => {
    const busyTargets = new Set(
      (snapshot.missions||[]).filter(m => m.kind==="attack" && !m.resolveDone && m.sourceVillageId===v.id).map(m => m.targetId)
    );
    return (snapshot.villages||[])
      .filter(t => t.owner==="barbarian")
      .map(t => {
        const dx=t.x-v.x, dy=t.y-v.y;
        return { ...t, dist: Math.sqrt(dx*dx+dy*dy), busy: busyTargets.has(t.id) };
      })
      .filter(t => t.dist<=radius)
      .sort((a,b)=>a.dist-b.dist);
  }, [snapshot.missions, snapshot.villages, v.id, v.x, v.y, radius]);

  const available = targets.filter(t => !t.busy);
  const selectedIds = available.filter(t => !deselectedIds.has(t.id)).map(t => t.id);

  const compKeys = Object.keys(composition).filter(k => composition[k]>0);
  let maxByTroops = compKeys.length ? Infinity : 0;
  for(const k of compKeys) maxByTroops = Math.min(maxByTroops, Math.floor((v.troops[k]||0)/composition[k]));
  if(!Number.isFinite(maxByTroops)) maxByTroops = 0;
  const willSend = Math.min(maxByTroops, selectedIds.length);

  let maxSpeed = 0;
  for(const k of compKeys) maxSpeed = Math.max(maxSpeed, TROOPS[k].speed);
  let moveMult = 1;
  for(const e of (snapshot.serverEvents||[])) if(e.affects==="move") moveMult *= e.multiplier;
  function estimateTravelSec(dist){
    if(!maxSpeed) return null;
    return Math.max(4, Math.round(dist*maxSpeed/moveMult));
  }

  function setTroopCount(k, n){
    setComposition(c => ({ ...c, [k]: Math.max(0, Math.floor(Number(n)||0)) }));
  }
  function toggleSelected(id, selected){
    setDeselectedIds(prev => {
      const next = new Set(prev);
      if(selected) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAll(){ setDeselectedIds(new Set()); }
  function selectNone(){ setDeselectedIds(new Set(available.map(t=>t.id))); }

  // Porte le handler du bouton d'envoi tel quel : contrairement aux autres actions (voir doAction
  // dans GameContext), celle-ci compose un message de succès VARIABLE selon la réponse du serveur
  // (nombre réellement envoyé / ignoré faute de troupes ou déjà en cours), donc appelle l'API et
  // affiche le toast elle-même plutôt que de passer par un successMsg fixe.
  async function sendFarm(){
    const ids = available.filter(t => !deselectedIds.has(t.id)).map(t => t.id);
    if(!ids.length) return;
    const comp = {};
    for(const k in composition) if(composition[k]>0) comp[k]=composition[k];
    if(!Object.keys(comp).length){ toast("Composez au moins une troupe pour le modèle de pillage."); return; }
    setSending(true);
    try{
      const data = await call("/api/farm/send", "POST", { targetIds: ids, troops: comp });
      applySnapshot(data.snapshot);
      const parts = [];
      if(data.sent) parts.push(`🌾 ${data.sent} pillage${data.sent>1?"s":""} envoyé${data.sent>1?"s":""}`);
      if(data.skippedBusy) parts.push(`${data.skippedBusy} déjà en cours`);
      if(data.skippedTroops) parts.push(`${data.skippedTroops} faute de troupes`);
      toast(parts.length ? parts.join(" · ") : "Aucun pillage envoyé.");
      if(data.sent) Audio.SFX.depart();
    }catch(err){ toast("⚠️ "+err.message); }
    finally{ setSending(false); }
  }

  return (
    <div>
      <h2>🌾 Assistant de pillage</h2>
      <p className="muted small">
        Compose un modèle de troupes une bonne fois pour toutes, puis envoie-le en un clic vers tous les villages
        barbares à portée de <b>{v.name}</b> — plus besoin de remplir le formulaire d'attaque cible par cible.
        Ne cible jamais un autre joueur, même par erreur. Clique une ligne (ou sa case) pour l'exclure de l'envoi :
        ce choix est conservé même pendant les mises à jour automatiques.
      </p>

      <div className="card" style={{marginBottom:14}}>
        <div className="flex-between" style={{alignItems:"flex-start", flexWrap:"wrap", gap:18}}>
          <div>
            <div className="small muted" style={{marginBottom:6}}>Modèle de pillage</div>
            <div className="inputs">
              {TROOP_ORDER.filter(k=>k!=="noble").map(k => {
                const avail = v.troops[k]||0;
                return (
                  <div className="inp" key={k}>
                    <span>{TROOPS[k].name}</span>
                    <input type="number" min={0} max={avail} value={composition[k]||0}
                      onChange={e=>setTroopCount(k, e.target.value)} />
                    <a href="#" style={{fontSize:10}} onClick={(e)=>{e.preventDefault(); setTroopCount(k, avail);}}>max {avail}</a>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div className="small muted" style={{marginBottom:6}}>Rayon de recherche</div>
            <div className="inp">
              <input type="number" min={1} max={500} style={{width:70}} value={radius}
                onChange={e=>setRadius(Math.max(1, Math.min(500, Math.floor(Number(e.target.value)||15))))} /> champs
            </div>
          </div>
        </div>
      </div>

      <div className="flex-between" style={{alignItems:"center", flexWrap:"wrap", gap:10, marginBottom:8}}>
        <p className="small" style={{margin:0}}>
          {targets.length} village{targets.length>1?"s":""} barbare{targets.length>1?"s":""} à portée ·{" "}
          <b>{selectedIds.length}</b> sélectionné{selectedIds.length>1?"s":""} (sur {available.length} disponible{available.length>1?"s":""}) ·
          le modèle actuel permet d'en viser <b>{maxByTroops===Infinity?"—":maxByTroops}</b> à la fois avec les troupes présentes ici.
        </p>
        <div style={{display:"flex", gap:8}}>
          <button className="small" type="button" disabled={available.length===0} onClick={selectAll}>Tout sélectionner</button>
          <button className="small" type="button" disabled={available.length===0} onClick={selectNone}>Tout désélectionner</button>
        </div>
      </div>

      <button className="primary" disabled={willSend<=0 || sending} onClick={sendFarm}>
        🌾 Piller la sélection ({willSend})
      </button>

      <table style={{marginTop:12}}>
        <thead><tr><th></th><th>Village</th><th>Distance</th><th>Rang</th><th>Trajet</th></tr></thead>
        <tbody>
          {targets.length ? targets.map(t => {
            const tagKey = (snapshot.villageTags||{})[t.id];
            const checked = !t.busy && !deselectedIds.has(t.id);
            const etaSec = t.busy ? null : estimateTravelSec(t.dist);
            const etaHtml = t.busy ? "🚩 pillage en cours" : (etaSec==null ? "—" : `⏱️ ${formatDurationShort(etaSec)}`);
            return (
              <tr className={"farm-row"+(checked?" farm-row-selected":"")+(t.busy?" farm-row-busy":"")} key={t.id}
                onClick={(e)=>{ if(t.busy) return; if(e.target.tagName==="INPUT") return; toggleSelected(t.id, !checked); }}>
                <td>
                  <input type="checkbox" disabled={t.busy} checked={checked}
                    onChange={(e)=>toggleSelected(t.id, e.target.checked)} />
                </td>
                <td>
                  {tagKey ? (
                    <span className="village-tag-badge" style={{position:"static", display:"inline-block", width:14, height:14, verticalAlign:-2}}
                      dangerouslySetInnerHTML={{__html: villageTagBadgeSvg(tagKey)}} />
                  ) : null}{" "}
                  {t.name} <span className="small muted">({t.x}|{t.y})</span>
                </td>
                <td>{t.dist.toFixed(1)}</td>
                <td><span className={"tag "+TIER_CLASS[t.tier]}>{TIER_LABEL[t.tier]}</span></td>
                <td className="small muted">{etaHtml}</td>
              </tr>
            );
          }) : (
            <tr><td colSpan={5} className="muted small">Aucun village barbare dans ce rayon — augmentez le rayon de recherche.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
