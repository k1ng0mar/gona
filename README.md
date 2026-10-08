# Gona

An offline crop advisor for West African smallholders. Press one button,
describe what you see out loud, get a diagnosis and what to do about it.
No signal required, nothing leaves the device.

Gona means "plant" in Hausa.

## Why

Every crop diagnosis app assumes you have signal in the field. You often do
not. This one carries its own speech model and its own knowledge base, so the
whole thing works with the radio off.

The knowledge is not a model's opinion. It is 11 conditions curated from
published plant pathology and extension sources, each entry citing where it
came from. A 35MB model cannot know West African crop pathology, so the
knowledge lives in a file you can read, audit and correct. The model's job is
only to hear you.

## How it works

```
voice  ->  Whistle (16.9MB, speech to text, on device)
       ->  symptom matcher (token overlap over the knowledge base, no model)
       ->  answer, read out loud by the device's own voice
```

Nothing in that path calls the internet.

## Run it

```
npm install
npm start
```

Open http://localhost:3000.

Voice input needs the local speech model. Without it the app still works, you
just type the symptoms instead.

### Optional: local speech

```
pip install cactus-needle
needle download whistle
export WHISTLE_WEIGHTS=/path/to/whistle.cact
export WHISTLE_BIN=./scripts/whistle.sh
```

The `scripts/whistle.sh` shim wraps the Python API so the server can shell out
to it. Speech to text runs on CPU, no GPU.

## The knowledge base

`kb/crops.json` holds every condition. Each entry has the symptoms, what it is
easily confused with, the conditions that favour it, the treatment steps, an
urgency level, and the source.

Covered crops: maize, sorghum, millet, rice, cassava, tomato, okra, cowpea,
groundnut.

Covered conditions include fall armyworm, Striga, cassava mosaic disease,
groundnut rosette, bacterial wilt, early blight, downy mildew, spider mites,
Tuta absoluta, okra yellow vein mosaic and cowpea aphid borne mosaic.

To add a condition, add an entry with a real source. To correct one, edit the
text. That is the point of keeping it as data.

## API

- `GET /api/health` returns what is available on the device
- `GET /api/kb` returns the whole knowledge base, for audit or forking
- `POST /api/diagnose` body `{ symptoms }` returns ranked matches with sources
- `POST /api/transcribe` body `{ audio }` base64 WAV, returns `{ text }`

## Tests

```
npm test
```

Runs the matcher against 12 field style descriptions and validates every
knowledge base entry, including that every citation resolves to a listed
source.

## Limits

This is advice, not a lab result. It matches what you describe to a curated
list of conditions and shows its reasoning. If the description is vague it will
say it has no match rather than guess. For anything that matters, confirm with
your local extension service.

## License

MIT
