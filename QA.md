# Fable Surfers — historical QA report

> **Important:** This report was inherited from the original Dropbox source project. Its test date is 20 September 2026, before the GitHub packaging and launcher changes. It is not a claim that the current GitHub revision has been independently tested. Re-run the commands below on the checked-out revision before relying on the results.

## Original gameplay report — 17/17

The source report recorded these simulation checks:

- Start, reset and deterministic generation.
- Three-lane switching, smooth movement and edge limits.
- Jump, landing, slide and fast descent.
- Low and high obstacle handling.
- Collision boundaries.
- Coin collection, score and magnet behavior.
- Hoverboard protection and pickup/restock.
- Ramp continuity and train-roof traversal.
- Moving train behavior.
- Speed increase and upper limit.
- Procedural route safety across generated chunks.
- Long simulation of 50 km with bounded active entities.

The original output is preserved in [docs/simulation-results.txt](docs/simulation-results.txt).

## Original browser report — 10/10

The source report also recorded browser checks for WebGL rendering, start/pause/resume, sound, keyboard input, obstacles, coins, power-ups, collisions and restart behavior.

## Current repository verification

The GitHub packaging changes include a replacement HTML entry page, cross-platform launch scripts and an updated local server. These packaging changes were not covered by the original report. Verify locally:

```bash
npm test
npm start
```

Then open `http://127.0.0.1:43827` and test keyboard and touch controls in the target browser.
