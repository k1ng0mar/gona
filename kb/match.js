// Symptom matcher. Takes free text (usually a transcript from Whistle) and
// scores it against the curated knowledge base. No model involved: token
// overlap plus a synonym layer for the words people actually use.
const fs = require("fs");
const path = require("path");

const KB_PATH = path.join(__dirname, "crops.json");

// words people say, mapped to the vocabulary used in the knowledge base
const SYNONYMS = {
  yellowing: "yellow", yellowish: "yellow", pale: "yellow",
  dying: "wilt", dead: "wilt", wilting: "wilt", drooping: "wilt",
  collapsing: "wilt", shrivelled: "wilt",
  spots: "spot", speckles: "spot", speckling: "spot", marks: "spot",
  patches: "spot", blotches: "spot",
  holes: "hole", eaten: "hole", chewed: "hole", ragged: "hole",
  worms: "caterpillar", worm: "caterpillar", caterpillars: "caterpillar",
  grubs: "caterpillar", larvae: "caterpillar",
  insects: "insect", bugs: "insect", flies: "whitefly",
  rot: "rotten", rotting: "rotten", mould: "mold", moldy: "mold", mouldy: "mold",
  curling: "curl", curled: "curl", twisted: "twist",
  dwarf: "stunted", small: "stunted", tiny: "stunted",
  dried: "dry", drying: "dry", black: "dark", brown: "dark",
  fuzz: "fuzzy", downy: "fuzzy", powdery: "powder",
  webbing: "webbing", web: "webbing", silk: "webbing",
};

const CROP_ALIASES = {
  corn: "maize", "guinea corn": "sorghum", dawa: "sorghum",
  masara: "maize", agbado: "maize",
  groundnuts: "groundnut", peanut: "groundnut", peanuts: "groundnut",
  beans: "cowpea", "black eyed pea": "cowpea",
  ladyfinger: "okra", okro: "okra", tomatoes: "tomato",
  "garden egg": "eggplant",
};

const CROPS = ["maize", "sorghum", "millet", "rice", "tomato", "cassava",
  "groundnut", "cowpea", "okra", "pepper", "potato", "eggplant"];

const STOP = new Set(`a an the is are was were be been being of in on at to for
from with by and or but if then than that this these those it its my our your
their have has had do does did can could should would will plant plants crop
crops leaf leaves some very really just about there here what which who whom
whose when where why how not no yes i me we you they he she them us mine`.split(/\s+/));

function tokens(text) {
  const words = String(text || "").toLowerCase().match(/[a-z]+/g) || [];
  const out = [];
  for (let w of words) {
    w = SYNONYMS[w] || w;
    if (STOP.has(w) || w.length < 3) continue;
    out.push(w);
  }
  return out;
}

function detectCrop(text) {
  const low = String(text || "").toLowerCase();
  for (const [alias, crop] of Object.entries(CROP_ALIASES)) {
    if (low.includes(alias)) return crop;
  }
  for (const crop of CROPS) {
    if (low.includes(crop)) return crop;
  }
  return null;
}

function loadKb(p) {
  return JSON.parse(fs.readFileSync(p || KB_PATH, "utf8"));
}

function match(symptomsText, kb, topN) {
  kb = kb || loadKb();
  topN = topN || 3;
  const text = symptomsText || "";
  const crop = detectCrop(text);
  const q = new Set(tokens(text));

  const results = [];
  for (const entry of kb.entries) {
    const crops = entry.crop.split(",").map((c) => c.trim());
    const cropOk = crop === null || crops.includes(crop) || crops.length > 1;

    let score = 0;
    const matched = [];
    for (const sym of entry.symptoms) {
      const s = new Set(tokens(sym));
      if (!s.size) continue;
      const overlap = [...q].filter((w) => s.has(w));
      if (overlap.length) {
        const frac = overlap.length / s.size;
        score += frac;
        if (frac >= 0.4) matched.push(sym);
      }
    }
    if (!cropOk) score *= 0.35;
    if (crop && crops.includes(crop)) score += 1.5;

    if (score > 0) {
      results.push({
        id: entry.id,
        crop: entry.crop,
        name: entry.name,
        pathogen: entry.pathogen,
        type: entry.type,
        urgency: entry.urgency,
        score: Math.round(score * 1000) / 1000,
        matched_symptoms: matched,
        treatment: entry.treatment,
        confusions: entry.confusions || [],
        source: entry.source,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return {
    query_crop: crop,
    matches: results.slice(0, topN),
    kb_version: kb.meta.version,
    sources: kb.meta.sources,
  };
}

module.exports = { match, loadKb, tokens, detectCrop, SYNONYMS, CROP_ALIASES };

if (require.main === module) {
  const q = process.argv.slice(2).join(" ") ||
    "tomato leaves have yellow patches and grey spots underneath";
  const out = match(q);
  console.log("crop:", out.query_crop);
  for (const m of out.matches) {
    console.log(`  ${m.score}  ${m.name} (${m.crop})  [${m.urgency}]`);
    for (const s of m.matched_symptoms.slice(0, 3)) console.log(`         matched: ${s}`);
  }
}
