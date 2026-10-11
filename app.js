import { init as initEngine, transcribe } from "./engine.js";
import { match } from "./matcher.js";

const $ = (id) => document.getElementById(id);

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

let KB = null;
let engineReady = false;

function showStatus(kind, msg) {
  const s = $("status");
  s.className = kind;
  s.textContent = msg;
}
function hideStatus() {
  $("status").className = "hidden";
}

// read the answer out with the device's own voice, no model needed
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

async function loadKb() {
  const r = await fetch("kb/crops.json");
  KB = await r.json();
  $("kb-line").textContent =
    `${KB.entries.length} conditions, ${Object.keys(KB.meta.sources).length} cited sources, runs offline.`;
}

async function warmEngine() {
  try {
    await initEngine((stage) => showStatus("loading", stage + "..."));
    engineReady = true;
    hideStatus();
  } catch (e) {
    $("mic").disabled = true;
    $("mic-label").textContent = "Speech unavailable";
    $("mic-hint").textContent = "Type the symptoms instead, that still works offline.";
  }
}

function urgencyLabel(u) {
  if (u === "high") return "act now";
  if (u === "medium") return "act soon";
  return "watch";
}

function renderMatches(matches) {
  const box = $("matches");
  box.innerHTML = "";
  matches.forEach((m, i) => {
    const card = document.createElement("div");
    card.className = "card match" + (i === 0 ? " top" : "");
    const treat = (m.treatment || []).map((t) => `<li>${esc(t)}</li>`).join("");
    const conf = (m.confusions || []).map((c) => `<li>${esc(c)}</li>`).join("");
    // every interpolation passes through esc(), urgencyLabel returns a fixed string
    card.innerHTML = `
      <div class="match-head">
        <h2>${esc(m.name)}</h2>
        <span class="tag ${esc(m.urgency)}">${esc(urgencyLabel(m.urgency))}</span>
      </div>
      <p class="pathogen">${esc(m.pathogen)} on ${esc(m.crop)}</p>
      ${i === 0 ? '<p class="conf">Most likely match.</p>' : ""}
      <h3>What to do</h3>
      <ul class="treat">${treat}</ul>
      ${conf ? `<details><summary>Similar problems, how to tell them apart</summary><ul class="plain">${conf}</ul></details>` : ""}
      <p class="src">Source: ${esc(m.source)}</p>
    `;
    box.appendChild(card);
  });
}

function diagnose(text) {
  if (!KB) return;
  const result = match(text, KB, 3);
  if (!result.matches.length) {
    showStatus(
      "error",
      "No match in the knowledge base. Name the crop and what you see, for example the colour and where it is."
    );
    return;
  }
  $("heard").textContent = text;
  renderMatches(result.matches);
  $("mic-card").classList.add("hidden");
  hideStatus();
  $("results").classList.remove("hidden");
  const top = result.matches[0];
  speak(`${top.name}. ${(top.treatment || [])[0] || ""}`);
}

// ---- capture straight to samples, run the local model, no upload ----
let recording = false;
let audioCtx = null;
let sourceNode = null;
let procNode = null;
let streamRef = null;
let buffers = [];
let sampleRate = 16000;

async function startRecording() {
  if (recording || !engineReady) return;
  try {
    streamRef = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sampleRate = audioCtx.sampleRate;
    sourceNode = audioCtx.createMediaStreamSource(streamRef);
    procNode = audioCtx.createScriptProcessor(4096, 1, 1);
    buffers = [];
    procNode.onaudioprocess = (e) =>
      buffers.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    sourceNode.connect(procNode);
    procNode.connect(audioCtx.destination);
    recording = true;
    $("mic").classList.add("live");
    $("mic-label").textContent = "Listening, release when done";
    showStatus("loading", "Listening...");
  } catch (e) {
    showStatus("error", "Microphone is not available. Type the symptoms instead.");
  }
}

async function stopRecording() {
  if (!recording) return;
  recording = false;
  $("mic").classList.remove("live");
  $("mic-label").textContent = "Hold to speak";

  try {
    if (procNode) procNode.disconnect();
    if (sourceNode) sourceNode.disconnect();
    if (streamRef) streamRef.getTracks().forEach((t) => t.stop());
    if (audioCtx) await audioCtx.close();
  } catch (e) {}

  const total = buffers.reduce((n, b) => n + b.length, 0);
  const all = new Float32Array(total);
  let o = 0;
  for (const b of buffers) {
    all.set(b, o);
    o += b.length;
  }
  buffers = [];

  if (total < sampleRate * 0.4) {
    showStatus("error", "Too short. Hold the button while you describe the problem.");
    return;
  }

  showStatus("loading", "Transcribing on this device...");
  try {
    const { text, ms } = await transcribe(all, sampleRate);
    if (!text.trim()) {
      showStatus("error", "Did not catch that. Try again, or type the symptoms.");
      return;
    }
    $("symptoms").value = text;
    showStatus("loading", `Heard you in ${(ms / 1000).toFixed(1)}s. Checking the knowledge base...`);
    setTimeout(() => diagnose(text), 250);
  } catch (e) {
    showStatus("error", e.message);
  }
}

$("mic").addEventListener("mousedown", startRecording);
$("mic").addEventListener("touchstart", (e) => {
  e.preventDefault();
  startRecording();
});
$("mic").addEventListener("mouseup", stopRecording);
$("mic").addEventListener("touchend", (e) => {
  e.preventDefault();
  stopRecording();
});

$("type-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("symptoms").value.trim();
  if (text) diagnose(text);
});

$("again").addEventListener("click", () => {
  $("results").classList.add("hidden");
  $("mic-card").classList.remove("hidden");
  $("symptoms").value = "";
  hideStatus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// knowledge base first so typing works at once, then the speech engine
loadKb().then(warmEngine);
