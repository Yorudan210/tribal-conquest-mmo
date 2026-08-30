import { useGame } from "../GameContext.jsx";
import { storageCap, farmCap, TROOP_ORDER, TROOPS, BUILDINGS } from "../gameData.js";
import { fmt, fmtTime, fmtTroops, estimateNow, popUsed, resProdRate, villageResourceBonus, RES_ICON, RES_NAME } from "../formulas.js";

// Porte renderSidebar() : ressources, troupes stationnées, files de construction/entraînement,
// missions en cours, attaques entrantes, renforts — chaque action (annuler, rappeler) appelle
// directement l'API comme avant (doAction), la liste se met à jour au prochain instantané.
export default function Sidebar({ openHelpBlackArmy }){
  const { snapshot, username, serverTimeOffset, doAction, call } = useGame();
  const s = snapshot;
  const v = s.village;
  const now = estimateNow(serverTimeOffset);
  const cap = storageCap(v.buildings.warehouse);
  const pop = popUsed(s, username), popMax = farmCap(v.buildings.farm);
  const presentTroops = TROOP_ORDER.filter(k => (v.troops[k]||0) > 0);

  const activeMissions = s.missions.filter(m => m.kind!=="raid");
  const incomingRaids = s.missions.filter(m => m.kind==="raid" && !m.resolveDone);
  const MISSION_LABEL = { attack:"⚔️ Attaque", scout:"🔭 Reconnaissance", support:"🤝 Soutien", supportReturn:"🤝 Soutien" };
  const incomingPlayerAttacks = s.incomingAttacks || [];
  const incomingSupport = v.support || [];
  const mySupport = s.mySupport || [];
  const activeEvents = s.serverEvents || [];
  const ba = s.blackArmyEvent;

  function cancelBuild(index){ doAction(()=>call("/api/build/cancel","POST",{index}), "Construction annulée, ressources remboursées.", null); }
  function cancelTrain(index){ doAction(()=>call("/api/train/cancel","POST",{index}), "Entraînement annulé, ressources remboursées.", null); }
  function cancelMission(missionId){ doAction(()=>call("/api/mission/cancel","POST",{missionId}), "✖ Mission annulée, les troupes rentrent.", null); }
  function recallSupport(supportId){ doAction(()=>call("/api/support/recall","POST",{supportId}), "🤝 Rappel envoyé, vos troupes reviennent.", null); }

  return (
    <aside id="sidebar">
      {ba && ba.active ? (
        <div className="box" style={{borderColor:"#9a2b2b", background:"linear-gradient(180deg, rgba(20,20,24,.55), rgba(20,20,24,.15))", boxShadow:"0 0 14px rgba(154,43,43,.25)"}}>
          <h3 style={{marginTop:0}}>🏴 L'Armée Noire</h3>
          <p className="small" style={{margin:"2px 0 4px"}}>Repérez les villages <b>noirs</b> sur la carte — encore <b>{fmtTime(ba.remainingSec)}</b> avant leur retrait.</p>
          <p className="small muted" style={{margin:0}}>
            {fmt(ba.defeatedCount)} campement{ba.defeatedCount>1?"s":""} vaincu{ba.defeatedCount>1?"s":""} par la communauté ·{" "}
            <a href="#" onClick={(e)=>{ e.preventDefault(); openHelpBlackArmy && openHelpBlackArmy(); }}>règles de l'évènement</a>
          </p>
        </div>
      ) : null}

      {activeEvents.length ? (
        <div className="box" style={{borderColor:"var(--gold)"}}>
          <h3>🎉 Évènements en cours</h3>
          <div className="event-badges">
            {activeEvents.map(e => (
              <span className="event-badge" key={e.id} title={`${e.name} ×${e.multiplier} — encore ${fmtTime(e.remainingSec)}`}>
                {e.icon}<span className="event-badge-mult">×{e.multiplier}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="box res-box">
        <h3>💰 Ressources</h3>
        <div className="res-group">
          {["wood","clay","iron"].map(r => {
            const bonus = villageResourceBonus(s, r);
            const warn = v.resources[r] >= cap-1;
            return (
              <div className={"res"+(warn?" warn":"")+(bonus?" bonus":"")} key={r}
                title={bonus?`Gisement riche : +${Math.round(bonus.pct*100)}% de production de ${RES_NAME[r].toLowerCase()} dans ce village.`:undefined}>
                <div className="val">{RES_ICON[r]} {fmt(v.resources[r])}<span style={{color:"var(--text-dim)", fontWeight:"normal"}}>/{fmt(cap)}</span></div>
                <div className="rate">+{fmt(resProdRate(s, r))}/h{bonus?" ⭐":""}</div>
              </div>
            );
          })}
          <div className="res"><div className="val">👥 {pop}/{popMax}</div><div className="rate">population</div></div>
        </div>
      </div>

      <div className="box res-box">
        <h3>⚔️ Troupes</h3>
        {presentTroops.length ? (
          <div className="res-group">
            {presentTroops.map(k => (
              <div className="res" key={k}><div className="val">{fmt(v.troops[k])}</div><div className="rate">{TROOPS[k].name}</div></div>
            ))}
          </div>
        ) : <p className="muted small" style={{margin:0}}>Aucune troupe stationnée dans ce village.</p>}
      </div>

      <div className="box">
        <h3>🏗️ File de construction</h3>
        {v.buildQueue.length ? v.buildQueue.map((item, i) => {
          const timeLeft = Math.max(0, item.startAt+item.duration-now);
          const pct = 100*(1-timeLeft/item.duration);
          return (
            <div className="queue-item" key={i}>
              <div className="flex-between">
                <span>{BUILDINGS[item.key].name} → niv. {item.level}</span>
                <span>{fmtTime(timeLeft)} <a href="#" title="Annuler (remboursé)" style={{marginLeft:6}} onClick={(e)=>{e.preventDefault(); cancelBuild(i);}}>✖</a></span>
              </div>
              <div className="bar-bg"><div className="bar-fill" style={{width:pct+"%"}} /></div>
            </div>
          );
        }) : <div className="muted small">File vide.</div>}
      </div>

      <div className="box">
        <h3>⚔️ File d'entraînement</h3>
        {v.trainQueue.length ? v.trainQueue.map((o, i) => {
          const timeLeft = Math.max(0, o.unitStartAt+o.unitDuration-now);
          const pct = 100*(1-timeLeft/o.unitDuration);
          return (
            <div className="queue-item" key={i}>
              <div className="flex-between">
                <span>{TROOPS[o.troop].name} ×{o.count}</span>
                <span>{fmtTime(timeLeft)} / unité <a href="#" title="Annuler (remboursé)" style={{marginLeft:6}} onClick={(e)=>{e.preventDefault(); cancelTrain(i);}}>✖</a></span>
              </div>
              <div className="bar-bg"><div className="bar-fill" style={{width:pct+"%"}} /></div>
            </div>
          );
        }) : <div className="muted small">File vide.</div>}
      </div>

      <div className="box">
        <h3>🚩 Missions en cours</h3>
        {activeMissions.length ? activeMissions.map(m => {
          const target = s.villages.find(vv => vv.id===m.targetId);
          const source = s.villages.find(vv => vv.id===m.sourceVillageId);
          const label = MISSION_LABEL[m.kind] || m.kind;
          let phase, remain, destName;
          if(m.cancelled){ phase="annulée, retour vers"; remain=m.returnAt-now; destName=source?source.name:"?"; }
          else if(m.kind==="supportReturn"){ phase="revient vers"; remain=m.returnAt-now; destName=target?target.name:"?"; }
          else if(!m.resolveDone){ phase="en route vers"; remain=m.arriveAt-now; destName=target?target.name:"?"; }
          else { phase="retour de"; remain=m.returnAt-now; destName=target?target.name:"?"; }
          const canCancel = (m.kind==="attack"||m.kind==="scout") && !m.resolveDone;
          return (
            <div className="mission-item" key={m.id}>
              <div className="flex-between">
                <span>{label} {phase} {destName}</span>
                <span>{fmtTime(remain)}{canCancel ? <a href="#" title="Annuler : les troupes font demi-tour immédiatement." style={{marginLeft:6}} onClick={(e)=>{e.preventDefault(); cancelMission(m.id);}}>✖</a> : null}</span>
              </div>
            </div>
          );
        }) : <div className="muted small">Aucune troupe en mission.</div>}
      </div>

      {incomingRaids.length ? (
        <div className="box" style={{borderColor:"#8a3226"}}>
          <h3>🚨 Attaques entrantes</h3>
          {incomingRaids.map(m => (
            <div className="mission-item" key={m.id}>
              <div className="flex-between"><span>{m.raidSourceName||"Village barbare"} approche</span><span>{fmtTime(m.arriveAt-now)}</span></div>
            </div>
          ))}
        </div>
      ) : null}

      {incomingPlayerAttacks.length ? (
        <div className="box" style={{borderColor:"#8a3226"}}>
          <h3>⚔️ Attaques ennemies entrantes</h3>
          {incomingPlayerAttacks.map((m,i) => {
            const label = m.kind==="scout" ? "🔭 Reconnaissance" : "⚔️ Attaque";
            return (
              <div className="mission-item" key={i}>
                <div className="flex-between"><span>{label} de <b>{m.attackerUsername}</b> vers {m.targetName||"?"}</span><span>{fmtTime(m.arriveAt-now)}</span></div>
                <div className="small muted">Depuis {m.sourceName||"?"} ({m.sourceCoord||"?"})</div>
              </div>
            );
          })}
        </div>
      ) : null}

      {incomingSupport.length ? (
        <div className="box">
          <h3>🤝 Renforts reçus</h3>
          {incomingSupport.map((sp,i) => (
            <div className="mission-item" key={i}>
              <div className="flex-between"><span>De {sp.from}</span><span className="small muted">{fmtTroops(sp.troops)}</span></div>
            </div>
          ))}
        </div>
      ) : null}

      {mySupport.length ? (
        <div className="box">
          <h3>🤝 Vos renforts envoyés</h3>
          {mySupport.map(sp => (
            <div className="mission-item" key={sp.id}>
              <div className="flex-between"><span>Chez {sp.atVillageName} ({sp.atCoord})</span><a href="#" onClick={(e)=>{e.preventDefault(); recallSupport(sp.id);}}>↩️ Rappeler</a></div>
              <div className="small muted">{fmtTroops(sp.troops)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
