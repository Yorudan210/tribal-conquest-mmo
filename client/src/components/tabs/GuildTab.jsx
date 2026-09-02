import { useEffect, useRef, useState } from "react";
import { useGame } from "../../GameContext.jsx";
import { BUILDINGS, GUILD_BOOSTS, buildCost } from "../../gameData.js";
import { fmt, fmtTime, canAffordAll, vBuildTime, estimateNow, RES_ICON } from "../../formulas.js";
import { DIPLOMACY_LABEL } from "../../legacy/mapRender.js";
import { DIPLOMACY_LABEL_LOWER } from "../../legacy/reportRender.js";

const GUILD_MAX_BONUS_PERCENT_CLIENT = 25;

// Porte renderGuild()/attachGuildHandlers() : fondation de guilde, Hall de guilde (bâtiment partagé),
// dons, boutique de bonus temporaires, membres, diplomatie entre guildes.
export default function GuildTab(){
  const { snapshot, username, serverTimeOffset, adminSpeed, doAction, call, openPlayerProfile } = useGame();
  const g = snapshot.guild;

  if(!g) return <NoGuild />;

  const [subTab, setSubTab] = useState("overview");
  const v = snapshot.village;

  return (
    <div>
      <h2>👥 [{g.tag}] {g.name}</h2>
      <p className="muted small">Bonus de production actuel : <b>+{g.bonusPercent}%</b> pour tous les membres (basé sur {fmt(g.totalDonated)} ressources données au total).</p>
      <div className="guild-banner">
        <svg className="guild-banner-bg" viewBox="0 0 1200 100" preserveAspectRatio="none"><rect width="1200" height="100" fill="url(#tex-cloth-burgundy)" /></svg>
        <div className="guild-banner-content">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="#f6ecd3" stroke="#f6ecd3" strokeWidth="0.5"><path d="M4 18H20L18 9L14 13L12 7L10 13L6 9L4 18Z" /></svg>
          <div>
            <div className="guild-banner-title">[{g.tag}] {g.name}</div>
            <div className="guild-banner-sub">+{g.bonusPercent}% de production partagée · {fmt(g.totalDonated)} ressources données au total</div>
          </div>
        </div>
      </div>
      <div style={{display:"flex", gap:8, flexWrap:"wrap", marginBottom:16}}>
        {[["overview","🏰 Aperçu"],["shop","🛒 Boutique"],["diplomacy","🕊️ Diplomatie"]].map(([k,label]) => (
          <button key={k} className={subTab===k?"primary":""} onClick={()=>setSubTab(k)}>{label}</button>
        ))}
      </div>
      {subTab==="shop" ? <ShopBox g={g} doAction={doAction} call={call} />
        : subTab==="diplomacy" ? <DiplomacyBox g={g} doAction={doAction} call={call} />
        : <OverviewBox g={g} v={v} username={username} serverTimeOffset={serverTimeOffset} adminSpeed={adminSpeed} doAction={doAction} call={call} openPlayerProfile={openPlayerProfile} />}
    </div>
  );
}

function NoGuild(){
  const { doAction, call } = useGame();
  const nameRef = useRef(null), tagRef = useRef(null);
  function submit(e){
    e.preventDefault();
    const name = nameRef.current.value.trim(), tag = tagRef.current.value.trim();
    if(!name || !tag) return;
    doAction(()=>call("/api/guild/create","POST",{name, tag}), "👥 Guilde fondée !", null);
  }
  return (
    <div>
      <h2>👥 Guilde</h2>
      <p className="muted small">Rejoignez ou fondez une guilde pour construire un Hall de guilde dans votre village : il permet de donner des ressources à la guilde pour obtenir un bonus de production partagé par tous ses membres.</p>
      <div className="box">
        <h3>➕ Fonder une guilde</h3>
        <form onSubmit={submit} style={{display:"flex", gap:8, flexWrap:"wrap", alignItems:"flex-end"}}>
          <label className="small">Nom<br/><input type="text" ref={nameRef} maxLength={30} placeholder="Les Braves" /></label>
          <label className="small">Tag<br/><input type="text" ref={tagRef} maxLength={6} placeholder="BRV" style={{width:80, textTransform:"uppercase"}} /></label>
          <button type="submit" className="primary">Fonder</button>
        </form>
      </div>
      <p className="muted small">Si un chef de guilde vous a invité, vous trouverez son invitation dans l'onglet <b>Rapports</b> (catégorie « Guilde »), avec un bouton pour l'accepter ou la refuser.</p>
    </div>
  );
}

function OverviewBox({ g, v, username, serverTimeOffset, adminSpeed, doAction, call, openPlayerProfile }){
  const hallLvl = v.buildings.guildHall||0;
  const b = BUILDINGS.guildHall;
  const nextLevel = hallLvl+1;
  const maxed = nextLevel>b.max;
  const lockedReq = b.requires && Object.entries(b.requires).some(([rk,rv])=>(v.buildings[rk]||0)<rv);
  const cost = maxed?null:buildCost("guildHall", nextLevel);
  const time = maxed?null:vBuildTime(v, "guildHall", nextLevel, adminSpeed);
  const affordable = cost && canAffordAll({village:v}, cost);
  const pendingHall = v.buildQueue.filter(o=>o.key==="guildHall").length;

  const donateWood = useRef(null), donateClay = useRef(null), donateIron = useRef(null);
  const inviteRef = useRef(null);

  function buildHall(){
    doAction(()=>call("/api/build","POST",{key:"guildHall"}), "Construction ajoutée : "+b.name+" niveau "+nextLevel, "buildQueued");
  }
  function donate(){
    const wood = Number(donateWood.current.value)||0, clay = Number(donateClay.current.value)||0, iron = Number(donateIron.current.value)||0;
    if(!wood && !clay && !iron) return;
    doAction(()=>call("/api/guild/donate","POST",{wood, clay, iron}), "🎁 Don envoyé à la guilde !", null);
  }
  function invite(e){
    e.preventDefault();
    const u = inviteRef.current.value.trim();
    if(!u) return;
    doAction(()=>call("/api/guild/invite","POST",{username:u}), "✉️ Invitation envoyée à "+u+".", null);
    inviteRef.current.value = "";
  }
  function kick(m){
    doAction(()=>call("/api/guild/kick","POST",{username:m}), m+" exclu de la guilde.", null);
  }
  function leave(){
    if(!confirm("Quitter la guilde ?")) return;
    doAction(()=>call("/api/guild/leave","POST"), "Vous avez quitté la guilde.", null);
  }
  function disband(){
    if(!confirm("Dissoudre définitivement la guilde pour tous les membres ?")) return;
    doAction(()=>call("/api/guild/disband","POST"), "Guilde dissoute.", null);
  }

  const donorTotalsSorted = Object.entries(g.donorTotals||{}).sort((a,b2)=>b2[1]-a[1]);
  const now = estimateNow(serverTimeOffset);

  return (
    <>
      <div className="box">
        <h3>👥 Membres ({g.members.length})</h3>
        <table><thead><tr><th>Pseudo</th><th></th></tr></thead><tbody>
          {g.members.map(m => (
            <tr key={m}>
              <td className="player-link" onClick={()=>openPlayerProfile(m)}>{m}{m===g.leader?<span className="tag strong"> CHEF</span>:null}{m===username?" (vous)":""}</td>
              <td>{g.isLeader && m!==username ? <button onClick={()=>kick(m)}>Exclure</button> : null}</td>
            </tr>
          ))}
        </tbody></table>
      </div>

      {g.isLeader ? (
        <div className="box">
          <h3>✉️ Inviter un joueur</h3>
          <form onSubmit={invite} style={{display:"flex", gap:8}}>
            <input type="text" ref={inviteRef} placeholder="Pseudo du joueur" />
            <button type="submit" className="primary">Inviter</button>
          </form>
          {g.invites.length ? <p className="small muted" style={{marginTop:8}}>Invitations en attente : {g.invites.join(", ")}</p> : null}
        </div>
      ) : null}

      <div className="box">
        <h3>🏛️ Hall de guilde {hallLvl>0?`(niveau ${hallLvl})`:""}</h3>
        <div className="desc">{b.desc}</div>
        {lockedReq ? (
          <div className="req-note">Nécessite : {Object.entries(b.requires).map(([rk,rv])=>BUILDINGS[rk].name+" niv. "+rv).join(", ")}</div>
        ) : maxed ? (
          <p className="muted small">Niveau maximum atteint.</p>
        ) : (
          <>
            <div className="cost" style={{margin:"8px 0"}}>
              <span className={v.resources.wood<cost.wood?"short":""}>🪵 {fmt(cost.wood)}</span>
              <span className={v.resources.clay<cost.clay?"short":""}>🧱 {fmt(cost.clay)}</span>
              <span className={v.resources.iron<cost.iron?"short":""}>⛏️ {fmt(cost.iron)}</span>
              <span>⏱ {fmtTime(time)}</span>
            </div>
            {pendingHall ? <div className="unit-note">{pendingHall} déjà en file d'attente</div> : null}
            <button className="primary" disabled={!affordable} onClick={buildHall}>{hallLvl<=0?"Construire":"Améliorer"} → niveau {nextLevel}</button>
          </>
        )}
      </div>

      {hallLvl>0 ? (
        <div className="box">
          <h3>🎁 Faire un don à la guilde</h3>
          <p className="small muted">Chaque don augmente définitivement le bonus de production de TOUS les membres (plafonné à {GUILD_MAX_BONUS_PERCENT_CLIENT}%). Votre Hall de guilde (niveau {hallLvl}) limite chaque don à {1000*hallLvl} ressources au total.</p>
          <div className="inputs" style={{display:"flex", gap:10, flexWrap:"wrap", marginBottom:8}}>
            {[["wood",donateWood],["clay",donateClay],["iron",donateIron]].map(([r,ref]) => {
              // Max "à vue" pour CE champ pris isolément : le plus petit entre ce que le village possède
              // et le plafond du Hall de guilde (1000*niveau) -- ne tient pas compte de ce qui serait
              // rempli simultanément dans les deux autres champs (comme les max de la Caserne/Empire,
              // volontairement indépendants champ par champ plutôt qu'un calcul croisé plus complexe).
              const donateMax = Math.min(Math.floor(v.resources[r]||0), 1000*hallLvl);
              return (
                <div className="inp" key={r}>
                  {RES_ICON[r]}<input type="number" min="0" max={donateMax} defaultValue="0" ref={ref} />
                  <a href="#" className="small" style={{fontSize:10, marginLeft:4}} onClick={(e)=>{ e.preventDefault(); ref.current.value = donateMax; }}>max {fmt(donateMax)}</a>
                </div>
              );
            })}
          </div>
          <button className="primary" onClick={donate}>Donner</button>
        </div>
      ) : <p className="muted small">Construisez le Hall de guilde ci-dessus pour pouvoir faire des dons.</p>}

      <div className="box">
        <h3>🎁 Historique des dons</h3>
        <div style={{display:"flex", gap:16, flexWrap:"wrap", alignItems:"flex-start"}}>
          <div style={{flex:"1 1 260px", minWidth:220}}>
            <div className="small muted" style={{marginBottom:4}}>Dons récents</div>
            {(g.donations||[]).slice(0,15).length ? (g.donations||[]).slice(0,15).map((d,i) => (
              <div className="donation-row" key={i}>
                <span>{d.username}</span>
                <span className="muted">🪵{fmt(d.wood)} 🧱{fmt(d.clay)} ⛏️{fmt(d.iron)}</span>
                <span className="muted">{fmtTime(Math.max(0,now-d.time))}</span>
              </div>
            )) : <p className="muted small">Aucun don pour l'instant.</p>}
          </div>
          <div style={{flex:"1 1 200px", minWidth:180}}>
            <div className="small muted" style={{marginBottom:4}}>Total cumulé par membre</div>
            <table style={{width:"100%"}}><thead><tr><th>Membre</th><th>Total</th></tr></thead><tbody>
              {donorTotalsSorted.length ? donorTotalsSorted.map(([u,total]) => (
                <tr key={u}><td>{u}</td><td>{fmt(total)}</td></tr>
              )) : <tr><td colSpan="2" className="muted">Aucun don pour l'instant.</td></tr>}
            </tbody></table>
          </div>
        </div>
      </div>

      <div className="box">
        <button onClick={leave}>🚪 Quitter la guilde</button>
        {g.isLeader ? <button style={{marginLeft:8}} onClick={disband}>💥 Dissoudre la guilde</button> : null}
      </div>
    </>
  );
}

function ShopBox({ g, doAction, call }){
  const activeBoosts = g.activeBoosts||[];
  function buy(key, boost){
    doAction(()=>call("/api/guild/buy-boost","POST",{key}), boost?("🛒 "+boost.icon+" "+boost.name+" activé pour toute la guilde !"):"🛒 Bonus activé.", null);
  }
  return (
    <div className="box">
      <h3>🛒 Boutique de guilde</h3>
      <p className="small muted">Dépensez les ressources de la <b>banque de guilde</b> (alimentée par les dons ci-dessus) pour offrir un bonus temporaire à TOUS les membres. Banque actuelle : 🪵{fmt(g.bank.wood)} 🧱{fmt(g.bank.clay)} ⛏️{fmt(g.bank.iron)}.</p>
      {activeBoosts.length ? (
        <div className="small muted" style={{margin:"8px 0"}}>Bonus actifs : {activeBoosts.map(b=>`${b.icon} ${b.name} (encore ${fmtTime(b.secondsLeft)})`).join(" · ")}</div>
      ) : <div className="small muted" style={{margin:"8px 0"}}>Aucun bonus actif pour l'instant.</div>}
      <div className="shop-grid">
        {GUILD_BOOSTS.map(b => {
          const active = activeBoosts.find(x=>x.key===b.key);
          const affordable = g.bank.wood>=b.cost.wood && g.bank.clay>=b.cost.clay && g.bank.iron>=b.cost.iron;
          return (
            <div className={"shop-card"+(active?" active":"")} key={b.key}>
              <h4>{b.icon} {b.name}</h4>
              <div className="small muted" style={{marginBottom:6}}>{b.desc}</div>
              <div className="cost small" style={{marginBottom:8}}>
                <span className={g.bank.wood<b.cost.wood?"short":""}>🪵 {fmt(b.cost.wood)}</span>
                <span className={g.bank.clay<b.cost.clay?"short":""}>🧱 {fmt(b.cost.clay)}</span>
                <span className={g.bank.iron<b.cost.iron?"short":""}>⛏️ {fmt(b.cost.iron)}</span>
              </div>
              {g.isLeader ? (
                <button className="primary" disabled={!affordable} onClick={()=>buy(b.key,b)}>{active?"Racheter (prolonger)":"Acheter"}</button>
              ) : <p className="muted small">Seul le chef de guilde peut acheter dans la boutique.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiplomacyBox({ g, doAction, call }){
  const [directory, setDirectory] = useState(null);
  const selectRef = useRef(null);

  async function refreshDirectory(){
    try{
      const data = await call("/api/guilds","GET");
      setDirectory(data.guilds);
    }catch(err){}
  }
  useEffect(() => {
    if(g.isLeader && directory===null) refreshDirectory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.isLeader]);

  function cancel(relationId){
    if(!confirm("Confirmer ?")) return;
    doAction(()=>call("/api/guild/diplomacy/cancel","POST",{relationId}), "Relation mise à jour.", null);
  }
  function respond(relationId, accept){
    doAction(()=>call("/api/guild/diplomacy/respond","POST",{relationId, accept}), accept?"🕊️ Proposition acceptée.":"Proposition refusée.", null);
  }
  function propose(type){
    const val = selectRef.current && selectRef.current.value;
    if(!val) return;
    doAction(()=>call("/api/guild/diplomacy/propose","POST",{targetGuildId:val, type}), "🕊️ Proposition envoyée.", null);
  }
  function declareWar(){
    const val = selectRef.current && selectRef.current.value;
    if(!val) return;
    if(!confirm("Déclarer la guerre à cette guilde ?")) return;
    doAction(()=>call("/api/guild/diplomacy/declare-war","POST",{targetGuildId:val}), "⚔️ Guerre déclarée.", null);
  }

  const relTypeCls = r => r.type==="war" ? "war" : (r.type==="alliance" ? "ally" : "pact");
  const diplomacy = g.diplomacy||[];
  const activeRelations = diplomacy.filter(r=>r.status==="active");
  const incomingPending = diplomacy.filter(r=>r.status==="pending" && r.direction==="incoming");
  const outgoingPending = diplomacy.filter(r=>r.status==="pending" && r.direction==="outgoing");

  return (
    <>
      <div className="box">
        <h3>🕊️ Diplomatie</h3>
        {incomingPending.length ? (
          <div style={{marginBottom:10}}>
            <div className="small muted" style={{marginBottom:4}}>Propositions reçues</div>
            {incomingPending.map(r => (
              <div className="donation-row" key={r.id}>
                <span className="tag pact">Reçue</span>
                <span>[{r.otherGuild.tag}] {r.otherGuild.name} propose {DIPLOMACY_LABEL_LOWER[r.type]}</span>
                {g.isLeader ? <span><button className="primary" onClick={()=>respond(r.id,true)}>Accepter</button> <button onClick={()=>respond(r.id,false)}>Refuser</button></span> : null}
              </div>
            ))}
          </div>
        ) : null}
        {outgoingPending.length ? (
          <div style={{marginBottom:10}}>
            <div className="small muted" style={{marginBottom:4}}>Propositions envoyées</div>
            {outgoingPending.map(r => (
              <div className="donation-row" key={r.id}>
                <span className="tag pact">Envoyée</span>
                <span>Proposition de {DIPLOMACY_LABEL_LOWER[r.type]} envoyée à [{r.otherGuild.tag}] {r.otherGuild.name}</span>
                {g.isLeader ? <button onClick={()=>cancel(r.id)}>Annuler</button> : null}
              </div>
            ))}
          </div>
        ) : null}
        <div className="small muted" style={{marginBottom:4}}>Relations actives</div>
        {activeRelations.length ? activeRelations.map(r => (
          <div className="donation-row" key={r.id}>
            <span className={"tag "+relTypeCls(r)}>{DIPLOMACY_LABEL[r.type]}</span>
            <span>[{r.otherGuild.tag}] {r.otherGuild.name}</span>
            {g.isLeader ? <button onClick={()=>cancel(r.id)}>{r.type==="war"?"🕊️ Faire la paix":"💔 Rompre"}</button> : null}
          </div>
        )) : <p className="muted small">Aucune relation active pour l'instant.</p>}
      </div>

      {g.isLeader ? (
        <div className="box">
          <div className="flex-between" style={{alignItems:"flex-start"}}>
            <h3 style={{margin:0}}>🕊️ Proposer une relation</h3>
            <button type="button" title="Actualiser la liste des guildes" style={{padding:"4px 8px"}} onClick={refreshDirectory}>🔄</button>
          </div>
          <p className="small muted">Un pacte ou une alliance doit être accepté par l'autre chef de guilde. Une déclaration de guerre est immédiate et unilatérale. Ces relations sont purement informatives : elles s'affichent sur la carte et avertissent avant une attaque, mais n'empêchent aucun combat.</p>
          {directory===null ? (
            <p className="muted small">Chargement de l'annuaire des guildes…</p>
          ) : directory.length===0 ? (
            <p className="muted small">Aucune autre guilde dans le monde pour l'instant.</p>
          ) : (
            <div style={{display:"flex", gap:8, flexWrap:"wrap", alignItems:"flex-end"}}>
              <label className="small">Guilde<br/>
                <select ref={selectRef}>
                  {directory.map(og => <option key={og.id} value={og.id}>[{og.tag}] {og.name} ({og.memberCount} membre{og.memberCount>1?"s":""})</option>)}
                </select>
              </label>
              <button type="button" onClick={()=>propose("pact")}>🕊️ Proposer un pacte</button>
              <button type="button" className="primary" onClick={()=>propose("alliance")}>🤝 Proposer une alliance</button>
              <button type="button" onClick={declareWar}>⚔️ Déclarer la guerre</button>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
