import { useState } from "react";
import { useGame } from "../../GameContext.jsx";
import { estimateNow } from "../../formulas.js";
import { REPORT_FILTERS, reportMatchesFilter, reportRowHtml } from "../../legacy/reportRender.js";

// Porte renderReports()/renderReportFilters()/attach...(data-toggle/data-delete-report/
// data-guild-invite-accept/decline/data-open-profile) : liste de rapports (contenu très hétérogène,
// voir legacy/reportRender.js) avec filtre par catégorie et repli/déplacement des détails --
// l'ensemble/repli (openReport) reste un état purement client, comme l'ancien ui.openReport.
export default function ReportsTab(){
  const { snapshot, serverTimeOffset, doAction, call, openPlayerProfile } = useGame();
  const [filter, setFilter] = useState("all");
  const [openReport, setOpenReport] = useState(() => new Set());
  const now = estimateNow(serverTimeOffset);
  const reports = snapshot.reports;

  function onContainerClick(e){
    const openProfileEl = e.target.closest("[data-open-profile]");
    if(openProfileEl){ e.stopPropagation(); openPlayerProfile(openProfileEl.dataset.openProfile); return; }
    const delEl = e.target.closest("[data-delete-report]");
    if(delEl){
      e.stopPropagation();
      doAction(()=>call("/api/reports/delete","POST",{ids:[delEl.dataset.deleteReport]}), "🗑️ Rapport supprimé", null);
      return;
    }
    const acceptEl = e.target.closest("[data-guild-invite-accept]");
    if(acceptEl){
      e.stopPropagation();
      doAction(()=>call("/api/guild/accept","POST",{guildId:acceptEl.dataset.guildInviteAccept}), "👥 Vous avez rejoint la guilde !", null);
      return;
    }
    const declineEl = e.target.closest("[data-guild-invite-decline]");
    if(declineEl){
      e.stopPropagation();
      doAction(()=>call("/api/guild/decline","POST",{guildId:declineEl.dataset.guildInviteDecline}), "Invitation refusée.", null);
      return;
    }
    const toggleEl = e.target.closest("[data-toggle]");
    if(toggleEl){
      const id = toggleEl.dataset.toggle;
      setOpenReport(prev => {
        const next = new Set(prev);
        if(next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    }
  }

  function clearReports(){
    const kind = filter==="all" ? undefined : filter;
    const label = kind ? "les rapports affichés" : "tous les rapports";
    if(!confirm("Supprimer "+label+" ? Cette action est irréversible.")) return;
    doAction(()=>call("/api/reports/clear","POST",{kind}), "🗑️ Rapports supprimés", null);
  }

  const filterBar = (
    <div className="report-filters">
      {REPORT_FILTERS.map(f => {
        const count = f.key==="all" ? reports.length : reports.filter(r=>reportMatchesFilter(r,f)).length;
        return (
          <button key={f.key} className={"filter-btn"+(filter===f.key?" active":"")} onClick={()=>setFilter(f.key)}>
            {f.label} ({count})
          </button>
        );
      })}
    </div>
  );

  if(!reports.length){
    return <div><h2>Rapports</h2>{filterBar}<p className="muted">Aucun rapport pour l'instant.</p></div>;
  }

  const activeFilterObj = REPORT_FILTERS.find(f=>f.key===filter);
  const filtered = filter==="all" ? reports : reports.filter(r=>reportMatchesFilter(r, activeFilterObj));
  const bulkLabel = filter==="all" ? "tous les rapports" : "les rapports affichés";

  const bulkBar = (
    <div className="flex-between" style={{marginBottom:10}}>
      <span className="small muted">{filtered.length} rapport{filtered.length>1?"s":""} affiché{filtered.length>1?"s":""}</span>
      <button className="small" disabled={!filtered.length} onClick={clearReports}>🗑️ Supprimer {bulkLabel}</button>
    </div>
  );

  if(!filtered.length){
    return <div><h2>Rapports</h2>{filterBar}{bulkBar}<p className="muted">Aucun rapport dans cette catégorie.</p></div>;
  }

  const itemsHtml = filtered.map(r => reportRowHtml(r, openReport.has(r.id), now)).join("");

  return (
    <div>
      <h2>Rapports</h2>
      {filterBar}
      {bulkBar}
      <div onClick={onContainerClick} dangerouslySetInnerHTML={{__html: itemsHtml}} />
    </div>
  );
}
