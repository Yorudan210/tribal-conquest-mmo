import { useEffect, useRef, useState } from "react";
import { useGame } from "../GameContext.jsx";
import { fmtClock } from "../formulas.js";

// Porte renderChat()/updateChatTabs()/updateChatMessages()/sendChat(). Widget flottant indépendant
// des onglets. Cliquer un pseudo (y compris le sien) ouvre sa fiche joueur (PlayerProfileModal),
// comme pour tous les autres liens data-open-profile de l'ancien index.html.
export default function ChatWidget(){
  const { snapshot, username, doAction, call, openPlayerProfile } = useGame();
  const hasGuild = !!snapshot.guild;
  // Sur petit écran, le panneau ouvert occupe une bonne partie de l'écran : démarre réduit sur
  // mobile, ouvert sur desktop où il ne gêne qu'un coin de l'écran (comme l'ancien index.html).
  const [open, setOpen] = useState(() => window.innerWidth > 480);
  const [channel, setChannel] = useState("global");
  const [text, setText] = useState("");
  const messagesRef = useRef(null);

  useEffect(() => { if(!hasGuild && channel==="guild") setChannel("global"); }, [hasGuild, channel]);

  const messages = channel==="guild" ? (snapshot.guildChat||[]) : (snapshot.chat||[]);

  useEffect(() => {
    const box = messagesRef.current;
    if(!box) return;
    const nearBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 20 - 60; // marge : nouveau message ajouté juste avant ce recalcul
    if(nearBottom) box.scrollTop = box.scrollHeight;
  }, [messages]);

  function submit(e){
    e.preventDefault();
    const t = text.trim();
    if(!t) return;
    setText("");
    doAction(()=>call("/api/chat/send","POST",{text:t, channel}), null, null);
  }

  if(!open){
    return (
      <div id="chatWidget">
        <button className="chat-bubble" title="Ouvrir le chat" onClick={()=>setOpen(true)}>💬</button>
      </div>
    );
  }

  return (
    <div id="chatWidget">
      <div className="chat-panel">
        <div className="chat-head">
          <span>💬 Chat</span>
          <button className="chat-toggle" title="Réduire" onClick={()=>setOpen(false)}>➖</button>
        </div>
        <div className="chat-tabs">
          <button className={"chat-tab"+(channel==="global"?" active":"")} onClick={()=>setChannel("global")}>🌍 Mondial</button>
          {hasGuild ? (
            <button className={"chat-tab"+(channel==="guild"?" active":"")} onClick={()=>setChannel("guild")}>
              🛡️ Guilde{snapshot.guild.tag ? ` [${snapshot.guild.tag}]` : ""}
            </button>
          ) : null}
        </div>
        <div className="chat-messages" ref={messagesRef}>
          {messages.length ? messages.map((m,i) => {
            const isAnnounce = m.kind==="announce";
            const nameCls = "chat-user"+(m.isAdmin?" admin-name":"");
            return (
              <div className={"chat-msg"+(isAnnounce?" announce":"")+(m.username===username?" me":"")} key={i}>
                <span className="chat-time">{fmtClock(m.time)}</span>
                {isAnnounce ? <span className="chat-announce-icon">📢</span> : null}
                <span className={nameCls} onClick={()=>openPlayerProfile(m.username)}>{m.username}</span>{" "}
                <span className="chat-text">{m.text}</span>
              </div>
            );
          }) : (
            <div className="muted small" style={{padding:8}}>
              {channel==="guild" ? "Aucun message dans le chat de guilde pour l'instant." : "Aucun message pour l'instant. Dites bonjour !"}
            </div>
          )}
        </div>
        <form className="chat-form" onSubmit={submit}>
          <input type="text" maxLength={300} placeholder="Écrire un message…" autoComplete="off"
            value={text} onChange={e=>setText(e.target.value)} />
          <span className="chat-charcount">{text.length}/300</span>
          <button type="submit">➤</button>
        </form>
      </div>
    </div>
  );
}
