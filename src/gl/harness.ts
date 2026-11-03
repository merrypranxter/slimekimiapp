/**
 * Minimal WebGL2 harness: program compilation, float ping-pong targets,
 * fullscreen-triangle passes, and an additive point-splat pass.
 * No external dependencies — everything runs on raw WebGL2.
 */

export type UniformValue =
  | number
  | [number, number]
  | [number, number, number]
  | [number, number, number, number]
  | Float32Array
  | Int32Array
  | number[];

export class GL {
  readonly gl: WebGL2RenderingContext;
  private quadVAO: WebGLVertexArrayObject;
  width = 0;
  height = 0;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      depth: false,
      stencil: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) throw new Error('EXT_color_buffer_float unavailable');
    this.gl = gl;
    this.quadVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVAO);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  program(vsSrc: string, fsSrc: string): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error('shader: ' + gl.getShaderInfoLog(sh) + '\n--- src ---\n' + src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'));
      }
      return sh;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    return p;
  }

  /** Draw a fullscreen pass: bind target (null = canvas), set uniforms, draw. */
  pass(
    prog: WebGLProgram,
    target: WebGLFramebuffer | null,
    w: number,
    h: number,
    uniforms: Record<string, UniformValue> = {},
    textures: Record<string, WebGLTexture> = {},
  ) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
    let unit = 0;
    for (const [name, tex] of Object.entries(textures)) {
      const loc = gl.getUniformLocation(prog, name);
      if (!loc) continue;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(loc, unit);
      unit++;
    }
    for (const [name, v] of Object.entries(uniforms)) {
      const loc = gl.getUniformLocation(prog, name) ?? gl.getUniformLocation(prog, name + '[0]');
      if (!loc) continue;
      if (typeof v === 'number') gl.uniform1f(loc, v);
      else if (v instanceof Float32Array) gl.uniform1fv(loc, v);
      else if (v instanceof Int32Array) gl.uniform1iv(loc, v);
      else if (Array.isArray(v)) {
        const [a = 0, b = 0, c = 0, d = 0] = v;
        if (v.length === 2) gl.uniform2f(loc, a, b);
        else if (v.length === 3) gl.uniform3f(loc, a, b, c);
        else gl.uniform4f(loc, a, b, c, d);
      }
    }
    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  /** Draw `count` points with an explicit vertex shader (agent splatting). */
  points(
    prog: WebGLProgram,
    target: WebGLFramebuffer | null,
    w: number,
    h: number,
    count: number,
    uniforms: Record<string, UniformValue> = {},
    textures: Record<string, WebGLTexture> = {},
  ) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
    let unit = 0;
    for (const [name, tex] of Object.entries(textures)) {
      const loc = gl.getUniformLocation(prog, name);
      if (!loc) continue;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(loc, unit);
      unit++;
    }
    for (const [name, v] of Object.entries(uniforms)) {
      const loc = gl.getUniformLocation(prog, name);
      if (!loc) continue;
      if (typeof v === 'number') gl.uniform1f(loc, v);
      else if (Array.isArray(v)) {
        const [a = 0, b = 0, c = 0, d = 0] = v;
        if (v.length === 2) gl.uniform2f(loc, a, b);
        else if (v.length === 3) gl.uniform3f(loc, a, b, c);
        else gl.uniform4f(loc, a, b, c, d);
      }
    }
    gl.bindVertexArray(this.quadVAO); // attribute 0 unused; program must not require attribs
    gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);
  }
}

export class Target {
  readonly tex: WebGLTexture;
  readonly fbo: WebGLFramebuffer;
  readonly glr: GL;
  readonly w: number;
  readonly h: number;
  constructor(glr: GL, w: number, h: number, internal: number = glr.gl.RGBA32F, filter: number = glr.gl.NEAREST) {
    this.glr = glr; this.w = w; this.h = h;
    const gl = glr.gl;
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, internal, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  dispose() {
    const gl = this.glr.gl;
    gl.deleteTexture(this.tex);
    gl.deleteFramebuffer(this.fbo);
  }
}

/** Ping-pong pair of float targets. */
export class PingPong {
  read: Target;
  write: Target;
  constructor(glr: GL, w: number, h: number, internal?: number, filter?: number) {
    this.read = new Target(glr, w, h, internal, filter);
    this.write = new Target(glr, w, h, internal, filter);
  }
  swap() { const t = this.read; this.read = this.write; this.write = t; }
  dispose() { this.read.dispose(); this.write.dispose(); }
}

export const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }`;

export const POINT_VERT = `#version 300 es
precision highp float;
uniform sampler2D uAgents;
uniform float uSym;        // symmetry order (1 = none)
uniform float uPointSize;
uniform float uAspect;     // sim is square; fine
out vec3 vSpeciesColor;
void main(){
  int copies = int(max(1.0, uSym));
  int agent = gl_VertexID / copies;
  int copy  = gl_VertexID % copies;
  ivec2 sz = textureSize(uAgents, 0);
  ivec2 coord = ivec2(agent % sz.x, agent / sz.x);
  vec4 a = texelFetch(uAgents, coord, 0);
  vec2 p = a.xy;
  if (copy > 0) {
    float ang = 6.2831853 * float(copy) / float(copies);
    vec2 d = p - 0.5;
    float ca = cos(ang), sa = sin(ang);
    // dihedral: odd copies get mirrored
    if (copy % 2 == 1) d.x = -d.x;
    p = 0.5 + vec2(d.x*ca - d.y*sa, d.x*sa + d.y*ca);
  }
  int sp = int(clamp(a.w, 0.0, 2.999));
  vSpeciesColor = sp == 0 ? vec3(1.,0.,0.) : (sp == 1 ? vec3(0.,1.,0.) : vec3(0.,0.,1.));
  gl_Position = vec4(p*2.0-1.0, 0., 1.);
  gl_PointSize = uPointSize;
}`;
