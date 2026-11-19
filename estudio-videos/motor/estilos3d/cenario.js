// cenario.js — cenários e objetos low-poly na estética Vice City/synthwave do canal
'use strict';

const COR = { roxo: 0x2a0a4a, rosa: 0xff2d95, ciano: 0x00f0ff, laranja: 0xff8c42, preto: 0x0b0218 };
function rnd(s) { let x = Math.sin(s * 9301 + 49297) * 233280; return x - Math.floor(x); }
function juntar(lista) { const g = new Geo(); for (const [geo, M] of lista) g.juntar(M ? transformar(geo, M) : geo); return g; }

// ───────── iluminação e fundo ─────────
const PRESETS = {
  noite: { fundo: { modo: 0, c0: 0xff2d95, c1: 0x5a1a7a, c2: 0x0b0218, solA: 0xffd36b, solB: 0xff2d95, sol: [0.5, 0.36], solR: 0.2, horizonte: 0.27 },
    luz: { key: [[-0.5, 0.9, 0.8], [0.95, 0.88, 0.9]], fill: [[0.8, 0.2, 0.4], [0.2, 0.3, 0.5]], rim: [1.0, 0.3, 0.7], sky: [0.42, 0.36, 0.52], chao: [0.2, 0.1, 0.25],
      nevoa: [0.36, 0.1, 0.4], perto: 8, longe: 30, grade: [1.0, 0.18, 0.58] } },
  rosa: { fundo: { modo: 1, c0: 0x3a0a4a, c1: 0xff4fa8, c2: 0x12031f },
    luz: { key: [[-0.4, 0.8, 1], [0.95, 0.9, 0.92]], fill: [[0.9, 0.3, 0.3], [0.5, 0.15, 0.35]], rim: [1.0, 0.35, 0.75], sky: [0.45, 0.35, 0.5], chao: [0.25, 0.08, 0.2],
      nevoa: [0.3, 0.05, 0.3], perto: 10, longe: 30, grade: [1.0, 0.3, 0.7] } },
  ciano: { fundo: { modo: 1, c0: 0x0a2a4a, c1: 0x00c8e0, c2: 0x020a18 },
    luz: { key: [[0.4, 0.8, 1], [0.86, 0.78, 0.72]], fill: [[-0.9, 0.3, 0.3], [0.08, 0.28, 0.42]], rim: [0.2, 0.8, 1.0], sky: [0.3, 0.36, 0.45], chao: [0.06, 0.15, 0.22],
      nevoa: [0.04, 0.2, 0.3], perto: 10, longe: 30, grade: [0.0, 0.85, 1.0] } },
  laranja: { fundo: { modo: 1, c0: 0x4a1a0a, c1: 0xff8c42, c2: 0x150505 },
    luz: { key: [[-0.6, 0.7, 0.8], [1.0, 0.85, 0.7]], fill: [[0.9, 0.2, 0.3], [0.45, 0.15, 0.3]], rim: [1.0, 0.55, 0.25], sky: [0.45, 0.35, 0.35], chao: [0.25, 0.12, 0.1],
      nevoa: [0.3, 0.1, 0.06], perto: 10, longe: 30, grade: [1.0, 0.55, 0.25] } },
  mar: { fundo: { modo: 0, c0: 0xff8c42, c1: 0xff2d95, c2: 0x2a0a4a, solA: 0xfff0a0, solB: 0xff8c42, sol: [0.62, 0.4], solR: 0.16, horizonte: 0.3 },
    luz: { key: [[0.6, 0.6, 0.9], [1.0, 0.85, 0.75]], fill: [[-0.8, 0.3, 0.4], [0.25, 0.25, 0.45]], rim: [1.0, 0.6, 0.4], sky: [0.5, 0.42, 0.5], chao: [0.15, 0.15, 0.25],
      nevoa: [0.65, 0.3, 0.4], perto: 8, longe: 28, grade: [0.0, 0.9, 1.0] } },
  clube: { fundo: { modo: 1, c0: 0x1a0530, c1: 0x5a0a6a, c2: 0x05010c },
    luz: { key: [[0, 0.9, 0.7], [0.75, 0.65, 0.95]], fill: [[0.9, 0.2, 0.5], [0.3, 0.1, 0.4]], rim: [0.2, 0.9, 1.0], sky: [0.3, 0.22, 0.42], chao: [0.12, 0.05, 0.18],
      nevoa: [0.08, 0.02, 0.14], perto: 6, longe: 18, grade: [1.0, 0.18, 0.58] } },
};
function aplicarPreset(R, nome) {
  const P = PRESETS[nome], f = P.fundo, l = P.luz;
  R.fundo = { modo: f.modo, c0: hex(f.c0), c1: hex(f.c1), c2: hex(f.c2), solA: hex(f.solA || 0xffd36b), solB: hex(f.solB || 0xff2d95),
    sol: f.sol || [0.5, 0.4], solR: f.solR || 0.2, horizonte: f.horizonte || 0.3 };
  R.luz = { key: { dir: l.key[0], cor: l.key[1] }, fill: { dir: l.fill[0], cor: l.fill[1] }, rim: l.rim, sky: l.sky, chao: l.chao,
    nevoa: l.nevoa, nevoaPerto: l.perto, nevoaLonge: l.longe, grade: l.grade };
}

// ───────── peças ─────────
function chao(cor = 0x14061f, grade = 1, tam = 60) {
  const n = new No(caixa(tam, 0.02, tam, hex(cor)), { grade, rim: 0 }); n.pos = [0, -0.011, 0]; return n;
}

function palmeira(alt = 3, s = 1) {
  const L = [], seg = 7, tronco = hex(0x3b1d3f), folha = hex(0x0f4a46);
  let x = 0, y = 0, inc = (rnd(s) - 0.5) * 0.25;
  for (let i = 0; i < seg; i++) {
    const h = alt / seg, r0 = lerp(0.11, 0.07, i / seg);
    L.push([membro({ h: h * 1.08, r0: r0 * 0.95, r1: r0, lados: 6, cor: i % 2 ? tronco : escurecer(tronco, 0.85) }), trs([x, y, 0], [Math.PI, 0, -inc * i * 0.7])]);
    x += Math.sin(inc * i * 0.7) * h; y += Math.cos(inc * i * 0.7) * h;
  }
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2 + rnd(s + k) * 0.4, queda = 0.35 + rnd(s + k * 3) * 0.35;
    L.push([superForma({ rx: 0.11, ry: 0.012, rz: 0.75, su: 4, sv: 2, ph: 2, pv: 2, cor: k % 2 ? folha : escurecer(folha, 0.8), centro: [0, 0, 0.7],
      deform: (p) => [p[0] * (1 - Math.abs(p[2] - 0.7) / 0.9), p[1] - Math.pow(Math.max(0, p[2]), 2) * 0.35, p[2]] }), trs([x, y, 0], [queda, a, 0])]);
  }
  L.push([superForma({ rx: 0.13, ry: 0.1, rz: 0.13, su: 6, sv: 3, cor: escurecer(tronco, 0.7) }), trs([x, y - 0.05, 0])]);
  return new No(juntar(L));
}

function predios(n = 9, s = 7, z0 = -10) {
  const corpo = [], jan = [], neon = [];
  const cores = [hex(COR.ciano), hex(COR.rosa), hex(COR.laranja), hex(0xfff2c0)];
  for (let i = 0; i < n; i++) {
    const w = 1.6 + rnd(s + i) * 1.8, h = 2.5 + rnd(s + i * 7) * 6, d = 1.8, x = (i - (n - 1) / 2) * 2.6 + (rnd(s + i * 3) - 0.5), z = z0 - rnd(s + i * 5) * 5;
    corpo.push([caixa(w, h, d, hex(i % 2 ? 0x1d0b35 : 0x260c3f)), trs([x, h / 2, z])]);
    neon.push([caixa(w + 0.04, 0.05, d + 0.04, cores[i % 2]), trs([x, h, z])]);
    for (let a = 0.6; a < h - 0.3; a += 0.55) for (let b = -w / 2 + 0.3; b < w / 2 - 0.2; b += 0.42) {
      if (rnd(s + i * 31 + a * 7 + b * 13) > 0.55) jan.push([caixa(0.2, 0.25, 0.02, cores[Math.floor(rnd(i + a + b) * 4)]), trs([x + b, a, z + d / 2 + 0.01])]);
    }
  }
  const g = new No(); g.add(new No(juntar(corpo))); g.add(new No(juntar(jan), { emis: 0.85 })); g.add(new No(juntar(neon), { emis: 1 }));
  return g;
}

function carro(cor = COR.rosa) {
  const r = { raiz: new No(), rodas: [] }, C = hex(cor);
  const lat = (p, u, v) => [p[0], p[1], p[2] * (p[1] > 0 ? 1 : 1)];
  r.raiz.add(new No(superForma({ rx: 0.48, ry: 0.15, rz: 1.05, su: 8, sv: 3, ph: 3.5, pv: 4, cor: C, centro: [0, 0.3, 0], jitter: 0.02, deform: lat })));
  r.raiz.add(new No(superForma({ rx: 0.4, ry: 0.15, rz: 0.48, su: 8, sv: 3, ph: 3, pv: 3, v0: 0.5, cor: hex(0x1a1030), centro: [0, 0.4, -0.12],
    deform: (p) => [p[0] * lerp(1, 0.8, p[1] / 0.15), p[1], p[2] * lerp(1, 0.75, p[1] / 0.15)] })));
  for (const s of [-1, 1]) {
    const f = r.raiz.add(new No(caixa(0.16, 0.06, 0.03, [1, 1, 0.95]), { emis: 1 })); f.pos = [s * 0.3, 0.33, 1.04];
    const t = r.raiz.add(new No(caixa(0.22, 0.05, 0.03, hex(0xff1030)), { emis: 1 })); t.pos = [s * 0.27, 0.36, -1.04];
    for (const z of [-0.62, 0.62]) {
      const w = r.raiz.add(new No(juntar([[membro({ h: 0.12, r0: 0.17, r1: 0.17, lados: 8, cor: hex(0x111116) }), trs([0.06, 0, 0], [0, 0, Math.PI / 2])],
        [membro({ h: 0.125, r0: 0.08, r1: 0.08, lados: 6, cor: hex(0xc0c0d0) }), trs([0.065, 0, 0], [0, 0, Math.PI / 2])]])));
      w.pos = [s * 0.44, 0.17, z]; w.esc = [s, 1, 1]; r.rodas.push(w);
    }
  }
  const glow = r.raiz.add(new No(superForma({ rx: 0.6, ry: 0.002, rz: 1.2, su: 10, sv: 2, ph: 3, pv: 2, cor: hex(COR.ciano) }), { emis: 1, alfa: 0.35 }));
  glow.pos = [0, 0.01, 0];
  return r;
}

function mesaCal() {
  const g = new No(), madeira = hex(0x4a2e22), cinza = hex(0x2a2a30);
  g.add(new No(juntar([[caixa(1.0, 0.05, 0.5, madeira), trs([0, 0.5, 0])],
    ...[[-0.45, -0.2], [0.45, -0.2], [-0.45, 0.2], [0.45, 0.2]].map(([x, z]) => [caixa(0.04, 0.5, 0.04, madeira), trs([x, 0.25, z])]),
    [caixa(0.5, 0.33, 0.04, cinza), trs([0, 0.8, -0.12])], [caixa(0.05, 0.14, 0.05, cinza), trs([0, 0.58, -0.12])],
    [caixa(0.38, 0.02, 0.14, cinza), trs([0, 0.535, 0.1])],
    [caixa(0.22, 0.13, 0.13, hex(0x3a3a2a)), trs([0.36, 0.59, -0.08])],
    [membro({ h: 0.35, r0: 0.006, r1: 0.006, lados: 4, cor: cinza }), trs([0.42, 0.65, -0.1], [Math.PI - 0.2, 0, 0])]])));
  const tela = g.add(new No(caixa(0.46, 0.29, 0.005, hex(0x0a3a4a)), { emis: 1 })); tela.pos = [0, 0.8, -0.098];
  const linhas = []; for (let i = 0; i < 7; i++) linhas.push([caixa(0.1 + rnd(i) * 0.25, 0.012, 0.004, hex(i % 3 ? COR.ciano : 0x7dffb0)), trs([-0.2 + 0.05 + (0.1 + rnd(i) * 0.25) / 2 - 0.05, 0.9 - i * 0.032, -0.094])]);
  g.add(new No(juntar(linhas), { emis: 1 }));
  const led = g.add(new No(caixa(0.03, 0.03, 0.01, hex(0xff1030)), { emis: 1 })); led.pos = [0.31, 0.62, -0.01]; g.led = led;
  return g;
}

function barco() {
  const g = new No(), branco = hex(0xf2f0ea), faixa = hex(COR.rosa);
  g.add(new No(superForma({ rx: 0.75, ry: 0.32, rz: 1.7, su: 10, sv: 3, ph: 2.6, pv: 2.2, v0: 0, v1: 0.5, cor: branco, centro: [0, 0.32, 0],
    corFn: (u, v) => (v > 0.38 ? faixa : branco), deform: (p) => [p[0] * (p[2] > 0 ? lerp(1, 0.3, p[2] / 1.7) : 1), p[1], p[2]] })));
  g.add(new No(caixa(1.3, 0.04, 2.6, hex(0xd8c8a8)), {})).pos = [0, 0.32, -0.2];
  g.add(new No(caixa(0.9, 0.45, 0.8, branco))).pos = [0, 0.56, -0.6];
  g.add(new No(caixa(0.92, 0.12, 0.82, hex(0x1a1030)), { emis: 0.3 })).pos = [0, 0.66, -0.6];
  return g;
}

function cais(comp = 6) {
  const L = []; for (let i = 0; i < comp / 0.32; i++) L.push([caixa(1.4, 0.06, 0.28, hex(i % 2 ? 0x6a4a34 : 0x5a3e2c)), trs([0, 0.03, -i * 0.32 + comp / 2])]);
  for (let i = 0; i < 4; i++) L.push([membro({ h: 0.9, r0: 0.06, r1: 0.06, lados: 6, cor: hex(0x4a3020) }), trs([0.72, 0.25, -i * 1.6 + 2], [Math.PI, 0, 0])]);
  return new No(juntar(L));
}

function clube() {
  const g = new No();
  const cab = g.add(new No(juntar([[caixa(1.6, 0.8, 0.6, hex(0x14081f)), trs([0, 0.4, -1.4])],
    [caixa(0.5, 0.05, 0.3, hex(0x303038)), trs([-0.3, 0.83, -1.4])], [caixa(0.5, 0.05, 0.3, hex(0x303038)), trs([0.3, 0.83, -1.4])]])));
  const faixa = g.add(new No(caixa(1.62, 0.06, 0.62, hex(COR.ciano)), { emis: 1 })); faixa.pos = [0, 0.62, -1.4];
  g.aneis = [];
  [[2.2, COR.rosa], [1.7, COR.ciano], [1.2, COR.rosa]].forEach(([R, c], i) => {
    const a = g.add(new No(toro(R, 0.035, 28, 4, hex(c)), { emis: 1 })); a.pos = [0, 1.6, -3 - i * 0.6]; a.rot = [Math.PI / 2, 0, 0]; g.aneis.push(a);
  });
  g.cones = [];
  [[-1.6, COR.rosa], [1.6, COR.ciano], [0, 0xfff0c0]].forEach(([x, c]) => {
    const cone = g.add(new No(superForma({ rx: 0.55, ry: 2.2, rz: 0.55, su: 10, sv: 2, ph: 2, pv: 2, v0: 0.5, v1: 1, cor: hex(c), centro: [0, -2.2, 0],
      deform: (p) => { const k = (p[1] + 2.2) / 2.2; return [p[0] * (1 - k), p[1], p[2] * (1 - k)]; } }), { emis: 1, alfa: 0.13 }));
    cone.pos = [x, 3.6, -0.6]; g.cones.push(cone);
  });
  const bola = g.add(new No(superForma({ rx: 0.28, ry: 0.28, rz: 0.28, su: 10, sv: 6, ph: 2, pv: 2, cor: hex(0xc8c8e0),
    corFn: (u, v, i, j) => ((i + j) % 2 ? hex(0xe8e8ff) : hex(0x8080a0)) }), { emis: 0.35 })); bola.pos = [0, 3.3, -1]; g.bola = bola;
  return g;
}

Object.assign(window, { COR, PRESETS, aplicarPreset, chao, palmeira, predios, carro, mesaCal, barco, cais, clube, juntar, rnd });
