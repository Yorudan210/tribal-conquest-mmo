import { useState } from "react";
import { useGame } from "../GameContext.jsx";
import Audio from "../legacy/audio.js";
import { fmtTime } from "../formulas.js";

// Porte renderTopBar() + startRenameVillage()/commitRename() + switchVillage().
export default function TopBar() {
  const {
    snapshot,
    username,
    doAction,
    call,
    logout
  } = useGame();
  const v = snapshot.village;
  const [renaming, setRenaming] = useState(false);
  const [muted, setMuted] = useState(Audio.isMuted());
  function toggleMute() {
    setMuted(Audio.toggle());
  }
  function commitRename(val) {
    setRenaming(false);
    const name = val.trim();
    if (name && name !== v.name) doAction(() => call("/api/village/rename", "POST", {
      name
    }), null, null);
  }
  function switchVillage(villageId) {
    doAction(() => call("/api/village/switch", "POST", {
      villageId
    }), "🏰 Village actif changé.", null);
  }
  return /*#__PURE__*/React.createElement("header", {
    id: "topbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "village-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "name-row"
  }, renaming ? /*#__PURE__*/React.createElement(RenameInput, {
    initial: v.name,
    onCommit: commitRename,
    onCancel: () => setRenaming(false)
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "name",
    id: "villageNameDisplay"
  }, "\uD83C\uDFF0 ", v.name), /*#__PURE__*/React.createElement("button", {
    className: "btn-rename",
    title: "Renommer le village",
    onClick: () => setRenaming(true)
  }, "\u270F\uFE0F"))), /*#__PURE__*/React.createElement("span", {
    className: "coord"
  }, v.x, "|", v.y, " \xB7 ", snapshot.isAdmin ? /*#__PURE__*/React.createElement("span", {
    className: "admin-name"
  }, username) : username, snapshot.isAdmin ? /*#__PURE__*/React.createElement("span", {
    className: "tag strong",
    style: {
      marginLeft: 6
    }
  }, "ADMIN") : null), v.activeBoosts && v.activeBoosts.length ? /*#__PURE__*/React.createElement("span", {
    className: "small",
    style: {
      color: "#f0b060",
      display: "block",
      marginTop: 2
    },
    title: "Bonus temporaires actifs sur ce village"
  }, v.activeBoosts.map(b => `${b.icon} ${b.name} (encore ${fmtTime(b.secondsLeft)})`).join(" · ")) : null, snapshot.myVillages && snapshot.myVillages.length > 1 ? /*#__PURE__*/React.createElement("select", {
    title: "Changer le village actuellement g\xE9r\xE9",
    style: {
      marginTop: 4,
      maxWidth: 240
    },
    value: snapshot.myVillages.find(mv => mv.isActive)?.id || "",
    onChange: e => switchVillage(e.target.value)
  }, snapshot.myVillages.map(mv => /*#__PURE__*/React.createElement("option", {
    value: mv.id,
    key: mv.id
  }, mv.isHome ? "🏠 " : "🚩 ", mv.name, " (", mv.x, "|", mv.y, ") \xB7 HdV ", mv.hq))) : null), /*#__PURE__*/React.createElement("div", {
    className: "topbar-right"
  }, /*#__PURE__*/React.createElement("span", {
    className: "small muted"
  }, "\uD83C\uDF10 Monde en temps r\xE9el"), /*#__PURE__*/React.createElement("button", {
    title: muted ? "Activer le son" : "Couper le son",
    onClick: toggleMute
  }, muted ? "🔇" : "🔊"), /*#__PURE__*/React.createElement("button", {
    onClick: () => logout(false)
  }, "\uD83D\uDEAA D\xE9connexion")));
}
function RenameInput({
  initial,
  onCommit,
  onCancel
}) {
  const [val, setVal] = useState(initial);
  return /*#__PURE__*/React.createElement("input", {
    type: "text",
    maxLength: 30,
    autoFocus: true,
    value: val,
    onChange: e => setVal(e.target.value),
    onFocus: e => e.target.select(),
    onKeyDown: e => {
      if (e.key === "Enter") onCommit(val);else if (e.key === "Escape") onCancel();
    },
    onBlur: () => onCommit(val)
  });
}