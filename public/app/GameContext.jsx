import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiCall } from "./api.js";
import { villageResourceBonus } from "./formulas.js";
import Audio from "./legacy/audio.js";
import { useToast } from "./ToastContext.jsx";

// ============================= ÉTAT GLOBAL DE JEU =============================
// Remplace l'ensemble des variables globales mutables de l'ancien index.html (state, username,
// authToken, serverTimeOffset, adminSpeed, scoutIntel, sparkleUntil...) par un vrai state React,
// partagé via Context. La logique métier (applySnapshot, doAction, connectWs, pollState...) est
// portée fidèlement — seule la façon de déclencher un re-rendu change : on appelle setState au lieu
// de manipuler le DOM à la main (plus besoin des hacks type rerenderPreservingInputs, React gère
// nativement la préservation du focus/valeur des <input> non contrôlés entre deux rendus).
const GameCtx = /*#__PURE__*/createContext(null);
const WS_RECONNECT_MAX_MS = 15000;
export function GameProvider({
  children
}) {
  const toast = useToast();
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("ct_token"));
  const [username, setUsername] = useState(() => localStorage.getItem("ct_username"));
  const [snapshot, setSnapshot] = useState(null); // dernier instantané reçu du serveur
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [adminSpeed, setAdminSpeed] = useState(1);
  const [sparkleUntil, setSparkleUntil] = useState({}); // buildingKey -> timestamp (effet de construction terminée)
  const [scoutIntel, setScoutIntel] = useState({}); // villageId -> dernier renseignement de reconnaissance connu
  const [banner, setBanner] = useState(null); // {id, text, type} — bannière de bataille flottante
  const [resuming, setResuming] = useState(true); // reprise de session en cours au premier chargement
  const [authError, setAuthError] = useState("");

  // Tutoriel de bienvenue (voir TUTORIAL_STEPS/TutorialModal.jsx) : affiché automatiquement une
  // fois après connexion/reprise de session si l'utilisateur ne l'a jamais vu (ct_tutorial_<user>
  // absent de localStorage), et rejouable à volonté depuis l'onglet Aide.
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const closeTutorial = useCallback(() => {
    if (usernameRef.current) localStorage.setItem("ct_tutorial_" + usernameRef.current, "1");
    setTutorialOpen(false);
  }, []);
  const replayTutorial = useCallback(() => {
    if (usernameRef.current) localStorage.removeItem("ct_tutorial_" + usernameRef.current);
    setTutorialOpen(true);
  }, []);

  // Vue de la carte (centre + pixels par champ) et village sélectionné (fenêtre de mission) : vivent
  // ici plutôt que dans MapTab pour survivre à un changement d'onglet (comme mapView/ui.selectedVillage,
  // variables de portée module dans l'ancien index.html — la fenêtre de mission, en particulier, est
  // une modale de haut niveau qui reste ouverte même en changeant d'onglet).
  const [mapView, setMapView] = useState(null); // {cx, cy, ppf} — initialisé au 1er rendu de la carte
  const [selectedVillage, setSelectedVillage] = useState(null); // "home" | id de village | null

  const openVillageAction = useCallback(villageId => setSelectedVillage(villageId), []);
  const closeVillageAction = useCallback(() => setSelectedVillage(null), []);

  // Onglet actif : vit ici (plutôt qu'en state local de GameScreen) parce que plusieurs actions
  // profondément imbriquées doivent pouvoir en changer -- fiche joueur ("Espionner" bascule sur la
  // Carte), Empire (gérer un village -> Bâtiments), Guilde (accéder au Hall de guilde) -- exactement
  // comme l'ancienne variable de portée module `activeTab`.
  const [activeTab, setActiveTab] = useState("buildings");

  // Fiche joueur détaillée (fetchée à la demande) : ouverte depuis la liste des membres de guilde, le
  // Classement, ou un pseudo cliqué dans le chat.
  const [playerProfile, setPlayerProfile] = useState(null);
  const openPlayerProfile = useCallback(async targetUsername => {
    try {
      const data = await apiCall("/api/player?username=" + encodeURIComponent(targetUsername), "GET", undefined, authTokenRef.current);
      setPlayerProfile(data.player);
    } catch (err) {
      toast("⚠️ " + err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);
  const closePlayerProfile = useCallback(() => setPlayerProfile(null), []);

  // Bascule sur l'onglet Carte, centre la vue sur un village donné et ouvre sa fenêtre de mission --
  // utilisé par le bouton Espionner de la fiche joueur et par l'onglet Empire.
  const goToVillageOnMap = useCallback(villageId => {
    const t = (snapshotRef.current?.villages || []).find(x => x.id === villageId);
    if (!t) return;
    setActiveTab("map");
    setMapView(prev => ({
      cx: t.x,
      cy: t.y,
      ppf: prev && prev.ppf || 26
    }));
    setSelectedVillage(villageId);
  }, []);

  // Copies "live" dans des refs pour que les callbacks WS/poll (créés une fois) lisent toujours la
  // valeur la plus récente sans avoir à les recréer à chaque changement de state.
  const authTokenRef = useRef(authToken);
  const usernameRef = useRef(username);
  const snapshotRef = useRef(snapshot);
  authTokenRef.current = authToken;
  usernameRef.current = username;
  snapshotRef.current = snapshot;
  const wsRef = useRef(null);
  const wsReconnectTimer = useRef(null);
  const wsReconnectDelay = useRef(1000);
  const pollHandle = useRef(null);

  /* Fusionne un instantané serveur dans l'état local, met à jour le cache de reconnaissance et
     déclenche les effets (scintillement de construction terminée, bannière de raid subi) — porte
     fidèlement applySnapshot() de l'ancien index.html. */
  const applySnapshot = useCallback(snap => {
    const prevState = snapshotRef.current;
    setServerTimeOffset(snap.serverTime - Date.now() / 1000);
    if (snap.speedMultiplier != null) setAdminSpeed(snap.speedMultiplier);
    setScoutIntel(prev => {
      let next = prev;
      for (const r of snap.reports) {
        if (r.kind === "scout" && r.targetId != null) {
          const ex = next[r.targetId];
          if (!ex || r.time > ex.time) {
            if (next === prev) next = {
              ...prev
            };
            next[r.targetId] = {
              resources: r.resources,
              troops: r.troops,
              wallLevel: r.wallLevel,
              loyalty: r.loyalty,
              time: r.time,
              isPlayer: r.isPlayer
            };
          }
        }
      }
      return next;
    });
    if (prevState) {
      const prevB = prevState.village.buildings;
      const sparkled = [];
      for (const k in snap.village.buildings) {
        if ((snap.village.buildings[k] || 0) > (prevB[k] || 0)) sparkled.push(k);
      }
      if (sparkled.length) {
        const until = Date.now() + 1500;
        setSparkleUntil(prev => {
          const next = {
            ...prev
          };
          for (const k of sparkled) next[k] = until;
          return next;
        });
        Audio.SFX.buildDone();
      }
      const newCount = snap.reports.length - prevState.reports.length;
      if (newCount > 0 && newCount <= snap.reports.length) {
        snap.reports.slice(0, newCount).forEach(r => {
          if (r.kind === "defense") {
            const lost = r.winner === "attacker";
            setBanner({
              id: Date.now() + Math.random(),
              type: "raid",
              text: lost ? "💀 " + (r.source || "Un ennemi") + " a pillé votre village !" : "🛡️ Attaque de " + (r.source || "un ennemi") + " repoussée !"
            });
            Audio.SFX[lost ? "defeat" : "victory"]();
          }
        });
      }
    }
    setSnapshot(snap);
  }, []);

  /* Exécute une action serveur, fusionne la réponse et affiche l'erreur sinon — porte doAction(). */
  const doAction = useCallback(async (promiseFn, successMsg, sfx) => {
    try {
      const data = await promiseFn();
      applySnapshot(data.snapshot);
      if (sfx) Audio.SFX[sfx]();
      if (successMsg) toast(successMsg);
      return data;
    } catch (err) {
      Audio.SFX.error();
      toast("⚠️ " + err.message);
      throw err;
    }
  }, [applySnapshot, toast]);
  const call = useCallback((path, method, body) => apiCall(path, method, body, authTokenRef.current), []);

  /* ============================= TEMPS RÉEL (WebSocket + sondage HTTP de secours) =============================
     Porte connectWs/scheduleWsReconnect/disconnectWs/pollState/startPolling/stopPolling à l'identique :
     le serveur pousse un instantané à chaque tick (2s) et après un message de chat ; le sondage HTTP
     (10s) reste un filet de sécurité si le WebSocket est bloqué par un réseau/proxy particulier. */
  const wsUrl = () => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return proto + "//" + location.host + "/ws";
  };
  const scheduleWsReconnect = useCallback(() => {
    if (!authTokenRef.current) return;
    if (wsReconnectTimer.current) clearTimeout(wsReconnectTimer.current);
    wsReconnectTimer.current = setTimeout(connectWs, wsReconnectDelay.current);
    wsReconnectDelay.current = Math.min(WS_RECONNECT_MAX_MS, Math.round(wsReconnectDelay.current * 1.6));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const connectWs = useCallback(() => {
    if (!authTokenRef.current || typeof WebSocket === "undefined") return;
    const existing = wsRef.current;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return;
    let socket;
    try {
      socket = new WebSocket(wsUrl());
    } catch (e) {
      scheduleWsReconnect();
      return;
    }
    wsRef.current = socket;
    socket.onopen = () => {
      wsReconnectDelay.current = 1000;
      try {
        socket.send(JSON.stringify({
          type: "auth",
          token: authTokenRef.current
        }));
      } catch (e) {}
    };
    socket.onmessage = ev => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (e) {
        return;
      }
      if (msg.type === "snapshot" && msg.snapshot) applySnapshot(msg.snapshot);
    };
    socket.onclose = () => {
      if (wsRef.current === socket) wsRef.current = null;
      scheduleWsReconnect();
    };
    socket.onerror = () => {
      try {
        socket.close();
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applySnapshot, scheduleWsReconnect]);
  const disconnectWs = useCallback(() => {
    if (wsReconnectTimer.current) {
      clearTimeout(wsReconnectTimer.current);
      wsReconnectTimer.current = null;
    }
    wsReconnectDelay.current = 1000;
    if (wsRef.current) {
      const s = wsRef.current;
      wsRef.current = null;
      try {
        s.onclose = null;
        s.close();
      } catch (e) {}
    }
  }, []);
  const pollState = useCallback(async () => {
    if (!authTokenRef.current) return;
    try {
      const data = await apiCall("/api/state", "GET", undefined, authTokenRef.current);
      applySnapshot(data.snapshot);
    } catch (err) {
      if (/session|reconnect/i.test(err.message || "")) logout(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applySnapshot]);
  const startPolling = useCallback(() => {
    if (pollHandle.current) clearInterval(pollHandle.current);
    pollHandle.current = setInterval(pollState, 10000);
  }, [pollState]);
  const stopPolling = useCallback(() => {
    if (pollHandle.current) {
      clearInterval(pollHandle.current);
      pollHandle.current = null;
    }
  }, []);

  // Un onglet remis au premier plan a pu manquer des pushes WebSocket pendant qu'il était masqué :
  // on rattrape immédiatement l'état via un sondage HTTP, et on relance le WebSocket si besoin.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && authTokenRef.current) {
        pollState();
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) connectWs();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pollState, connectWs]);

  /* ============================= AUTHENTIFICATION ============================= */

  const enterGame = useCallback(data => {
    setAuthToken(data.token);
    setUsername(data.username);
    localStorage.setItem("ct_token", data.token);
    localStorage.setItem("ct_username", data.username);
    authTokenRef.current = data.token;
    usernameRef.current = data.username;
    applySnapshot(data.snapshot);
    startPolling();
    connectWs();
    if (!localStorage.getItem("ct_tutorial_" + data.username)) setTutorialOpen(true);
    document.addEventListener("click", function unlockAudio() {
      Audio.ensureCtx();
      document.removeEventListener("click", unlockAudio);
    }, {
      once: true
    });
  }, [applySnapshot, startPolling, connectWs]);
  const login = useCallback(async (u, p) => {
    setAuthError("");
    try {
      const data = await apiCall("/api/login", "POST", {
        username: u,
        password: p
      });
      enterGame(data);
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }, [enterGame]);
  const register = useCallback(async (u, p) => {
    setAuthError("");
    try {
      const data = await apiCall("/api/register", "POST", {
        username: u,
        password: p
      });
      enterGame(data);
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  }, [enterGame]);
  const logout = useCallback(silent => {
    stopPolling();
    disconnectWs();
    setAuthToken(null);
    setUsername(null);
    setSnapshot(null);
    setScoutIntel({});
    setSparkleUntil({});
    setBanner(null);
    setTutorialOpen(false);
    authTokenRef.current = null;
    usernameRef.current = null;
    snapshotRef.current = null;
    localStorage.removeItem("ct_token");
    localStorage.removeItem("ct_username");
    setAuthError(silent ? "Session expirée, reconnectez-vous." : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopPolling, disconnectWs]);

  // Reprise de session au premier chargement (équivalent de tryResumeSession()).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedToken = localStorage.getItem("ct_token"),
        savedUser = localStorage.getItem("ct_username");
      if (!savedToken || !savedUser) {
        setResuming(false);
        return;
      }
      authTokenRef.current = savedToken;
      usernameRef.current = savedUser;
      try {
        const data = await apiCall("/api/state", "GET", undefined, savedToken);
        if (cancelled) return;
        enterGame({
          token: savedToken,
          username: savedUser,
          snapshot: data.snapshot
        });
      } catch (err) {
        if (cancelled) return;
        authTokenRef.current = null;
        usernameRef.current = null;
        localStorage.removeItem("ct_token");
        localStorage.removeItem("ct_username");
      } finally {
        if (!cancelled) setResuming(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => {
    stopPolling();
    disconnectWs();
  }, [stopPolling, disconnectWs]);
  const value = {
    authToken,
    username,
    snapshot,
    serverTimeOffset,
    adminSpeed,
    sparkleUntil,
    scoutIntel,
    banner,
    setBanner,
    resuming,
    authError,
    setAuthError,
    call,
    doAction,
    applySnapshot,
    login,
    register,
    logout,
    mapView,
    setMapView,
    selectedVillage,
    openVillageAction,
    closeVillageAction,
    activeTab,
    setActiveTab,
    playerProfile,
    openPlayerProfile,
    closePlayerProfile,
    goToVillageOnMap,
    tutorialOpen,
    closeTutorial,
    replayTutorial,
    villageResourceBonus: r => snapshot ? villageResourceBonus(snapshot, r) : null
  };
  return /*#__PURE__*/React.createElement(GameCtx.Provider, {
    value: value
  }, children);
}
export function useGame() {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error("useGame doit être utilisé sous <GameProvider>");
  return ctx;
}