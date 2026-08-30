import { useGame } from "../GameContext.jsx";
import { RES_ICON } from "../formulas.js";

// Porte renderPlayerProfile() : fiche joueur détaillée (guilde, points, villages, actions), ouverte
// depuis la liste des membres de guilde, le Classement, ou un pseudo cliqué dans le chat -- voir
// GameContext (playerProfile/openPlayerProfile/closePlayerProfile/goToVillageOnMap).
export default function PlayerProfileModal(){
  const { snapshot, username, playerProfile: p, closePlayerProfile, goToVillageOnMap, doAction, call } = useGame();
  if(!p) return null;

  const isSelf = p.username===username;
  const canAct = !isSelf && p.homeVillageId!=null;

  function onBackdropClick(e){ if(e.target.id==="playerProfileBackdrop") closePlayerProfile(); }

  function sendGift(){
    const amt = {};
    let any = false;
    for(const r of ["wood","clay","iron"]){
      const el = document.getElementById("profileGift_"+r);
      if(!el) continue;
      let n = Math.floor(Number(el.value)||0);
      n = Math.max(0, Math.min(n, Math.floor(snapshot.village.resources[r]||0)));
      if(n>0){ amt[r]=n; any=true; }
    }
    if(!any) return;
    doAction(()=>call("/api/gift","POST",{username:p.username, wood:amt.wood||0, clay:amt.clay||0, iron:amt.iron||0}),
      "🎁 Don envoyé à "+p.username+".", null);
    closePlayerProfile();
  }

  function attackOrScout(){
    closePlayerProfile();
    goToVillageOnMap(p.homeVillageId);
  }

  return (
    <div className="tutorial-backdrop" id="playerProfileBackdrop" onClick={onBackdropClick}>
      <div className="tutorial-card" style={{maxWidth:360}}>
        <div className="flex-between" style={{alignItems:"flex-start"}}>
          <h3 style={{margin:0}}>👤 {p.isAdmin ? <span className="admin-name">{p.username}</span> : p.username}{isSelf?" (vous)":""}</h3>
          <button title="Fermer" style={{padding:"4px 8px"}} onClick={closePlayerProfile}>✖</button>
        </div>
        <div className="small muted" style={{margin:"10px 0", lineHeight:1.6}}>
          👥 {p.guild ? `Guilde : [${p.guild.tag}] ${p.guild.name}${p.guild.isLeader?" (chef)":""}` : "Aucune guilde"}<br/>
          🏆 Points : {p.points} (niveau total des constructions {p.buildingLevels} sur {p.villageCount} village{p.villageCount>1?"s":""}, Hôtel de ville capitale niv. {p.hq}, {p.conquered} conquête{p.conquered>1?"s":""})<br/>
          🏰 {p.villageCount} village{p.villageCount>1?"s":""}{p.homeCoord?(" · capitale à "+p.homeCoord):""}
        </div>
        {(p.villages && p.villages.length) ? (
          <>
            <div className="small muted" style={{margin:"4px 0 6px"}}>Villages (clic pour voir sur la carte) :</div>
            <div className="profile-village-list" style={{display:"flex", flexDirection:"column", gap:4, maxHeight:160, overflowY:"auto", marginBottom:10}}>
              {p.villages.map(v => (
                <button key={v.id} className="profile-village-row" style={{textAlign:"left", display:"flex", justifyContent:"space-between", gap:8, padding:"6px 8px"}}
                  onClick={()=>{ closePlayerProfile(); goToVillageOnMap(v.id); }}>
                  <span>{v.isHome?"👑 ":"🏰 "}{v.name}</span>
                  <span className="muted small">{v.x}|{v.y}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
        <div className="player-card-actions" style={{display:"flex", flexDirection:"column", gap:8}}>
          {isSelf ? (
            <p className="muted small">C'est vous !</p>
          ) : !canAct ? (
            <p className="muted small">Aucune action disponible (village introuvable).</p>
          ) : (
            <>
              <div className="send-form open">
                <div className="small muted" style={{marginBottom:6}}>🎁 Envoyer des ressources (livré à sa capitale)</div>
                <div className="inputs" style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                  {["wood","clay","iron"].map(r => (
                    <div className="inp" key={r}>{RES_ICON[r]}<input type="number" min="0" max={Math.floor(snapshot.village.resources[r]||0)} defaultValue="0" id={"profileGift_"+r} /></div>
                  ))}
                </div>
                <button onClick={sendGift}>🎁 Envoyer</button>
              </div>
              <button className="primary" onClick={attackOrScout}>⚔️ Attaquer</button>
              <button onClick={attackOrScout}>🔭 Espionner</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
