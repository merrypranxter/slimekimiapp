import { mulberry32, pick, range, perturb } from '@/lib/rng';

export type EngineName = 'MYXARIUM' | 'ORBIA';

export interface SimParams {
  seed: number;
  // ---- MYXARIUM (physarum) ----
  species: number;      // 1..3 colonies
  speed: number;        // uv per substep
  sensorDist: number;   // px
  sensorAngle: number;  // rad
  turnAngle: number;    // rad
  jitter: number;       // rad per substep
  trailDecay: number;   // per substep
  trailDiffuse: number; // 0..1
  deposit: number;      // per splat
  selfAtt: number;      // own-channel sensor weight boost
  crossAtt: number;     // -1..1 other-species response
  sym: number;          // 0 off, else dihedral order 3..12 on deposition
  fieldScale: number;   // curl noise spatial frequency
  fieldStrength: number;
  // ---- ORBIA (lenia) ----
  kernelRadius: number; // px
  mu: number;
  sigma: number;
  leniaDt: number;
  noiseScale: number;   // init noise frequency
  leniaSym: number;     // genesis symmetry order
  // ---- shared display ----
  colorMode: number;    // 0..3
  sat: number;          // saturation punch
  glowAmt: number;
  sparkle: number;
  exposure: number;
  vignette: number;
  kaleido: number;      // 0 off, else render-fold order
  bg: string;
  glowTint: string;
  paletteIndex: number; // -1 = custom stops
  customStops: string[] | null;
  // ---- motion ----
  speedMult: number;    // evolution speed 1..8 substeps
  pulseAmp: number;     // breathing amount
  pulsePeriod: number;  // frames per breath
  turbulence: number;   // time-varying field churn
}

export interface ParamDef {
  key: keyof SimParams & string;
  label: string;
  min: number; max: number; step: number;
  engines: EngineName[];
  tab: 'biology' | 'geometry' | 'color' | 'motion';
  fmt?: (v: number) => string;
}

export const PARAM_DEFS: ParamDef[] = [
  // BIOLOGY
  { key: 'species', label: 'Colonies', min: 1, max: 3, step: 1, engines: ['MYXARIUM'], tab: 'biology', fmt: v => `${v}` },
  { key: 'speed', label: 'Growth speed', min: 0.0008, max: 0.006, step: 0.0001, engines: ['MYXARIUM'], tab: 'biology' },
  { key: 'sensorDist', label: 'Sensor reach', min: 3, max: 30, step: 0.5, engines: ['MYXARIUM'], tab: 'biology' },
  { key: 'sensorAngle', label: 'Sensor spread', min: 0.05, max: 1.6, step: 0.01, engines: ['MYXARIUM'], tab: 'biology' },
  { key: 'turnAngle', label: 'Turn rate', min: 0.05, max: 1.4, step: 0.01, engines: ['MYXARIUM'], tab: 'biology' },
  { key: 'jitter', label: 'Morphological instability', min: 0, max: 2.5, step: 0.01, engines: ['MYXARIUM'], tab: 'biology' },
  { key: 'trailDecay', label: 'Trail memory', min: 0.85, max: 0.995, step: 0.001, engines: ['MYXARIUM'], tab: 'biology' },
  { key: 'trailDiffuse', label: 'Trail diffusion', min: 0, max: 1, step: 0.01, engines: ['MYXARIUM'], tab: 'biology' },
  { key: 'deposit', label: 'Deposit strength', min: 0.1, max: 2.5, step: 0.01, engines: ['MYXARIUM'], tab: 'biology' },
  { key: 'selfAtt', label: 'Self reinforcement', min: -0.5, max: 2.5, step: 0.01, engines: ['MYXARIUM'], tab: 'biology' },
  { key: 'crossAtt', label: 'Colony chemistry', min: -1, max: 1, step: 0.01, engines: ['MYXARIUM'], tab: 'biology', fmt: v => v < -0.15 ? 'repel' : v > 0.15 ? 'merge' : 'ignore' },
  { key: 'mu', label: 'Growth target μ', min: 0.04, max: 0.45, step: 0.001, engines: ['ORBIA'], tab: 'biology' },
  { key: 'sigma', label: 'Growth width σ', min: 0.004, max: 0.09, step: 0.001, engines: ['ORBIA'], tab: 'biology' },
  { key: 'leniaDt', label: 'Metabolic rate', min: 0.02, max: 0.35, step: 0.005, engines: ['ORBIA'], tab: 'biology' },
  // GEOMETRY
  { key: 'sym', label: 'Growth symmetry', min: 0, max: 12, step: 1, engines: ['MYXARIUM'], tab: 'geometry', fmt: v => v < 1 ? 'off' : `${v}-fold` },
  { key: 'fieldScale', label: 'Environment scale', min: 1.5, max: 12, step: 0.1, engines: ['MYXARIUM'], tab: 'geometry' },
  { key: 'fieldStrength', label: 'Environment force', min: 0, max: 0.5, step: 0.005, engines: ['MYXARIUM'], tab: 'geometry' },
  { key: 'kernelRadius', label: 'Cell size', min: 6, max: 22, step: 0.5, engines: ['ORBIA'], tab: 'geometry' },
  { key: 'noiseScale', label: 'Genesis detail', min: 1.5, max: 9, step: 0.1, engines: ['ORBIA'], tab: 'geometry' },
  { key: 'leniaSym', label: 'Genesis symmetry', min: 0, max: 10, step: 1, engines: ['ORBIA'], tab: 'geometry', fmt: v => v < 1 ? 'free' : `${v}-fold` },
  { key: 'kaleido', label: 'Kaleidoscope', min: 0, max: 12, step: 1, engines: ['MYXARIUM', 'ORBIA'], tab: 'geometry', fmt: v => v < 1 ? 'off' : `${v}-fold` },
  { key: 'vignette', label: 'Vignette', min: 0, max: 0.7, step: 0.01, engines: ['MYXARIUM', 'ORBIA'], tab: 'geometry' },
  // COLOR
  { key: 'sat', label: 'Neon punch', min: 0, max: 2, step: 0.01, engines: ['MYXARIUM', 'ORBIA'], tab: 'color' },
  { key: 'glowAmt', label: 'Glow / bloom', min: 0, max: 2, step: 0.01, engines: ['MYXARIUM', 'ORBIA'], tab: 'color' },
  { key: 'sparkle', label: 'Sparkle', min: 0, max: 2, step: 0.01, engines: ['MYXARIUM', 'ORBIA'], tab: 'color' },
  { key: 'exposure', label: 'Exposure', min: 0.5, max: 1.8, step: 0.01, engines: ['MYXARIUM', 'ORBIA'], tab: 'color' },
  // MOTION
  { key: 'speedMult', label: 'Evolution speed', min: 1, max: 8, step: 1, engines: ['MYXARIUM', 'ORBIA'], tab: 'motion', fmt: v => `${v}×` },
  { key: 'pulseAmp', label: 'Breathing', min: 0, max: 1, step: 0.01, engines: ['MYXARIUM', 'ORBIA'], tab: 'motion' },
  { key: 'pulsePeriod', label: 'Breath period', min: 30, max: 600, step: 5, engines: ['MYXARIUM', 'ORBIA'], tab: 'motion', fmt: v => `${(v / 60).toFixed(1)}s` },
  { key: 'turbulence', label: 'Turbulence', min: 0, max: 1, step: 0.01, engines: ['MYXARIUM', 'ORBIA'], tab: 'motion' },
];

export const DEFAULT_PARAMS: SimParams = {
  seed: 20261103,
  species: 3, speed: 0.0022, sensorDist: 14, sensorAngle: 0.55, turnAngle: 0.5,
  jitter: 0.55, trailDecay: 0.955, trailDiffuse: 0.32, deposit: 0.9,
  selfAtt: 1.1, crossAtt: -0.7, sym: 0, fieldScale: 4.5, fieldStrength: 0.12,
  kernelRadius: 13, mu: 0.16, sigma: 0.035, leniaDt: 0.09, noiseScale: 3.4, leniaSym: 0,
  colorMode: 2, sat: 1.35, glowAmt: 0.55, sparkle: 0.25, exposure: 1.05, vignette: 0.28,
  kaleido: 0, bg: '#0a0618', glowTint: '#8f6bff', paletteIndex: 3, customStops: null,
  speedMult: 3, pulseAmp: 0.25, pulsePeriod: 180, turbulence: 0.15,
};

export function randomizeParams(engine: EngineName, seed: number): Partial<SimParams> {
  const r = mulberry32(seed ^ 0x9e3779b9);
  const p: Partial<SimParams> = {};
  if (engine === 'MYXARIUM') {
    p.species = Math.round(range(r, 1, 3));
    p.speed = range(r, 0.0012, 0.0045);
    p.sensorDist = range(r, 6, 24);
    p.sensorAngle = range(r, 0.25, 1.1);
    p.turnAngle = range(r, 0.15, 0.9);
    p.jitter = range(r, 0.1, 1.6);
    p.trailDecay = range(r, 0.92, 0.985);
    p.trailDiffuse = range(r, 0.25, 0.75);
    p.deposit = range(r, 0.5, 1.8);
    p.selfAtt = range(r, 0.2, 2.0);
    p.crossAtt = range(r, -0.9, 0.6);
    p.sym = pick(r, [0, 0, 0, 3, 4, 5, 6, 8]);
    p.fieldScale = range(r, 2, 9);
    p.fieldStrength = range(r, 0.02, 0.35);
  } else {
    p.kernelRadius = range(r, 9, 18);
    p.mu = range(r, 0.12, 0.3);
    p.sigma = range(r, 0.012, 0.05);
    p.leniaDt = range(r, 0.07, 0.2);
    p.noiseScale = range(r, 2, 7);
    p.leniaSym = pick(r, [0, 0, 0, 3, 4, 5, 6]);
    p.colorMode = pick(r, [0, 1, 2, 3]);
  }
  p.kaleido = pick(r, [0, 0, 0, 0, 3, 4, 6, 8]);
  p.glowAmt = range(r, 0.2, 1.4);
  p.sparkle = range(r, 0, 1.0);
  p.sat = range(r, 1.0, 1.7);
  return p;
}

export function mutateParams(engine: EngineName, cur: SimParams, rngSeed: number): Partial<SimParams> {
  const r = mulberry32(rngSeed);
  const p: Partial<SimParams> = {};
  const defs = PARAM_DEFS.filter(d => d.engines.includes(engine));
  for (const d of defs) {
    if (r() < 0.55) (p as Record<string, number>)[d.key] = Number(perturb(cur[d.key] as number, 0.18, d.min, d.max, r).toFixed(4));
  }
  // keep the organism's identity: seed & palette survive mutation
  return p;
}

export const COLOR_MODES = ['Density gradient', 'Colony territories', 'Spectral drift', 'Chemical activity'];
