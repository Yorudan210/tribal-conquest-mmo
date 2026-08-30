import { useEffect, useState } from "react";
import { useGame } from "../../GameContext.jsx";
import { useToast } from "../../ToastContext.jsx";
import { BUILD_ORDER, BUILDINGS, TROOP_ORDER, TROOPS, SERVER_EVENTS } from "../../gameData.js";
import { fmt, fmtTime, RES_ICON } from "../../formulas.js";

// Porte renderAdmin()/renderAdminBlackArmyBox()/renderAdminBulkVillagesBox()/renderAdminVillagesTable()/
// renderAdminVillageEditor()/renderAdminEditor()/attachAdminHandlers() (index.html ~4837-5378) : le plus
// gros morceau du panneau, entièrement réservé aux comptes administrateurs (voir InformationTab, qui ne
// monte ce composant que si snapshot.isAdmin). adminPlayers/adminMissions/adminVillages restent un state
// LOCAL à ce composant (comme farmComposition dans FarmTab) plutôt que remonté dans GameContext : ils sont
// chargés à la demande, ne servent qu'ici, et un refetch à chaque ouverture de l'onglet Admin est un
// détail mineur, pas un problème -- exactement le même arbitrage que pour les autres états "confort"
// déjà tranché ailleurs dans cette réécriture.
export default function AdminPanel(){
  const { snapshot, username, adminSpeed, applySnapshot, call } = useGame();
  const toast = useToast();

  const [players, setPlayers] = useState(null);
  const [missions, setMissions] = useState(null);
  const [villages, setVillages] = useState(null);
  const [playerFilter, setPlayerFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [villageFilter, setVillageFilter] = useState("");
  const [selectedVillageId, setSelectedVillageId] = useState(null);
  const [bulkScope, setBulkScope] = useState("all");
  const [eventKey, setEventKey] = useState(SERVER_EVENTS[0]?.key || "");

  // Chargement à la demande (une seule fois, à l'ouverture du sous-onglet Admin) -- porte
  // refreshAdminData(), appelée dans l'ancien index.html seulement "si adminPlayers est encore null".
  useEffect(() => {
    let cancelled = false;
    Promise.all([call("/api/admin/players","GET"), call("/api/admin/villages","GET")])
      .then(([playersData, villagesData]) => {
        if(cancelled) return;
        setPlayers(playersData.players);
        setMissions(playersData.missions);
        setVillages(villagesData.villages);
      })
      .catch(err => { if(!cancelled) toast("⚠️ "+err.message); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function adminAction(promiseFn, successMsg){
    try{
      const data = await promiseFn();
      if(data.snapshot) applySnapshot(data.snapshot);
      if(data.players) setPlayers(data.players);
      if(data.villages) setVillages(data.villages);
      if(data.missions) setMissions(data.missions);
      if(successMsg) toast(successMsg);
    }catch(err){ toast("⚠️ "+err.message); }
  }

  const filter = playerFilter.trim().toLowerCase();
  const filteredPlayers = (players||[]).filter(p => !filter || p.username.toLowerCase().includes(filter) || (p.villageName||"").toLowerCase().includes(filter));
  const selP = (players||[]).find(p => p.username===selected);

  const vfilter = villageFilter.trim().toLowerCase();
  const filteredVillages = (villages||[]).filter(v => !vfilter || v.name.toLowerCase().includes(vfilter) || (v.x+"|"+v.y).includes(vfilter) || (v.owner||"").toLowerCase().includes(vfilter));
  const selV = (villages||[]).find(v => v.id===selectedVillageId);

  return (
    <div>
      <h2>🛠️ Panneau d'administration</h2>
      <p className="muted small">Réservé aux comptes administrateurs. Ces actions modifient directement le monde — utilisez-les avec prudence.</p>

      <SpeedBox adminSpeed={adminSpeed} adminAction={adminAction} call={call} toast={toast} />
      <AnnounceBox adminAction={adminAction} call={call} toast={toast} />
      <GiveAllBox adminAction={adminAction} call={call} toast={toast} />
      <BulkVillagesBox bulkScope={bulkScope} setBulkScope={setBulkScope} adminAction={adminAction} call={call} toast={toast} />
      <ServerEventsBox snapshot={snapshot} eventKey={eventKey} setEventKey={setEventKey} adminAction={adminAction} call={call} toast={toast} />
      <BlackArmyBox snapshot={snapshot} adminAction={adminAction} call={call} toast={toast} />
      <MissionsBox missions={missions} adminAction={adminAction} call={call} />

      <div className="box" style={{marginBottom:14}}>
        <div className="flex-between">
          <h3 style={{margin:0}}>👥 Joueurs ({filteredPlayers.length}{filteredPlayers.length!==(players||[]).length ? (" / "+(players||[]).length) : ""})</h3>
          <input type="text" placeholder="🔎 Filtrer par pseudo ou village…" style={{maxWidth:240}}
            value={playerFilter} onChange={e=>setPlayerFilter(e.target.value)} />
        </div>
        <p className="small muted">Cliquez sur un joueur pour modifier son village (ressources, bâtiments, troupes).</p>
        <div style={{maxHeight:280, overflow:"auto"}}>
          <table><thead><tr><th>Pseudo</th><th>Village</th><th>Coord.</th><th>Ressources</th><th>HdV</th><th>Files (constr./entr.)</th><th>Villages</th></tr></thead>
          <tbody>
            {filteredPlayers.length ? filteredPlayers.map(p => (
              <tr key={p.username} className={selected===p.username?"admin-selected":""} onClick={()=>setSelected(p.username)}>
                <td>{p.username}{p.isAdmin ? <span className="tag strong"> ADMIN</span> : null}</td>
                <td>{p.villageName || "-"}</td>
                <td>{p.coord || "-"}</td>
                <td>{RES_ICON.wood}{fmt(p.resources?p.resources.wood:0)} {RES_ICON.clay}{fmt(p.resources?p.resources.clay:0)} {RES_ICON.iron}{fmt(p.resources?p.resources.iron:0)}</td>
                <td>🏛️ {p.buildings?p.buildings.hq||0:0}</td>
                <td>{p.buildQueueLen||0} / {p.trainQueueLen||0}</td>
                <td>{p.villageCount||1}</td>
              </tr>
            )) : <tr><td colSpan={7} className="muted">{(players||[]).length ? "Aucun joueur ne correspond à la recherche." : "Chargement…"}</td></tr>}
          </tbody></table>
        </div>
      </div>

      {selP
        ? <div className="box"><PlayerEditor key={selP.username} player={selP} username={username} adminAction={adminAction} call={call} toast={toast} onDeleted={()=>setSelected(null)} /></div>
        : <p className="muted small">Sélectionnez un joueur ci-dessus pour l'éditer.</p>}

      <div className="box" style={{marginBottom:14}}>
        <div className="flex-between">
          <h3 style={{margin:0}}>🏘️ Tous les villages ({filteredVillages.length}{filteredVillages.length!==(villages||[]).length ? (" / "+(villages||[]).length) : ""})</h3>
          <input type="text" placeholder="🔎 Filtrer par nom, coord. ou propriétaire…" style={{maxWidth:260}}
            value={villageFilter} onChange={e=>setVillageFilter(e.target.value)} />
        </div>
        <p className="small muted">Cliquez sur un village pour l'éditer individuellement, y compris une conquête d'un joueur qui n'est pas son village d'origine.</p>
        <div style={{maxHeight:280, overflow:"auto"}}>
          <table><thead><tr><th>Village</th><th>Coord.</th><th>Propriétaire</th><th>HdV</th><th>Ressources</th><th>Files (constr./entr.)</th></tr></thead>
          <tbody>
            {filteredVillages.length ? filteredVillages.map(v => (
              <tr key={v.id} className={selectedVillageId===v.id?"admin-selected":""} onClick={()=>setSelectedVillageId(v.id)}>
                <td>{v.name}</td>
                <td>{v.x}|{v.y}</td>
                <td>{v.isPlayer ? v.owner : "🏚️ barbare"}</td>
                <td>{v.hq!=null ? v.hq : "—"}</td>
                <td>{RES_ICON.wood}{fmt(v.resources.wood)} {RES_ICON.clay}{fmt(v.resources.clay)} {RES_ICON.iron}{fmt(v.resources.iron)}</td>
                <td>{v.buildQueueLen}/{v.trainQueueLen}</td>
              </tr>
            )) : <tr><td colSpan={6} className="muted">{(villages||[]).length ? "Aucun village ne correspond à la recherche." : "Chargement…"}</td></tr>}
          </tbody></table>
        </div>
      </div>

      {selV
        ? <div className="box"><VillageEditor key={selV.id} village={selV} adminAction={adminAction} call={call} /></div>
        : <p className="muted small">Sélectionnez un village ci-dessus pour l'éditer.</p>}
    </div>
  );
}

function SpeedBox({ adminSpeed, adminAction, call, toast }){
  return (
    <div className="box" style={{marginBottom:14}}>
      <h3>⚡ Vitesse du monde</h3>
      <div className="flex-between">
        <span className="small">Multiplicateur actuel : <b>{adminSpeed}×</b> — s'applique immédiatement à tout : ressources, files de construction et d'entraînement déjà en cours <i>et</i> nouvelles (temps divisé par ce facteur).</span>
        <div style={{display:"flex", gap:6}}>
          <input type="number" id="adminSpeedInput" min="0.01" max="1000" step="0.1" defaultValue={adminSpeed} style={{width:90}} />
          <button className="primary" onClick={()=>{
            const v = Number(document.getElementById("adminSpeedInput").value);
            if(!v || v<=0){ toast("⚠️ Valeur invalide."); return; }
            adminAction(()=>call("/api/admin/speed","POST",{multiplier:v}), "Vitesse du monde réglée sur "+v+"×.");
          }}>Appliquer</button>
        </div>
      </div>
    </div>
  );
}

function AnnounceBox({ adminAction, call, toast }){
  return (
    <div className="box" style={{marginBottom:14}}>
      <h3>📢 Annonce à tous les joueurs</h3>
      <p className="small muted">Envoie un message qui apparaît immédiatement dans la boîte de rapports de tous les joueurs actuels.</p>
      <form style={{display:"flex", gap:8, flexWrap:"wrap", alignItems:"flex-start"}} onSubmit={e=>{
        e.preventDefault();
        const inp = document.getElementById("adminAnnounceText");
        const text = (inp.value||"").trim();
        if(!text){ toast("⚠️ Message vide."); return; }
        adminAction(()=>call("/api/admin/announce","POST",{text}), "📢 Annonce publiée à tous les joueurs.");
        inp.value = "";
      }}>
        <textarea id="adminAnnounceText" rows={2} maxLength={500} placeholder="Message de l'administration…" style={{flex:"1 1 260px"}} />
        <button type="submit" className="primary">Publier</button>
      </form>
    </div>
  );
}

function GiveAllBox({ adminAction, call, toast }){
  return (
    <div className="box" style={{marginBottom:14}}>
      <h3>🎁 Ressources pour tous les joueurs</h3>
      <p className="small muted">Ajoute ces montants au stock actuel de chaque joueur, en une seule fois.</p>
      <div className="inputs" style={{display:"flex", gap:14, marginBottom:8, flexWrap:"wrap"}}>
        {["wood","clay","iron"].map(r => (
          <div className="inp" key={r}>{RES_ICON[r]}<input type="number" id={"adminGiveAll_"+r} min="0" defaultValue={0} /></div>
        ))}
        <button className="primary" onClick={()=>{
          const wood = Number(document.getElementById("adminGiveAll_wood").value)||0;
          const clay = Number(document.getElementById("adminGiveAll_clay").value)||0;
          const iron = Number(document.getElementById("adminGiveAll_iron").value)||0;
          if(!wood && !clay && !iron){ toast("⚠️ Indiquez au moins une ressource à donner."); return; }
          adminAction(()=>call("/api/admin/give-all","POST",{wood, clay, iron}), "Ressources données à tous les joueurs.");
        }}>➕ Donner à tous</button>
      </div>
    </div>
  );
}

const BULK_SCOPE_LABEL = { all:"tous les villages", players:"les villages de joueurs", barbarians:"les villages barbares" };

function BulkVillagesBox({ bulkScope, setBulkScope, adminAction, call, toast }){
  return (
    <div className="box" style={{marginBottom:14}}>
      <h3>🌍 Gestion groupée de tous les villages</h3>
      <p className="small muted">Applique une action à plusieurs villages à la fois. Choisissez d'abord la portée ci-dessous ; pour les bâtiments et les troupes, ne remplissez que les champs que vous voulez réellement changer — un champ laissé vide n'est pas touché.</p>
      <div style={{marginBottom:12}}>
        <label className="small muted">Portée de l'action</label><br/>
        <select value={bulkScope} onChange={e=>setBulkScope(e.target.value)}>
          <option value="all">🌐 Tous les villages (joueurs + barbares)</option>
          <option value="players">👥 Villages de joueurs uniquement (origine + conquêtes)</option>
          <option value="barbarians">🏚️ Villages barbares uniquement</option>
        </select>
      </div>

      <h4>Ressources</h4>
      <p className="small muted" style={{marginTop:0}}>Ajoute ces montants au stock actuel de chaque village de la portée (pas de plafond d'entrepôt).</p>
      <div className="inputs" style={{display:"flex", gap:14, marginBottom:8, flexWrap:"wrap", alignItems:"center"}}>
        {["wood","clay","iron"].map(r => (
          <div className="inp" key={r}>{RES_ICON[r]}<input type="number" id={"adminBulkGive_"+r} min="0" placeholder="0" /></div>
        ))}
        <button className="primary" onClick={()=>{
          const wood = Number(document.getElementById("adminBulkGive_wood").value)||0;
          const clay = Number(document.getElementById("adminBulkGive_clay").value)||0;
          const iron = Number(document.getElementById("adminBulkGive_iron").value)||0;
          if(!wood && !clay && !iron){ toast("⚠️ Indiquez au moins une ressource à donner."); return; }
          adminAction(()=>call("/api/admin/villages/bulk-give","POST",{scope:bulkScope, wood, clay, iron}), "Ressources données à "+BULK_SCOPE_LABEL[bulkScope]+".");
        }}>➕ Donner à la portée sélectionnée</button>
      </div>

      <h4>Bâtiments <span className="small muted" style={{fontWeight:"normal"}}>(niveau exact — ignoré pour les villages barbares, qui n'en ont pas)</span></h4>
      <div className="grid-buildings" style={{gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", marginBottom:8}}>
        {BUILD_ORDER.map(k => (
          <div className="troop-row" key={k}><span className="tname">{BUILDINGS[k].name}</span><input type="number" id={"adminBulkBuild_"+k} min="0" max={BUILDINGS[k].max} placeholder="—" /></div>
        ))}
      </div>
      <button className="primary" style={{marginBottom:14}} onClick={()=>{
        const buildings = {};
        BUILD_ORDER.forEach(k => { const el = document.getElementById("adminBulkBuild_"+k); if(el && el.value!=="") buildings[k] = Number(el.value)||0; });
        if(!Object.keys(buildings).length){ toast("⚠️ Remplissez au moins un niveau de bâtiment à appliquer."); return; }
        adminAction(()=>call("/api/admin/villages/bulk-update","POST",{scope:bulkScope, buildings}), "Bâtiments appliqués à "+BULK_SCOPE_LABEL[bulkScope]+".");
      }}>Appliquer les bâtiments remplis à la portée</button>

      <h4>Troupes <span className="small muted" style={{fontWeight:"normal"}}>(nombre exact)</span></h4>
      <div className="grid-buildings" style={{gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", marginBottom:8}}>
        {TROOP_ORDER.map(k => (
          <div className="troop-row" key={k}><span className="tname">{TROOPS[k].name}</span><input type="number" id={"adminBulkTroop_"+k} min="0" placeholder="—" /></div>
        ))}
      </div>
      <button className="primary" style={{marginBottom:14}} onClick={()=>{
        const troops = {};
        TROOP_ORDER.forEach(k => { const el = document.getElementById("adminBulkTroop_"+k); if(el && el.value!=="") troops[k] = Number(el.value)||0; });
        if(!Object.keys(troops).length){ toast("⚠️ Remplissez au moins un nombre de troupes à appliquer."); return; }
        adminAction(()=>call("/api/admin/villages/bulk-update","POST",{scope:bulkScope, troops}), "Troupes appliquées à "+BULK_SCOPE_LABEL[bulkScope]+".");
      }}>Appliquer les troupes remplies à la portée</button>

      <h4>Files d'attente</h4>
      <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
        <button onClick={()=>adminAction(()=>call("/api/admin/villages/bulk-finish-build","POST",{scope:bulkScope}), "Constructions terminées pour "+BULK_SCOPE_LABEL[bulkScope]+".")}>✅ Terminer toutes les constructions en cours (portée)</button>
        <button onClick={()=>adminAction(()=>call("/api/admin/villages/bulk-finish-train","POST",{scope:bulkScope}), "Entraînements terminés pour "+BULK_SCOPE_LABEL[bulkScope]+".")}>✅ Terminer tous les entraînements en cours (portée)</button>
      </div>
    </div>
  );
}

function ServerEventsBox({ snapshot, eventKey, setEventKey, adminAction, call, toast }){
  const def = SERVER_EVENTS.find(e => e.key===eventKey) || SERVER_EVENTS[0];
  const isInstant = def?.kind==="instant";
  const activeEvents = snapshot.serverEvents || [];
  return (
    <div className="box" style={{marginBottom:14}}>
      <h3>🎉 Évènements du serveur</h3>
      <p className="small muted">Lance un évènement temporaire visible par tous les joueurs (bannière + annonce automatique dans leurs rapports). Un seul évènement actif à la fois par type d'effet : en relancer un remplace celui en cours.</p>
      {activeEvents.length ? (
        <div className="event-badges" style={{marginBottom:12}}>
          {activeEvents.map(e => (
            <span key={e.id} className="event-badge admin" title={e.name+" ×"+e.multiplier+" — encore "+fmtTime(e.remainingSec)+" (cliquer pour arrêter)"}
              onClick={()=>adminAction(()=>call("/api/admin/event/stop","POST",{id:e.id}), "Évènement arrêté.")}>
              {e.icon}<span className="event-badge-mult">×{e.multiplier}</span><span className="event-badge-stop">✕</span>
            </span>
          ))}
        </div>
      ) : <p className="small muted">Aucun évènement actif actuellement.</p>}
      <form style={{display:"flex", gap:12, flexWrap:"wrap", alignItems:"flex-end"}} onSubmit={e=>{
        e.preventDefault();
        if(!def) return;
        if(isInstant){
          const amount = Number(document.getElementById("adminEventAmount").value);
          if(!amount || amount<=0){ toast("⚠️ Montant invalide."); return; }
          adminAction(()=>call("/api/admin/event/start","POST",{key:def.key, amount}), def.icon+" "+def.name+" envoyé à tous les joueurs.");
        } else {
          const multiplier = Number(document.getElementById("adminEventMultiplier").value);
          const minutes = Number(document.getElementById("adminEventMinutes").value);
          if(!multiplier || multiplier<=1){ toast("⚠️ Le multiplicateur doit être supérieur à 1."); return; }
          if(!minutes || minutes<=0){ toast("⚠️ Durée invalide."); return; }
          adminAction(()=>call("/api/admin/event/start","POST",{key:def.key, multiplier, minutes}), def.icon+" "+def.name+" lancé pour "+minutes+" min.");
        }
      }}>
        <div>
          <label className="small muted">Type d'évènement</label><br/>
          <select value={eventKey} onChange={e=>setEventKey(e.target.value)}>
            {SERVER_EVENTS.map(e => <option key={e.key} value={e.key}>{e.icon} {e.name}</option>)}
          </select>
        </div>
        {isInstant && <div>
          <label className="small muted">Montant (bois + argile + fer, chacun)</label><br/>
          <input type="number" id="adminEventAmount" min="1" max="1000000" defaultValue={1000} />
        </div>}
        {!isInstant && <div>
          <label className="small muted">Multiplicateur (×)</label><br/>
          <input type="number" id="adminEventMultiplier" min="1.1" max="20" step="0.1" defaultValue={2} />
        </div>}
        {!isInstant && <div>
          <label className="small muted">Durée (minutes)</label><br/>
          <input type="number" id="adminEventMinutes" min="1" max="10080" defaultValue={60} />
        </div>}
        <button type="submit" className="primary">🚀 Lancer</button>
      </form>
      <p className="small muted" style={{marginTop:8}}>{def?.desc}</p>
    </div>
  );
}

function BlackArmyBox({ snapshot, adminAction, call, toast }){
  const ba = snapshot.blackArmyEvent;
  const active = ba && ba.active;
  return (
    <div className="box" style={{marginBottom:14, borderColor:"#9a2b2b"}}>
      <h3>🏴 Évènement : l'Armée Noire</h3>
      <p className="small muted">Fait apparaître une vague de campements PNJ (pins noirs sur la Carte), plus forts et plus riches que des barbares ordinaires, répartis en 5 Rangs (I faible → V redoutable) pour donner un objectif aussi bien aux nouveaux joueurs qu'aux joueurs multi-villages. Une annonce automatique explique les règles à tous. Un seul évènement à la fois.</p>
      {active ? (
        <>
          <div className="event-badges" style={{marginBottom:12}}>
            <span className="event-badge admin" title={"🏴 L'Armée Noire — encore "+fmtTime(ba.remainingSec)+" (cliquer pour arrêter)"}
              onClick={()=>adminAction(()=>call("/api/admin/blackarmy/stop","POST",{}), "Évènement Armée Noire arrêté.")}>
              🏴<span className="event-badge-mult">{fmt(ba.totalSpawned)} campements</span><span className="event-badge-stop">✕</span>
            </span>
          </div>
          <p className="small muted">Encore <b>{fmtTime(ba.remainingSec)}</b> avant le retrait automatique des campements non conquis — {fmt(ba.defeatedCount)} victoire{ba.defeatedCount>1?"s":""} enregistrée{ba.defeatedCount>1?"s":""} jusqu'ici.</p>
        </>
      ) : <p className="small muted">Aucun évènement Armée Noire actif actuellement.</p>}
      <form style={{display:"flex", gap:12, flexWrap:"wrap", alignItems:"flex-end"}} inert={active ? "" : undefined} onSubmit={e=>{
        e.preventDefault();
        if(active) return;
        const count = Number(document.getElementById("adminBlackArmyCount").value);
        const minutes = Number(document.getElementById("adminBlackArmyMinutes").value);
        if(!count || count<=0){ toast("⚠️ Nombre de campements invalide."); return; }
        if(!minutes || minutes<=0){ toast("⚠️ Durée invalide."); return; }
        adminAction(()=>call("/api/admin/blackarmy/start","POST",{count, minutes}), "🏴 L'Armée Noire envahit le monde !");
      }}>
        <div>
          <label className="small muted">Nombre de campements</label><br/>
          <input type="number" id="adminBlackArmyCount" min="5" max="150" defaultValue={40} />
        </div>
        <div>
          <label className="small muted">Durée (minutes)</label><br/>
          <input type="number" id="adminBlackArmyMinutes" min="60" max="10080" defaultValue={4320} />
        </div>
        <button type="submit" className="primary" disabled={active}>🏴 Lancer l'Armée Noire</button>
      </form>
    </div>
  );
}

function MissionsBox({ missions, adminAction, call }){
  const list = missions || [];
  return (
    <div className="box" style={{marginBottom:14}}>
      <h3>🚩 Missions en cours ({list.length})</h3>
      <p className="small muted">Force la résolution/arrivée immédiate d'une mission (attaque, reconnaissance, soutien...), utile pour débloquer un joueur ou tester.</p>
      <div style={{maxHeight:220, overflow:"auto"}}>
        <table><thead><tr><th>Type</th><th>Joueur</th><th>Cible</th><th>Statut</th><th></th></tr></thead>
        <tbody>
          {list.length ? list.map(m => (
            <tr key={m.id}>
              <td>{m.kindLabel}</td>
              <td>{m.attacker || "-"}</td>
              <td>{m.targetName ? (m.targetName+" ("+m.targetCoord+")") : "-"}</td>
              <td>{m.resolveDone ? "retour" : "en route"}</td>
              <td><button onClick={()=>adminAction(()=>call("/api/admin/finish-mission","POST",{missionId:m.id}), "Mission résolue instantanément.")}>✅ Terminer</button></td>
            </tr>
          )) : <tr><td colSpan={5} className="muted">Aucune mission en cours.</td></tr>}
        </tbody></table>
      </div>
    </div>
  );
}

function PlayerEditor({ player:p, username, adminAction, call, toast, onDeleted }){
  return (
    <div>
      <div className="flex-between" style={{marginBottom:10}}>
        <h3 style={{margin:0}}>✏️ {p.username} {p.isAdmin ? <span className="tag strong">ADMIN</span> : null}</h3>
        <div style={{display:"flex", gap:6}}>
          <button onClick={()=>adminAction(()=>call("/api/admin/setadmin","POST",{username:p.username, isAdmin:!p.isAdmin}), p.isAdmin?("Droits admin retirés à "+p.username+"."):("Droits admin accordés à "+p.username+"."))}>
            {p.isAdmin ? "Retirer les droits admin" : "Promouvoir administrateur"}
          </button>
          <button className="danger" title="Supprime le compte définitivement. Ses villages redeviennent barbares (jamais supprimés de la carte)."
            onClick={()=>{
              if(p.username===username){ toast("⚠️ Vous ne pouvez pas supprimer votre propre compte."); return; }
              if(!confirm("Supprimer définitivement le compte « "+p.username+" » ? Cette action est irréversible : son compte, ses rapports, son adhésion à sa guilde et ses offres au marché seront supprimés, et son ou ses village(s) redeviendront des villages barbares.")) return;
              onDeleted();
              adminAction(()=>call("/api/admin/delete-player","POST",{username:p.username}), "🗑️ Compte « "+p.username+" » supprimé.");
            }}>🗑️ Supprimer le joueur</button>
        </div>
      </div>
      <div style={{display:"flex", gap:8, marginBottom:14, flexWrap:"wrap"}}>
        <button onClick={()=>adminAction(()=>call("/api/admin/finish-build","POST",{username:p.username}), "Construction(s) terminée(s) instantanément.")}>✅ Terminer la construction en cours</button>
        <button onClick={()=>adminAction(()=>call("/api/admin/finish-train","POST",{username:p.username}), "Entraînement(s) terminé(s) instantanément.")}>✅ Terminer l'entraînement en cours</button>
      </div>

      <h4>Ressources</h4>
      <div className="inputs" style={{display:"flex", gap:14, marginBottom:8}}>
        {["wood","clay","iron"].map(r => (
          <div className="inp" key={r}>{RES_ICON[r]}<input type="number" id={"adminRes_"+r} min="0" defaultValue={p.resources?Math.round(p.resources[r]||0):0} /></div>
        ))}
      </div>
      <div style={{display:"flex", gap:8, marginBottom:14, flexWrap:"wrap"}}>
        <button className="primary" onClick={()=>{
          const resources = {
            wood: Number(document.getElementById("adminRes_wood").value)||0,
            clay: Number(document.getElementById("adminRes_clay").value)||0,
            iron: Number(document.getElementById("adminRes_iron").value)||0,
          };
          adminAction(()=>call("/api/admin/village","POST",{username:p.username, resources}), "Ressources mises à jour pour "+p.username+".");
        }}>Définir (valeur exacte)</button>
        <button onClick={()=>{
          const wood = Number(document.getElementById("adminRes_wood").value)||0;
          const clay = Number(document.getElementById("adminRes_clay").value)||0;
          const iron = Number(document.getElementById("adminRes_iron").value)||0;
          adminAction(()=>call("/api/admin/give","POST",{username:p.username, wood, clay, iron}), "Ressources données à "+p.username+".");
        }}>➕ Donner (ajoute ces montants au stock actuel)</button>
      </div>

      <h4>Bâtiments</h4>
      <div className="grid-buildings" style={{gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", marginBottom:8}}>
        {BUILD_ORDER.map(k => (
          <div className="troop-row" key={k}><span className="tname">{BUILDINGS[k].name}</span><input type="number" id={"adminBuild_"+k} min="0" max={BUILDINGS[k].max} defaultValue={p.buildings?p.buildings[k]||0:0} /></div>
        ))}
      </div>
      <button className="primary" style={{marginBottom:14}} onClick={()=>{
        const buildings = {};
        BUILD_ORDER.forEach(k => { const el = document.getElementById("adminBuild_"+k); if(el) buildings[k] = Number(el.value)||0; });
        adminAction(()=>call("/api/admin/village","POST",{username:p.username, buildings}), "Bâtiments mis à jour pour "+p.username+".");
      }}>Enregistrer les bâtiments</button>

      <h4>Troupes</h4>
      <div className="grid-buildings" style={{gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", marginBottom:8}}>
        {TROOP_ORDER.map(k => (
          <div className="troop-row" key={k}><span className="tname">{TROOPS[k].name}</span><input type="number" id={"adminTroop_"+k} min="0" defaultValue={p.troops?p.troops[k]||0:0} /></div>
        ))}
      </div>
      <button className="primary" onClick={()=>{
        const troops = {};
        TROOP_ORDER.forEach(k => { const el = document.getElementById("adminTroop_"+k); if(el) troops[k] = Number(el.value)||0; });
        adminAction(()=>call("/api/admin/village","POST",{username:p.username, troops}), "Troupes mises à jour pour "+p.username+".");
      }}>Enregistrer les troupes</button>
    </div>
  );
}

function VillageEditor({ village:v, adminAction, call }){
  return (
    <div>
      <div className="flex-between" style={{marginBottom:10}}>
        <h3 style={{margin:0}}>✏️ {v.name} <span className="small muted" style={{fontWeight:"normal"}}>({v.x}|{v.y}) — {v.isPlayer ? v.owner : "🏚️ village barbare"}</span></h3>
      </div>
      {v.isPlayer && <div style={{display:"flex", gap:8, marginBottom:14, flexWrap:"wrap"}}>
        <button onClick={()=>adminAction(()=>call("/api/admin/villages/finish-build","POST",{villageId:v.id}), "Construction(s) terminée(s) pour ce village.")}>✅ Terminer la construction en cours</button>
        <button onClick={()=>adminAction(()=>call("/api/admin/villages/finish-train","POST",{villageId:v.id}), "Entraînement(s) terminé(s) pour ce village.")}>✅ Terminer l'entraînement en cours</button>
      </div>}

      <h4>Ressources</h4>
      <div className="inputs" style={{display:"flex", gap:14, marginBottom:8}}>
        {["wood","clay","iron"].map(r => (
          <div className="inp" key={r}>{RES_ICON[r]}<input type="number" id={"adminVRes_"+r} min="0" defaultValue={Math.round(v.resources?v.resources[r]||0:0)} /></div>
        ))}
      </div>
      <div style={{display:"flex", gap:8, marginBottom:14, flexWrap:"wrap"}}>
        <button className="primary" onClick={()=>{
          const resources = {
            wood: Number(document.getElementById("adminVRes_wood").value)||0,
            clay: Number(document.getElementById("adminVRes_clay").value)||0,
            iron: Number(document.getElementById("adminVRes_iron").value)||0,
          };
          adminAction(()=>call("/api/admin/villages/update","POST",{villageId:v.id, resources}), "Ressources mises à jour pour ce village.");
        }}>Définir (valeur exacte)</button>
        <button onClick={()=>{
          const wood = Number(document.getElementById("adminVRes_wood").value)||0;
          const clay = Number(document.getElementById("adminVRes_clay").value)||0;
          const iron = Number(document.getElementById("adminVRes_iron").value)||0;
          adminAction(()=>call("/api/admin/villages/give","POST",{villageId:v.id, wood, clay, iron}), "Ressources données à ce village.");
        }}>➕ Donner (ajoute ces montants au stock actuel)</button>
      </div>

      {v.buildings ? (
        <>
          <h4>Bâtiments</h4>
          <div className="grid-buildings" style={{gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", marginBottom:8}}>
            {BUILD_ORDER.map(k => (
              <div className="troop-row" key={k}><span className="tname">{BUILDINGS[k].name}</span><input type="number" id={"adminVBuild_"+k} min="0" max={BUILDINGS[k].max} defaultValue={v.buildings[k]||0} /></div>
            ))}
          </div>
          <button className="primary" style={{marginBottom:14}} onClick={()=>{
            const buildings = {};
            BUILD_ORDER.forEach(k => { const el = document.getElementById("adminVBuild_"+k); if(el) buildings[k] = Number(el.value)||0; });
            adminAction(()=>call("/api/admin/villages/update","POST",{villageId:v.id, buildings}), "Bâtiments mis à jour pour ce village.");
          }}>Enregistrer les bâtiments</button>
        </>
      ) : <p className="small muted">Village barbare : pas de bâtiments (niveau de muraille actuel : {v.wallLevel||0}).</p>}

      <h4>Troupes</h4>
      <div className="grid-buildings" style={{gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", marginBottom:8}}>
        {TROOP_ORDER.map(k => (
          <div className="troop-row" key={k}><span className="tname">{TROOPS[k].name}</span><input type="number" id={"adminVTroop_"+k} min="0" defaultValue={v.troops?v.troops[k]||0:0} /></div>
        ))}
      </div>
      <button className="primary" onClick={()=>{
        const troops = {};
        TROOP_ORDER.forEach(k => { const el = document.getElementById("adminVTroop_"+k); if(el) troops[k] = Number(el.value)||0; });
        adminAction(()=>call("/api/admin/villages/update","POST",{villageId:v.id, troops}), "Troupes mises à jour pour ce village.");
      }}>Enregistrer les troupes</button>
    </div>
  );
}
