/**
 * All GLSL for the two simulation engines + shared display pass.
 * Engine A (MYXARIUM): multi-species physarum — agents as float texture,
 *   trail as RGB species channels, point-splat deposition with dihedral
 *   symmetry copies, curl-noise steering, pointer chemistry.
 * Engine B (ORBIA): Lenia-class continuous automaton — ring kernel as a
 *   difference of separable Gaussians, bell-curve growth, symmetric genesis.
 */

const COMMON = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 frag;

uvec4 pcg4d(uvec4 v){
  v = v*1664525u + 1013904223u;
  v.x += v.y*v.w; v.y += v.z*v.x; v.z += v.x*v.y; v.w += v.y*v.z;
  v ^= v >> 16u;
  v.x += v.y*v.w; v.y += v.z*v.x; v.z += v.x*v.y; v.w += v.y*v.z;
  return v;
}
float hash1(uvec4 s){ return float(pcg4d(s).x) * (1.0/4294967296.0); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = hash1(uvec4(ivec2(i), 811u, 137u));
  float b = hash1(uvec4(ivec2(i)+ivec2(1,0), 811u, 137u));
  float c = hash1(uvec4(ivec2(i)+ivec2(0,1), 811u, 137u));
  float d = hash1(uvec4(ivec2(i)+ivec2(1,1), 811u, 137u));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 p){
  return vnoise(p)*0.6 + vnoise(p*2.13+5.2)*0.28 + vnoise(p*4.41+9.7)*0.12;
}
// divergence-free stream bias from noise gradient (curl of psi)
vec2 curl(vec2 p){
  float e = 0.35;
  float n1 = fbm(p+vec2(0.,e)), n2 = fbm(p-vec2(0.,e));
  float n3 = fbm(p+vec2(e,0.)), n4 = fbm(p-vec2(e,0.));
  return vec2(n1-n2, n4-n3) / (2.0*e);
}
vec2 coverUv(vec2 uv, float aspect){
  vec2 s = aspect > 1.0 ? vec2(1.0/aspect, 1.0) : vec2(1.0, aspect);
  return (uv - 0.5) * s + 0.5;
}
`;

/* ---------------- MYXARIUM (physarum) ---------------- */

export const TRAIL_FS = COMMON + `
uniform sampler2D uTrail;
uniform vec2 uTexel;
uniform float uDecay, uDiffuse;
uniform vec4 uPointer;   // xy pos, z radius, w signed strength (+feed/-repel)
uniform float uAspect;
void main(){
  vec3 c  = texture(uTrail, vUv).rgb;
  vec3 n  = texture(uTrail, vUv + vec2(0., uTexel.y)).rgb;
  vec3 s  = texture(uTrail, vUv - vec2(0., uTexel.y)).rgb;
  vec3 e  = texture(uTrail, vUv + vec2(uTexel.x, 0.)).rgb;
  vec3 w  = texture(uTrail, vUv - vec2(uTexel.x, 0.)).rgb;
  vec3 ne = texture(uTrail, vUv + uTexel).rgb;
  vec3 nw = texture(uTrail, vUv + vec2(-uTexel.x, uTexel.y)).rgb;
  vec3 se = texture(uTrail, vUv + vec2(uTexel.x, -uTexel.y)).rgb;
  vec3 sw = texture(uTrail, vUv - uTexel).rgb;
  vec3 blur = (c*4.0 + (n+s+e+w)*2.0 + (ne+nw+se+sw)) / 16.0;
  vec3 t = mix(c, blur, uDiffuse) * uDecay;
  vec2 d = vUv - uPointer.xy; d.x *= uAspect;
  float g = exp(-dot(d,d) / max(1e-6, uPointer.z*uPointer.z));
  t += uPointer.w * g;                 // feed adds trail to all species channels
  frag = vec4(clamp(t, 0.0, 8.0), 1.0);
}`;

export const AGENTS_FS = COMMON + `
uniform sampler2D uAgents;
uniform sampler2D uTrail;
uniform vec2 uSimTexel;     // 1/simRes
uniform vec2 uAgentTexel;   // 1/agentTexSize
uniform float uSA, uSD, uRA, uSpeed, uJitter;
uniform float uSelf, uCross;
uniform float uSpecies;     // 1..3
uniform float uFieldScale, uFieldStrength, uFieldPhase;
uniform vec4 uPointer;      // xy, radius, strength
uniform float uAspect;
uniform float uSeed;
uniform float uFrame;
uniform float uInit;

float sense(vec2 pos, float ang, int sp){
  vec3 t = texture(uTrail, fract(pos)).rgb;
  float own = sp == 0 ? t.r : (sp == 1 ? t.g : t.b);
  float other = (t.r + t.g + t.b) - own;
  return own * (1.0 + uSelf) + other * uCross;
}

void main(){
  ivec2 coord = ivec2(gl_FragCoord.xy);
  vec4 a = texelFetch(uAgents, coord, 0);
  uvec4 h = pcg4d(uvec4(coord, uint(uSeed), uint(uFrame)));

  if (uInit > 0.5) {
    vec2 p = vec2(h.x, h.y) * (1.0/4294967296.0);
    float ang = float(h.z) * (1.0/4294967296.0) * 6.2831853;
    float sp = floor(float(h.w) * (1.0/4294967296.0) * uSpecies);
    frag = vec4(p, ang, sp);
    return;
  }

  vec2 pos = a.xy;
  float ang = a.z;
  int sp = int(clamp(a.w, 0.0, 2.0));

  vec2 off = vec2(cos(ang), sin(ang)) * (uSD * uSimTexel.x);
  float F  = sense(pos + off, ang, sp);
  float FL = sense(pos + vec2(cos(ang+uSA), sin(ang+uSA)) * (uSD * uSimTexel.x), ang + uSA, sp);
  float FR = sense(pos + vec2(cos(ang-uSA), sin(ang-uSA)) * (uSD * uSimTexel.x), ang - uSA, sp);

  if (F < FL || F < FR) {
    if (FL > FR) ang += uRA; else ang -= uRA;
  }

  // curl-noise environmental current
  vec2 cv = curl(pos * uFieldScale + uFieldPhase);
  vec2 dirv = vec2(cos(ang), sin(ang));
  vec2 perp = vec2(-dirv.y, dirv.x);
  ang += dot(cv, perp) * uFieldStrength;

  // per-step jitter = morphological instability / branchiness
  ang += (float(h.x) * (1.0/4294967296.0) - 0.5) * uJitter;

  // pointer chemistry: steer toward (feed) or away (repel)
  if (uPointer.w != 0.0) {
    vec2 d = pos - uPointer.xy; d.x *= uAspect;
    float r = length(d);
    float fall = exp(-dot(d,d) / max(1e-6, uPointer.z*uPointer.z));
    if (fall > 0.01) {
      float toward = atan(-d.y, -d.x);
      float diff = mod(toward - ang + 3.14159265, 6.2831853) - 3.14159265;
      ang += sign(uPointer.w) * fall * diff * 0.35;
    }
  }

  vec2 stepv = vec2(cos(ang), sin(ang)) * uSpeed;
  pos = fract(pos + stepv);
  frag = vec4(pos, ang, float(sp));
}`;

export const SPLAT_FS = `#version 300 es
precision highp float;
in vec3 vSpeciesColor;
uniform float uDeposit;
out vec4 frag;
void main(){
  vec2 pc = gl_PointCoord * 2.0 - 1.0;
  float g = max(0.0, 1.0 - dot(pc, pc));
  frag = vec4(vSpeciesColor * (uDeposit * g * g), 0.0);
}`;

/* ---------------- ORBIA (Lenia) ---------------- */

export const BLUR_FS = COMMON + `
uniform sampler2D uSrc;
uniform vec2 uDir;        // texel step direction
uniform float uSigma;     // gaussian sigma in texels
uniform float uRadius;    // kernel radius in texels
void main(){
  vec4 acc = vec4(0.0);
  float sum = 0.0;
  for (int i = -6; i <= 6; i++) {
    float o = float(i) / 6.0 * uRadius;
    float g = exp(-o*o / (2.0*uSigma*uSigma));
    acc += g * texture(uSrc, vUv + uDir * o);
    sum += g;
  }
  frag = acc / sum;
}`;

export const LENIA_UPDATE_FS = COMMON + `
uniform sampler2D uMass;
uniform sampler2D uNarrow;
uniform sampler2D uWide;
uniform vec2 uTexel;
uniform float uMu, uSigma, uDt, uGain;
void main(){
  float A = texture(uMass, vUv).r;
  float U = (texture(uNarrow, vUv).r - texture(uWide, vUv).r) * uGain;
  float g = 2.0 * exp(-0.5 * pow((U - uMu) / max(uSigma, 1e-5), 2.0)) - 1.0;
  A = clamp(A + uDt * g, 0.0, 1.0);
  // gentle 4-neighbour relaxation: kills pixel-scale checkerboard instability
  float avg = 0.25 * (
    texture(uMass, vUv + vec2(uTexel.x, 0.)).r +
    texture(uMass, vUv - vec2(uTexel.x, 0.)).r +
    texture(uMass, vUv + vec2(0., uTexel.y)).r +
    texture(uMass, vUv - vec2(0., uTexel.y)).r);
  A = mix(A, avg, 0.12);
  frag = vec4(A, U, 0.0, 1.0);
}`;

export const LENIA_INIT_FS = COMMON + `
uniform float uSeed, uNoiseScale, uThresh, uSym;
// dihedral fold of the sampling coordinate -> symmetric genesis
vec2 foldSym(vec2 p, float n){
  if (n < 1.5) return p;
  vec2 d = p - 0.5;
  float r = length(d);
  float an = mod(atan(d.y, d.x), 6.2831853 / n);
  return 0.5 + r * vec2(cos(an), sin(an));
}
void main(){
  vec2 p = foldSym(vUv, uSym);
  float seedOff = hash1(uvec4(uint(uSeed), 91u, 17u, 3u)) * 61.7;
  float n = fbm(p * uNoiseScale + seedOff);
  float A = smoothstep(uThresh, uThresh + 0.22, n);
  // a seeded heart so the organism always has a nucleus to organise around
  vec2 d = vUv - 0.5;
  float heart = smoothstep(0.16, 0.05, length(d)) * 0.85;
  frag = vec4(max(A * 0.9, heart), 0.0, 0.0, 1.0);
}`;

/* ---------------- DISPLAY (shared) ---------------- */

/** copy 32F sim state into a filterable 16F present texture */
export const COPY_FS = COMMON + `
uniform sampler2D uSrc;
void main(){ frag = texture(uSrc, vUv); }`;

export const GLOW_FS = COMMON + `
uniform sampler2D uState;
uniform float uEngineType; // 0 physarum, 1 lenia
uniform vec2 uTexel;
void main(){
  vec3 acc = vec3(0.0);
  for (int j = -2; j <= 2; j++)
    for (int i = -2; i <= 2; i++)
      acc += texture(uState, vUv + vec2(float(i), float(j)) * uTexel * 2.0).rgb;
  vec3 t = acc / 25.0;
  float lum = uEngineType < 0.5 ? max(t.r, max(t.g, t.b)) : t.r;
  frag = vec4(vec3(lum), 1.0);
}`;

export const DISPLAY_FS = COMMON + `
uniform sampler2D uState;
uniform sampler2D uGlow;
uniform float uEngineType;  // 0 physarum, 1 lenia
uniform vec3 uStops[6];
uniform int uStopCount;
uniform float uColorMode;   // 0 gradient, 1 colony/territory, 2 spectral drift, 3 activity
uniform float uSat;         // saturation punch
uniform float uGlowAmt;
uniform vec3 uGlowTint;
uniform float uSparkle;
uniform float uExposure;
uniform vec3 uBg;
uniform float uAspect;      // canvas w/h
uniform float uKaleido;     // 0 off, else order
uniform float uVignette;

vec3 palette(float t){
  float n = float(uStopCount);
  float x = fract(t) * n;
  int i = int(floor(x));
  float f = fract(x);
  f = f*f*(3.0-2.0*f);
  return mix(uStops[i % uStopCount], uStops[(i+1) % uStopCount], f);
}

vec2 kaleidoUv(vec2 uv, float n){
  if (n < 1.5) return uv;
  vec2 d = uv - 0.5;
  float r = length(d);
  float an = mod(atan(d.y, d.x), 6.2831853 / n);
  return 0.5 + r * vec2(cos(an), sin(an));
}

void main(){
  vec2 uv = coverUv(vUv, uAspect);
  uv = kaleidoUv(uv, uKaleido);
  vec4 st = texture(uState, uv);
  float glow = texture(uGlow, uv).r;

  float density; float colony; float activity;
  if (uEngineType < 0.5) {
    float raw = max(st.r, max(st.g, st.b));
    density = 1.0 - exp(-raw * 1.3);              // filmic-ish trail tonemap
    activity = density;
    // normalized colony mixture: no ties, hue follows species share
    float sum = st.r + st.g + st.b;
    colony = sum <= 1e-5 ? 0.5 : clamp((st.g * 0.5 + st.b) / sum, 0.0, 1.0);
  } else {
    density = st.r;
    activity = clamp(st.g * 0.5 + 0.5, 0.0, 1.0); // growth potential
    colony = density;
  }

  vec3 col;
  float mode = uColorMode;
  if (mode < 0.5) {                       // DENSITY GRADIENT
    col = palette(clamp(density * 1.15, 0.0, 1.0));
    col *= 0.25 + 0.95 * clamp(density * 1.4, 0.0, 1.0);
  } else if (mode < 1.5) {                // COLONY / TERRITORY — flat graphic
    float idx = uEngineType < 0.5 ? 0.08 + 0.84 * colony : clamp(colony * 1.2, 0.0, 1.0);
    col = palette(idx);
    col *= 0.3 + 0.85 * clamp(density * 1.6, 0.0, 1.0);
  } else if (mode < 2.5) {                // SPECTRAL DRIFT — iridescent
    float t = clamp(density, 0.0, 1.0) * 0.55 + uv.x * 0.22 + uv.y * 0.18;
    col = palette(t);
    col *= 0.25 + 1.0 * clamp(density * 1.3, 0.0, 1.0);
  } else {                                // ACTIVITY — color by chemical potential
    col = palette(activity);
    col *= 0.3 + 0.9 * clamp(density * 1.2, 0.0, 1.0);
  }

  float mask = smoothstep(0.015, 0.10, density);
  if (uEngineType > 0.5) mask = smoothstep(0.01, 0.05, density);

  // composite over background
  vec3 outCol = mix(uBg, col, mask);

  // glow / bloom (tonemapped so it saturates instead of blowing to white)
  float glowT = 1.0 - exp(-glow * 2.5);
  outCol += uGlowTint * glowT * uGlowAmt * (0.35 + 0.65 * mask);

  // sparkle: white-hot micro-glints on the densest filaments
  float sp = pow(clamp(density, 0.0, 1.0), 7.0) * uSparkle;
  outCol += vec3(sp);

  // vignette
  float v = length(vUv - 0.5) * 2.0;
  outCol *= 1.0 - uVignette * smoothstep(0.55, 1.35, v);

  // saturation punch
  float luma = dot(outCol, vec3(0.299, 0.587, 0.114));
  outCol = mix(vec3(luma), outCol, uSat);

  outCol *= uExposure;
  // gentle filmic shoulder so hot colors roll off instead of clipping dead
  outCol = outCol / (1.0 + max(vec3(0.0), outCol - 1.0) * 0.55);
  frag = vec4(outCol, 1.0);
}`;
