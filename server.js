const express = require("express");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const KB = require("./kb/crops.json");
const { match } = require("./kb/match");

const WHISTLE = process.env.WHISTLE_BIN || "needle";
const CACTUS_PY = process.env.CACTUS_PYTHON || "python3";
const WHISTLE_WEIGHTS = process.env.WHISTLE_WEIGHTS || "./models/whistle.cact";

// ---- health: what is actually available on this box ----
app.get("/api/health", (req, res) => {
  res.json({
    kb_version: KB.meta.version,
    kb_entries: KB.entries.length,
    kb_sources: Object.keys(KB.meta.sources).length,
    offline: true,
    speech: fs.existsSync(WHISTLE_WEIGHTS) ? "whistle" : "browser",
  });
});

// ---- diagnosis: pure knowledge base lookup, no model ----
app.post("/api/diagnose", (req, res) => {
  const text = (req.body && req.body.symptoms) || "";
  if (!text.trim()) {
    return res.status(400).json({ error: "empty", message: "No symptoms given." });
  }
  const result = match(text, KB, 3);
  res.json({
    query: text,
    crop: result.query_crop,
    matches: result.matches,
    kb_version: result.kb_version,
  });
});

// ---- the knowledge base itself, so anyone can audit or fork it ----
app.get("/api/kb", (req, res) => {
  res.json(KB);
});

// ---- speech to text via Whistle, when it is installed ----
app.post("/api/transcribe", (req, res) => {
  const b64 = (req.body && req.body.audio) || "";
  if (!b64) {
    return res.status(400).json({ error: "empty", message: "No audio sent." });
  }
  const tmp = path.join("/tmp", `gona-${Date.now()}.wav`);
  try {
    fs.writeFileSync(tmp, Buffer.from(b64, "base64"));
  } catch (e) {
    return res.status(500).json({ error: "write_failed", message: e.message });
  }

  execFile(
    WHISTLE,
    ["transcribe", "--weights", WHISTLE_WEIGHTS, "--audio", tmp],
    { timeout: 120000 },
    (err, stdout) => {
      fs.unlink(tmp, () => {});
      if (err) {
        return res.status(503).json({
          error: "speech_unavailable",
          message: "Local speech model is not available. Type the symptoms instead.",
        });
      }
      let text = (stdout || "").trim();
      try {
        const parsed = JSON.parse(stdout);
        text = parsed.text || text;
      } catch (e) {
        // whistle may print plain text; keep it
      }
      res.json({ text });
    }
  );
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () =>
    console.log(`Gona listening on http://localhost:${PORT}`)
  );
}
module.exports = app;
