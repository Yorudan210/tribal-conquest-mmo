// Textures/dégradés partagés par le thème "Parchemin" (badges de troupes, médailles du classement,
// bannière de guilde) — invisibles en soi, référencés via url(#id) depuis le reste de l'appli
// (voir legacy/art.js : BUILDING_TEX/TROOP_TEX). Porté tel quel depuis l'ancien index.html.
export default function SvgTexDefs() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "0",
    height: "0",
    style: {
      position: "absolute"
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("pattern", {
    id: "tex-stone",
    width: "14",
    height: "10",
    patternUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "14",
    height: "10",
    fill: "#c2b28c"
  }), /*#__PURE__*/React.createElement("rect", {
    width: "6",
    height: "4",
    fill: "#ab9a72"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "7",
    width: "7",
    height: "4",
    fill: "#b7a67e"
  }), /*#__PURE__*/React.createElement("rect", {
    y: "5",
    width: "4",
    height: "4",
    fill: "#b7a67e"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "5",
    width: "9",
    height: "4",
    fill: "#ab9a72"
  })), /*#__PURE__*/React.createElement("pattern", {
    id: "tex-wood",
    width: "10",
    height: "10",
    patternUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "10",
    height: "10",
    fill: "#7a4f28"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M0 2Q5 1 10 2M0 5Q5 4 10 5M0 8Q5 7 10 8",
    stroke: "#5c3a1c",
    strokeWidth: "0.8",
    fill: "none"
  })), /*#__PURE__*/React.createElement("pattern", {
    id: "tex-tile",
    width: "12",
    height: "8",
    patternUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "12",
    height: "8",
    fill: "#a3452d"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M0 8A4 4 0 0 1 8 8Z",
    fill: "#8a3a26"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M-4 8A4 4 0 0 1 4 8Z",
    fill: "#8a3a26"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 8A4 4 0 0 1 16 8Z",
    fill: "#8a3a26"
  })), /*#__PURE__*/React.createElement("pattern", {
    id: "tex-hay",
    width: "10",
    height: "10",
    patternUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "10",
    height: "10",
    fill: "#cba456"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M1 9L4 2M5 9L8 2M-1 9L2 2M9 9L12 2",
    stroke: "#a5813c",
    strokeWidth: "0.8"
  })), /*#__PURE__*/React.createElement("pattern", {
    id: "tex-metal",
    width: "9",
    height: "9",
    patternUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "9",
    height: "9",
    fill: "#4b4a4d"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "2",
    cy: "2",
    r: "0.6",
    fill: "#9a9aa0"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "5",
    r: "0.5",
    fill: "#8f8f96"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "3",
    cy: "7",
    r: "0.5",
    fill: "#9a9aa0"
  })), /*#__PURE__*/React.createElement("pattern", {
    id: "tex-clay",
    width: "11",
    height: "11",
    patternUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "11",
    height: "11",
    fill: "#b06b3e"
  }), /*#__PURE__*/React.createElement("ellipse", {
    cx: "3",
    cy: "3",
    rx: "2.4",
    ry: "1.6",
    fill: "#96552f"
  }), /*#__PURE__*/React.createElement("ellipse", {
    cx: "8",
    cy: "7",
    rx: "2.2",
    ry: "1.5",
    fill: "#c37c4d"
  })), /*#__PURE__*/React.createElement("pattern", {
    id: "tex-cloth",
    width: "8",
    height: "8",
    patternUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "8",
    height: "8",
    fill: "#e6d9b0"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M0 0L8 8M8 0L0 8",
    stroke: "#d0bd88",
    strokeWidth: "0.6"
  })), /*#__PURE__*/React.createElement("pattern", {
    id: "tex-cloth-burgundy",
    width: "8",
    height: "8",
    patternUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "8",
    height: "8",
    fill: "#8a3040"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M0 0L8 8M8 0L0 8",
    stroke: "#752738",
    strokeWidth: "0.6"
  })), /*#__PURE__*/React.createElement("pattern", {
    id: "tex-stone-muted",
    width: "14",
    height: "10",
    patternUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "14",
    height: "10",
    fill: "#b8b2a3"
  }), /*#__PURE__*/React.createElement("rect", {
    width: "6",
    height: "4",
    fill: "#a29c8d"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "7",
    width: "7",
    height: "4",
    fill: "#aca690"
  }), /*#__PURE__*/React.createElement("rect", {
    y: "5",
    width: "4",
    height: "4",
    fill: "#aca690"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "5",
    width: "9",
    height: "4",
    fill: "#a29c8d"
  })), /*#__PURE__*/React.createElement("radialGradient", {
    id: "grad-gold",
    cx: "35%",
    cy: "30%",
    r: "75%"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#fbe38a"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#b8860b"
  })), /*#__PURE__*/React.createElement("radialGradient", {
    id: "grad-silver",
    cx: "35%",
    cy: "30%",
    r: "75%"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#f2f2f2"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#9a9a9a"
  })), /*#__PURE__*/React.createElement("radialGradient", {
    id: "grad-bronze",
    cx: "35%",
    cy: "30%",
    r: "75%"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#e0a25c"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#8f5c26"
  }))));
}