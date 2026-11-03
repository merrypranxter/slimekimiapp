import { GL, PingPong, Target, VERT, POINT_VERT } from '@/gl/harness';
import { TRAIL_FS, AGENTS_FS, SPLAT_FS, GLOW_FS, DISPLAY_FS, COPY_FS } from '@/gl/shaders';
import type { Engine, PointerState } from './types';
import type { SimParams } from '@/state/params';
import { hexToRgb } from '@/lib/palettes';

/**
 * MYXARIUM — multi-species physarum transport network.
 * Lagrangian agents on a torus sensing an RGB species-trail field.
 * Deposition is splatted as points with dihedral symmetry copies.
 */
export class Myxarium implements Engine {
  readonly name = 'MYXARIUM';
  private glr: GL;
  private simRes: number;
  private agentTexSize: number;
  private agentCount: number;
  private agents: PingPong;
  private trail: PingPong;
  private glow: Target;
  private present: Target; // filterable 16F copy of trail for display
  private pTrail: WebGLProgram;
  private pAgents: WebGLProgram;
  private pSplat: WebGLProgram;
  private pGlow: WebGLProgram;
  private pDisplay: WebGLProgram;
  private pCopy: WebGLProgram;
  private frame = 0;
  private canvasW = 0; private canvasH = 0;

  constructor(glr: GL) {
    this.glr = glr;
    const gl = glr.gl;
    const mobile = Math.min(window.innerWidth, window.innerHeight) < 520;
    this.simRes = mobile ? 384 : 512;
    this.agentTexSize = mobile ? 256 : 512;
    this.agentCount = this.agentTexSize * this.agentTexSize;
    this.agents = new PingPong(glr, this.agentTexSize, this.agentTexSize);
    this.trail = new PingPong(glr, this.simRes, this.simRes);
    this.glow = new Target(glr, 128, 128, gl.RGBA16F, gl.LINEAR);
    this.present = new Target(glr, this.simRes, this.simRes, gl.RGBA16F, gl.LINEAR);
    this.pTrail = glr.program(VERT, TRAIL_FS);
    this.pAgents = glr.program(VERT, AGENTS_FS);
    this.pSplat = glr.program(POINT_VERT, SPLAT_FS);
    this.pGlow = glr.program(VERT, GLOW_FS);
    this.pDisplay = glr.program(VERT, DISPLAY_FS);
    this.pCopy = glr.program(VERT, COPY_FS);
  }

  resize(cssW: number, cssH: number, dpr: number) {
    this.canvasW = Math.round(cssW * dpr);
    this.canvasH = Math.round(cssH * dpr);
  }

  reset(seed: number, p: SimParams) {
    const gl = this.glr.gl;
    // wipe trail
    for (const t of [this.trail.read, this.trail.write]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    // scatter agents deterministically from the seed
    this.frame = 0;
    this.glr.pass(this.pAgents, this.agents.write.fbo, this.agentTexSize, this.agentTexSize, {
      uInit: 1, uSeed: seed % 100000, uSpecies: Math.max(1, Math.round(p.species)),
      uSA: 0, uSD: 0, uRA: 0, uSpeed: 0, uJitter: 0, uSelf: 0, uCross: 0,
      uFieldScale: 0, uFieldStrength: 0, uFieldPhase: 0,
      uPointer: [0.5, 0.5, 0.001, 0], uAspect: 1, uFrame: 0,
      uSimTexel: [1 / this.simRes, 1 / this.simRes],
      uAgentTexel: [1 / this.agentTexSize, 1 / this.agentTexSize],
    }, { uAgents: this.agents.read.tex, uTrail: this.trail.read.tex });
    this.agents.swap();
  }

  step(p: SimParams, _frame: number, pointer: PointerState) {
    const gl = this.glr.gl;
    const steps = Math.max(1, Math.round(p.speedMult));
    const pulse = 1 + p.pulseAmp * Math.sin((2 * Math.PI * this.frame) / Math.max(1, p.pulsePeriod));
    const texel = 1 / this.simRes;
    const deposit = p.deposit * (65536 / this.agentCount) * 0.022;
    const symCopies = Math.max(1, Math.round(p.sym));
    const pt: [number, number, number, number] = pointer.active
      ? [pointer.x, pointer.y, pointer.radius, pointer.strength]
      : [0.5, 0.5, 0.0001, 0];

    for (let i = 0; i < steps; i++) {
      // 1. trail decay + diffusion + pointer food
      this.glr.pass(this.pTrail, this.trail.write.fbo, this.simRes, this.simRes, {
        uTexel: [texel, texel],
        uDecay: Math.pow(p.trailDecay, 1),
        uDiffuse: p.trailDiffuse,
        uPointer: pt,
        uAspect: 1,
      }, { uTrail: this.trail.read.tex });

      // 2. agent chemotaxis
      this.glr.pass(this.pAgents, this.agents.write.fbo, this.agentTexSize, this.agentTexSize, {
        uSimTexel: [texel, texel],
        uAgentTexel: [1 / this.agentTexSize, 1 / this.agentTexSize],
        uSA: p.sensorAngle, uSD: p.sensorDist, uRA: p.turnAngle,
        uSpeed: p.speed * pulse,
        uJitter: p.jitter,
        uSelf: p.selfAtt, uCross: p.crossAtt,
        uSpecies: p.species,
        uFieldScale: p.fieldScale,
        uFieldStrength: p.fieldStrength,
        uFieldPhase: this.frame * 0.011 * p.turbulence,
        uPointer: pt,
        uAspect: 1,
        uSeed: p.seed % 100000,
        uFrame: this.frame % 65536,
        uInit: 0,
      }, { uAgents: this.agents.read.tex, uTrail: this.trail.read.tex });
      this.agents.swap();

      // 3. deposit splats (additive), with symmetry copies
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.trail.write.fbo);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      this.glr.points(this.pSplat, this.trail.write.fbo, this.simRes, this.simRes,
        this.agentCount * symCopies,
        { uSym: symCopies, uPointSize: 2.0, uAspect: 1, uDeposit: deposit },
        { uAgents: this.agents.read.tex });
      gl.disable(gl.BLEND);

      this.trail.swap();
      this.frame++;
    }
  }

  render(p: SimParams, stops: [number, number, number][]) {
    // copy sim state into the filterable present texture
    this.glr.pass(this.pCopy, this.present.fbo, this.simRes, this.simRes, {}, { uSrc: this.trail.read.tex });
    // glow buffer from current trail
    this.glr.pass(this.pGlow, this.glow.fbo, 128, 128, {
      uEngineType: 0, uTexel: [1 / this.simRes, 1 / this.simRes],
    }, { uState: this.present.tex });

    const stopsU: Record<string, [number, number, number]> = {};
    for (let i = 0; i < 6; i++) stopsU[`uStops[${i}]`] = stops[i % stops.length];
    const bg = hexToRgb(p.bg);
    const gt = hexToRgb(p.glowTint);
    this.glr.pass(this.pDisplay, null, this.canvasW, this.canvasH, {
      uEngineType: 0,
      ...stopsU,
      uStopCount: new Int32Array([stops.length]),
      uColorMode: p.colorMode,
      uSat: p.sat,
      uGlowAmt: p.glowAmt,
      uGlowTint: gt,
      uSparkle: p.sparkle,
      uExposure: p.exposure,
      uBg: bg,
      uAspect: this.canvasW / Math.max(1, this.canvasH),
      uKaleido: p.kaleido,
      uVignette: p.vignette,
    }, { uState: this.present.tex, uGlow: this.glow.tex });
  }

  checksum(): string {
    const gl = this.glr.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trail.read.fbo);
    const buf = new Float32Array(8 * 8 * 4);
    gl.readPixels(this.simRes / 2 - 4, this.simRes / 2 - 4, 8, 8, gl.RGBA, gl.FLOAT, buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    let s = 0;
    for (let i = 0; i < buf.length; i++) s = (s + buf[i] * (i + 1)) % 1000000007;
    return s.toFixed(3);
  }

  dispose() {
    this.agents.dispose(); this.trail.dispose(); this.glow.dispose(); this.present.dispose();
  }
}
