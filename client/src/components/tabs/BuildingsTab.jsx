import { useState } from "react";
import { useGame } from "../../GameContext.jsx";
import { BUILDINGS, BUILD_ORDER, buildCost } from "../../gameData.js";
import { fmt, fmtTime, canAffordAll, vBuildTime, estimateNow } from "../../formulas.js";
import { buildingIconSvg, buildingBadgeSvg } from "../../legacy/art.js";
import { renderVillageSceneMarkup } from "../../legacy/villageScene.js";

// Porte renderBuildings()/renderBuildingsList()/renderBuildMenuCard() : la scène SVG du village
// (générative, voir legacy/villageScene.js) est injectée telle quelle et ses clics captés par
// délégation d'évènement sur le conteneur (data-plot="...") — la liste compacte, le panneau de
// détail et les cartes de construction sont, eux, de vrai JSX interactif.
export default function BuildingsTab({ onGotoTab }){
  const { snapshot, adminSpeed, sparkleUntil, doAction, call } = useGame();
  const v = snapshot.village;
  const [selectedBuilding, setSelectedBuilding] = useState("hq");

  function queueBuild(key){
    const b = BUILDINGS[key];
    const nextLevel = (v.buildings[key]||0) + 1;
    doAction(()=>call("/api/build","POST",{key}), "Construction ajoutée : "+b.name+" niveau "+nextLevel, "buildQueued");
  }

  function onSceneClick(e){
    const el = e.target.closest("[data-plot]");
    if(el) setSelectedBuilding(el.dataset.plot);
  }

  const sel = BUILDINGS[selectedBuilding] ? selectedBuilding : "hq";
  const b = BUILDINGS[sel], lvl = v.buildings[sel]||0, atMax = lvl>=b.max;
  const pendingForSel = v.buildQueue.filter(o=>o.key===sel).length;
  const nextLevel = lvl+pendingForSel+1, maxed = nextLevel>b.max;
  const cost = maxed?null:buildCost(sel,nextLevel);
  const time = maxed?null:vBuildTime(v, sel, nextLevel, adminSpeed);
  const lockedReq = b.requires && Object.entries(b.requires).some(([rk,rv])=>(v.buildings[rk]||0)<rv);
  const affordable = cost && canAffordAll(snapshot, cost);
  const isEmpty = lvl<=0;
  const queueFull = v.buildQueue.length>=6;

  const sceneMarkup = renderVillageSceneMarkup(v, sel, sparkleUntil);

  return (
    <div>
      <h2>Votre village</h2>
      <p className="muted small">Cliquez sur un bâtiment du village (ou de la liste ci-contre) pour voir ses détails et l'améliorer.</p>

      <div className="village-top">
        <div className="village-scene" onClick={onSceneClick} dangerouslySetInnerHTML={{__html: sceneMarkup}} />
        <div className="box village-blist">
          <BuildingsList v={v} selectedBuilding={sel} onSelect={setSelectedBuilding} onGotoTab={onGotoTab} />
        </div>
      </div>

      <div className="building-detail box">
        <div className="icon-big" dangerouslySetInnerHTML={{__html: buildingIconSvg(sel, lvl)}} />
        <div className="info">
          <h3 style={{marginBottom:2}}>{b.name} <span style={{color:"var(--text-dim)", fontSize:13, fontWeight:"normal"}}>— niveau {lvl}{atMax?" (max)":""}</span></h3>
          <div className="desc" style={{marginBottom:8}}>{b.desc}</div>
          {maxed ? (
            <p className="muted small">{atMax ? "Niveau maximum atteint." : "Toutes les améliorations jusqu'au niveau maximum sont déjà en file."}</p>
          ) : (
            <>
              <div className="cost" style={{marginBottom:8}}>
                <span className={v.resources.wood<cost.wood?"short":""}>🪵 {fmt(cost.wood)}</span>
                <span className={v.resources.clay<cost.clay?"short":""}>🧱 {fmt(cost.clay)}</span>
                <span className={v.resources.iron<cost.iron?"short":""}>⛏️ {fmt(cost.iron)}</span>
                <span>⏱ {fmtTime(time)}</span>
              </div>
              {pendingForSel ? <div className="unit-note">{pendingForSel} déjà en file d'attente</div> : null}
              {lockedReq ? <div className="req-note">Nécessite : {Object.entries(b.requires).map(([rk,rv])=>BUILDINGS[rk].name+" niv. "+rv).join(", ")}</div> : null}
              {queueFull ? <div className="req-note">File de construction pleine (max 6).</div> : null}
              <button className="primary" disabled={!affordable||lockedReq||queueFull} onClick={()=>queueBuild(sel)}>
                {isEmpty?"Construire":"Améliorer"} → niveau {nextLevel}
              </button>
            </>
          )}
        </div>
      </div>

      {sel==="hq" ? (
        <div className="box" style={{marginTop:14}}>
          <h3>🏗️ Construire un bâtiment</h3>
          <p className="muted small">Depuis l'Hôtel de ville, lancez la construction ou l'amélioration de n'importe quel bâtiment sans avoir à cliquer dessus sur la carte.</p>
          <div className="grid-buildings">
            {BUILD_ORDER.filter(k=>k!=="hq").map(k => (
              <BuildMenuCard key={k} k={k} v={v} snapshot={snapshot} adminSpeed={adminSpeed} onBuild={queueBuild} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BuildingsList({ v, selectedBuilding, onSelect, onGotoTab }){
  const { serverTimeOffset } = useGame();
  const now = estimateNow(serverTimeOffset);
  const keys = [...BUILD_ORDER, "guildHall"];
  return (
    <>
      {keys.map(key => {
        const b = BUILDINGS[key], lvl = v.buildings[key]||0;
        const lockedReq = b.requires && Object.entries(b.requires).some(([rk,rv])=>(v.buildings[rk]||0)<rv);
        const isEmpty = lvl<=0;
        const frontQueued = v.buildQueue.length && v.buildQueue[0].key===key;
        const isGuildHall = key==="guildHall";
        const selected = !isGuildHall && selectedBuilding===key;
        let levelNode, upDisabled;
        if(frontQueued){
          const remain = Math.max(0, v.buildQueue[0].startAt+v.buildQueue[0].duration-now);
          levelNode = <span className="blevel muted">🔨 {fmtTime(remain)}</span>;
          upDisabled = true;
        } else if(lockedReq){
          levelNode = <span className="blevel muted">Verrouillé</span>;
          upDisabled = true;
        } else if(isEmpty){
          levelNode = <span className="blevel muted">Non construit</span>;
          upDisabled = false;
        } else {
          levelNode = <span className="blevel">Niv. {lvl}{lvl>=b.max?" (max)":""}</span>;
          upDisabled = false;
        }
        return (
          <div className={"blist-row"+(selected?" selected":"")} key={key}
            title={b.name+(isGuildHall?" — géré depuis l'onglet Guilde":"")}
            onClick={()=> isGuildHall ? (onGotoTab && onGotoTab("guild")) : onSelect(key)}
          >
            <span dangerouslySetInnerHTML={{__html: buildingBadgeSvg(key)}} />
            <span className={"bname"+((lockedReq&&!frontQueued)?" locked":"")}>{b.name}</span>
            {levelNode}
            <span className={"bup"+(upDisabled?" disabled":"")}>▲</span>
          </div>
        );
      })}
    </>
  );
}

function BuildMenuCard({ k, v, snapshot, adminSpeed, onBuild }){
  const b = BUILDINGS[k], lvl = v.buildings[k]||0, atMax = lvl>=b.max;
  const queuedCount = v.buildQueue.filter(q=>q.key===k).length;
  const nextLevel = lvl+queuedCount+1, maxed = nextLevel>b.max;
  const cost = maxed?null:buildCost(k,nextLevel);
  const time = maxed?null:vBuildTime(v, k, nextLevel, adminSpeed);
  const lockedReq = b.requires && Object.entries(b.requires).some(([rk,rv])=>(v.buildings[rk]||0)<rv);
  const affordable = cost && canAffordAll(snapshot, cost);
  const isEmpty = lvl<=0;
  const queueFull = v.buildQueue.length>=6;
  return (
    <div className="card">
      <div className="card-head">
        <div className="icon-mini" dangerouslySetInnerHTML={{__html: buildingIconSvg(k, lvl)}} />
        <h4>{b.name}<span className="small muted" style={{fontWeight:"normal"}}>niveau {lvl}{atMax?" (max)":""}</span></h4>
      </div>
      <div className="desc">{b.desc}</div>
      {maxed ? (
        <p className="muted small">{atMax ? "Niveau maximum atteint." : "Toutes les améliorations jusqu'au niveau maximum sont déjà en file."}</p>
      ) : (
        <>
          <div className="cost">
            <span className={v.resources.wood<cost.wood?"short":""}>🪵 {fmt(cost.wood)}</span>
            <span className={v.resources.clay<cost.clay?"short":""}>🧱 {fmt(cost.clay)}</span>
            <span className={v.resources.iron<cost.iron?"short":""}>⛏️ {fmt(cost.iron)}</span>
            <span>⏱ {fmtTime(time)}</span>
          </div>
          {lockedReq ? <div className="req-note">Nécessite : {Object.entries(b.requires).map(([rk,rv])=>BUILDINGS[rk].name+" niv. "+rv).join(", ")}</div> : null}
          {queuedCount ? <div className="unit-note">{queuedCount} déjà en file d'attente</div> : null}
          <button className="primary" disabled={!affordable||lockedReq||queueFull} onClick={()=>onBuild(k)}>
            {isEmpty?"Construire":"Améliorer"} → niveau {nextLevel}
          </button>
        </>
      )}
    </div>
  );
}
