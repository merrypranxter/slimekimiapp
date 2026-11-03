# Verifier — append-only index

Every verifier run appends a timestamped record to `verifier/runs/`.
Criteria versions are immutable once created; changes go in a new `vN/` folder.

## Versions

- **v1** — 2026-11-03 — First acceptance suite for the Phase 1→2 deliverable
  (playable prototype of MYXARIUM + ORBIA engines in the slimekimiapp repo).
  Measures: build health, zero console errors / failed requests, canvas actually
  animating, seed determinism, parameter causality (sliders change output), tab
  & control integrity, mobile viewport hygiene. See `v1/criteria.md`.

## How to run

```bash
cd verifier/v1
node verify.mjs            # expects ../../dist served at BASE_URL (default http://127.0.0.1:8099)
```
