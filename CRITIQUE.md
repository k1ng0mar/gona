# Critique — Gona redesign, Round 1 (2026-10-11)

Critic: fresh-eyes subagent briefed per web-designer/references/critique.md.
Renders: shots/r1/390.png, 1440.png, sheet.png, diagnosis (phone), matrix/windows-hc.png.
Scan: clean, no FAILs. Matrix: 1 known FAIL (windows-hc — mic disc and Diagnose lose backgrounds; logged, needs transparent border/outline).

## Scores

| # | Line | Score | Evidence |
|---|---|---|---|
| 1 | Concept on the page | 5 | Both screens read as an offline voice crop-doctor without the logo. |
| 2 | Not the category average | 5 | Indigo + millet gold + harmattan haze; no agtech green, no dashboard clichés. |
| 3 | Not a slop face | 4 | Two Paper Edition echoes (white floating panel, grey lede); none of its signatures. |
| 4 | First screen | 5 | Evidence, concept, action in first viewport on phone and desktop; squint lands on the mic disc. |
| 5 | Typography | 4 | Real scale contrast, tight display tracking; Inter is a default reach, not a chosen voice; "You said" in italic grey is the weakest sunlight choice. |
| 6 | Colour | 4 | One hue family (240); urgency doubled by shape markers — but millet gold does two jobs (accent + Act-soon band). |
| 7 | Richness | 5 | The 60-tick voice-reactive ring is the product's own live data as imagery. |
| 8 | Structure and rhythm | 4 | Tight groups, generous breaks; the three marketing facts repeat verbatim after the result on the phone diagnosis screen. |
| 9 | Craft | 3 | Pixel-tight in normal states; the known windows-hc FAIL breaks two primary controls. |
| 10 | Responsive | 5 | Mic-first phone column; 768 holds; 1280/1440 earn the split. |
| 11 | Everyone's computer | 3 | Win 125/150, Linux, macOS, Android clean; windows-hc FAIL logged; Firefox/Safari not run (engines absent). |
| 12 | Signature | 5 | The tick ring lengthening with your voice — describable in one sentence. |
| 13 | Screenshot test | 4 | The mic moment and Act-now card get screenshotted; at rest the ring fades to near-invisible grey dots. |

Stop rule: no line below 3; 11 of 13 at 4+. **Done** — the windows-hc FAIL is fixed (transparent borders on .mic, .disc, .btn; verified 0 FAILs in re-run).

## Fix applied (2026-10-11, after round 1)

Windows High Contrast: added `border: 2px solid transparent` to `.mic`, `.disc`, and `.btn`. Invisible in normal mode (border-box, no layout shift); forced-colors renders the border so the mic disc, Diagnose, and other buttons keep their shape. Re-ran matrix: 0 FAILs. Committed as 11848ca. The five design changes above remain unapplied — awaiting Umar's pick.

## Five changes (none touch the HC FAIL, none restore refused defaults)

1. **Diagnosis screen, "You said" transcript** — roman 16px ink, not italic grey; keep the indigo left rule as the quote signal. (Lifts 5.)
2. **"Act soon" band** — deepen fill ~12–15% toward amber so urgency gold and accent gold stop sharing one value; keep the diamond. (Lifts 6.)
3. **Results view (phone)** — drop the three-fact block ("Works with no signal / Every answer cites its source / Open and correctable"); it duplicates the start screen. End on "Check another plant" + footer. (Lifts 8.)
4. **First screen at 390px** — drop the white mic-card background/border at phone width; disc sits directly on the harmattan ground. Keep card chrome ≥768px. (Lifts 3.)
5. **Tick ring rest state** — raise resting tick opacity so the ring reads faintly gold at `--level: 0`, blooming with voice. (Lifts 13.)

None applied — awaiting Umar's pick.
