// Graphiques de combat (rapports "attack"/"defense"/"raid") : trois petits graphiques SVG en ligne,
// portés TELS QUELS depuis l'ancien public/index.html -- fonctions pures (mêmes coordonnées de
// tracé ajustées au pixel près), rendues côté React via dangerouslySetInnerHTML (voir ReportsTab.jsx).
import { TROOP_ORDER, TROOPS } from "../gameData.js";
import { fmt } from "../formulas.js";

const COMBAT_CHART_COLOR = { attack:"#c15b46", defense:"#5b93b0", survive:"#6bab5e", loss:"#c15b46" };

export function combatPowerChartSvg(r){
  const W=460, barX=96, barW=270, barH=16, rowGap=36;
  const maxPower = Math.max(r.attackPower||0, r.effAttack||0, r.defensePower||0, 1);
  const scale = v => Math.max(0, Math.min(barW, (v/maxPower)*barW));
  const attackWon = r.winner==="attacker";
  const effX = barX + scale(r.effAttack);
  const luckPct = Math.round((r.luck||0)*100);
  const luckLabel = (luckPct>=0?"+":"")+luckPct+"% chance";
  const H = rowGap*2+14;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%; max-width:460px; height:auto; display:block;" role="img" aria-label="Comparaison de la puissance d'attaque et de défense">
    <text x="0" y="13" font-size="12" fill="${COMBAT_CHART_COLOR.attack}" font-weight="bold">⚔️ Attaque${attackWon?' 🏆':''}</text>
    <rect x="${barX}" y="3" width="${barW}" height="${barH}" rx="4" fill="#000" opacity="0.2"></rect>
    <rect x="${barX}" y="3" width="${scale(r.attackPower)}" height="${barH}" rx="4" fill="${COMBAT_CHART_COLOR.attack}" opacity="0.55"></rect>
    <line x1="${effX}" y1="0" x2="${effX}" y2="${3+barH+4}" stroke="#f2e6c8" stroke-width="2"></line>
    <text x="${Math.max(20,Math.min(W-20,effX))}" y="${3+barH+15}" font-size="9" fill="#f2e6c8" text-anchor="middle">${luckLabel}</text>
    <text x="${barX+barW+8}" y="15" font-size="11" fill="#f2e6c8">${fmt(r.attackPower)}</text>
    <text x="0" y="${rowGap+13}" font-size="12" fill="${COMBAT_CHART_COLOR.defense}" font-weight="bold">🛡️ Défense${!attackWon?' 🏆':''}</text>
    <rect x="${barX}" y="${rowGap+3}" width="${barW}" height="${barH}" rx="4" fill="#000" opacity="0.2"></rect>
    <rect x="${barX}" y="${rowGap+3}" width="${scale(r.defensePower)}" height="${barH}" rx="4" fill="${COMBAT_CHART_COLOR.defense}"></rect>
    <text x="${barX+barW+8}" y="${rowGap+15}" font-size="11" fill="#f2e6c8">${fmt(r.defensePower)}</text>
  </svg>`;
}

export function combatTroopsChartSvg(r){
  const rows = TROOP_ORDER.filter(k=>(r.troopsSent&&r.troopsSent[k]>0));
  if(!rows.length) return "";
  const W=460, barX=92, barW=230, barH=14, rowH=22;
  const maxSent = Math.max(1, ...rows.map(k=>r.troopsSent[k]||0));
  const scale = v => Math.max(0, Math.min(barW, (v/maxSent)*barW));
  const H = rows.length*rowH+4;
  const bars = rows.map((k,i)=>{
    const sent=r.troopsSent[k]||0;
    const survived=(r.attackerSurvivors&&r.attackerSurvivors[k])||0;
    const survivedW=scale(survived);
    const lostW=Math.max(0, scale(sent)-survivedW);
    const y=i*rowH;
    return `<text x="0" y="${y+11}" font-size="10" fill="#f2e6c8">${TROOPS[k].name}</text>
      <rect x="${barX}" y="${y+1}" width="${scale(sent)}" height="${barH}" rx="3" fill="#000" opacity="0.2"></rect>
      <rect x="${barX}" y="${y+1}" width="${survivedW}" height="${barH}" rx="3" fill="${COMBAT_CHART_COLOR.survive}"></rect>
      <rect x="${barX+survivedW}" y="${y+1}" width="${lostW}" height="${barH}" fill="${COMBAT_CHART_COLOR.loss}"></rect>
      <text x="${barX+barW+8}" y="${y+11}" font-size="9" fill="#bfa878">${fmt(sent)} env. · ${fmt(survived)} vivants</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%; max-width:460px; height:auto; display:block;" role="img" aria-label="Composition de l'armée attaquante : envoyés, survivants et perdus par type de troupe">${bars}</svg>`;
}

export function combatDefenderLossesChartSvg(r){
  const rows = TROOP_ORDER.filter(k=>(r.defenderLosses&&r.defenderLosses[k]>0));
  if(!rows.length) return "";
  const W=460, barX=92, barW=230, barH=14, rowH=22;
  const maxLoss = Math.max(1, ...rows.map(k=>r.defenderLosses[k]||0));
  const scale = v => Math.max(0, Math.min(barW, (v/maxLoss)*barW));
  const H = rows.length*rowH+4;
  const bars = rows.map((k,i)=>{
    const lost=r.defenderLosses[k]||0;
    const y=i*rowH;
    return `<text x="0" y="${y+11}" font-size="10" fill="#f2e6c8">${TROOPS[k].name}</text>
      <rect x="${barX}" y="${y+1}" width="${barW}" height="${barH}" rx="3" fill="#000" opacity="0.2"></rect>
      <rect x="${barX}" y="${y+1}" width="${scale(lost)}" height="${barH}" rx="3" fill="${COMBAT_CHART_COLOR.loss}"></rect>
      <text x="${barX+barW+8}" y="${y+11}" font-size="9" fill="#bfa878">-${fmt(lost)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%; max-width:460px; height:auto; display:block;" role="img" aria-label="Pertes subies par le camp défenseur, par type de troupe">${bars}</svg>`;
}

export function combatChartsHtml(r, defenderLossesTitle){
  const troopsChart = combatTroopsChartSvg(r);
  const defLossesChart = combatDefenderLossesChartSvg(r);
  return `<div class="combat-chart">
    <div class="chart-block"><div class="chart-title">Puissance de combat${r.attackShare?(' — répartition infanterie '+r.attackShare.inf+'% / cavalerie '+r.attackShare.cav+'% / archers '+r.attackShare.arch+'%'):''}</div>${combatPowerChartSvg(r)}</div>
    ${troopsChart?`<div class="chart-block"><div class="chart-title">Armée attaquante</div>${troopsChart}</div>`:''}
    ${defLossesChart?`<div class="chart-block"><div class="chart-title">${defenderLossesTitle||"Pertes côté défense"}</div>${defLossesChart}</div>`:''}
  </div>`;
}

export function nobleReportLine(r){
  if(!r.nobleSent) return "";
  const escortNote = r.nobleEscortSurvivorPct!=null
    ? ` (escorte revenue : ${r.nobleEscortSurvivorPct}% — il en fallait au moins 20% pour que le Noble survive au combat)`
    : "";
  let outcome;
  if(r.nobleSurvived<=0){
    outcome = `mort au combat${escortNote}.`;
  } else if(r.conquered){
    outcome = `a survécu au combat${escortNote} et a pris possession du village !`;
  } else {
    outcome = `a survécu au combat${escortNote}, mais a été consommé en réduisant la loyauté de la cible — un Noble ne revient jamais au village, qu'il survive ou non.`;
  }
  return `<div class="small muted" style="margin-top:4px;">Noble(s) envoyé(s) : ${r.nobleSent} — ${outcome}</div>`;
}
