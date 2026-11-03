# Verifier v1 — acceptance criteria (Phase 1→2 playable prototype)

A run PASSES only if **every** check below is green.

## A. Build health
- A1 `npm run build` exits 0 and `dist/index.html` exists.

## B. Runtime health (Chromium, desktop + mobile viewport)
- B1 Page loads with **zero console errors** and **zero failed network requests**.
- B2 WebGL2 context initializes (no fallback warning in console).
- B3 Canvas is visibly non-blank on first paint (poster/initial frame renders).

## C. Animation is real
- C1 Two screenshots ≥1.2 s apart differ materially (mean abs pixel delta above
  threshold) while playing → the mathematical state evolves, not a static image.

## D. Determinism
- D1 `reset(seed=42)` twice produces identical frame checksums
  (`__probe.checksum()` stable across resets with same seed).
- D2 Two *different* seeds produce different checksums (seed actually drives
  the outcome).

## E. Parameter causality
- E1 Changing BIOLOGY/GEOMETRY params via `__probe.setParam` changes the
  frame checksum (sliders are wired to the simulation, not decoration).

## F. Control integrity
- F1 All five tabs (CREATE / BIOLOGY / GEOMETRY / COLOR / MOTION) open their
  panels.
- F2 Randomize → seed changes & frame changes. Mutate → params change but seed
  preserved. Pause → animation halts; Play resumes.
- F3 Engine switch MYXARIUM ⇄ ORBIA reinitialises the stage without errors.

## G. Mobile hygiene (390×844 viewport)
- G1 No horizontal scroll (`scrollWidth <= clientWidth`).
- G2 Canvas fills the art area; tab bar reachable at bottom.

## Probes
The app exposes `window.__probe = { checksum(), reset(seed), setParam(k,v),
getParams(), setEngine(name), pause(), play(), frame(), engineName }` for the
verifier only.
