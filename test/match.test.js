// Regression suite for the symptom matcher.
// Run with: node test/match.test.js
const assert = require("assert");
const { match, loadKb } = require("../kb/match");

const CASES = [
  ["my tomato leaves have yellow patches between the veins and grey fuzzy spots underneath", "Downy mildew"],
  ["tomato plants are wilting in the afternoon then recovering, the stem is brown inside when i cut it", "Bacterial wilt"],
  ["tomato leaves have tiny white speckles and fine webbing underneath", "Spider mites"],
  ["tomato leaves have brown spots with rings and the older leaves are yellow around them", "Early blight"],
  ["tomato leaves have blotch shaped mines with larvae inside", "Tomato leafminer"],
  ["the maize has holes in the leaves and sawdust like droppings in the funnel", "Fall armyworm"],
  ["maize is stunted and yellow and scorched with small purple flowers at the base", "Striga"],
  ["sorghum looks yellow and scorched with purple flowers at the base", "Striga"],
  ["cassava leaves are twisted and have yellow mosaic patterns and the plants are small", "Cassava mosaic"],
  ["okra leaf veins are turning yellow and the pods are small and deformed", "Okra yellow vein mosaic"],
  ["groundnut plants are stunted and bunched with mottled leaves", "Groundnut rosette"],
  ["cowpea leaves have mosaic mottling and are distorted and the plants are stunted", "Cowpea"],
];

let pass = 0;
const fails = [];

for (const [query, want] of CASES) {
  const r = match(query);
  const got = r.matches.length ? r.matches[0].name : "NONE";
  if (got.toLowerCase().includes(want.toLowerCase())) {
    pass++;
  } else {
    fails.push({ query, want, got });
  }
}

// the knowledge base must be well formed
const kb = loadKb();
assert.ok(kb.entries.length >= 10, "expected at least 10 conditions");
for (const e of kb.entries) {
  for (const field of ["id", "crop", "name", "pathogen", "type", "symptoms", "treatment", "urgency", "source"]) {
    assert.ok(e[field] !== undefined, `${e.id} missing ${field}`);
  }
  assert.ok(e.symptoms.length >= 3, `${e.id} needs at least 3 symptoms`);
  assert.ok(e.treatment.length >= 3, `${e.id} needs at least 3 treatment steps`);
  // every cited source must exist in the source list
  for (const key of e.source.split(",").map((s) => s.trim())) {
    assert.ok(kb.meta.sources[key], `${e.id} cites unknown source ${key}`);
  }
}

console.log(`matcher: ${pass}/${CASES.length} correct`);
if (fails.length) {
  for (const f of fails) {
    console.log(`  MISS want=${f.want} got=${f.got}`);
  }
}
console.log(`knowledge base: ${kb.entries.length} conditions, ${Object.keys(kb.meta.sources).length} sources, all citations resolve`);
process.exit(fails.length ? 1 : 0);
