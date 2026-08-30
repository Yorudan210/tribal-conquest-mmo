/* ============================= AMBIANCE SONORE (synthétisée, sans fichier externe) =============================
   Porté tel quel depuis l'ancien index.html : module autonome (IIFE → singleton exporté), aucune
   dépendance au DOM ni à React, seulement l'API Web Audio native du navigateur. */
const Audio = (() => {
  let ctx = null, muted = false;
  function ensureCtx(){
    if(!ctx){ const AC = window.AudioContext||window.webkitAudioContext; if(!AC) return null; ctx = new AC(); }
    if(ctx.state==="suspended") ctx.resume();
    return ctx;
  }
  function tone(freq, duration, opts={}){
    if(muted) return;
    const c = ensureCtx(); if(!c) return;
    const osc = c.createOscillator(), gain = c.createGain();
    osc.type = opts.type || "sine";
    osc.frequency.value = freq;
    const vol = opts.vol!=null ? opts.vol : 0.12;
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.linearRampToValueAtTime(vol, c.currentTime+0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+duration);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(); osc.stop(c.currentTime+duration+0.05);
  }
  function sequence(notes, opts={}){
    let t=0;
    notes.forEach(([f,d,gap])=>{ if(f>0) setTimeout(()=>tone(f,d,opts), t*1000); t+=(gap!=null?gap:d); });
  }
  const SFX = {
    buildQueued: ()=>tone(440,0.08,{type:"triangle",vol:0.07}),
    buildDone: ()=>sequence([[523,0.12],[659,0.12],[784,0.22]],{type:"triangle",vol:0.11}),
    trainQueued: ()=>tone(330,0.07,{type:"square",vol:0.06}),
    trainDone: ()=>sequence([[392,0.08],[523,0.16]],{type:"square",vol:0.08}),
    depart: ()=>sequence([[220,0.15],[220,0.18]],{type:"sawtooth",vol:0.09}),
    victory: ()=>sequence([[523,0.12],[659,0.12],[784,0.12],[988,0.26]],{type:"triangle",vol:0.14}),
    defeat: ()=>sequence([[300,0.2],[220,0.32]],{type:"sawtooth",vol:0.11}),
    conquest: ()=>sequence([[523,0.1],[659,0.1],[784,0.1],[659,0.1],[784,0.1],[988,0.4]],{type:"triangle",vol:0.15}),
    raidAlarm: ()=>sequence([[880,0.1],[0,0.05],[880,0.1],[0,0.05],[880,0.16]],{type:"square",vol:0.09}),
    error: ()=>tone(180,0.15,{type:"square",vol:0.07})
  };
  function setMuted(m){ muted=m; }
  function toggle(){ setMuted(!muted); return muted; }
  return {ensureCtx, SFX, setMuted, toggle, isMuted:()=>muted};
})();

export default Audio;
