import { useEffect, useRef, useState } from "react";
import { useGame } from "../GameContext.jsx";
import { fmtClock } from "../formulas.js";

// Porte renderChat()/updateChatTabs()/updateChatMessages()/sendChat(). Widget flottant indépendant
// des onglets. Cliquer un pseudo (y compris le sien) ouvre sa fiche joueur (PlayerProfileModal),
// comme pour tous les autres liens data-open-profile de l'ancien index.html.
export default function ChatWidget() {
  const {
    snapshot,
    username,
    doAction,
    call,
    openPlayerProfile
  } = useGame();
  const hasGuild = !!snapshot.guild;
  // Sur petit écran, le panneau ouvert occupe une bonne partie de l'écran : démarre réduit sur
  // mobile, ouvert sur desktop où il ne gêne qu'un coin de l'écran (comme l'ancien index.html).
  const [open, setOpen] = useState(() => window.innerWidth > 480);
  const [channel, setChannel] = useState("global");
  const [text, setText] = useState("");
  const messagesRef = useRef(null);
  useEffect(() => {
    if (!hasGuild && channel === "guild") setChannel("global");
  }, [hasGuild, channel]);
  const messages = channel === "guild" ? snapshot.guildChat || [] : snapshot.chat || [];
  useEffect(() => {
    const box = messagesRef.current;
    if (!box) return;
    const nearBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 20 - 60; // marge : nouveau message ajouté juste avant ce recalcul
    if (nearBottom) box.scrollTop = box.scrollHeight;
  }, [messages]);
  function submit(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    doAction(() => call("/api/chat/send", "POST", {
      text: t,
      channel
    }), null, null);
  }
  if (!open) {
    return /*#__PURE__*/React.createElement("div", {
      id: "chatWidget"
    }, /*#__PURE__*/React.createElement("button", {
      className: "chat-bubble",
      title: "Ouvrir le chat",
      onClick: () => setOpen(true)
    }, "\uD83D\uDCAC"));
  }
  return /*#__PURE__*/React.createElement("div", {
    id: "chatWidget"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chat-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chat-head"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCAC Chat"), /*#__PURE__*/React.createElement("button", {
    className: "chat-toggle",
    title: "R\xE9duire",
    onClick: () => setOpen(false)
  }, "\u2796")), /*#__PURE__*/React.createElement("div", {
    className: "chat-tabs"
  }, /*#__PURE__*/React.createElement("button", {
    className: "chat-tab" + (channel === "global" ? " active" : ""),
    onClick: () => setChannel("global")
  }, "\uD83C\uDF0D Mondial"), hasGuild ? /*#__PURE__*/React.createElement("button", {
    className: "chat-tab" + (channel === "guild" ? " active" : ""),
    onClick: () => setChannel("guild")
  }, "\uD83D\uDEE1\uFE0F Guilde", snapshot.guild.tag ? ` [${snapshot.guild.tag}]` : "") : null), /*#__PURE__*/React.createElement("div", {
    className: "chat-messages",
    ref: messagesRef
  }, messages.length ? messages.map((m, i) => {
    const isAnnounce = m.kind === "announce";
    const nameCls = "chat-user" + (m.isAdmin ? " admin-name" : "");
    return /*#__PURE__*/React.createElement("div", {
      className: "chat-msg" + (isAnnounce ? " announce" : "") + (m.username === username ? " me" : ""),
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      className: "chat-time"
    }, fmtClock(m.time)), isAnnounce ? /*#__PURE__*/React.createElement("span", {
      className: "chat-announce-icon"
    }, "\uD83D\uDCE2") : null, /*#__PURE__*/React.createElement("span", {
      className: nameCls,
      onClick: () => openPlayerProfile(m.username)
    }, m.username), " ", /*#__PURE__*/React.createElement("span", {
      className: "chat-text"
    }, m.text));
  }) : /*#__PURE__*/React.createElement("div", {
    className: "muted small",
    style: {
      padding: 8
    }
  }, channel === "guild" ? "Aucun message dans le chat de guilde pour l'instant." : "Aucun message pour l'instant. Dites bonjour !")), /*#__PURE__*/React.createElement("form", {
    className: "chat-form",
    onSubmit: submit
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    maxLength: 300,
    placeholder: "\xC9crire un message\u2026",
    autoComplete: "off",
    value: text,
    onChange: e => setText(e.target.value)
  }), /*#__PURE__*/React.createElement("span", {
    className: "chat-charcount"
  }, text.length, "/300"), /*#__PURE__*/React.createElement("button", {
    type: "submit"
  }, "\u27A4"))));
}