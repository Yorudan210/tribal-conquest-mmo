import { useEffect, useLayoutEffect, useRef } from "react";
import { useGame } from "../../GameContext.jsx";
import { estimateNow } from "../../formulas.js";
import { buildMapMarkup, drawMapInfluence, drawMapAttackLines } from "../../legacy/mapRender.js";

// Porte renderMap()/positionMapWorld()/drawMapInfluence()/drawMapAttackLines()/attachMapHandlers() :
// glisser pour explorer, molette pour zoomer, taper un village pour ouvrir sa fenêtre de mission
// (portée dans VillageActionModal.jsx, rendue au niveau de GameScreen -- comme dans l'ancien
// index.html, la fenêtre reste ouverte même si on change d'onglet). Le balisage du monde (pins,
// décor, marqueurs) est généré en HTML (legacy/mapRender.js, réutilise les fonctions SVG portées
// verbatim de art.js) et injecté via dangerouslySetInnerHTML ; le glisser/zoom et le dessin des deux
// canvas (zones d'influence, lignes d'attaque) restent impératifs, comme dans l'original -- une
// carte à mise à jour aussi fréquente (chaque poussée WebSocket, ~2s) ne gagne rien à passer par de
// vrais éléments JSX pour des dizaines de pins.
export default function MapTab() {
  const {
    snapshot,
    username,
    serverTimeOffset,
    mapView,
    setMapView,
    selectedVillage,
    openVillageAction
  } = useGame();
  const v = snapshot.village;

  // Initialisation paresseuse (une seule fois par session, comme `if(!mapView) mapView=...`) --
  // centrée sur le village actif au tout premier affichage de la carte.
  useEffect(() => {
    if (!mapView) setMapView({
      cx: v.x,
      cy: v.y,
      ppf: 26
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapView]);
  const canvasRef = useRef(null); // #mapCanvas (zone visible, viewport)
  const worldRef = useRef(null); // #mapWorld (contenu, positionné en absolu et déplacé au glisser)
  const jumpXRef = useRef(null);
  const jumpYRef = useRef(null);
  const dragRef = useRef({
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    baseLeft: 0,
    baseTop: 0
  });
  const mv = mapView || {
    cx: v.x,
    cy: v.y,
    ppf: 26
  };
  const now = estimateNow(serverTimeOffset);
  // Copie "live" de la vue courante, lue par le gestionnaire de molette (voir onWheel) pour que
  // plusieurs évènements wheel survenant dans la même frame d'animation se cumulent correctement
  // avant que React n'ait eu l'occasion de re-rendre entre deux -- voir wheelRafRef ci-dessous.
  const mvRef = useRef(mv);
  mvRef.current = mv;
  const wheelRafRef = useRef(null);
  const viewport = {
    width: canvasRef.current?.clientWidth,
    height: canvasRef.current?.clientHeight
  };
  const {
    worldHtml,
    minX,
    minY,
    worldW,
    worldH,
    gridBg
  } = buildMapMarkup(snapshot, username, mv, selectedVillage, now, viewport);

  // Repositionne #mapWorld sous le viewport (équivalent positionMapWorld) et redessine les deux
  // canvas -- après CHAQUE rendu (contenu ou vue de carte changés), pendant qu'on n'est pas en train
  // de glisser (le glisser déplace #mapWorld lui-même via les gestionnaires ci-dessous, sans passer
  // par un re-rendu React tant qu'on n'a pas relâché, exactement comme l'ancien mapDragging).
  useLayoutEffect(() => {
    const canvasEl = canvasRef.current,
      worldEl = worldRef.current;
    if (!canvasEl || !worldEl || dragRef.current.dragging) return;
    worldEl.style.left = canvasEl.clientWidth / 2 - (mv.cx - minX) * mv.ppf + "px";
    worldEl.style.top = canvasEl.clientHeight / 2 - (mv.cy - minY) * mv.ppf + "px";
    drawMapInfluence(worldEl.querySelector("#mapInfluence"), snapshot, username, minX, minY, mv.ppf);
    drawMapAttackLines(worldEl.querySelector("#mapAttackLines"), snapshot, minX, minY, mv.ppf);
  });

  // Glisser (pan) + molette (zoom centré sur le curseur) + tap pour ouvrir un village -- portés à
  // l'identique (voir attachMapHandlers) via de vrais évènements pointer, réattachés après chaque
  // rendu pour que les callbacks lisent toujours minX/minY/mv.ppf à jour (petit nombre de listeners,
  // sans conséquence sur les performances).
  useEffect(() => {
    const canvasEl = canvasRef.current,
      worldEl = worldRef.current;
    if (!canvasEl || !worldEl) return;
    const st = dragRef.current;
    function onPointerDown(e) {
      st.dragging = true;
      st.moved = false;
      st.startX = e.clientX;
      st.startY = e.clientY;
      st.baseLeft = parseFloat(worldEl.style.left) || 0;
      st.baseTop = parseFloat(worldEl.style.top) || 0;
      canvasEl.classList.add("dragging");
      try {
        canvasEl.setPointerCapture(e.pointerId);
      } catch (err) {}
    }
    function onPointerMove(e) {
      if (!st.dragging) return;
      const dx = e.clientX - st.startX,
        dy = e.clientY - st.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) st.moved = true;
      worldEl.style.left = st.baseLeft + dx + "px";
      worldEl.style.top = st.baseTop + dy + "px";
    }
    function endDrag(e) {
      if (!st.dragging) return;
      st.dragging = false;
      canvasEl.classList.remove("dragging");
      if (e && e.pointerId != null) {
        try {
          canvasEl.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
      if (st.moved) {
        const left = parseFloat(worldEl.style.left) || 0,
          top = parseFloat(worldEl.style.top) || 0;
        setMapView(prev => {
          const p = prev || mv;
          return {
            ...p,
            cx: minX + (canvasEl.clientWidth / 2 - left) / p.ppf,
            cy: minY + (canvasEl.clientHeight / 2 - top) / p.ppf
          };
        });
      } else if (e) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const pinEl = el && el.closest ? el.closest("[data-village-pin]") : null;
        if (pinEl) {
          const raw = pinEl.dataset.villagePin;
          openVillageAction(raw === "home" ? "home" : raw);
        }
      }
    }
    // Un trackpad/souris haute fréquence peut émettre des dizaines d'évènements wheel par seconde ;
    // appeler setMapView (donc reconstruire tout le balisage de la carte, voir buildMapMarkup) à
    // chaque évènement saturait le thread principal pendant un geste de zoom (voir le ralentissement
    // signalé). On accumule donc les deltas dans mvRef.current (lu/écrit de façon synchrone, sans
    // attendre un re-rendu React) et on ne pousse l'état React qu'UNE fois par frame d'animation,
    // via requestAnimationFrame -- le zoom reste fluide et cumulatif, mais React ne re-rend plus
    // qu'au rythme d'affichage de l'écran au lieu du rythme brut des évènements wheel.
    function onWheel(e) {
      e.preventDefault();
      const rect = canvasEl.getBoundingClientRect();
      const cur = mvRef.current;
      const oldPpf = cur.ppf;
      const newPpf = Math.max(12, Math.min(48, oldPpf + (e.deltaY < 0 ? 4 : -4)));
      if (newPpf === oldPpf) return;
      const cursorX = e.clientX - rect.left,
        cursorY = e.clientY - rect.top;
      const worldX = cur.cx + (cursorX - canvasEl.clientWidth / 2) / oldPpf;
      const worldY = cur.cy + (cursorY - canvasEl.clientHeight / 2) / oldPpf;
      mvRef.current = {
        ppf: newPpf,
        cx: worldX - (cursorX - canvasEl.clientWidth / 2) / newPpf,
        cy: worldY - (cursorY - canvasEl.clientHeight / 2) / newPpf
      };
      if (wheelRafRef.current == null) {
        wheelRafRef.current = requestAnimationFrame(() => {
          wheelRafRef.current = null;
          setMapView(mvRef.current);
        });
      }
    }
    canvasEl.addEventListener("pointerdown", onPointerDown);
    canvasEl.addEventListener("pointermove", onPointerMove);
    canvasEl.addEventListener("pointerup", endDrag);
    canvasEl.addEventListener("pointercancel", endDrag);
    canvasEl.addEventListener("wheel", onWheel, {
      passive: false
    });
    return () => {
      canvasEl.removeEventListener("pointerdown", onPointerDown);
      canvasEl.removeEventListener("pointermove", onPointerMove);
      canvasEl.removeEventListener("pointerup", endDrag);
      canvasEl.removeEventListener("pointercancel", endDrag);
      canvasEl.removeEventListener("wheel", onWheel);
      if (wheelRafRef.current != null) {
        cancelAnimationFrame(wheelRafRef.current);
        wheelRafRef.current = null;
      }
    };
  });
  function zoomIn() {
    setMapView(prev => ({
      ...(prev || mv),
      ppf: Math.min(48, (prev || mv).ppf + 6)
    }));
  }
  function zoomOut() {
    setMapView(prev => ({
      ...(prev || mv),
      ppf: Math.max(12, (prev || mv).ppf - 6)
    }));
  }
  function recenter() {
    setMapView(prev => ({
      ...(prev || mv),
      cx: v.x,
      cy: v.y
    }));
  }
  function jump() {
    const x = Number(jumpXRef.current.value),
      y = Number(jumpYRef.current.value);
    if (Number.isFinite(x) && Number.isFinite(y)) setMapView(prev => ({
      ...(prev || mv),
      cx: x,
      cy: y
    }));
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "Carte du monde"), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "Glissez la carte pour explorer, molette pour zoomer, cliquez sur un village pour ouvrir ses informations et lui envoyer des troupes. \uD83D\uDC64 = village d'un autre joueur. Depuis ce popup, posez aussi un \uD83C\uDFF3\uFE0F marqueur personnel (visible seulement par vous) sur n'importe quel village, pour l'organiser sur votre propre carte."), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "\uD83D\uDDFA\uFE0F Zones d'influence (purement visuelles, sans effet sur le jeu) :"), /*#__PURE__*/React.createElement("div", {
    className: "legend-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "legend-chip",
    style: {
      color: "var(--gold)"
    }
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      background: "currentColor"
    }
  }), "vous"), /*#__PURE__*/React.createElement("span", {
    className: "legend-chip",
    style: {
      color: "var(--green)"
    }
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      background: "currentColor"
    }
  }), "alli\xE9"), /*#__PURE__*/React.createElement("span", {
    className: "legend-chip",
    style: {
      color: "var(--blue)"
    }
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      background: "currentColor"
    }
  }), "pacte"), /*#__PURE__*/React.createElement("span", {
    className: "legend-chip",
    style: {
      color: "var(--red)"
    }
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      background: "currentColor"
    }
  }), "guerre"), /*#__PURE__*/React.createElement("span", {
    className: "legend-chip",
    style: {
      color: "#9a7526"
    }
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      background: "currentColor"
    }
  }), "autre joueur")), /*#__PURE__*/React.createElement("p", {
    className: "muted small"
  }, "\u2694\uFE0F/\uD83D\uDD2D pleins et anim\xE9s = vos propres troupes en mouvement. \u2694\uFE0F/\uD83D\uDD2D pointill\xE9s et discrets = attaque ou reconnaissance d'un ", /*#__PURE__*/React.createElement("b", null, "autre joueur"), " actuellement en approche (composition et identit\xE9 de l'attaquant non r\xE9v\xE9l\xE9es, comme partout ailleurs tant qu'aucune reconnaissance n'a r\xE9ussi). Une ligne pointill\xE9e rouge relie l'origine et la cible de chaque attaque en cours."), /*#__PURE__*/React.createElement("div", {
    className: "map-toolbar box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "group"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: zoomOut,
    title: "D\xE9zoomer"
  }, "\u2796"), /*#__PURE__*/React.createElement("span", {
    className: "small muted"
  }, "Zoom"), /*#__PURE__*/React.createElement("button", {
    onClick: zoomIn,
    title: "Zoomer"
  }, "\u2795"), /*#__PURE__*/React.createElement("button", {
    onClick: recenter
  }, "\uD83C\uDFAF Mon village")), /*#__PURE__*/React.createElement("div", {
    className: "group"
  }, /*#__PURE__*/React.createElement("span", {
    className: "small muted"
  }, "Aller aux coordonn\xE9es"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    defaultValue: Math.round(mv.cx),
    ref: jumpXRef
  }), /*#__PURE__*/React.createElement("span", null, "|"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    defaultValue: Math.round(mv.cy),
    ref: jumpYRef
  }), /*#__PURE__*/React.createElement("button", {
    onClick: jump
  }, "Aller"))), /*#__PURE__*/React.createElement("div", {
    id: "mapCanvas",
    ref: canvasRef
  }, /*#__PURE__*/React.createElement("div", {
    id: "mapWorld",
    ref: worldRef,
    "data-minx": minX,
    "data-miny": minY,
    style: {
      width: worldW + "px",
      height: worldH + "px",
      ...parseGridBg(gridBg)
    },
    dangerouslySetInnerHTML: {
      __html: worldHtml
    }
  })));
}

// La grille de fond (dégradés CSS) est construite comme une chaîne "background-image:...;
// background-size:...;" côté legacy/mapRender.js (portée verbatim) -- reconvertie ici en objet de
// style React plutôt que de dupliquer cette logique en JSX.
function parseGridBg(cssText) {
  const style = {};
  for (const decl of cssText.split(";")) {
    const idx = decl.indexOf(":");
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const val = decl.slice(idx + 1).trim();
    if (prop) style[prop] = val;
  }
  return style;
}