import { GL, PingPong, Target, VERT } from '@/gl/harness';
import { BLUR_FS, LENIA_UPDATE_FS, LENIA_INIT_FS, GLOW_FS, DISPLAY_FS, COPY_FS } from '@/gl/shaders';
import type { Engine, PointerState } from './types';
import type { SimParams } from '@/state/params';
import { hexToRgb } from '@/lib/palettes';

/**
 * ORBIA — Lenia-class continuous cellular automaton.
 * Eulerian field A ∈ [0,1]; ring kernel as difference of separable Gaussians;
 * bell-curve growth law; symmetric genesis from folded noise.
 */
export class Orbia implements Engine {
  readonly name = 'ORBIA';
  private glr: GL;
  private simRes: number;
  private mass: PingPong;
  private narrow: PingPong;
  private wide: PingPong;
  private glow: Target;
  private present: Target;
  private pBlur: WebGLProgram;
  private pUpdate: WebGLProgram;
  private pInit: WebGLProgram;
  private pGlow: WebGLProgram;
  private pDisplay: WebGLProgram;
  private pCopy: WebGLProgram;
  private frame = 0;
  private canvasW = 0; private canvasH = 0;

  constructor(glr: GL) {
    this.glr = glr;
    const gl = glr.gl;
    const mobile = Math.min(window.innerWidth, window.innerHeight) < 520;
    this.simRes = mobile ? 240 : 320;
    this.mass = new PingPong(glr, this.simRes, this.simRes);
    this.narrow = new PingPong(glr, this.simRes, this.simRes);
    this.wide = new PingPong(glr, this.simRes, this.simRes);
    this.glow = new Target(glr, 128, 128, gl.RGBA16F, gl.LINEAR);
    this.present = new Target(glr, this.simRes, this.simRes, gl.RGBA16F, gl.LINEAR);
    this.pBlur = glr.program(VERT, BLUR_FS);
    this.pUpdate = glr.program(VERT, LENIA_UPDATE_FS);
    this.pInit = glr.program(VERT, LENIA_INIT_FS);
    this.pGlow = glr.program(VERT, GLOW_FS);
    this.pDisplay = glr.program(VERT, DISPLAY_FS);
    this.pCopy = glr.program(VERT, COPY_FS);
  }

  resize(cssW: number, cssH: number, dpr: number) {
    this.canvasW = Math.round(cssW * dpr);
    this.canvasH = Math.round(cssH * dpr);
  }

  reset(seed: number, p: SimParams) {
    this.glr.pass(this.pInit, this.mass.write.fbo, this.simRes, this.simRes, {
      uSeed: seed % 100000,
      uNoiseScale: p.noiseScale,
      uThresh: 0.52,
      uSym: p.leniaSym,
    });
    this.mass.swap();
    this.frame = 0;
  }

  private blur(tex: WebGLTexture, sigma: number, radius: number) {
    const t = 1 / this.simRes;
    // H into .write, V back into .read
    this.glr.pass(this.pBlur, this.narrow.write.fbo, this.simRes, this.simRes,
      { uDir: [t, 0], uSigma: sigma, uRadius: radius }, { uSrc: tex });
    this.narrow.swap();
    this.glr.pass(this.pBlur, this.narrow.write.fbo, this.simRes, this.simRes,
      { uDir: [0, t], uSigma: sigma, uRadius: radius }, { uSrc: this.narrow.read.tex });
    this.narrow.swap();
    return this.narrow.read.tex;
  }

  step(p: SimParams, _frame: number, _pointer: PointerState) {
    const steps = Math.max(1, Math.round(p.speedMult));
    const pulse = 1 + p.pulseAmp * Math.sin((2 * Math.PI * this.frame) / Math.max(1, p.pulsePeriod));
    const R = p.kernelRadius;
    for (let i = 0; i < steps; i++) {
      // ring kernel: narrow gaussian minus wide gaussian
      const narrowTex = this.blur(this.mass.read.tex, R * 0.30, R);
      this.glr.pass(this.pBlur, this.wide.write.fbo, this.simRes, this.simRes,
        { uDir: [1 / this.simRes, 0], uSigma: R * 0.85, uRadius: R * 1.6 }, { uSrc: this.mass.read.tex });
      this.wide.swap();
      this.glr.pass(this.pBlur, this.wide.write.fbo, this.simRes, this.simRes,
        { uDir: [0, 1 / this.simRes], uSigma: R * 0.85, uRadius: R * 1.6 }, { uSrc: this.wide.read.tex });
      this.wide.swap();

      this.glr.pass(this.pUpdate, this.mass.write.fbo, this.simRes, this.simRes, {
        uMu: p.mu, uSigma: p.sigma, uDt: p.leniaDt * pulse, uGain: 2.0,
        uTexel: [1 / this.simRes, 1 / this.simRes],
      }, { uMass: this.mass.read.tex, uNarrow: narrowTex, uWide: this.wide.read.tex });
      this.mass.swap();
      this.frame++;
    }
  }

  render(p: SimParams, stops: [number, number, number][]) {
    this.glr.pass(this.pCopy, this.present.fbo, this.simRes, this.simRes, {}, { uSrc: this.mass.read.tex });
    this.glr.pass(this.pGlow, this.glow.fbo, 128, 128, {
      uEngineType: 1, uTexel: [1 / this.simRes, 1 / this.simRes],
    }, { uState: this.present.tex });

    const stopsU: Record<string, [number, number, number]> = {};
    for (let i = 0; i < 6; i++) stopsU[`uStops[${i}]`] = stops[i % stops.length];
    this.glr.pass(this.pDisplay, null, this.canvasW, this.canvasH, {
      uEngineType: 1,
      ...stopsU,
      uStopCount: new Int32Array([stops.length]),
      uColorMode: p.colorMode,
      uSat: p.sat,
      uGlowAmt: p.glowAmt,
      uGlowTint: hexToRgb(p.glowTint),
      uSparkle: p.sparkle,
      uExposure: p.exposure,
      uBg: hexToRgb(p.bg),
      uAspect: this.canvasW / Math.max(1, this.canvasH),
      uKaleido: p.kaleido,
      uVignette: p.vignette,
    }, { uState: this.present.tex, uGlow: this.glow.tex });
  }

  checksum(): string {
    const gl = this.glr.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.mass.read.fbo);
    const buf = new Float32Array(8 * 8 * 4);
    gl.readPixels(this.simRes / 2 - 4, this.simRes / 2 - 4, 8, 8, gl.RGBA, gl.FLOAT, buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    let s = 0;
    for (let i = 0; i < buf.length; i++) s = (s + buf[i] * (i + 1)) % 1000000007;
    return s.toFixed(3);
  }

  dispose() {
    this.mass.dispose(); this.narrow.dispose(); this.wide.dispose(); this.glow.dispose(); this.present.dispose();
  }
}
