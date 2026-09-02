import { useRef } from "react";
import { useGame } from "../../GameContext.jsx";
import { BUILDINGS, TROOPS, TROOP_ORDER, INFANTRY, CAVALRY, ARCHERS, clamp, farmCap } from "../../gameData.js";
import { fmt, fmtTime, vTrainTime, nobleCount, NOBLE_CAP_PER_VILLAGE, popUsed } from "../../formulas.js";
import { troopBadgeSvg } from "../../legacy/art.js";

// Porte renderBarracks() : entraînement/licenciement de troupes. Les compteurs (nombre à
// entraîner/licencier) restent des <input> non contrôlés (comme dans l'ancien index.html, lu via
// getElementById au clic) — ici via une ref par ligne, ce qui évite un état React par troupe pour
// une simple valeur jetable relue une fois au clic.
export default function BarracksTab(){
  const { snapshot, username, adminSpeed, doAction, call } = useGame();
  const v = snapshot.village;

  if((v.buildings.barracks||0) < 1){
    return (
      <div>
        <h2>Caserne</h2>
        <p className="muted">Construisez d'abord une <b>Caserne</b> (onglet Bâtiments) pour pouvoir entraîner des troupes.</p>
      </div>
    );
  }

  function queueTrain(key, count){
    count = Math.floor(count);
    if(!count || count<=0) return;
    const t = TROOPS[key];
    doAction(()=>call("/api/train","POST",{key, count}), count+" "+t.name+"(s) mis en formation.", "trainQueued");
  }

  function disbandTroops(key, count){
    count = Math.floor(count);
    if(!count || count<=0) return;
    const t = TROOPS[key];
    const have = v.troops[key]||0;
    if(count>have){ return; } // le bouton est de toute façon borné par max=have
    if(!confirm("Licencier "+count+" "+t.name+"(s) ? Ces troupes seront définitivement détruites, sans remboursement.")) return;
    doAction(()=>call("/api/troops/disband","POST",{key, count}), count+" "+t.name+"(s) licencié(s).", null);
  }

  return (
    <div>
      <h2>Caserne (niv. {v.buildings.barracks})</h2>
      <p className="muted small">⚔️ attaque · 🛡️ défense infanterie/cavalerie/archers · 🎒 capacité de pillage · 🐎 vitesse (plus bas = plus rapide) · ⏱ temps d'entraînement par unité à ce niveau de Caserne (plus la Caserne est haute, plus l'entraînement est rapide)</p>
      <p className="muted small">La puissance d'une attaque se répartit entre Infanterie/Cavalerie/Archers selon sa composition, et chaque troupe défensive résiste différemment à chacun de ces trois types (barres ci-dessous, 0-100) : ce n'est pas un triangle strict "qui bat qui", mais des résistances asymétriques — par exemple l'Archer défend très mal face à d'autres archers (🏹 5) mais bien contre l'infanterie et la cavalerie.</p>
      <div className="troops-list">
        {TROOP_ORDER.map(k => (
          <TroopRow key={k} k={k} v={v} snapshot={snapshot} username={username} adminSpeed={adminSpeed}
            onTrain={queueTrain} onDisband={disbandTroops} />
        ))}
      </div>
    </div>
  );
}

function troopTypeChip(k){
  if(INFANTRY.includes(k)) return <span className="type-chip type-inf" title="Type d'attaque : Infanterie">🗡️ Infanterie</span>;
  if(CAVALRY.includes(k)) return <span className="type-chip type-cav" title="Type d'attaque : Cavalerie">🐎 Cavalerie</span>;
  if(ARCHERS.includes(k)) return <span className="type-chip type-arch" title="Type d'attaque : Archers">🏹 Archers</span>;
  return null;
}

function TriangleBar({ cls, label, val }){
  return (
    <div className="ttri-row">
      <span className="ttri-lbl">{label}</span>
      <div className="ttri-bar"><div className={"ttri-fill "+cls} style={{width: clamp(val,0,100)+"%"}} /></div>
      <span className="ttri-val">{val}</span>
    </div>
  );
}

function TroopRow({ k, v, snapshot, username, adminSpeed, onTrain, onDisband }){
  const t = TROOPS[k];
  const trainRef = useRef(null);
  const disbandRef = useRef(null);
  const lockedEntries = Object.entries(t.requires).filter(([rk,rv]) => (v.buildings[rk]||0) < rv);
  const locked = lockedEntries.length>0;
  const home = v.troops[k]||0;

  // Quantité maximale réellement finançable MAINTENANT pour cette troupe : le minimum entre ce que
  // permettent le bois/l'argile/le fer disponibles et la population libre (capacité de la Ferme moins
  // popUsed, même formule que la barre de population de la Sidebar -- voir doTrain, gameLogic.js, côté
  // serveur, qui applique exactement ces mêmes contraintes et refuse tout l'ordre si l'une d'elles est
  // dépassée). Pour le Noble, contrainte supplémentaire : au plus NOBLE_CAP_PER_VILLAGE vivants/en
  // formation à la fois dans ce village.
  const freePop = farmCap(v.buildings.farm) - popUsed(snapshot, username);
  const maxByWood = t.cost.wood>0 ? Math.floor((v.resources.wood||0)/t.cost.wood) : Infinity;
  const maxByClay = t.cost.clay>0 ? Math.floor((v.resources.clay||0)/t.cost.clay) : Infinity;
  const maxByIron = t.cost.iron>0 ? Math.floor((v.resources.iron||0)/t.cost.iron) : Infinity;
  const maxByPop = t.pop>0 ? Math.floor(Math.max(0,freePop)/t.pop) : Infinity;
  let maxAffordable = Math.min(maxByWood, maxByClay, maxByIron, maxByPop);
  if(k==="noble") maxAffordable = Math.min(maxAffordable, Math.max(0, NOBLE_CAP_PER_VILLAGE-nobleCount(snapshot, username)));
  if(!Number.isFinite(maxAffordable)) maxAffordable = 0;
  maxAffordable = Math.max(0, maxAffordable);

  return (
    <div className="troop-row">
      <div className="thead">
        <div className="ticon" dangerouslySetInnerHTML={{__html: troopBadgeSvg(k)}} />
        <div className="tname">{t.name}</div>
        {troopTypeChip(k)}
      </div>
      <div className="stats-mini">⚔️{t.atk} 🛡️{t.defInf}/{t.defCav}/{t.defArch} 🎒{t.carry} 🐎{t.speed}</div>
      <div className="ttriangle">
        <TriangleBar cls="inf" label="🗡️ vs Inf." val={t.defInf} />
        <TriangleBar cls="cav" label="🐎 vs Cav." val={t.defCav} />
        <TriangleBar cls="arch" label="🏹 vs Arc." val={t.defArch} />
      </div>
      <div className="small">Stock : {home}</div>
      <div className="cost small">🪵{fmt(t.cost.wood)} 🧱{fmt(t.cost.clay)} ⛏️{fmt(t.cost.iron)} 👥{t.pop} ⏱ {fmtTime(vTrainTime(v, k, adminSpeed))}</div>
      {locked ? (
        <span className="req-note">Nécessite : {lockedEntries.map(([rk,rv]) => (BUILDINGS[rk]?BUILDINGS[rk].name:rk)+" niv. "+rv).join(", ")}</span>
      ) : (
        <>
          <div className="train-row-inputs" style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap"}}>
            <input type="number" min="0" max={maxAffordable} defaultValue="0" ref={trainRef} />
            <a href="#" className="small" style={{fontSize:10}} title="Remplir avec le nombre finançable maintenant (bois/argile/fer + population libre)"
              onClick={(e)=>{ e.preventDefault(); trainRef.current.value = maxAffordable; }}>max {fmt(maxAffordable)}</a>
            <button onClick={()=>onTrain(k, Number(trainRef.current.value))} disabled={maxAffordable<=0} title={maxAffordable<=0 ? "Ressources ou population insuffisantes pour entraîner cette troupe" : undefined}>Entraîner</button>
          </div>
          {t.note ? <div className="unit-note">{t.note}</div> : null}
          {k==="noble" ? (
            <div className="unit-note">Nobles vivants : {nobleCount(snapshot, username)} / {NOBLE_CAP_PER_VILLAGE} dans ce village (1 seul noble peut partir par attaque)</div>
          ) : null}
        </>
      )}
      {home>0 ? (
        <div className="disband-row">
          <input type="number" min="0" max={home} defaultValue="0" ref={disbandRef} />
          <button className="danger" title="Licencier définitivement, sans remboursement"
            onClick={()=>onDisband(k, Number(disbandRef.current.value))}>🗑️ Licencier</button>
        </div>
      ) : null}
    </div>
  );
}
