import { useState } from "react";
import { useGame } from "../GameContext.jsx";
import Audio from "../legacy/audio.js";

// Porte renderTopBar() + startRenameVillage()/commitRename() + switchVillage().
export default function TopBar(){
  const { snapshot, username, doAction, call, logout } = useGame();
  const v = snapshot.village;
  const [renaming, setRenaming] = useState(false);
  const [muted, setMuted] = useState(Audio.isMuted());

  function toggleMute(){ setMuted(Audio.toggle()); }

  function commitRename(val){
    setRenaming(false);
    const name = val.trim();
    if(name && name!==v.name) doAction(()=>call("/api/village/rename", "POST", { name }), null, null);
  }

  function switchVillage(villageId){
    doAction(()=>call("/api/village/switch", "POST", { villageId }), "🏰 Village actif changé.", null);
  }

  return (
    <header id="topbar">
      <div className="village-title">
        <div className="name-row">
          {renaming ? (
            <RenameInput initial={v.name} onCommit={commitRename} onCancel={()=>setRenaming(false)} />
          ) : (
            <>
              <span className="name" id="villageNameDisplay">🏰 {v.name}</span>
              <button className="btn-rename" title="Renommer le village" onClick={()=>setRenaming(true)}>✏️</button>
            </>
          )}
        </div>
        <span className="coord">
          {v.x}|{v.y} · {snapshot.isAdmin ? <span className="admin-name">{username}</span> : username}
          {snapshot.isAdmin ? <span className="tag strong" style={{marginLeft:6}}>ADMIN</span> : null}
        </span>
        {snapshot.myVillages && snapshot.myVillages.length>1 ? (
          <select title="Changer le village actuellement géré" style={{marginTop:4, maxWidth:240}}
            value={snapshot.myVillages.find(mv=>mv.isActive)?.id || ""}
            onChange={(e)=>switchVillage(e.target.value)}>
            {snapshot.myVillages.map(mv => (
              <option value={mv.id} key={mv.id}>
                {(mv.isHome?"🏠 ":"🚩 ")}{mv.name} ({mv.x}|{mv.y}) · HdV {mv.hq}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="topbar-right">
        <span className="small muted">🌐 Monde en temps réel</span>
        <button title={muted?"Activer le son":"Couper le son"} onClick={toggleMute}>{muted?"🔇":"🔊"}</button>
        <button onClick={()=>logout(false)}>🚪 Déconnexion</button>
      </div>
    </header>
  );
}

function RenameInput({ initial, onCommit, onCancel }){
  const [val, setVal] = useState(initial);
  return (
    <input type="text" maxLength={30} autoFocus value={val}
      onChange={e=>setVal(e.target.value)}
      onFocus={e=>e.target.select()}
      onKeyDown={e=>{ if(e.key==="Enter") onCommit(val); else if(e.key==="Escape") onCancel(); }}
      onBlur={()=>onCommit(val)} />
  );
}
