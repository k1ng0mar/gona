const $ = (id) => document.getElementById(id);

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function showStatus(kind, msg) {
  const s = $("status");
  s.className = kind;
  s.textContent = msg;
}
function hideStatus() {
  $("status").className = "hidden";
}

// ---- speak the answer out loud, using the device's own voice ----
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

async function loadHealth() {
  try {
    const r = await fetch("/api/health");
    const h = await r.json();
    $("kb-line").textContent =
      `${h.kb_entries} conditions, ${h.kb_sources} cited sources, runs offline.`;
  } catch (e) {
    $("kb-line").textContent = "Knowledge base unavailable.";
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
    const treat = (m.treatment || [])
      .map((t) => `<li>${esc(t)}</li>`)
      .join("");
    const conf = (m.confusions || [])
      .map((c) => `<li>${esc(c)}</li>`)
      .join("");
    // Every value below passes through esc() first, and urgencyLabel returns a
    // fixed string, so this innerHTML carries no attacker controlled markup.
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
    `;
    box.appendChild(card);
  });
}

async function diagnose(text) {
  showStatus("loading", "Checking the knowledge base...");
  try {
    const r = await fetch("/api/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symptoms: text }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "Something went wrong.");
    if (!data.matches.length) {
      showStatus(
        "error",
        "No match in the knowledge base. Try naming the crop and what you see, for example the colour and where it is."
      );
      return;
    }
    $("heard").textContent = text;
    renderMatches(data.matches);
    $("mic-card").classList.add("hidden");
    hideStatus();
    $("results").classList.remove("hidden");

    const top = data.matches[0];
    const spoken = `${top.name}. ${(top.treatment || [])[0] || ""}`;
    speak(spoken);
  } catch (err) {
    showStatus("error", err.message);
  }
}

// ---- voice input: record, send to the local Whisper model ----
let mediaRecorder = null;
let chunks = [];
let recording = false;

async function startRecording() {
  if (recording) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: "audio/webm" });
      await transcribe(blob);
    };
    mediaRecorder.start();
    recording = true;
    $("mic").classList.add("live");
    $("mic-label").textContent = "Listening, release when done";
  } catch (e) {
    showStatus(
      "error",
      "Microphone is not available. Type the symptoms instead."
    );
  }
}

function stopRecording() {
  if (!recording || !mediaRecorder) return;
  recording = false;
  $("mic").classList.remove("live");
  $("mic-label").textContent = "Hold to speak";
  mediaRecorder.stop();
}

async function transcribe(blob) {
  showStatus("loading", "Transcribing on this device...");
  const buf = await blob.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  try {
    const r = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: b64 }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "Transcription failed.");
    $("symptoms").value = data.text;
    await diagnose(data.text);
  } catch (err) {
    showStatus("error", err.message);
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

loadHealth();
