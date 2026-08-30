import { useRef, useState } from "react";
import { useGame } from "../../GameContext.jsx";
import { BUILD_ORDER, BUILDINGS, TROOP_ORDER, TROOPS, buildCost } from "../../gameData.js";
import { fmt, fmtTime, estimateNow, vBuildTime, vTrainTime, canAffordAll, nobleCount, NOBLE_CAP_PER_VILLAGE, RES_ICON } from "../../formulas.js";

// Porte renderEmpire() et ses 5 sous-onglets (Aperçu/Notifications/Construction/Troupes/Envoi de
// ressources) + attachEmpireHandlers()/empireQueueBuild()/etc. : gestion groupée de tous les
// villages du compte sans avoir à basculer dessus un par un.
export default function EmpireTab(){
  const { snapshot, username, serverTimeOffset, adminSpeed, doAction, call, setActiveTab } = useGame();
  const villages = snapshot.myVillagesDetailed||[];
  const [subTab, setSubTab] = useState("apercu");
  const [selectedVillageId, setSelectedVillageId] = useState(null);
  const now = estimateNow(serverTimeOffset);

  function gotoVillage(villageId){
    doAction(()=>call("/api/village/switch","POST",{villageId}), "🏰 Village actif changé.", null)
      .then(()=>setActiveTab("buildings")).catch(()=>{});
  }

  const subTabs = [["apercu","📊 Aperçu"],["notifications","🔔 Notifications"],["construction","🏗️ Construction"],["troupes","⚔️ Troupes"],["resources","📦 Envoi de ressources"]];

  let content;
  if(subTab==="notifications") content = <NotificationsBox villages={villages} snapshot={snapshot} now={now} />;
  else if(subTab==="construction") content = <ConstructionBox villages={villages} snapshot={snapshot} now={now} adminSpeed={adminSpeed}
    selectedVillageId={selectedVillageId} onSelect={setSelectedVillageId} doAction={doAction} call={call} />;
  else if(subTab==="troupes") content = <TroopsBox villages={villages} snapshot={snapshot} now={now} adminSpeed={adminSpeed}
    selectedVillageId={selectedVillageId} onSelect={setSelectedVillageId} doAction={doAction} call={call} />;
  else if(subTab==="resources") content = <ResourcesBox villages={villages} snapshot={snapshot} doAction={doAction} call={call} />;
  else content = <OverviewBox villages={villages} snapshot={snapshot} now={now} username={username} onGoto={gotoVillage} />;

  return (
    <div>
      <h2>🏰 Gestion de l'empire</h2>
      <p className="muted small">Vue d'ensemble et gestion groupée de vos {villages.length} villages, sans avoir à basculer sur chacun d'eux.</p>
      <div style={{display:"flex", gap:8, flexWrap:"wrap", marginBottom:16}}>
        {subTabs.map(([k,label]) => (
          <button key={k} className={subTab===k?"primary":""} onClick={()=>setSubTab(k)}>{label}</button>
        ))}
      </div>
      {content}
    </div>
  );
}

function empireBuildQueueHead(v, now){
  if(!v.buildQueue.length) return <span className="muted">File vide</span>;
  const item = v.buildQueue[0];
  const b = BUILDINGS[item.key];
  const remain = Math.max(0, item.startAt+item.duration-now);
  return <>{b.name} → niv.{item.level} <span className="muted">({fmtTime(remain)})</span>{v.buildQueue.length>1?<span className="muted"> +{v.buildQueue.length-1}</span>:null}</>;
}
function empireTrainQueueHead(v, now){
  if(!v.trainQueue.length) return <span className="muted">File vide</span>;
  const o = v.trainQueue[0];
  const remain = Math.max(0, o.unitStartAt+o.unitDuration-now);
  return <>{TROOPS[o.troop].name} ×{o.count} <span className="muted">({fmtTime(remain)}/unité)</span>{v.trainQueue.length>1?<span className="muted"> +{v.trainQueue.length-1}</span>:null}</>;
}

function OverviewBox({ villages, snapshot, now, username, onGoto }){
  return (
    <>
      <p className="small muted">Cliquez sur un village pour y basculer directement (onglet Bâtiments).</p>
      <div style={{overflow:"auto"}}>
        <table><thead><tr><th>Village</th><th>HdV</th><th>Niveaux cumulés</th><th>Ressources</th><th>Pop.</th><th>Construction</th><th>Entraînement</th><th>Missions</th></tr></thead>
        <tbody>
          {villages.map(v => {
            const buildLevels = BUILD_ORDER.reduce((s,k)=>s+(v.buildings[k]||0),0);
            const outMissions = snapshot.missions.filter(m=>m.sourceVillageId===v.id && m.attackerUsername===username && !m.completed).length;
            const inThreats = (snapshot.incomingAttacks||[]).filter(m=>m.targetVillageId===v.id).length
              + snapshot.missions.filter(m=>m.kind==="raid" && !m.resolveDone && m.targetId===v.id).length;
            return (
              <tr key={v.id} style={{cursor:"pointer"}} onClick={()=>onGoto(v.id)}>
                <td>{v.isHome?"🏠 ":"🚩 "}{v.name}<div className="small muted">{v.x}|{v.y}</div></td>
                <td>{v.buildings.hq||0}</td>
                <td className="small">{buildLevels}</td>
                <td className="small">{RES_ICON.wood} {fmt(v.resources.wood)} · {RES_ICON.clay} {fmt(v.resources.clay)} · {RES_ICON.iron} {fmt(v.resources.iron)}<div className="muted">/ {fmt(v.resCap)}</div></td>
                <td className="small">{v.pop}/{v.popMax}</td>
                <td className="small">{empireBuildQueueHead(v, now)}</td>
                <td className="small">{empireTrainQueueHead(v, now)}</td>
                <td className="small">
                  {outMissions ? <>{outMissions} envoyée(s)<br/></> : null}
                  {inThreats ? <span style={{color:"#e05a4a"}}>⚠️ {inThreats} entrante(s)</span> : (outMissions?null:<span className="muted">—</span>)}
                </td>
              </tr>
            );
          })}
        </tbody></table>
      </div>
    </>
  );
}

function NotificationsBox({ villages, snapshot, now }){
  const items = [];
  for(const v of villages){
    for(const item of v.buildQueue){
      const b = BUILDINGS[item.key];
      items.push({ time:item.startAt+item.duration, icon:"🏗️", text:`${b.name} → niv. ${item.level} — ${v.name}` });
    }
    for(const o of v.trainQueue){
      items.push({ time:o.unitStartAt+o.unitDuration, icon:"⚔️", text:`${TROOPS[o.troop].name} — ${v.name} (encore ${o.count} unité(s) dans cette file)` });
    }
  }
  for(const m of (snapshot.incomingAttacks||[])){
    const label = m.kind==="scout" ? "🔭 Reconnaissance" : "⚔️ Attaque";
    items.push({ time:m.arriveAt, icon:"🚨", text:`${label} de ${m.attackerUsername} vers ${m.targetName||"?"}`, danger:true });
  }
  for(const m of snapshot.missions.filter(mm=>mm.kind==="raid" && !mm.resolveDone)){
    items.push({ time:m.arriveAt, icon:"🚨", text:`Riposte de ${m.raidSourceName||"village barbare"} approche`, danger:true });
  }
  items.sort((a,b)=>a.time-b.time);
  return (
    <div className="box">
      <h3 style={{marginTop:0}}>🔔 Notifications — tout votre empire</h3>
      <p className="small muted">Constructions et entraînements en cours, et attaques entrantes, sur TOUS vos villages, triés par ordre d'arrivée.</p>
      {items.length ? items.map((it,i) => (
        <div className="mission-item" key={i}>
          <div className="flex-between">
            <span>{it.icon} {it.text}</span>
            <span style={it.danger?{color:"#e05a4a"}:undefined}>{fmtTime(Math.max(0,it.time-now))}</span>
          </div>
        </div>
      )) : <div className="muted small">Rien à signaler pour l'instant.</div>}
    </div>
  );
}

function ConstructionBox({ villages, snapshot, now, adminSpeed, selectedVillageId, onSelect, doAction, call }){
  const selV = villages.find(v=>v.id===selectedVillageId) || villages.find(v=>v.id===snapshot.village.id) || villages[0];

  function queueBuild(villageId, key){
    doAction(()=>call("/api/build","POST",{key, villageId}), "🏗️ Construction lancée.", null);
  }
  function cancelBuild(villageId, index){
    doAction(()=>call("/api/build/cancel","POST",{index, villageId}), "Construction annulée, ressources remboursées.", null);
  }

  return (
    <>
      <div className="box" style={{marginBottom:14}}>
        <h3 style={{marginTop:0}}>🏗️ Construction — tous vos villages</h3>
        <p className="small muted">Cliquez sur un village pour lancer une construction directement, sans y basculer.</p>
        <div style={{maxHeight:220, overflow:"auto"}}>
          <table><thead><tr><th>Village</th><th>Coord.</th><th>HdV</th><th>File en cours</th><th>Occupation</th></tr></thead>
          <tbody>
            {villages.map(v => (
              <tr key={v.id} className={selV&&selV.id===v.id?"admin-selected":""} style={{cursor:"pointer"}} onClick={()=>onSelect(v.id)}>
                <td>{v.isHome?"🏠 ":"🚩 "}{v.name}</td>
                <td>{v.x}|{v.y}</td>
                <td>{v.buildings.hq||0}</td>
                <td className="small">{empireBuildQueueHead(v, now)}</td>
                <td>{v.buildQueue.length}/6</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </div>
      {selV ? <ConstructionEditor v={selV} now={now} adminSpeed={adminSpeed} onBuild={queueBuild} onCancel={cancelBuild} /> : null}
    </>
  );
}

function ConstructionEditor({ v, now, adminSpeed, onBuild, onCancel }){
  return (
    <div className="box">
      <h3 style={{marginTop:0}}>✏️ {v.isHome?"🏠 ":"🚩 "}{v.name} <span className="small muted" style={{fontWeight:"normal"}}>({v.x}|{v.y})</span></h3>
      <h4>File de construction</h4>
      {v.buildQueue.length ? v.buildQueue.map((item,i) => {
        const b = BUILDINGS[item.key];
        const timeLeft = Math.max(0, item.startAt+item.duration-now);
        const pct = 100*(1-timeLeft/item.duration);
        return (
          <div className="queue-item" key={i}>
            <div className="flex-between">
              <span>{b.name} → niv. {item.level}</span>
              <span>{fmtTime(timeLeft)} <a href="#" style={{marginLeft:6}} title="Annuler (remboursé)" onClick={(e)=>{ e.preventDefault(); onCancel(v.id, i); }}>✖</a></span>
            </div>
            <div className="bar-bg"><div className="bar-fill" style={{width:pct+"%"}} /></div>
          </div>
        );
      }) : <div className="muted small">File vide.</div>}
      <h4>Bâtiments</h4>
      <div className="grid-buildings">
        {BUILD_ORDER.filter(k=>k!=="hq").map(key => {
          const b = BUILDINGS[key], lvl = v.buildings[key]||0, atMax = lvl>=b.max;
          const queuedCount = v.buildQueue.filter(q=>q.key===key).length;
          const nextLevel = lvl+queuedCount+1, maxed = nextLevel>b.max;
          const cost = maxed?null:buildCost(key,nextLevel);
          const time = maxed?null:vBuildTime(v, key, nextLevel, adminSpeed);
          const lockedReq = b.requires && Object.entries(b.requires).some(([rk,rv])=>(v.buildings[rk]||0)<rv);
          const affordable = cost && v.resources.wood>=cost.wood && v.resources.clay>=cost.clay && v.resources.iron>=cost.iron;
          const isEmpty = lvl<=0;
          const queueFull = v.buildQueue.length>=6;
          return (
            <div className="card" key={key}>
              <div className="card-head"><h4>{b.name}<span className="small muted" style={{fontWeight:"normal"}}>niveau {lvl}{atMax?" (max)":""}</span></h4></div>
              <div className="desc">{b.desc}</div>
              {maxed ? (
                <p className="muted small">{atMax?"Niveau maximum atteint.":"Toutes les améliorations jusqu'au niveau maximum sont déjà en file."}</p>
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
                  <button className="primary" disabled={!affordable||lockedReq||queueFull} onClick={()=>onBuild(v.id, key)}>{isEmpty?"Construire":"Améliorer"} → niveau {nextLevel}</button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TroopsBox({ villages, snapshot, now, adminSpeed, selectedVillageId, onSelect, doAction, call }){
  const selV = villages.find(v=>v.id===selectedVillageId) || villages.find(v=>v.id===snapshot.village.id) || villages[0];

  function queueTrain(villageId, key, count){
    count = Math.floor(count);
    if(!count || count<=0) return;
    doAction(()=>call("/api/train","POST",{key, count, villageId}), "⚔️ Entraînement lancé.", null);
  }
  function cancelTrain(villageId, index){
    doAction(()=>call("/api/train/cancel","POST",{index, villageId}), "Entraînement annulé, ressources remboursées.", null);
  }
  function disbandTroops(villageId, key, count){
    count = Math.floor(count);
    if(!count || count<=0) return;
    if(!confirm("Licencier ces troupes ? Elles seront définitivement détruites, sans remboursement.")) return;
    doAction(()=>call("/api/troops/disband","POST",{key, count, villageId}), "🗑️ Troupes licenciées.", null);
  }

  return (
    <>
      <div className="box" style={{marginBottom:14}}>
        <h3 style={{marginTop:0}}>⚔️ Troupes — tous vos villages</h3>
        <p className="small muted">Cliquez sur un village pour entraîner ou licencier des troupes directement, sans y basculer.</p>
        <div style={{maxHeight:220, overflow:"auto"}}>
          <table><thead><tr><th>Village</th><th>Coord.</th><th>Pop.</th><th>File en cours</th><th>Troupes (total)</th></tr></thead>
          <tbody>
            {villages.map(v => {
              const totalTroops = TROOP_ORDER.reduce((s,k)=>s+(v.troops[k]||0),0);
              return (
                <tr key={v.id} className={selV&&selV.id===v.id?"admin-selected":""} style={{cursor:"pointer"}} onClick={()=>onSelect(v.id)}>
                  <td>{v.isHome?"🏠 ":"🚩 "}{v.name}</td>
                  <td>{v.x}|{v.y}</td>
                  <td>{v.pop}/{v.popMax}</td>
                  <td className="small">{empireTrainQueueHead(v, now)}</td>
                  <td>{totalTroops}</td>
                </tr>
              );
            })}
          </tbody></table>
        </div>
      </div>
      {selV ? <TroopsEditor v={selV} now={now} adminSpeed={adminSpeed} onTrain={queueTrain} onCancel={cancelTrain} onDisband={disbandTroops} /> : null}
    </>
  );
}

function TroopsEditor({ v, now, adminSpeed, onTrain, onCancel, onDisband }){
  if((v.buildings.barracks||0)<1){
    return (
      <div className="box">
        <h3 style={{marginTop:0}}>✏️ {v.isHome?"🏠 ":"🚩 "}{v.name} <span className="small muted" style={{fontWeight:"normal"}}>({v.x}|{v.y})</span></h3>
        <p className="muted small">Ce village n'a pas encore de Caserne : construisez-en une (sous-onglet Construction) pour pouvoir y entraîner des troupes.</p>
      </div>
    );
  }
  return (
    <div className="box">
      <h3 style={{marginTop:0}}>✏️ {v.isHome?"🏠 ":"🚩 "}{v.name} <span className="small muted" style={{fontWeight:"normal"}}>({v.x}|{v.y})</span> — Caserne niv. {v.buildings.barracks}</h3>
      <h4>File d'entraînement</h4>
      {v.trainQueue.length ? v.trainQueue.map((o,i) => {
        const timeLeft = Math.max(0, o.unitStartAt+o.unitDuration-now);
        const pct = 100*(1-timeLeft/o.unitDuration);
        return (
          <div className="queue-item" key={i}>
            <div className="flex-between">
              <span>{TROOPS[o.troop].name} ×{o.count}</span>
              <span>{fmtTime(timeLeft)} / unité <a href="#" style={{marginLeft:6}} title="Annuler (remboursé)" onClick={(e)=>{ e.preventDefault(); onCancel(v.id, i); }}>✖</a></span>
            </div>
            <div className="bar-bg"><div className="bar-fill" style={{width:pct+"%"}} /></div>
          </div>
        );
      }) : <div className="muted small">File vide.</div>}
      <h4>Troupes</h4>
      <p className="muted small">⏱ temps d'entraînement par unité au niveau de Caserne de <b>ce</b> village (plus elle est haute, plus l'entraînement est rapide).</p>
      {TROOP_ORDER.map(k => <EmpireTroopRow key={k} k={k} v={v} adminSpeed={adminSpeed} onTrain={onTrain} onDisband={onDisband} />)}
    </div>
  );
}

function EmpireTroopRow({ k, v, adminSpeed, onTrain, onDisband }){
  const t = TROOPS[k];
  const trainRef = useRef(null), disbandRef = useRef(null);
  const lockedEntries = Object.entries(t.requires).filter(([rk,rv]) => (v.buildings[rk]||0) < rv);
  const locked = lockedEntries.length>0;
  const home = v.troops[k]||0;
  const nobleAlive = k==="noble" ? (v.troops.noble||0)+v.trainQueue.filter(o=>o.troop==="noble").reduce((s,o)=>s+o.count,0) : 0;

  return (
    <div className="troop-row">
      <div className="tname">{t.name}</div>
      <div className="stats-mini">⚔️{t.atk} 🛡️{t.defInf}/{t.defCav}/{t.defArch} 🎒{t.carry} 🐎{t.speed}</div>
      <div className="small">Stock : {home}</div>
      <div className="cost small">🪵{fmt(t.cost.wood)} 🧱{fmt(t.cost.clay)} ⛏️{fmt(t.cost.iron)} 👥{t.pop} ⏱ {fmtTime(vTrainTime(v, k, adminSpeed))}</div>
      {locked ? (
        <span className="req-note">Nécessite : {lockedEntries.map(([rk,rv]) => (BUILDINGS[rk]?BUILDINGS[rk].name:rk)+" niv. "+rv).join(", ")}</span>
      ) : (
        <>
          <input type="number" min="0" defaultValue="0" ref={trainRef} />
          <button onClick={()=>onTrain(v.id, k, Number(trainRef.current.value))}>Entraîner</button>
          {t.note ? <div className="unit-note">{t.note}</div> : null}
          {k==="noble" ? <div className="unit-note">Nobles vivants : {nobleAlive} / {NOBLE_CAP_PER_VILLAGE} dans ce village (1 seul noble peut partir par attaque)</div> : null}
        </>
      )}
      {home>0 ? (
        <div className="disband-row">
          <input type="number" min="0" max={home} defaultValue="0" ref={disbandRef} />
          <button className="danger" title="Licencier définitivement, sans remboursement" onClick={()=>onDisband(v.id, k, Number(disbandRef.current.value))}>🗑️ Licencier</button>
        </div>
      ) : null}
    </div>
  );
}

function ResourcesBox({ villages, snapshot, doAction, call }){
  if(villages.length<2) return <p className="muted small">Il vous faut au moins 2 villages pour transférer des ressources entre eux.</p>;
  const activeId = snapshot.village.id;
  const defaultTargetId = (villages.find(v=>v.id!==activeId)||villages[0]).id;
  const sourceRef = useRef(null), targetRef = useRef(null);
  const woodRef = useRef(null), clayRef = useRef(null), ironRef = useRef(null);

  function transfer(){
    const srcId = sourceRef.current.value, tgtId = targetRef.current.value;
    if(!srcId || !tgtId || srcId===tgtId) return;
    const source = villages.find(v=>v.id===srcId);
    const target = (snapshot.myVillages||[]).find(mv=>mv.id===tgtId);
    const amt = {};
    let any = false;
    for(const [r, ref] of [["wood",woodRef],["clay",clayRef],["iron",ironRef]]){
      let n = Math.floor(Number(ref.current.value)||0);
      n = Math.max(0, Math.min(n, source?Math.floor(source.resources[r]||0):0));
      if(n>0){ amt[r]=n; any=true; }
    }
    if(!any) return;
    doAction(()=>call("/api/village/transfer","POST",{sourceVillageId:srcId, targetVillageId:tgtId, wood:amt.wood||0, clay:amt.clay||0, iron:amt.iron||0}),
      "🚚 Ressources transférées"+(source&&target?(" de "+source.name+" vers "+target.name):"")+".", null);
  }

  return (
    <div className="box">
      <h3 style={{marginTop:0}}>📦 Envoi de ressources entre vos villages</h3>
      <p className="small muted">Transfert instantané (aucun trajet, aucun marchand) : choisissez le village source et le village de destination parmi TOUS les vôtres, sans avoir à basculer dessus au préalable. Plafonné par la capacité d'entrepôt du village de destination.</p>
      <div style={{display:"flex", gap:14, flexWrap:"wrap", alignItems:"flex-end", marginBottom:10}}>
        <div>
          <label className="small muted">Depuis</label><br/>
          <select ref={sourceRef} defaultValue={activeId}>
            {villages.map(v => <option key={v.id} value={v.id}>{v.isHome?"🏠 ":"🚩 "}{v.name} ({v.x}|{v.y}) — 🪵{fmt(v.resources.wood)} 🧱{fmt(v.resources.clay)} ⛏️{fmt(v.resources.iron)}</option>)}
          </select>
        </div>
        <div>
          <label className="small muted">Vers</label><br/>
          <select ref={targetRef} defaultValue={defaultTargetId}>
            {villages.map(v => <option key={v.id} value={v.id}>{v.isHome?"🏠 ":"🚩 "}{v.name} ({v.x}|{v.y})</option>)}
          </select>
        </div>
      </div>
      <div className="inputs" style={{display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", marginBottom:8}}>
        <div className="inp">{RES_ICON.wood}<input type="number" min="0" defaultValue="0" ref={woodRef} /></div>
        <div className="inp">{RES_ICON.clay}<input type="number" min="0" defaultValue="0" ref={clayRef} /></div>
        <div className="inp">{RES_ICON.iron}<input type="number" min="0" defaultValue="0" ref={ironRef} /></div>
      </div>
      <button className="primary" onClick={transfer}>🚚 Transférer</button>
    </div>
  );
}
