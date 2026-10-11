// Runs the Whistle speech model entirely in the browser, via WebAssembly.
// No server, no network after the first load. The engine and the weights are
// fetched once and cached by the service worker.
//
// The C API is small: load the weights, hand it 16 kHz mono float PCM, read
// back JSON. That is the whole surface.

let mod = null;
let loaded = false;

const ENGINE = {
  js: "engine/needle.js",
  wasm: "engine/needle.wasm",
  weights: "engine/whistle.cact",
};

async function init(onProgress) {
  if (loaded) return;
  onProgress && onProgress("loading engine");

  // needle.js is a UMD build with no ES module export, so it cannot be
  // imported. Load it as a classic script; it attaches the factory to
  // globalThis.createNeedle.
  if (typeof globalThis.createNeedle !== "function") {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = ENGINE.js;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Could not load the speech engine."));
      document.head.appendChild(s);
    });
  }
  const factory = globalThis.createNeedle;
  if (typeof factory !== "function") {
    throw new Error("Speech engine did not initialise.");
  }

  mod = await factory({
    locateFile: (f) => (f.endsWith(".wasm") ? ENGINE.wasm : f),
    print: () => {},
    printErr: () => {},
  });

  onProgress && onProgress("loading speech model");
  const res = await fetch(ENGINE.weights);
  if (!res.ok) throw new Error("Could not load the speech model.");
  const cact = new Uint8Array(await res.arrayBuffer());

  const ptr = mod._malloc(cact.length);
  mod.HEAPU8.set(cact, ptr);
  const rc = mod._needle_load(ptr, BigInt(cact.length));
  if (rc < 0) {
    throw new Error("Engine rejected the model: " + mod.UTF8ToString(mod._needle_last_error()));
  }
  mod._free(ptr);
  loaded = true;
}

// Resample any Float32Array of mono samples to 16 kHz, which is what the
// model expects. Linear interpolation is fine for speech.
function resample(input, inRate, outRate = 16000) {
  if (inRate === outRate) return input;
  const ratio = inRate / outRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

async function transcribe(samples, sampleRate) {
  if (!loaded) throw new Error("Speech model is not loaded yet.");
  const pcm = resample(samples, sampleRate, 16000);
  const n = Math.min(pcm.length, 16000 * 30); // 30 s cap

  const fptr = mod._malloc(n * 4);
  // only HEAPU8 is exported, so build a float view over the same buffer
  const F32 = new Float32Array(mod.HEAPU8.buffer, fptr, n);
  F32.set(pcm.subarray(0, n));

  const OUT = 16384;
  const outPtr = mod._malloc(OUT);
  const t0 = performance.now();
  const tok = mod._needle_transcribe(fptr, n, 0, 0, 0, outPtr, OUT);
  const ms = Math.round(performance.now() - t0);
  const raw = mod.UTF8ToString(outPtr);

  mod._free(fptr);
  mod._free(outPtr);

  if (tok < 0) {
    throw new Error("Transcription failed: " + mod.UTF8ToString(mod._needle_last_error()));
  }
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    parsed = { text: raw };
  }
  return { text: parsed.text || "", ms, language: parsed.language };
}

export { init, transcribe, resample };
