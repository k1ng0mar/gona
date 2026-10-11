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
let lastTop = null;

function showStatus(kind, msg) {
  const s = $("status");
  s.className = kind;
  s.textContent = msg;
}
function hideStatus() {
  $("status").className = "hidden";
}

// small pill in the header: getting ready / speech ready / typing only
function setChip(state, text) {
  $("engine-chip").dataset.state = state;
  $("engine-chip-text").textContent = text;
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
    $("mic").dataset.ready = "true";
    setChip("ready", "Speech ready");
    hideStatus();
  } catch (e) {
    $("mic").disabled = true;
    $("mic-label").textContent = "Speech unavailable";
    $("mic-hint").textContent = "Type the symptoms instead, that still works offline.";
    setChip("off", "Typing only");
    hideStatus();
  }
}

function urgencyOf(u) {
  return u === "high" || u === "medium" ? u : "low";
}
function urgencyLabel(u) {
  if (u === "high") return "Act now";
  if (u === "medium") return "Act soon";
  return "Watch";
}

// the source field holds ids like "cabi_faw, iita_cmd"; show the full citations
function citations(m) {
  const ids = String(m.source || "").split(",").map((s) => s.trim()).filter(Boolean);
  const table = (KB && KB.meta && KB.meta.sources) || {};
  return ids.map((id) => table[id] || id);
}

function metaLine(m) {
  const crop = String(m.crop || "").split(",").map((c) => c.trim()).filter(Boolean).join(", ");
  return `<p class="meta"><span class="crop">${esc(crop)}</span><span>${esc(m.pathogen)}</span></p>`;
}

function detailBlocks(m) {
  const steps = (m.treatment || []).map((t) => `<li><span>${esc(t)}</span></li>`).join("");
  const why = (m.matched_symptoms || []).map((t) => `<li>${esc(t)}</li>`).join("");
  const conf = (m.confusions || []).map((c) => `<li>${esc(c)}</li>`).join("");
  const src = citations(m).map((c) => `<li>${esc(c)}</li>`).join("");
  return `
    <h3>What to do</h3>
    <ol class="steps">${steps}</ol>
    ${why ? `<details class="more"><summary>Why this matched</summary><ul class="plain">${why}</ul></details>` : ""}
    ${conf ? `<details class="more"><summary>Similar problems, how to tell them apart</summary><ul class="plain">${conf}</ul></details>` : ""}
    ${src ? `<div class="sources"><h4>Sources</h4><ul>${src}</ul></div>` : ""}
  `;
}

function renderMatches(matches) {
  const box = $("matches");
  box.innerHTML = "";

  matches.forEach((m, i) => {
    const u = urgencyOf(m.urgency);
    const label = urgencyLabel(u);
    // every interpolation passes through esc(), urgencyOf/urgencyLabel return fixed strings
    if (i === 0) {
      const card = document.createElement("article");
      card.className = `match top urgency-${u}`;
      const canSpeak = "speechSynthesis" in window;
      card.innerHTML = `
        <div class="band">${label}</div>
        <div class="match-body">
          <h2>${esc(m.name)}</h2>
          ${metaLine(m)}
          ${canSpeak ? '<button type="button" class="btn btn-line listen">Listen to the steps</button>' : ""}
          ${detailBlocks(m)}
        </div>`;
      box.appendChild(card);
    } else {
      if (i === 1) {
        const h = document.createElement("h3");
        h.className = "also";
        h.textContent = "Also possible";
        box.appendChild(h);
      }
      const card = document.createElement("details");
      card.className = `match alt urgency-${u}`;
      card.innerHTML = `
        <summary><span class="alt-name">${esc(m.name)}</span><span class="tag">${label}</span></summary>
        <div class="match-body">
          ${metaLine(m)}
          ${detailBlocks(m)}
        </div>`;
      box.appendChild(card);
    }
  });
}

$("matches").addEventListener("click", (e) => {
  if (!e.target.closest(".listen") || !lastTop) return;
  const steps = (lastTop.treatment || []).join(". ");
  speak(`${lastTop.name}. ${steps}`);
});

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
  $("heard").textContent = "“" + text + "”";
  renderMatches(result.matches);
  $("mic-card").classList.add("hidden");
  hideStatus();
  $("results").classList.remove("hidden");
  $("results").focus({ preventScroll: true });
  $("results").scrollIntoView({ block: "start" });
  const top = result.matches[0];
  lastTop = top;
  speak(`${top.name}. ${(top.treatment || [])[0] || ""}`);
}

// ---- capture straight to samples, run the local model, no upload ----
let recording = false;
let starting = false;
let held = false; // is the button still down
let audioCtx = null;
let sourceNode = null;
let procNode = null;
let streamRef = null;
let buffers = [];
let sampleRate = 16000;
let level = 0;

function setLive(on) {
  $("mic").classList.toggle("live", on);
  $("mic-label").classList.toggle("live", on);
  $("mic-label").textContent = on ? "Listening. Let go when you are done." : "Hold to speak";
  if (!on) {
    level = 0;
    $("mic").style.setProperty("--level", "0");
  }
}

async function startRecording() {
  if (recording || starting) return;
  if (!engineReady) {
    showStatus("loading", "The speech model is still loading. You can type in the meantime.");
    return;
  }
  starting = true;
  held = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    // let go before the microphone opened: switch it straight off again
    if (!held) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef = stream;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sampleRate = audioCtx.sampleRate;
    sourceNode = audioCtx.createMediaStreamSource(streamRef);
    procNode = audioCtx.createScriptProcessor(4096, 1, 1);
    buffers = [];
    procNode.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      buffers.push(new Float32Array(d));
      // loudness for the ring: quick to rise, slow to fall
      let sum = 0;
      let n = 0;
      for (let i = 0; i < d.length; i += 8) {
        sum += d[i] * d[i];
        n++;
      }
      level = Math.max(Math.min(1, Math.sqrt(sum / n) * 7), level * 0.75);
      $("mic").style.setProperty("--level", level.toFixed(3));
    };
    sourceNode.connect(procNode);
    procNode.connect(audioCtx.destination);
    recording = true;
    setLive(true);
    showStatus("loading", "Listening...");
  } catch (e) {
    showStatus("error", "Microphone is not available. Type the symptoms instead.");
  } finally {
    starting = false;
  }
}

async function stopRecording() {
  if (!recording) return;
  recording = false;
  setLive(false);

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

function release() {
  held = false;
  stopRecording();
}

const mic = $("mic");
mic.addEventListener("mousedown", startRecording);
mic.addEventListener("touchstart", (e) => {
  e.preventDefault();
  startRecording();
});
mic.addEventListener("mouseup", release);
mic.addEventListener("mouseleave", release);
mic.addEventListener("touchend", (e) => {
  e.preventDefault();
  release();
});
mic.addEventListener("touchcancel", release);
mic.addEventListener("blur", release);
mic.addEventListener("contextmenu", (e) => e.preventDefault());
// keyboard: hold Space or Enter, the same as holding the button
mic.addEventListener("keydown", (e) => {
  if ((e.key === " " || e.key === "Enter") && !e.repeat) {
    e.preventDefault();
    startRecording();
  }
});
mic.addEventListener("keyup", (e) => {
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    release();
  }
});

$("type-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("symptoms").value.trim();
  if (text) diagnose(text);
});

$("again").addEventListener("click", () => {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  $("results").classList.add("hidden");
  $("mic-card").classList.remove("hidden");
  $("symptoms").value = "";
  hideStatus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// knowledge base first so typing works at once, then the speech engine
loadKb().then(warmEngine);
