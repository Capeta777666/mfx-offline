// motor.js — mini motor 3D WebGL2 com sombreamento facetado (low-poly) para o @radar.gta6
// Sem dependências. Cena = árvore de nós {mesh, pos, rot, esc, filhos}. Câmera perspectiva.
'use strict';

// ───────── matemática (mat4 column-major) ─────────
const M4 = {
  id: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s;
    }
    return o;
  },
  trans: (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1],
  esc: (x, y, z) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1],
  rotX(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; },
  rotY(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; },
  rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; },
  persp(fov, asp, n, f) {
    const t = 1 / Math.tan(fov / 2);
    return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0];
  },
  lookAt(e, c, u = [0, 1, 0]) {
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const nor = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
    const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const z = nor(sub(e, c)), x = nor(cr(u, z)), y = cr(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
  },
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const suave = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeOutBack = (t) => { t = clamp(t); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
// ruído suave 1D determinístico (para movimentos "vivos")
function ruido(x, semente = 0) {
  const h = (n) => { const s = Math.sin(n * 127.1 + semente * 311.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

// ───────── geometria ─────────
// Malha = {v: Float32Array intercalado [pos3, nor3, cor3]}; triângulos com normal por face (facetado).
class Geo {
  constructor() { this.d = []; }
  tri(a, b, c, cor) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(...n); if (l < 1e-9) return; n = n.map((x) => x / l);
    for (const p of [a, b, c]) this.d.push(p[0], p[1], p[2], n[0], n[1], n[2], cor[0], cor[1], cor[2]);
  }
  juntar(g) { this.d.push(...g.d); return this; }
}

const sp = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e);
function hash3(x, y, z) {
  const s = Math.sin(Math.round(x * 997) * 12.9898 + Math.round(y * 997) * 78.233 + Math.round(z * 997) * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

// Superelipsoide facetado. u: volta em Y (0 = frente +z), v: 0 = base, 1 = topo.
// ph/pv: "quadradez" horizontal/vertical (2 = esfera, maior = mais caixa).
function superForma(o) {
  const { rx = 0.1, ry = 0.1, rz = 0.1, su = 8, sv = 6, ph = 2.6, pv = 2.6, u0 = 0, u1 = 1, v0 = 0, v1 = 1,
    cor = [1, 1, 1], corFn = null, deform = null, jitter = 0.0, centro = [0, 0, 0] } = o;
  const g = new Geo(), P = [];
  for (let j = 0; j <= sv; j++) {
    const v = lerp(v0, v1, j / sv), phi = lerp(-Math.PI / 2, Math.PI / 2, v), linha = [];
    for (let i = 0; i <= su; i++) {
      const u = lerp(u0, u1, i / su), th = u * Math.PI * 2;
      const cp = sp(Math.cos(phi), 2 / pv);
      let p = [rx * cp * sp(Math.sin(th), 2 / ph), ry * sp(Math.sin(phi), 2 / pv), rz * cp * sp(Math.cos(th), 2 / ph)];
      if (deform) p = deform(p, u, v);
      if (jitter) {
        const k = jitter * Math.min(rx, ry, rz);
        p = [p[0] + (hash3(p[0], p[1], p[2]) - 0.5) * k, p[1] + (hash3(p[1], p[2], p[0]) - 0.5) * k, p[2] + (hash3(p[2], p[0], p[1]) - 0.5) * k];
      }
      linha.push([p[0] + centro[0], p[1] + centro[1], p[2] + centro[2]]);
    }
    P.push(linha);
  }
  for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) {
    const a = P[j][i], b = P[j][i + 1], c = P[j + 1][i + 1], d = P[j + 1][i];
    const um = lerp(u0, u1, (i + 0.5) / su), vm = lerp(v0, v1, (j + 0.5) / sv);
    const k = corFn ? corFn(um, vm, i, j) : cor;
    g.tri(a, b, c, k); g.tri(a, c, d, k);
  }
  return g;
}

// Prisma/cilindro facetado entre y=0 e y=-h (pendurado, bom para membros), raio no topo r0 e na base r1.
function membro(o) {
  const { h = 0.2, r0 = 0.05, r1 = 0.045, lados = 6, cor = [1, 1, 1], sx = 1, sz = 1, tampa = true, corFn = null } = o;
  const g = new Geo();
  const anel = (y, r) => Array.from({ length: lados }, (_, i) => {
    const a = (i + 0.5) / lados * Math.PI * 2; return [Math.sin(a) * r * sx, y, Math.cos(a) * r * sz];
  });
  const A = anel(0, r0), B = anel(-h, r1);
  for (let i = 0; i < lados; i++) {
    const j = (i + 1) % lados, k = corFn ? corFn(i) : cor;
    g.tri(A[i], B[i], B[j], k); g.tri(A[i], B[j], A[j], k);
    if (tampa) { g.tri([0, 0, 0], A[j], A[i], cor); g.tri([0, -h, 0], B[i], B[j], cor); }
  }
  return g;
}

function caixa(w, h, d, cor, centro = [0, 0, 0]) {
  const g = new Geo(), x = w / 2, y = h / 2, z = d / 2, c = centro;
  const P = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]].map((p) => [p[0] + c[0], p[1] + c[1], p[2] + c[2]]);
  [[4, 5, 6, 7], [1, 0, 3, 2], [5, 1, 2, 6], [0, 4, 7, 3], [7, 6, 2, 3], [0, 1, 5, 4]].forEach(([a, b, e, f]) => { g.tri(P[a], P[b], P[e], cor); g.tri(P[a], P[e], P[f], cor); });
  return g;
}

function toro(R, r, su, sv, cor) {
  const g = new Geo(), P = [];
  for (let i = 0; i <= su; i++) {
    const a = i / su * Math.PI * 2, linha = [];
    for (let j = 0; j <= sv; j++) {
      const b = j / sv * Math.PI * 2;
      linha.push([(R + r * Math.cos(b)) * Math.cos(a), r * Math.sin(b), (R + r * Math.cos(b)) * Math.sin(a)]);
    }
    P.push(linha);
  }
  for (let i = 0; i < su; i++) for (let j = 0; j < sv; j++) {
    g.tri(P[i][j], P[i + 1][j], P[i + 1][j + 1], cor); g.tri(P[i][j], P[i + 1][j + 1], P[i][j + 1], cor);
  }
  return g;
}

// aplica uma matriz numa geometria (para juntar várias peças estáticas numa só malha)
function transformar(geo, M) {
  const g = new Geo(), d = geo.d;
  for (let i = 0; i < d.length; i += 9) {
    const x = d[i], y = d[i + 1], z = d[i + 2], nx = d[i + 3], ny = d[i + 4], nz = d[i + 5];
    g.d.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]);
    let a = M[0] * nx + M[4] * ny + M[8] * nz, b = M[1] * nx + M[5] * ny + M[9] * nz, c = M[2] * nx + M[6] * ny + M[10] * nz;
    const l = Math.hypot(a, b, c) || 1; g.d.push(a / l, b / l, c / l, d[i + 6], d[i + 7], d[i + 8]);
  }
  return g;
}
// matriz a partir de posição/rotação/escala (mesma ordem dos nós)
function trs(pos = [0, 0, 0], rot = [0, 0, 0], esc = [1, 1, 1]) {
  let m = M4.trans(...pos);
  m = M4.mul(m, M4.rotY(rot[1])); m = M4.mul(m, M4.rotX(rot[0])); m = M4.mul(m, M4.rotZ(rot[2]));
  return M4.mul(m, M4.esc(...esc));
}

// ───────── cena ─────────
class No {
  constructor(geo = null, opc = {}) {
    this.geo = geo; this.pos = [0, 0, 0]; this.rot = [0, 0, 0]; this.esc = [1, 1, 1];
    this.filhos = []; this.visivel = true;
    this.emis = opc.emis || 0; this.alfa = opc.alfa ?? 1; this.grade = opc.grade || 0; this.rim = opc.rim ?? 1; this.nome = opc.nome || '';
  }
  add(n) { this.filhos.push(n); return n; }
  local() {
    let m = M4.trans(...this.pos);
    m = M4.mul(m, M4.rotY(this.rot[1])); m = M4.mul(m, M4.rotX(this.rot[0])); m = M4.mul(m, M4.rotZ(this.rot[2]));
    return M4.mul(m, M4.esc(...this.esc));
  }
}

// ───────── renderizador ─────────
const VS = `#version 300 es
in vec3 aP; in vec3 aN; in vec3 aC;
uniform mat4 uPV, uM; out vec3 vN, vC, vW;
void main(){ vec4 w = uM*vec4(aP,1.); vW=w.xyz; vN=mat3(uM)*aN; vC=aC; gl_Position=uPV*w; }`;
const FS = `#version 300 es
precision highp float;
in vec3 vN, vC, vW; out vec4 o;
uniform vec3 uCam, uKeyDir, uKeyCol, uFillDir, uFillCol, uRimCol, uSky, uChao, uNevoa, uGradeCor;
uniform float uEmis, uAlfa, uGrade, uNevoaPerto, uNevoaLonge, uRim;
void main(){
  vec3 n = normalize(vN); vec3 V = normalize(uCam - vW); if (dot(n,V) < 0.) n = -n;
  float k = max(dot(n, normalize(uKeyDir)), 0.);
  float f = max(dot(n, normalize(uFillDir)), 0.);
  float r = pow(1. - max(dot(n,V),0.), 2.5);
  vec3 hemi = mix(uChao, uSky, n.y*.5+.5);
  vec3 c = vC*(hemi + k*uKeyCol + f*uFillCol) + r*uRimCol*.55*uRim;
  c = mix(c, vC, uEmis);
  if (uGrade > 0.) {
    vec2 g = vW.xz / uGrade; vec2 w = fwidth(g);
    vec2 l = abs(fract(g - .5) - .5) / max(w, 1e-4);
    float lin = 1. - min(min(l.x, l.y), 1.);
    c += uGradeCor * lin * 1.1;
  }
  float d = length(uCam - vW);
  c = mix(c, uNevoa, smoothstep(uNevoaPerto, uNevoaLonge, d));
  o = vec4(c, uAlfa);
}`;
// fundo de tela cheia: céu degradê + sol retrô listrado, ou estúdio radial
const VS_BG = `#version 300 es
in vec2 aP; out vec2 vUv; void main(){ vUv = aP*.5+.5; gl_Position = vec4(aP,0.999,1.); }`;
const FS_BG = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform vec3 uC0, uC1, uC2, uSolA, uSolB; uniform vec2 uSol; uniform float uSolR, uModo, uAsp, uT, uHorizonte;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 p = vUv; vec3 c;
  if (uModo < .5) {
    float y = (p.y - uHorizonte) / (1. - uHorizonte);
    c = mix(uC0, uC1, smoothstep(0., .55, y)); c = mix(c, uC2, smoothstep(.5, 1., y));
    vec2 q = vec2((p.x - uSol.x)*uAsp, p.y - uSol.y); float d = length(q);
    if (d < uSolR) {
      float t = (p.y - (uSol.y - uSolR)) / (2.*uSolR);
      vec3 s = mix(uSolB, uSolA, t);
      float vao = 0.;
      if (t < .5) vao = step(fract(t*11.), mix(.55, .06, t/.5));
      if (vao < .5) c = s;
    }
    c += uSolA * .35 * exp(-d*d/(uSolR*uSolR*2.2));
    vec2 e = floor(p*vec2(140., 250.)); float st = step(.996, h(e)) * smoothstep(uHorizonte+.1, 1., p.y);
    c += st * (.5+.5*sin(uT*3.+h(e+1.)*20.));
  } else {
    vec2 q = vec2((p.x-.5)*uAsp, p.y-.55); float d = length(q);
    c = mix(uC1, uC0, smoothstep(0., .9, d));
    c = mix(c, uC2, smoothstep(.45, 1.2, d));
  }
  c += (h(p*999.+uT)-.5)*.02;
  o = vec4(c, 1.);
}`;

class Render {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('sem WebGL2');
    this.gl = gl; this.cv = canvas;
    this.p = this.prog(VS, FS); this.pb = this.prog(VS_BG, FS_BG);
    this.bgBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.cache = new Map();
    this.luz = {
      key: { dir: [-0.5, 0.9, 0.8], cor: [0.95, 0.9, 0.88] }, fill: { dir: [0.8, 0.2, 0.4], cor: [0.25, 0.22, 0.35] },
      rim: [0.8, 0.3, 0.9], sky: [0.42, 0.38, 0.5], chao: [0.18, 0.12, 0.22], nevoa: [0.1, 0.03, 0.18], nevoaPerto: 12, nevoaLonge: 40,
      grade: [1.0, 0.18, 0.58],
    };
    this.fundo = { modo: 0, c0: hex(0xff2d95), c1: hex(0x5a1a7a), c2: hex(0x0b0218), solA: hex(0xffd36b), solB: hex(0xff2d95), sol: [0.5, 0.42], solR: 0.2, horizonte: 0.3 };
  }
  prog(vs, fs) {
    const gl = this.gl, mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    p.u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); p.u[a.name] = gl.getUniformLocation(p, a.name); }
    return p;
  }
  buf(geo) {
    let b = this.cache.get(geo); if (b) return b;
    const gl = this.gl; b = { vbo: gl.createBuffer(), n: geo.d.length / 9 };
    gl.bindBuffer(gl.ARRAY_BUFFER, b.vbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.d), gl.STATIC_DRAW);
    this.cache.set(geo, b); return b;
  }
  desenhar(raiz, cam, t = 0) {
    const gl = this.gl, W = this.cv.width, H = this.cv.height, f = this.fundo, L = this.luz;
    gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // fundo
    gl.disable(gl.DEPTH_TEST); gl.useProgram(this.pb); const ub = this.pb.u;
    gl.uniform3fv(ub.uC0, f.c0); gl.uniform3fv(ub.uC1, f.c1); gl.uniform3fv(ub.uC2, f.c2);
    gl.uniform3fv(ub.uSolA, f.solA); gl.uniform3fv(ub.uSolB, f.solB); gl.uniform2fv(ub.uSol, f.sol);
    gl.uniform1f(ub.uSolR, f.solR); gl.uniform1f(ub.uModo, f.modo); gl.uniform1f(ub.uAsp, W / H); gl.uniform1f(ub.uT, t);
    gl.uniform1f(ub.uHorizonte, f.horizonte);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf); const la = gl.getAttribLocation(this.pb, 'aP');
    gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 8, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(la);
    // cena
    gl.enable(gl.DEPTH_TEST); gl.useProgram(this.p); const u = this.p.u;
    const PV = M4.mul(M4.persp(cam.fov * Math.PI / 180, W / H, 0.05, 200), M4.lookAt(cam.olho, cam.alvo));
    gl.uniformMatrix4fv(u.uPV, false, PV); gl.uniform3fv(u.uCam, cam.olho);
    gl.uniform3fv(u.uKeyDir, L.key.dir); gl.uniform3fv(u.uKeyCol, L.key.cor); gl.uniform3fv(u.uFillDir, L.fill.dir);
    gl.uniform3fv(u.uFillCol, L.fill.cor); gl.uniform3fv(u.uRimCol, L.rim); gl.uniform3fv(u.uSky, L.sky); gl.uniform3fv(u.uChao, L.chao);
    gl.uniform3fv(u.uNevoa, L.nevoa); gl.uniform1f(u.uNevoaPerto, L.nevoaPerto); gl.uniform1f(u.uNevoaLonge, L.nevoaLonge);
    gl.uniform3fv(u.uGradeCor, L.grade);
    const aP = gl.getAttribLocation(this.p, 'aP'), aN = gl.getAttribLocation(this.p, 'aN'), aC = gl.getAttribLocation(this.p, 'aC');
    [aP, aN, aC].forEach((a) => gl.enableVertexAttribArray(a));
    const transp = [];
    const visitar = (n, M) => {
      if (!n.visivel) return; const W = M4.mul(M, n.local());
      if (n.geo) { if (n.alfa < 1) transp.push([n, W]); else this.item(n, W, aP, aN, aC); }
      for (const c of n.filhos) visitar(c, W);
    };
    visitar(raiz, M4.id());
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    for (const [n, W] of transp) this.item(n, W, aP, aN, aC);
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
  item(n, W, aP, aN, aC) {
    const gl = this.gl, u = this.p.u, b = this.buf(n.geo);
    gl.uniformMatrix4fv(u.uM, false, W); gl.uniform1f(u.uEmis, n.emis); gl.uniform1f(u.uAlfa, n.alfa); gl.uniform1f(u.uGrade, n.grade); gl.uniform1f(u.uRim, n.rim);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.vbo);
    gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 36, 0); gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 36, 12);
    gl.vertexAttribPointer(aC, 3, gl.FLOAT, false, 36, 24); gl.drawArrays(gl.TRIANGLES, 0, b.n);
  }
}

Object.assign(window, { M4, Geo, No, Render, superForma, membro, caixa, toro, transformar, trs, lerp, clamp, suave, easeOutBack, easeInOut, ruido, hex });
