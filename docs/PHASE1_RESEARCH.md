# PHASE 1 — Mathematical Discovery

*SLIMEKIMI · Psychedelic Mycelium · independent interpretation · 2026-11-03*

## The shortlist (investigated) and the choice (3 engines)

I investigated nine candidate mathematical systems for their capacity to
produce *unfamiliar* shape and *honest* biological motion on a mobile GPU.
Selection criteria: (1) genuine emergence — structure must come from the rules,
not from painted-on symmetry; (2) temporal depth — growth, competition,
reorganisation visible over time; (3) distinct morphological signatures, so two
engines never feel like the same noise with different labels; (4) WebGL2
feasibility at 60fps on an iPhone.

| # | System | Verdict | Reason |
|---|--------|---------|--------|
| 1 | **Multi-species Physarum transport network** (agent-based, Jones 2010 pattern) | ✅ **Engine A — MYXARIUM** | Real chemotaxis, reinforcement/pruning, anastomosis-like network healing. Multi-species chemotaxis gives territory competition for free. Maps beautifully to hyphal networks too (tip growth ≈ agent motion, trail reinforcement ≈ hyphal fusion + resource flow). |
| 2 | **Lenia** continuous cellular automaton (Bert Chan 2019) | ✅ **Engine B — ORBIA** | The strongest known system for *alien morphologies that are genuinely alive*: self-organising lifeforms with locomotion, mitosis, pulsation. Perfect MICROSCOPIC ALIEN personality, and its (μ, σ, R) parameter space is an instrument in itself. |
| 3 | Gray–Scott reaction–diffusion | ⏳ Phase 3 candidate | Produces elegant labyrinths, but morphology space is narrower; better added later as a pattern layer than as a headline engine. |
| 4 | Excitable-media FitzHugh–Nagumo | ⏳ Phase 3 candidate | Spiral waves = gorgeous traveling excitation, but reads as "waves on tissue" more than as structure-building. |
| 5 | L-system / recursive branching (hyphal tip grammar) | ⏳ Phase 3 candidate | Excellent for ORNAMENTAL embroidery and lace; planned as Engine C on top of the shared trail-field substrate (tip walkers steered by the same nutrient fields). |
| 6 | DLA (diffusion-limited aggregation) | ❌ | Beautiful but static-feeling, single morphology family, no internal motion. |
| 7 | Flock/boids network | ❌ | Reads as particle noise; fails the "not generic neon particle noise" test. |
| 8 | Turing–Meinhardt spots/stripes | ❌ | Folded into Gray–Scott; same verdict. |
| 9 | KPZ / Eden growth fronts | ⏳ | Interesting roughening dynamics; low priority. |

**The bet for Phase 2:** MYXARIUM (living networks, lace, territories) + ORBIA
(living tissue, alien organisms). They share one display/color engine but share
*no* mathematics — one is Lagrangian (agents), one is Eulerian (fields).

## Engine A — MYXARIUM (multi-species physarum)

Classical single-species physarum (Jones 2010): agents sense pheromone trail
ahead-left / ahead / ahead-right and steer toward the strongest reading. Trail
decays and diffuses. That produces maze-solving vein networks.

My independent extensions, each with a distinct artistic job:

1. **Species vector field.** Trail is an RGB texture — three species channels.
   Each agent belongs to one species. Sensor response is
   `v = own·(1+w) + others·c`, with cross-coefficient `c` user-controlled:
   `c > 0` species merge into braided prismatic veins; `c < 0` species repel
   into competing territories (biological competition → large color fields);
   `c ≈ 0` independent interwoven laces. This one slider is the difference
   between *lace*, *territory map*, and *braided embroidery*.
2. **Dihedral symmetry injection** at the deposit stage (point splats are
   rotated about the field centre). The network *itself* grows symmetrically —
   a living kaleidoscope, not a mirrored post-effect. Networks remain alive
   because growth continues after symmetry is imposed.
3. **Curl-noise environmental forcing.** Agent heading is biased by the curl
   of an analytic value-noise field, ∇×ψ. Curl fields are divergence-free —
   they channel growth into swirling gyres and river systems rather than
   uniform fuzz. Field strength & scale exposed: this is the "environmental
   heterogeneity → quasi-geometric rearrangement" experiment.
4. **Touch as chemistry.** Pointer = chemoattractant source (feed) or repellent,
   deposited into the trail field and steering nearby agents. The user performs
   chemistry on the organism.

Mathematical identity: Lagrangian agents on a torus, reaction = deposition,
diffusion = 9-tap blur, advection = agent motion. It's a PDE solved by
particles.

## Engine B — ORBIA (Lenia-class continuous automaton)

Lenia (Chan 2019): mass field A ∈ [0,1]; potential U = A ∗ K with K a smooth
ring kernel; growth G = bell(U; μ, σ); A ← clip(A + dt·G). I implement the ring
kernel as a **difference of two separable Gaussians** (narrow − wide), the
standard GPU trick — 4 blur passes + 1 update pass per step.

Why it earns its place: the (μ, σ, R, dt) neighbourhood around classic
"orbium" parameters contains self-propelling, self-dividing, pulsating
lifeforms. No other cheap system gives *motile* morphologies — this supplies the
"organism that is obviously alive" axis MYXARIUM's networks lack.

Independent extensions:
- **Symmetric organism genesis**: the init noise field is sampled at dihedral
  copies of each coordinate, so symmetric organisms *emerge* from symmetric
  initial conditions rather than being mirrored afterward.
- **Living kaleidoscope mode**: a runtime symmetry-fold of the mass field
  during sampling, creating evolving radial mandala-tissue that is still
  governed by real growth dynamics.
- Parameter-space instrument: μ/σ/R/dt as sliders gives dramatically different
  zoology per seed.

## Why not more engines in Phase 2

Two deep engines + one serious color/material engine beats four shallow ones.
The display/color layer (palettes, colony-identity mapping, spectral
iridescence, glow/sparkle, flat-graphic mode) is shared, so every future engine
(Phase 3: reaction–diffusion lace, excitable spirals, hyphal-tip embroidery)
plugs into a finished instrument.

## Honest limitations (Phase 2)

- Seamless loops: not yet. MYXARIUM/OR BIA dynamics are dissipative; genuinely
  periodic behaviour needs cyclic forcing or a closed orbit in state space
  (planned experiment: drive curl-field phase θ(t) = 2πt/T — a periodic
  *forcing* whose response can loop if transients decay).
- Export: still PNG only; animation export is Phase 5.
- Breeding: parameter-set crossover lands in Phase 4 (needs organism library).
