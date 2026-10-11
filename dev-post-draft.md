# Gona: a crop doctor that works where there's no signal

<!--
MEDIA FOR THE POST:
- Live demo: https://k1ng0mar.github.io/gona/
- Repo: https://github.com/k1ng0mar/gona
- Screenshots: main screen after intro, diagnosis result in "What it covers"
-->

*Hacktoberfest 2026, Week 1: Touch Grass*

Every crop diagnosis app I've tried assumes you've got signal in the field. In a lot of West Africa, you don't. You're standing in a maize plot an hour from the nearest town, the leaves have weird streaks on them, and the app that was supposed to help is stuck on a loading spinner.

So I built Gona. It's Hausa for "farm." You press one button, say out loud what you're seeing, and it tells you what's probably wrong and what to do about it. No signal needed, and nothing leaves your phone.

## Made for people who are already outside

This week's theme is about getting people off their screens. Farmers are already off their screens, they're out walking their plots. So I tried to make the app the smallest possible interruption: talk, listen, pocket the phone. No feed, no account, no dashboard. It's basically a conversation you have while looking at the plant.

The offline part isn't a bonus feature, it's the whole point. The places where crops get sick and the places with decent coverage barely overlap, so an app that needs internet fails the exact people who need it most.

## The open-source AI

The only neural network in Gona is Whistle, a 16.9MB open-weight speech-to-text model from Cactus Compute (Apache 2.0). It runs in the browser tab as WebAssembly. After your first visit, a service worker caches the app, the knowledge base, and the model runtime. The 17MB of speech weights download once, the first time you use it. After that, you can switch the radio off.

Open matters here for practical reasons:

- **It works with no internet.** The model lives on the device. No API key, no account, no per request cost.
- **Nothing leaves the device.** Your voice, your crops, your location never hit a server, because the static build doesn't have one.
- **It costs nothing to run.** No inference bills, no subscriptions. It's a static site, so hosting is free.
- **You can read and change all of it.** The speech model is open weight, the engine is open source, and the knowledge is a JSON file. If an entry is wrong, you fix the text. Try doing that with a closed model.

## The model only listens. Humans do the diagnosing.

The best design decision in this project came from getting it wrong first. I tried the obvious thing and put an LLM in charge. A 3B model gave me a confident wrong diagnosis in 20 seconds. A 7B model took over seven minutes on the same question. A model small enough to run on a phone just doesn't know West African crop pathology, and confident wrong advice about someone's livelihood is worse than no advice at all.

So the setup is deliberately lopsided:

```
voice  ->  Whistle (16.9MB, speech to text, runs in the browser)
       ->  symptom matcher (token overlap over the knowledge base)
       ->  answer, read out loud by the device's own voice
```

Whistle has one job: hear what you said. Everything after that is a lookup against 11 conditions I pulled from published plant pathology and extension sources (CABI, IITA, APS). Each entry cites its source and lists the symptoms, what it's commonly confused with, the conditions that favour it, treatment steps, and an urgency level.

A lookup can't hallucinate, and it's fast. If your description doesn't match anything, Gona says so instead of guessing. That's on purpose. It's giving advice about people's crops, so when it matters it tells you to confirm with your local extension service.

This is where open beat closed for me. A closed API would have meant a bigger model and a monthly bill, and it still wouldn't know cassava mosaic disease from a nutrient deficiency, because that knowledge was never in its training data. Going open let me put the knowledge where it belongs: in a file, written by humans, with sources attached.

## What it covers

Nine crops: maize, sorghum, millet, rice, cassava, tomato, okra, cowpea, and groundnut. Eleven conditions, including fall armyworm, Striga, cassava mosaic disease, groundnut rosette, bacterial wilt, and Tuta absoluta. To add a condition, add an entry with a real source. To fix one, edit the text.

I tested the matcher against 12 field-style descriptions, written the way a farmer would actually say it, not in textbook language. The test suite checks that every knowledge base entry validates, that every citation resolves, and that the browser matcher and the server matcher never drift apart.

## Try it

**Live demo:** https://k1ng0mar.github.io/gona/
**Repo:** https://github.com/k1ng0mar/gona (MIT)

It works best in a real browser with a mic. Press the button, describe a sick plant out loud, and listen to what it says. Then turn on airplane mode and do it again. That second run is the whole argument.
