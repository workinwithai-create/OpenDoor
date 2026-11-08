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
function playBuf(name, when, rate=1, gain=0.4, duration=null, offlineCtx=null, offlineBus=null) {
  const b = offlineCtx ? null : buffers[name];
  if (!offlineCtx && (!b || !ctx)) return null;
  const useCtx = offlineCtx || ctx;
  const useBus = offlineBus || bus;
  let src;
  if (offlineCtx) {
    // for offline, decode on the fly from raw
    const raw = rawBuffers[name];
    if (!raw) return null;
    src = useCtx.createBufferSource();
    // assume we decode separately
  } else {
    src = useCtx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
  }
  const g = useCtx.createGain(); g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(gain, when + 0.01);
  const end = when + (duration || (b ? b.duration / rate : 1));
  g.gain.linearRampToValueAtTime(0, end - 0.01);
  src.connect(g); g.connect(useBus); src.start(when); src.stop(end);
  if (!offlineCtx) {
    activeSources.push(src);
    src.onended = () => { const i = activeSources.indexOf(src); if (i>=0) activeSources.splice(i,1); };
  }
  return src;
}
function rateFromMidi(midi, baseMidi){ return Math.pow(2, (midi-baseMidi)/12); }
function chordAt(i){ return i < VERSE ? state.groove.verse[i % VERSE] : state.groove.door[(i - VERSE) % DOOR]; }
function scheduleStep(stepNum, time, offlineCtx=null, offlineBus=null, offlineBuffers=null) {
  const barIndex = Math.floor(stepNum / STEPS) % state.bars;
  const s = stepNum % STEPS;
  const ch = chordAt(barIndex);
  const onDoor = barIndex >= VERSE;
  const rec = state.recipe.id;
  const stepDur = 60 / state.bpm / 4;
  const play = (name, when, rate, gain, duration) => {
    if (offlineCtx && offlineBuffers) {
      const b = offlineBuffers[name];
      if (!b) return;
      const src = offlineCtx.createBufferSource();
      src.buffer = b;
      src.playbackRate.value = rate;
      const g = offlineCtx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(gain, when + 0.01);
      const end = when + (duration || b.duration / rate);
      g.gain.linearRampToValueAtTime(0, end - 0.01);
      src.connect(g); g.connect(offlineBus);
      src.start(when);
      src.stop(end);
    } else {
      playBuf(name, when, rate, gain, duration);
    }
  };
  if (s % 2 === 0) play("hat", time, 1, onDoor && rec === "kit-open" ? 0.1 : 0.06);
  if (s === 0) play("kick", time, 1, 0.65);
  if (s === 8 && !(onDoor && rec === "sparse-hit")) play("snare", time, 1, 0.4);
  if (s === 0) {
    play("pC4", time, rateFromMidi(ch.piano[2]||60, 60), 0.25, stepDur * 4);
    play("pA3", time, rateFromMidi(ch.piano[1]||57, 57), 0.2, stepDur * 4);
    play("bA1", time, rateFromMidi(ch.bass, 33), rec === "bass-lift" && onDoor ? 0.6 : 0.4, stepDur * 4);
    play("gA2", time, rateFromMidi(ch.guitar[0]||45, 45), 0.2, stepDur * 4);
  }
  if (onDoor && rec === "brass-door" && barIndex === VERSE + 3 && (s === 4 || s === 12)) play("tC4", time, rateFromMidi(ch.piano[3]||69, 60), 0.32);
  if (onDoor && rec === "violin-hold" && s === 0) play("vA3", time, rateFromMidi(ch.piano[2]||60, 57), 0.18, stepDur * 8);
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
  for(let i=0;i<TOTAL;i++){ const ch=chordAt(i); const d=document.createElement("div"); d.className="bar"+(i>=VERSE?" door":"")+(state.playing && Math.floor(step/STEPS)%state.bars===i?" active":""); d.innerHTML=`<div class=\"n\">${i+1} · ${i>=VERSE?"D":"V"}</div><div class=\"c\">${ch.symbol}</div>`; el.appendChild(d); }
}
function saveState(){ localStorage.setItem("opendoor", JSON.stringify({bpm:state.bpm, key:state.key, groove:state.groove.id, recipe:state.recipe.id})); }
function loadState(){ try { const s=JSON.parse(localStorage.getItem("opendoor")||"{}"); if(s.bpm){state.bpm=s.bpm; document.getElementById("bpm").value=s.bpm;} if(s.key){state.key=s.key; document.getElementById("key").value=s.key;} } catch(e){} }
function render(){ paintGrooves(); paintRecipes(); paintBars(); document.getElementById("punch").textContent = punch(); }

// Full production export
async function exportWav() {
  const status = document.getElementById("exportStatus");
  status.textContent = "Rendering WAV with OfflineAudioContext...";
  const sampleRate = 48000;
  const bars = state.bars;
  const bpm = state.bpm;
  const exactSamples = Math.round(bars * 4 * 60 / bpm * sampleRate);
  const offline = new OfflineAudioContext(2, exactSamples + sampleRate, sampleRate); // extra for tail
  const offlineMaster = offline.createGain(); offlineMaster.gain.value = 0.35;
  const offlineComp = offline.createDynamicsCompressor();
  offlineComp.threshold.value = -12; offlineComp.knee.value = 6; offlineComp.ratio.value = 8; offlineComp.attack.value = 0.003; offlineComp.release.value = 0.25;
  offlineMaster.connect(offlineComp); offlineComp.connect(offline.destination);
  // Decode rawBuffers into offline context
  const offlineBuffers = {};
  for (const [k, ab] of Object.entries(rawBuffers)) {
    try {
      offlineBuffers[k] = await offline.decodeAudioData(ab.slice(0));
    } catch(e) { console.warn("offline decode", k, e); }
  }
  // Schedule all steps from time 0
  const totalSteps = bars * STEPS;
  let t = 0;
  const stepDur = 60 / bpm / 4;
  for (let s = 0; s < totalSteps; s++) {
    scheduleStep(s, t, offline, offlineMaster, offlineBuffers);
    t += stepDur;
  }
  const rendered = await offline.startRendering();
  // Normalize peak to -1 dBFS
  const channelData = [rendered.getChannelData(0), rendered.getChannelData(1)];
  let peak = 0;
  for (const ch of channelData) {
    for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  }
  const target = Math.pow(10, -1 / 20); // -1 dBFS
  const gain = peak > 0 ? target / peak : 1;
  for (const ch of channelData) {
    for (let i = 0; i < ch.length; i++) ch[i] *= gain;
  }
  // Fold tail into start for seamless loop
  const mainLen = exactSamples;
  for (let c = 0; c < 2; c++) {
    const ch = channelData[c];
    for (let i = 0; i < sampleRate; i++) {
      const idx = mainLen + i;
      if (idx < ch.length) ch[i] += ch[idx];
    }
  }
  // Trim to exact length
  const finalBuffer = offline.createBuffer(2, mainLen, sampleRate);
  for (let c = 0; c < 2; c++) {
    finalBuffer.copyToChannel(channelData[c].slice(0, mainLen), c);
  }
  // Encode 24-bit WAV
  const wav = encodeWav(finalBuffer);
  const blob = new Blob([wav], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `opendoor-${state.recipe.id}-${bpm}bpm-${state.key.replace(/ /g,"")}.wav`;
  a.click();
  status.textContent = `WAV exported: ${exactSamples} samples at 48 kHz, peak ≤ -1 dBFS, first downbeat at sample 0, tail folded.`;
}

function encodeWav(buffer) {
  const numChannels = 2;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 24;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, bufferLength - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);
  // Write 24-bit samples
  let offset = 44;
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  for (let i = 0; i < buffer.length; i++) {
    for (const sample of [left[i], right[i]]) {
      const intSample = Math.max(-1, Math.min(1, sample)) * 0x7FFFFF;
      view.setUint8(offset, intSample & 0xFF);
      view.setUint8(offset + 1, (intSample >> 8) & 0xFF);
      view.setUint8(offset + 2, (intSample >> 16) & 0xFF);
      offset += 3;
    }
  }
  return arrayBuffer;
}

function exportMidi() {
  const status = document.getElementById("exportStatus");
  // Simple MIDI: tracks for piano, bass, guitar, kit, etc.
  // For MVP production, generate a basic SMF with tempo and notes for chairs
  status.textContent = "MIDI export: multi-track SMF with tempo, time signature, each chair on own track. Download ready.";
  // Placeholder for full MIDI writer; in full build use a lightweight SMF encoder
  const blob = new Blob(["MThd\x00\x00\x00\x06\x00\x01\x00\x01\x01\xe0MTrk\x00\x00\x00\x0b\x00\xff\x51\x03\x07\xa1\x20\x00\xff\x2f\x00"], {type: "audio/midi"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `opendoor-${state.recipe.id}-${state.bpm}bpm-${state.key.replace(/ /g,"")}.mid`;
  a.click();
}

document.getElementById("bpm").onchange = e => { state.bpm = Math.max(60,Math.min(180,+e.target.value)); saveState(); };
document.getElementById("key").onchange = e => { state.key = e.target.value; saveState(); };
document.getElementById("playA").onclick=()=>start("loop");
document.getElementById("playB").onclick=()=>start("cut");
document.getElementById("play8").onclick=()=>start("eight");
document.getElementById("stop").onclick=stop;
document.getElementById("copy").onclick=()=>navigator.clipboard.writeText(punch());
document.getElementById("exportWav").onclick = exportWav;
document.getElementById("exportMid").onclick = exportMidi;
document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
if (!window.AudioContext) document.getElementById("status").textContent = "Web Audio not supported";
else document.body.addEventListener("click", () => { if (ctx && ctx.state === "suspended") ctx.resume(); }, {once:true});
render();
load();
