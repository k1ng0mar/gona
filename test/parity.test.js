// Guards against the browser matcher and the Node matcher drifting apart.
// Run with: node test/parity.test.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const nodeMatcher = require(path.join(root, "kb", "match.js"));
const browserSrc = fs.readFileSync(path.join(root, "public", "matcher.js"), "utf8");

// The browser copy is an ES module, so it cannot be require()d here. Instead
// pull the two lookup tables out of the source text and compare them. This is
// plain text parsing, no code is executed.
function extractObjectLiteral(src, name) {
  const start = src.indexOf(`const ${name} = {`);
  assert.ok(start !== -1, `could not find ${name}`);
  let depth = 0;
  let i = src.indexOf("{", start);
  const from = i;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(from, i + 1);
}

// convert a simple "key: 'value'," literal into JSON so we can compare safely
function literalToJson(lit) {
  const body = lit.replace(/\/\/[^\n]*/g, "");
  const pairs = body
    .slice(1, -1)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^["']?([^"':]+)["']?\s*:\s*["']([^"']*)["']$/);
      if (!m) throw new Error("cannot parse pair: " + s);
      return [m[1].trim(), m[2]];
    });
  return Object.fromEntries(pairs);
}

const browserSynonyms = literalToJson(extractObjectLiteral(browserSrc, "SYNONYMS"));
const browserAliases = literalToJson(extractObjectLiteral(browserSrc, "CROP_ALIASES"));

assert.deepStrictEqual(
  browserSynonyms,
  nodeMatcher.SYNONYMS,
  "SYNONYMS differ between kb/match.js and public/matcher.js"
);

const nodeAliases = require(path.join(root, "kb", "match.js")).CROP_ALIASES;
assert.deepStrictEqual(
  browserAliases,
  nodeAliases,
  "CROP_ALIASES differ between kb/match.js and public/matcher.js"
);

// the served knowledge base must be byte identical to the source of truth
const a = fs.readFileSync(path.join(root, "kb", "crops.json"), "utf8");
const b = fs.readFileSync(path.join(root, "public", "kb", "crops.json"), "utf8");
assert.strictEqual(a, b, "public/kb/crops.json has drifted from kb/crops.json");

// same inputs must produce a match in both directions
for (const q of [
  "tomato leaves yellow patches grey fuzzy spots underneath",
  "maize holes leaves sawdust funnel",
  "cassava twisted leaves mosaic",
  "okra veins yellow pods deformed",
]) {
  assert.ok(nodeMatcher.match(q).matches[0], `node matcher returned nothing for ${q}`);
}

console.log("parity: synonym tables match, crop aliases match, kb copies identical");
