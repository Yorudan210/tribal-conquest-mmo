import { useRef, useMemo } from "react";
import { useGame } from "../GameContext.jsx";
import { TROOP_ORDER, TROOPS, VILLAGE_TAGS, PERMANENT_FACTIONS } from "../gameData.js";
import { fmt, fmtTime, estimateNow, RES_ICON, RES_NAME } from "../formulas.js";
import { villageTagBadgeSvg, legendaryCampSceneSvg, villageSceneSvg } from "../legacy/art.js";
import { guildRelationFor, TIER_CLASS, TIER_LABEL, FACTION_PIN } from "../legacy/mapRender.js";

// Porte renderVillageActionModal()/wireVillageActionModal()/sendMission()/sendGift()/
// villageTagPickerHtml() : la fenêtre de mission ouverte en cliquant un village sur la carte (ou,
// plus tard, depuis l'onglet Empire). Rendue au niveau de GameScreen (comme dans l'ancien
// index.html, où #villageActionModal est un <div> de haut niveau, frère de #tabContent) pour rester
// ouverte même si on change d'onglet -- voir GameContext (selectedVillage/openVillageAction/
// closeVillageAction).
export default function VillageActionModal({ onGotoTab }){
  const { snapshot, username, scoutIntel, selectedVillage, closeVillageAction, doAction, call, applySnapshot } = useGame();
  if(selectedVillage==null) return null;
  const v = snapshot.village;

  function setTag(villageId, tag){
    call("/api/map/tag", "POST", { villageId, tag }).then(data => applySnapshot(data.snapshot)).catch(()=>{});
  }

  function switchVillage(villageId, goToBuildings){
    doAction(()=>call("/api/village/switch","POST",{villageId}), "🏰 Village actif changé.", null)
      .then(()=>{ if(goToBuildings && onGotoTab) onGotoTab("buildings"); })
      .catch(()=>{});
  }

  function sendMission(villageId, kind){
    const troops = {};
    let any = false;
    for(const k of TROOP_ORDER){
      const el = document.getElementById("send_"+villageId+"_"+k);
      if(!el) continue;
      let n = Math.floor(Number(el.value)||0);
      n = Math.max(0, Math.min(n, v.troops[k]||0));
      if(k==="noble") n = Math.min(n,1);
      if(n>0){ troops[k]=n; any=true; }
    }
    if(!any) return;
    if(kind==="scout" && !troops.scout) return;
    const target = snapshot.villages.find(t=>t.id===villageId);
    if(kind==="support"){
      doAction(()=>call("/api/support/send","POST",{targetId:villageId, troops}),
        "🤝 Renfort envoyé"+(target?(" vers "+target.name+" ("+target.x+"|"+target.y+")"):"")+".", "depart");
    } else {
      doAction(()=>call("/api/mission","POST",{targetId:villageId, kind, troops}),
        (kind==="attack"?"⚔️ Attaque":"🔭 Reconnaissance")+" envoyée"+(target?(" vers "+target.name+" ("+target.x+"|"+target.y+")"):"")+".", "depart");
    }
    closeVillageAction();
  }

  function sendGift(villageId){
    const target = snapshot.villages.find(t=>t.id===villageId);
    if(!target || !target.isPlayer) return;
    const amt = {};
    let any = false;
    for(const r of ["wood","clay","iron"]){
      const el = document.getElementById("gift_"+villageId+"_"+r);
      if(!el) continue;
      let n = Math.floor(Number(el.value)||0);
      n = Math.max(0, Math.min(n, Math.floor(v.resources[r]||0)));
      if(n>0){ amt[r]=n; any=true; }
    }
    if(!any) return;
    doAction(()=>call("/api/gift","POST",{username:target.owner, wood:amt.wood||0, clay:amt.clay||0, iron:amt.iron||0}),
      "🎁 Don envoyé à "+target.owner+".", null);
    closeVillageAction();
  }

  function onBackdropClick(e){ if(e.target.id==="villageActionBackdrop") closeVillageAction(); }

  // ---- Cas 1 : notre propre village (actif ou non) ----
  if(selectedVillage==="home"){
    return (
      <div className="tutorial-backdrop" id="villageActionBackdrop" onClick={onBackdropClick}>
        <div className="tutorial-card village-action-card">
          <div className="flex-between" style={{alignItems:"flex-start"}}>
            <h3 style={{margin:0}}>🏰 {v.name}</h3>
            <button title="Fermer" style={{padding:"4px 8px"}} onClick={closeVillageAction}>✖</button>
          </div>
          <p className="muted small">Votre village ({v.x}|{v.y}). Impossible de s'attaquer soi-même.</p>
          {v.resourceBonus ? (
            <p className="small" style={{color:"var(--gold)", background:"rgba(193,121,62,.16)", border:"1px solid rgba(193,121,62,.5)", borderRadius:8, padding:"6px 10px"}}>
              {RES_ICON[v.resourceBonus.res]} Gisement riche : +{Math.round(v.resourceBonus.pct*100)}% de production de {RES_NAME[v.resourceBonus.res].toLowerCase()} dans ce village précis.
            </p>
          ) : null}
          <TagPicker villageId={v.id} snapshot={snapshot} onSetTag={setTag} />
        </div>
      </div>
    );
  }

  const t = snapshot.villages.find(x=>x.id===selectedVillage);
  if(!t) return null;
  const dx=t.x-v.x, dy=t.y-v.y, dist=Math.sqrt(dx*dx+dy*dy);

  // ---- Cas 2 : un de nos AUTRES villages (conquis) ----
  if(t.owner===username){
    const isActive = t.id===v.id;
    return (
      <div className="tutorial-backdrop" id="villageActionBackdrop" onClick={onBackdropClick}>
        <div className="tutorial-card village-action-card">
          <div className="flex-between" style={{alignItems:"flex-start"}}>
            <h3 style={{margin:0}}>🚩 {t.name}</h3>
            <button title="Fermer" style={{padding:"4px 8px"}} onClick={closeVillageAction}>✖</button>
          </div>
          <div className="small muted" style={{margin:"2px 0 10px"}}>{t.x}|{t.y} · à {dist.toFixed(1)} champs <span className="tag weak">Conquis</span></div>
          <p className="muted small">Ce village vous appartient : vous pouvez l'améliorer et y entraîner des troupes comme votre premier village (ressources et troupes qui lui sont propres).</p>
          {t.resourceBonus ? (
            <p className="small" style={{color:"var(--gold)", background:"rgba(193,121,62,.16)", border:"1px solid rgba(193,121,62,.5)", borderRadius:8, padding:"6px 10px"}}>
              {RES_ICON[t.resourceBonus.res]} Gisement riche : +{Math.round(t.resourceBonus.pct*100)}% de production de {RES_NAME[t.resourceBonus.res].toLowerCase()} dans ce village précis.
            </p>
          ) : null}
          {isActive ? (
            <p className="sub small"><span className="tag strong">Village actif</span> — c'est celui que vous gérez actuellement (onglets Bâtiments/Caserne).</p>
          ) : (
            <button className="primary" onClick={()=>switchVillage(t.id, true)}>🏗️ Gérer ce village</button>
          )}
          <TagPicker villageId={t.id} snapshot={snapshot} onSetTag={setTag} />
        </div>
      </div>
    );
  }

  // ---- Cas 3 : village barbare ou d'un autre joueur ----
  const intel = scoutIntel[t.id];
  const rel = t.isPlayer ? guildRelationFor(snapshot, t.guildId) : null;
  const factionInfo = !t.isPlayer && t.faction ? FACTION_PIN[t.faction] : null;
  const raidersCfg = t.faction==="raiders" ? (PERMANENT_FACTIONS||{}).raiders : null;
  const legendaryCfg = t.faction==="legendary" ? (PERMANENT_FACTIONS||{}).legendary : null;
  // Illustration isométrique de la citadelle légendaire (Phase 2) -- mémoïsée sur l'id du village
  // ciblé pour ne pas régénérer ce gros bloc de markup SVG à chaque rafraîchissement du polling.
  const legendarySceneSvg = useMemo(() => (legendaryCfg ? legendaryCampSceneSvg() : null), [legendaryCfg, t.id]);
  // Même traitement pour tout autre campement ciblé (barbare simple, Armée Noire, brigands,
  // maraudeurs) : une scène isométrique générique choisie selon t.tier (0 à 4, voir
  // TIER_CLASS/TIER_LABEL) -- villageSceneSvg()/art.js, portée depuis la maquette de concept
  // "Villages modulables" validée séparément avec l'utilisateur. Jamais affichée pour un village
  // de joueur (t.isPlayer) : ces scènes racontent la croissance d'un campement, pas un foyer.
  const tierSceneSvg = useMemo(
    () => (!t.isPlayer && !legendaryCfg ? villageSceneSvg(t.tier) : null),
    [t.isPlayer, legendaryCfg, t.tier, t.id]
  );

  return (
    <div className="tutorial-backdrop" id="villageActionBackdrop" onClick={onBackdropClick}>
      <div className="tutorial-card village-action-card">
        <div className="flex-between" style={{alignItems:"flex-start"}}>
          <h3 style={{margin:0}}>{t.name}</h3>
          <button title="Fermer" style={{padding:"4px 8px"}} onClick={closeVillageAction}>✖</button>
        </div>
        {legendarySceneSvg ? (
          <div className="legendary-camp-scene" dangerouslySetInnerHTML={{__html: legendarySceneSvg}} />
        ) : tierSceneSvg ? (
          <div className={"village-scene"+(factionInfo?(" "+factionInfo.cls):"")} dangerouslySetInnerHTML={{__html: tierSceneSvg}} />
        ) : null}
        <div className="flex-between" style={{margin:"2px 0 8px"}}>
          <span className="muted small">{t.x}|{t.y} · à {dist.toFixed(1)} champs</span>
          {t.isPlayer ? (
            <span className={"tag "+(rel?rel.cls:"medium")}>Joueur : {t.owner}{rel?(" · "+rel.label):""}</span>
          ) : (
            <span style={{display:"flex", gap:6, flexWrap:"wrap"}}>
              <span className={"tag "+TIER_CLASS[t.tier]}>{TIER_LABEL[t.tier]}</span>
              {factionInfo ? <span className={"tag "+factionInfo.cls}>{factionInfo.icon} {factionInfo.label}</span> : null}
            </span>
          )}
        </div>
        <div className="sub small" style={{marginBottom:8}}>
          {intel
            ? `Vue lors d'une reconnaissance il y a ${fmtTime(Math.max(0,estimateNow()-intel.time))} : lanciers ${intel.troops.spear||0} · épéistes ${intel.troops.sword||0} · archers ${intel.troops.archer||0}${intel.loyalty!=null?(" · Loyauté "+Math.round(intel.loyalty)+"%"):""} — 🪵${fmt(intel.resources.wood)} 🧱${fmt(intel.resources.clay)} ⛏️${fmt(intel.resources.iron)}`
            : "Troupes et ressources inconnues — envoyez une reconnaissance pour les révéler."}
          {t.wallLevel>0 ? " · Muraille niv."+t.wallLevel : ""}
        </div>
        {t.resourceBonus ? (
          <p className="small" style={{color:"var(--gold)", background:"rgba(193,121,62,.16)", border:"1px solid rgba(193,121,62,.5)", borderRadius:8, padding:"6px 10px", margin:"0 0 8px"}}>
            {RES_ICON[t.resourceBonus.res]} Gisement riche : ce village produit +{Math.round(t.resourceBonus.pct*100)}% de {RES_NAME[t.resourceBonus.res].toLowerCase()}{t.isPlayer?"":" une fois conquis"} — le bonus reste propre à ce village.
          </p>
        ) : null}
        {raidersCfg && raidersCfg.boostOnVictory ? (
          <p className="small" style={{color:"#f0b060", background:"rgba(224,138,48,.14)", border:"1px solid rgba(224,138,48,.45)", borderRadius:8, padding:"6px 10px", margin:"0 0 8px"}}>
            {raidersCfg.boostOnVictory.icon} Victoire = {raidersCfg.boostOnVictory.name} : +{Math.round((raidersCfg.boostOnVictory.multiplier-1)*100)}% de production pendant {Math.round(raidersCfg.boostOnVictory.durationSec/3600)}h sur le village attaquant.
          </p>
        ) : null}
        {legendaryCfg ? (
          <p className="small" style={{color:"#f2c94c", background:"rgba(242,201,76,.12)", border:"1px solid rgba(242,201,76,.45)", borderRadius:8, padding:"6px 10px", margin:"0 0 8px"}}>
            👑 Campement légendaire : bien trop fort pour être vaincu par un seul village, et ses défenses ne se régénèrent jamais -- chaque assaut, gagné ou perdu, l'affaiblit durablement. Sa chute récompense tous les joueurs qui y auront pris part (succès Chasseur de légende).
            {t.contributorCount>0 ? ` Déjà entamé par ${t.contributorCount} joueur${t.contributorCount>1?"s":""} différent${t.contributorCount>1?"s":""}.` : ""}
          </p>
        ) : null}
        {t.isPlayer ? (
          <p className="small muted" style={{background:"rgba(0,0,0,.12)", border:"1px solid var(--border-soft)", borderRadius:8, padding:"6px 10px", margin:"8px 0"}}>
            🕊️ Ce monde est intégralement JcE : les attaques entre joueurs sont désactivées. Vous pouvez tout de même reconnaître ce village ou lui envoyer un soutien.
          </p>
        ) : null}
        <div className="send-form open">
          <div className="inputs">
            {TROOP_ORDER.map(k => {
              const avail = v.troops[k]||0;
              const maxSend = k==="noble" ? Math.min(avail,1) : avail;
              return (
                <div className="inp" key={k}>
                  <span>{TROOPS[k].name}</span>
                  <input type="number" min="0" max={maxSend} defaultValue="0" id={"send_"+t.id+"_"+k} />
                  <a href="#" style={{fontSize:10}} onClick={(e)=>{ e.preventDefault(); document.getElementById("send_"+t.id+"_"+k).value=maxSend; }}>max {maxSend}</a>
                </div>
              );
            })}
          </div>
          {t.isPlayer ? null : <button className="primary" onClick={()=>sendMission(t.id,"attack")}>⚔️ Attaquer</button>}
          <button onClick={()=>sendMission(t.id,"scout")}>🔭 Reconnaître</button>
          {t.isPlayer ? <button onClick={()=>sendMission(t.id,"support")}>🤝 Envoyer en soutien</button> : null}
        </div>
        {t.isPlayer ? (
          <div className="send-form open" style={{marginTop:14, paddingTop:10, borderTop:"1px dashed var(--border)"}}>
            <div className="small muted" style={{marginBottom:6}}>🎁 Donner des ressources (immédiat, sans marchand)</div>
            <div className="inputs" style={{display:"flex", gap:10, flexWrap:"wrap"}}>
              {["wood","clay","iron"].map(r => (
                <div className="inp" key={r}>{RES_ICON[r]}<input type="number" min="0" max={Math.floor(v.resources[r])} defaultValue="0" id={"gift_"+t.id+"_"+r} /></div>
              ))}
            </div>
            <button onClick={()=>sendGift(t.id)}>🎁 Envoyer le don</button>
          </div>
        ) : null}
        <TagPicker villageId={t.id} snapshot={snapshot} onSetTag={setTag} />
      </div>
    </div>
  );
}

function TagPicker({ villageId, snapshot, onSetTag }){
  const current = (snapshot.villageTags||{})[villageId] || "";
  return (
    <div className="village-tag-picker">
      <div className="small muted" style={{marginBottom:6}}>🏳️ Marqueur personnel (visible seulement par vous) :</div>
      <div className="tag-chip-row">
        <button type="button" className={"tag-chip tag-chip-clear"+(current?"":" active")} title="Aucun marqueur" onClick={()=>onSetTag(villageId,"")}>✕</button>
        {VILLAGE_TAGS.map(tg => (
          <button type="button" key={tg.key} className={"tag-chip"+(current===tg.key?" active":"")}
            title={tg.label} onClick={()=>onSetTag(villageId, tg.key)}
            dangerouslySetInnerHTML={{__html: villageTagBadgeSvg(tg.key)}} />
        ))}
      </div>
    </div>
  );
}
