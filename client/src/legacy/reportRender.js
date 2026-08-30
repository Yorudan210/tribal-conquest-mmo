// Porte le corps de renderReports() (le grand switch par r.kind) -- fonction pure retournant du HTML
// pour UN rapport, réutilisée par ReportsTab.jsx via dangerouslySetInnerHTML + délégation
// d'évènement (data-toggle/data-delete-report/data-guild-invite-accept/decline/data-open-profile),
// exactement comme pour la carte (legacy/mapRender.js) : bien plus fiable qu'une retranscription
// manuelle en JSX pour un contenu aussi hétérogène (12 natures de rapport, graphiques SVG intégrés).
import { TROOP_ORDER, TROOPS } from "../gameData.js";
import { fmt, fmtTime, fmtTroops, RES_ICON, RES_NAME, escapeHtml } from "../formulas.js";
import { combatChartsHtml, nobleReportLine } from "./combatCharts.js";

export const DIPLOMACY_LABEL_LOWER = {pact:"un pacte de non-agression", alliance:"une alliance", war:"un état de guerre"};

export const REPORT_FILTERS = [
  {key:"all", label:"Tous"},
  {key:"attack", label:"⚔️ Attaques envoyées"},
  {key:"defense", label:"🛡️ Attaques subies"},
  {key:"scout", label:"🔭 Reconnaissances", kinds:["scout","scoutDefense"]},
  {key:"raid", label:"⚠️ Raids de pillards"},
  {key:"support", label:"🤝 Soutien", kinds:["supportIn","supportOut"]},
  {key:"gift", label:"🎁 Dons", kinds:["giftIn","giftOut"]},
  {key:"market", label:"🏪 Marché", kinds:["marketSold","marketBought"]},
  {key:"guildInvite", label:"👥 Guilde"},
  {key:"diplomacy", label:"🕊️ Diplomatie", kinds:["diplomacyProposal","diplomacyAccepted","diplomacyDeclined","diplomacyEnded","diplomacyWar"]},
  {key:"announcement", label:"📢 Annonces"},
];

export function reportMatchesFilter(r, f){ return f.kinds ? f.kinds.includes(r.kind) : r.kind===f.key; }

function reportActions(r, now){
  return `<span class="actions"><span class="small muted">${fmtTime(Math.max(0,now-r.time))}</span><button class="report-del" data-delete-report="${r.id}" title="Supprimer ce rapport">🗑️</button></span>`;
}

export function reportRowHtml(r, open, now){
  if(r.kind==="attack"){
    const win = r.winner==="attacker";
    const titleLabel = r.conquered ? "👑 Village conquis" : (win?"🏆 Victoire":"💀 Défaite");
    return `<div class="report ${win?'win':'lose'}">
      <div class="title" data-toggle="${r.id}"><span><span class="report-pill ${win?'win':'lose'}">${titleLabel}</span> contre ${escapeHtml(r.target)} (${r.coord})${r.targetIsPlayer?(' — joueur '+escapeHtml(r.targetOwner)):''}</span>${reportActions(r,now)}</div>
      <div class="details ${open?'open':''}">
        ${combatChartsHtml(r, "Pertes infligées au défenseur")}
        ${nobleReportLine(r)}
        ${win?`<div class="small muted" style="margin-top:4px;">Butin : 🪵${r.loot.wood} 🧱${r.loot.clay} ⛏️${r.loot.iron}</div>`:""}
        ${r.wallDamage?`<div class="small muted" style="margin-top:4px;">Muraille adverse endommagée : -${r.wallDamage} niveau(x)${r.targetWallLevelAfter!=null?(' (reste niveau '+r.targetWallLevelAfter+')'):''}</div>`:""}
        ${r.storageDamageFrac?`<div class="small muted" style="margin-top:4px;">Entrepôt adverse endommagé : -${Math.round(r.storageDamageFrac*100)}% de capacité</div>`:""}
        ${r.loyaltyReduced?`<div class="small muted" style="margin-top:4px;">Loyauté réduite de ${r.loyaltyReduced}% (reste ${Math.round(r.targetLoyalty)}%)${r.conquered?" — village conquis !":""}</div>`:""}
      </div>
    </div>`;
  }
  if(r.kind==="defense"){
    const win = r.winner==="attacker";
    return `<div class="report defense">
      <div class="title" data-toggle="${r.id}"><span><span class="report-pill ${win?'lose':'win'}">${win?'💀 Raid subi':'🛡️ Repoussé'}</span> de ${escapeHtml(r.source)}</span>${reportActions(r,now)}</div>
      <div class="details ${open?'open':''}">
        ${combatChartsHtml(r, "Vos pertes")}
        ${r.wallDamage?`<div class="small muted" style="margin-top:4px;">Votre muraille a été endommagée : -${r.wallDamage} niveau(x)${r.targetWallLevelAfter!=null?(' (reste niveau '+r.targetWallLevelAfter+')'):''}</div>`:""}
        <div class="small muted" style="margin-top:4px;">${win?`Ressources pillées : 🪵${r.loot.wood} 🧱${r.loot.clay} ⛏️${r.loot.iron}`:"Aucune perte de ressources."}</div>
      </div>
    </div>`;
  }
  if(r.kind==="scout"){
    if(r.lost){
      return `<div class="report scout lose">
        <div class="title" data-toggle="${r.id}"><span>🔭 Reconnaissance échouée${r.target?(' contre '+escapeHtml(r.target)+' ('+r.coord+')'):''}</span>${reportActions(r,now)}</div>
        <div class="details ${open?'open':''}">
          ${r.counterSpied?`Contre-espionnage : ${r.defenderScouts} éclaireur(s) en défense contre ${r.attackerScouts} envoyé(s). Aucun renseignement obtenu.`:escapeHtml(r.text||"Le village ciblé n'existe plus.")}
        </div>
      </div>`;
    }
    return `<div class="report scout">
      <div class="title" data-toggle="${r.id}"><span>🔭 Reconnaissance de ${escapeHtml(r.target)} (${r.coord})</span>${reportActions(r,now)}</div>
      <div class="details ${open?'open':''}">
        Ressources : 🪵${fmt(r.resources.wood)} 🧱${fmt(r.resources.clay)} ⛏️${fmt(r.resources.iron)}<br>
        Troupes : ${TROOP_ORDER.map(k=>TROOPS[k].name+" "+(r.troops[k]||0)).join(", ")}<br>
        Muraille niveau ${r.wallLevel}${r.loyalty!=null?(' · Loyauté '+Math.round(r.loyalty)+'%'):''}
      </div>
    </div>`;
  }
  if(r.kind==="scoutDefense"){
    return `<div class="report scout win">
      <div class="title" data-toggle="${r.id}"><span>🛡️ Reconnaissance ennemie repoussée (${escapeHtml(r.attacker)})</span>${reportActions(r,now)}</div>
      <div class="details ${open?'open':''}">
        Vos ${r.defenderScouts} éclaireur(s) ont repéré et éliminé les ${r.attackerScouts} éclaireur(s) envoyé(s) par ${escapeHtml(r.attacker)} : aucun renseignement n'a été obtenu sur votre village.
      </div>
    </div>`;
  }
  if(r.kind==="raid"){
    return `<div class="report raid">
      <div class="title" data-toggle="${r.id}"><span>⚠️ Raid de pillards</span>${reportActions(r,now)}</div>
      <div class="details ${open?'open':''}">Ressources perdues : 🪵${(r.lost&&r.lost.wood)||0} 🧱${(r.lost&&r.lost.clay)||0} ⛏️${(r.lost&&r.lost.iron)||0}</div>
    </div>`;
  }
  if(r.kind==="supportIn"){
    return `<div class="report support">
      <div class="title"><span>🤝 Renfort reçu de ${escapeHtml(r.from)}</span>${reportActions(r,now)}</div>
      <div class="details open">${fmtTroops(r.troops)}</div>
    </div>`;
  }
  if(r.kind==="supportOut"){
    return `<div class="report support">
      <div class="title"><span>🤝 Renfort envoyé${r.lost?'':(' vers '+escapeHtml(r.target)+' ('+r.coord+')')}</span>${reportActions(r,now)}</div>
      <div class="details open">${r.lost?escapeHtml(r.text||''):fmtTroops(r.troops)}</div>
    </div>`;
  }
  if(r.kind==="giftIn"){
    return `<div class="report gift">
      <div class="title"><span>🎁 Don reçu de ${escapeHtml(r.from)}</span>${reportActions(r,now)}</div>
      <div class="details open">🪵${fmt(r.wood)} 🧱${fmt(r.clay)} ⛏️${fmt(r.iron)}</div>
    </div>`;
  }
  if(r.kind==="giftOut"){
    return `<div class="report gift">
      <div class="title"><span>🎁 Don envoyé à ${escapeHtml(r.target)}</span>${reportActions(r,now)}</div>
      <div class="details open">🪵${fmt(r.wood)} 🧱${fmt(r.clay)} ⛏️${fmt(r.iron)}</div>
    </div>`;
  }
  if(r.kind==="marketSold"){
    return `<div class="report market">
      <div class="title"><span>🏪 Offre acceptée par ${escapeHtml(r.other)}</span>${reportActions(r,now)}</div>
      <div class="details open">Vous avez donné ${RES_ICON[r.giveRes]} ${fmt(r.giveAmount)} ${RES_NAME[r.giveRes].toLowerCase()} contre ${RES_ICON[r.wantRes]} ${fmt(r.wantAmount)} ${RES_NAME[r.wantRes].toLowerCase()} reçu(e)(s).</div>
    </div>`;
  }
  if(r.kind==="marketBought"){
    return `<div class="report market">
      <div class="title"><span>🏪 Échange conclu avec ${escapeHtml(r.other)}</span>${reportActions(r,now)}</div>
      <div class="details open">Vous avez donné ${RES_ICON[r.wantRes]} ${fmt(r.wantAmount)} ${RES_NAME[r.wantRes].toLowerCase()} contre ${RES_ICON[r.giveRes]} ${fmt(r.giveAmount)} ${RES_NAME[r.giveRes].toLowerCase()} reçu(e)(s).</div>
    </div>`;
  }
  if(r.kind==="guildInvite"){
    return `<div class="report guild">
      <div class="title"><span>👥 Invitation de guilde : [${escapeHtml(r.guildTag)}] ${escapeHtml(r.guildName)} (par ${escapeHtml(r.from)})</span>${reportActions(r,now)}</div>
      <div class="details open">
        <button data-guild-invite-accept="${r.guildId}" class="primary">✅ Rejoindre</button>
        <button data-guild-invite-decline="${r.guildId}">❌ Refuser</button>
      </div>
    </div>`;
  }
  if(r.kind==="diplomacyProposal"){
    return `<div class="report guild">
      <div class="title"><span>🕊️ [${escapeHtml(r.fromGuildTag)}] ${escapeHtml(r.fromGuildName)} propose ${DIPLOMACY_LABEL_LOWER[r.relType]}</span>${reportActions(r,now)}</div>
      <div class="details open">Rendez-vous dans l'onglet Guilde pour accepter ou refuser (chef de guilde uniquement).</div>
    </div>`;
  }
  if(r.kind==="diplomacyAccepted"){
    return `<div class="report guild">
      <div class="title"><span>🤝 [${escapeHtml(r.fromGuildTag)}] ${escapeHtml(r.fromGuildName)} a accepté ${DIPLOMACY_LABEL_LOWER[r.relType]}</span>${reportActions(r,now)}</div>
    </div>`;
  }
  if(r.kind==="diplomacyDeclined"){
    return `<div class="report guild">
      <div class="title"><span>❌ [${escapeHtml(r.fromGuildTag)}] ${escapeHtml(r.fromGuildName)} a refusé ${DIPLOMACY_LABEL_LOWER[r.relType]}</span>${reportActions(r,now)}</div>
    </div>`;
  }
  if(r.kind==="diplomacyEnded"){
    return `<div class="report guild">
      <div class="title"><span>💔 [${escapeHtml(r.fromGuildTag)}] ${escapeHtml(r.fromGuildName)} a ${r.wasPending?"retiré sa proposition de ":"mis fin à "}${DIPLOMACY_LABEL_LOWER[r.relType]}</span>${reportActions(r,now)}</div>
    </div>`;
  }
  if(r.kind==="diplomacyWar"){
    return `<div class="report defense">
      <div class="title"><span>⚔️ [${escapeHtml(r.fromGuildTag)}] ${escapeHtml(r.fromGuildName)} vous a déclaré la guerre !</span>${reportActions(r,now)}</div>
    </div>`;
  }
  if(r.kind==="announcement"){
    return `<div class="report announcement">
      <div class="title"><span>📢 Annonce${r.author?(' de '+escapeHtml(r.author)):''}</span>${reportActions(r,now)}</div>
      <div class="details open" style="white-space:pre-wrap;">${escapeHtml(r.text||'')}</div>
    </div>`;
  }
  return `<div class="report"><div class="title"><span>${escapeHtml(r.text||'')}</span>${reportActions(r,now)}</div></div>`;
}
