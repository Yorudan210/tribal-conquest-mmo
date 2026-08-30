import { useState } from "react";
import { useGame } from "../GameContext.jsx";
import CHANGELOG_ENTRIES from "../legacy/changelog.js";

export function ChangelogCards(){
  return (
    <div style={{display:"flex", flexDirection:"column", gap:8}}>
      {CHANGELOG_ENTRIES.map((e,i) => (
        <div className="card" style={{padding:"10px 12px"}} key={i}>
          <div className="card-head" style={{marginBottom:4}}>
            <div className="icon-mini shop-icon" style={{width:30, height:30, fontSize:15}}>{e.icon}</div>
            <h4 style={{margin:0}}>{e.title}<span className="small muted" style={{fontWeight:"normal"}}>{e.tag}</span></h4>
          </div>
          <div className="desc small">{e.body}</div>
        </div>
      ))}
    </div>
  );
}

export default function AuthScreen(){
  const { login, register, authError, setAuthError } = useGame();
  const [mode, setMode] = useState("login"); // "login" | "register" | "changelog"
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isChangelog = mode==="changelog";

  function switchMode(m){ setAuthError(""); setMode(m); }

  async function onSubmit(e){
    e.preventDefault();
    const uu = u.trim();
    if(submitting) return;
    setSubmitting(true);
    try{
      if(mode==="register") await register(uu, p);
      else await login(uu, p);
    }catch(err){
      // authError déjà mis à jour par le contexte (login/register l'écrit avant de relancer l'erreur)
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div id="authScreen">
      <div className="box" style={{maxWidth: isChangelog?460:380, margin:"80px auto", textAlign:"center"}}>
        <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:8, marginBottom:6}}>
          <svg viewBox="0 0 64 76" width="64" height="76" xmlns="http://www.w3.org/2000/svg">
            <path d="M32 3 L59 13 L59 37 C59 59 46 69 32 75 C18 69 5 59 5 37 L5 13 Z" fill="var(--panel2)" stroke="var(--gold)" strokeWidth="3"/>
            <line x1="30" y1="28" x2="30" y2="11" stroke="var(--gold)" strokeWidth="2"/>
            <polygon points="30,11 45,16.5 30,22" fill="var(--red)"/>
            <polygon points="19,40 19,32 23,32 23,28 27,28 27,32 33,32 33,28 37,28 37,32 41,32 41,40" fill="var(--gold)"/>
            <rect x="19" y="40" width="22" height="22" fill="var(--gold)"/>
            <rect x="26" y="52" width="8" height="10" fill="var(--panel2)"/>
          </svg>
          <h2 style={{textTransform:"uppercase", letterSpacing:1, margin:0}}>Conquête Tribale</h2>
        </div>
        <p className="muted small">Un monde partagé, en temps réel, avec de vrais joueurs. Connectez-vous ou créez un compte pour rejoindre la partie.</p>
        <div style={{display:"flex", gap:8, justifyContent:"center", margin:"14px 0", flexWrap:"wrap"}}>
          <button className={mode==='login'?'primary':''} onClick={()=>switchMode("login")}>Connexion</button>
          <button className={mode==='register'?'primary':''} onClick={()=>switchMode("register")}>Créer un compte</button>
          <button className={isChangelog?'primary':''} onClick={()=>switchMode("changelog")}>🗞️ Nouveautés</button>
        </div>
        {isChangelog ? (
          <div style={{maxHeight:360, overflowY:"auto", textAlign:"left", display:"flex", flexDirection:"column", gap:8, paddingRight:4}}>
            <ChangelogCards />
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{display:"flex", flexDirection:"column", gap:10, textAlign:"left"}}>
            <label className="small">Pseudo
              <input type="text" maxLength={20} autoComplete="username" placeholder="3 à 20 caractères"
                value={u} onChange={e=>setU(e.target.value)} />
            </label>
            <label className="small">Mot de passe
              <input type="password" autoComplete={mode==='register'?'new-password':'current-password'} placeholder="4 caractères minimum"
                value={p} onChange={e=>setP(e.target.value)} />
            </label>
            <div className="muted small" style={{color:"#e0836a", minHeight:16}}>{authError||""}</div>
            <button type="submit" className="primary" disabled={submitting}>
              {mode==='register' ? 'Créer mon compte' : 'Se connecter'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
