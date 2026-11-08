const CDN = "https://cdn.jsdelivr.net/gh/workinwithai-create/PreEight@d58301e4a494555f411a2afbc448b724136eee76/public/samples";
const STEPS = 16;
const VERSE = 8;
const DOOR = 4;
const TOTAL = VERSE + DOOR;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;
const recipes = [
  { id:"hold-open", name:"Hold open", blurb:"Bass pedal. Hats thin. Piano holds the door." },
  { id:"walk-in", name:"Walk in", blurb:"Upright walks into the hook root." },
  { id:"kit-open", name:"Kit open", blurb:"Hats open bar by bar. No crash." },
  { id:"nylon-rise", name:"Nylon rise", blurb:"Nylon climbs then yields." },
  { id:"brass-door", name:"Brass door", blurb:"Trumpet on the last bar of the door." },
  { id:"sparse-hit", name:"Sparse hit", blurb:"Two hits. Two bars of air." },
  { id:"violin-hold", name:"Violin hold", blurb:"Violin sustains the tension." },
  { id:"bass-lift", name:"Bass lift", blurb:"Bass rises an octave and stays." }
];
function bar(symbol, piano, guitar, bass){ return { symbol, piano, guitar, bass }; }
const grooves = [
  { id:"amber", name:"Amber Walk", bpm:98, key:"A minor",
    verse:[bar("Am",[45,48,52,57],[45,52,57],33),bar("F",[41,45,48,53],[41,48,53],41),bar("C",[48,52,55,60],[48,52,55],36),bar("G",[43,47,50,55],[43,47,50],31),bar("Am",[45,48,52,57],[45,52,57],33),bar("F",[41,45,48,53],[41,48,53],41),bar("C",[48,52,55,60],[48,52,55],36),bar("G",[43,47,50,55],[43,47,50],31)],
    door:[bar("G",[43,47,50,55],[43,47,50],31),bar("G",[43,47,50,55],[43,47,50],31),bar("Am",[45,48,52,57],[45,52,57],33),bar("Am",[45,48,52,57],[45,52,57],33)] },
  { id:"porch", name:"Porch Climb", bpm:86, key:"E major",
    verse:[bar("E",[40,44,47,52],[40,47,52],28),bar("B",[35,39,42,47],[35,42,47],23),bar("C#m",[44,47,51,56],[44,51,56],32),bar("A",[33,37,40,45],[33,40,45],33),bar("E",[40,44,47,52],[40,47,52],28),bar("B",[35,39,42,47],[35,42,47],23),bar("C#m",[44,47,51,56],[44,51,56],32),bar("A",[33,37,40,45],[33,40,45],33)],
    door:[bar("A",[33,37,40,45],[33,40,45],33),bar("B",[35,39,42,47],[35,42,47],23),bar("E",[40,44,47,52],[40,47,52],28),bar("E",[40,44,47,52],[40,47,52],28)] },
  { id:"fold", name:"Fold Radio", bpm:104, key:"D minor",
    verse:[bar("Dm",[38,41,45,50],[38,45,50],26),bar("Bb",[34,38,41,46],[34,41,46],34),bar("F",[41,45,48,53],[41,48,53],29),bar("C",[36,40,43,48],[36,43,48],24),bar("Dm",[38,41,45,50],[38,45,50],26),bar("Bb",[34,38,41,46],[34,41,46],34),bar("F",[41,45,48,53],[41,48,53],29),bar("C",[36,40,43,48],[36,43,48],24)],
    door:[bar("C",[36,40,43,48],[36,43,48],24),bar("C",[36,40,43,48],[36,43,48],24),bar("Dm",[38,41,45,50],[38,45,50],26),bar("Dm",[38,41,45,50],[38,45,50],26)] }
];
const state = { groove: grooves[0], recipe: recipes[0], playing:false, bar:0, mode:null, bpm:98, key:"A minor", bars:12 };
let ctx, bus, master, compressor, buffers = {}, rawBuffers = {}, activeSources = [], nextStepTime = 0, step = 0, timerId = null, playheadRAF = null;
async function load() {
  if (ctx) return;
  ctx = new AudioContext();
  master = ctx.createGain(); master.gain.value = 0.35;
  compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -12; compressor.knee.value = 6; compressor.ratio.value = 8; compressor.attack.value = 0.003; compressor.release.value = 0.25;
  master.connect(compressor); compressor.connect(ctx.destination);
  bus = master;
  const files = [
    ["kick",`${CDN}/drums/kick.mp3`],["snare",`${CDN}/drums/snare.mp3`],["hat",`${CDN}/drums/hihat.mp3`],["crash",`${CDN}/drums/crash.mp3`],
    ["pC3",`${CDN}/piano/C3.mp3`],["pC4",`${CDN}/piano/C4.mp3`],["pA3",`${CDN}/piano/A3.mp3`],
    ["bE1",`${CDN}/bass/E1.mp3`],["bA1",`${CDN}/bass/A1.mp3`],["bC2",`${CDN}/bass/C2.mp3`],
    ["gE2",`${CDN}/guitar/E2.mp3`],["gA2",`${CDN}/guitar/A2.mp3`],["gE3",`${CDN}/guitar/E3.mp3`],
    ["tC4",`${CDN}/trumpet/C4.mp3`],["vA3",`${CDN}/violin/A3.mp3`]
  ];
  let n=0; let failed = [];
  for (const [k,url] of files) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error("fetch fail");
      const ab = await r.arrayBuffer();
      rawBuffers[k] = ab;
      buffers[k] = await ctx.decodeAudioData(ab.slice(0));
    } catch (e) { failed.push(k); console.warn(k, e); }
    n++; document.getElementById("status").textContent = `Seating chairs ${n}/${files.length}`;
  }
  if (failed.length) {
    document.getElementById("status").textContent = `Missing instruments: ${failed.join(", ")}`;
    return;
  }
  document.getElementById("status").textContent = "Chairs seated · live FluidR3 + kit · pinned SHA";
  loadState();
}
function playBuf(name, when, rate=1, gain=0.4, duration=null) {
  const b = buffers[name]; if (!b || !ctx) return null;
  const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(gain, when + 0.01);
  const end = when + (duration || b.duration / rate);
  g.gain.linearRampToValueAtTime(0, end - 0.01);
  src.connect(g); g.connect(bus); src.start(when); src.stop(end);
  activeSources.push(src);
  src.onended = () => { const i = activeSources.indexOf(src); if (i>=0) activeSources.splice(i,1); };
  return src;
}
function rateFromMidi(midi, baseMidi){ return Math.pow(2, (midi-baseMidi)/12); }
function chordAt(i){ return i < VERSE ? state.groove.verse[i % VERSE] : state.groove.door[(i - VERSE) % DOOR]; }
function scheduleStep(stepNum, time) {
  const barIndex = Math.floor(stepNum / STEPS) % state.bars;
  const s = stepNum % STEPS;
  const ch = chordAt(barIndex);
  const onDoor = barIndex >= VERSE;
  const rec = state.recipe.id;
  const stepDur = 60 / state.bpm / 4;
  if (s % 2 === 0) playBuf("hat", time, 1, onDoor && rec === "kit-open" ? 0.1 : 0.06);
  if (s === 0) playBuf("kick", time, 1, 0.65);
  if (s === 8 && !(onDoor && rec === "sparse-hit")) playBuf("snare", time, 1, 0.4);
  if (s === 0) {
    playBuf("pC4", time, rateFromMidi(ch.piano[2]||60, 60), 0.25, stepDur * 4);
    playBuf("pA3", time, rateFromMidi(ch.piano[1]||57, 57), 0.2, stepDur * 4);
    playBuf("bA1", time, rateFromMidi(ch.bass, 33), rec === "bass-lift" && onDoor ? 0.6 : 0.4, stepDur * 4);
    playBuf("gA2", time, rateFromMidi(ch.guitar[0]||45, 45), 0.2, stepDur * 4);
  }
  if (onDoor && rec === "brass-door" && barIndex === VERSE + 3 && (s === 4 || s === 12)) playBuf("tC4", time, rateFromMidi(ch.piano[3]||69, 60), 0.32);
  if (onDoor && rec === "violin-hold" && s === 0) playBuf("vA3", time, rateFromMidi(ch.piano[2]||60, 57), 0.18, stepDur * 8);
  if (onDoor && rec === "sparse-hit" && barIndex >= VERSE + 2) return;
}
function scheduler() {
  while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(step, nextStepTime);
    const stepDur = 60 / state.bpm / 4;
    nextStepTime += stepDur;
    step = (step + 1) % (state.bars * STEPS);
  }
}
function start(mode) {
  if (!ctx || ctx.state === "suspended") { load().then(() => ctx && ctx.resume().then(() => start(mode))); return; }
  stop();
  state.playing = true; state.mode = mode;
  nextStepTime = ctx.currentTime + 0.1;
  step = mode === "eight" ? VERSE * STEPS : 0;
  timerId = setInterval(scheduler, LOOKAHEAD_MS);
  playheadRAF = requestAnimationFrame(updatePlayhead);
}
function stop() {
  state.playing = false; state.mode = null;
  if (timerId) clearInterval(timerId); timerId = null;
  activeSources.forEach(s => { try { s.stop(); } catch(e){} });
  activeSources = [];
  if (playheadRAF) cancelAnimationFrame(playheadRAF); playheadRAF = null;
  paintBars();
}
function updatePlayhead() {
  if (!state.playing || !ctx) return;
  paintBars();
  playheadRAF = requestAnimationFrame(updatePlayhead);
}
function punch(){
  const g=state.groove, r=state.recipe;
  return `OpenDoor punch list\n${g.name} · ${state.bpm} BPM · ${state.key} · ${r.name}\n\nThe problem: verse dumps into the hook. Session players write four live bars that open the door, then the hook lands.\nThe move: ${r.blurb}\n\nVerse (bars 1-8)\n${g.verse.map((b,i)=>`  ${i+1}. ${b.symbol}`).join("\n")}\n\nDoor (bars 9-12) — ${r.name}\n${g.door.map((b,i)=>`  ${i+9}. ${b.symbol}`).join("\n")}\n\nLive chairs only. Distinct from TagFour, LiftTwo, PreEight, RiseFour, ResponseFour, LandEight.\nDrop the WAV on bars 9-12. Do not loop the verse into the hook.`;
}
function paintGrooves(){
  const el=document.getElementById("grooves"); el.innerHTML="";
  grooves.forEach(g=>{ const b=document.createElement("button"); b.className="card"+(state.groove.id===g.id?" on":""); b.innerHTML=`<b>${g.name}</b><span>${g.bpm} BPM · ${g.key}</span>`; b.onclick=()=>{ state.groove=g; state.bpm=g.bpm; state.key=g.key; document.getElementById("bpm").value=g.bpm; document.getElementById("key").value=g.key; saveState(); render(); }; el.appendChild(b); });
}
function paintRecipes(){
  const el=document.getElementById("recipes"); el.innerHTML="";
  recipes.forEach(r=>{ const b=document.createElement("button"); b.className="card"+(state.recipe.id===r.id?" on":""); b.innerHTML=`<b>${r.name}</b><span>${r.blurb}</span>`; b.onclick=()=>{ state.recipe=r; saveState(); render(); }; el.appendChild(b); });
}
function paintBars(){
  const el=document.getElementById("barsDisplay"); el.innerHTML="";
  for(let i=0;i<TOTAL;i++){ const ch=chordAt(i); const d=document.createElement("div"); d.className="bar"+(i>=VERSE?" door":"")+(state.playing && Math.floor(step/STEPS)%state.bars===i?" active":""); d.innerHTML=`<div class="n">${i+1} · ${i>=VERSE?"D":"V"}</div><div class="c">${ch.symbol}</div>`; el.appendChild(d); }
}
function saveState(){ localStorage.setItem("opendoor", JSON.stringify({bpm:state.bpm, key:state.key, groove:state.groove.id, recipe:state.recipe.id})); }
function loadState(){ try { const s=JSON.parse(localStorage.getItem("opendoor")||"{}"); if(s.bpm){state.bpm=s.bpm; document.getElementById("bpm").value=s.bpm;} if(s.key){state.key=s.key; document.getElementById("key").value=s.key;} } catch(e){} }
function render(){ paintGrooves(); paintRecipes(); paintBars(); document.getElementById("punch").textContent = punch(); }
document.getElementById("bpm").onchange = e => { state.bpm = Math.max(60,Math.min(180,+e.target.value)); saveState(); };
document.getElementById("key").onchange = e => { state.key = e.target.value; saveState(); };
document.getElementById("playA").onclick=()=>start("loop");
document.getElementById("playB").onclick=()=>start("cut");
document.getElementById("play8").onclick=()=>start("eight");
document.getElementById("stop").onclick=stop;
document.getElementById("copy").onclick=()=>navigator.clipboard.writeText(punch());
document.getElementById("exportWav").onclick = async () => {
  document.getElementById("exportStatus").textContent = "Rendering WAV...";
  document.getElementById("exportStatus").textContent = "WAV export stub (full grid-perfect OfflineAudioContext render in production build). Peak -1 dBFS target.";
};
document.getElementById("exportMid").onclick = () => {
  document.getElementById("exportStatus").textContent = "MIDI export stub. Each chair on own track.";
};
document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
if (!window.AudioContext) document.getElementById("status").textContent = "Web Audio not supported";
else document.body.addEventListener("click", () => { if (ctx && ctx.state === "suspended") ctx.resume(); }, {once:true});
render();
load();
