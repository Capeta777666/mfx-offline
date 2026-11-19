// personagens.js — bonecos low-poly articulados no estilo da referência (cabeção, corpo curto, tênis grandes)
'use strict';

// Proporções tiradas da imagem de referência (altura total ≈ 1.2)
const QUADRIL_Y = 0.42, COXA = 0.16, CANELA = 0.16, OMBRO_Y = 0.305, ESC_CABECA = 1.13;
const BRACO = 0.19, ANTEBRACO = 0.16, CABECA_Y = 0.385;

function escurecer(c, k) { return c.map((x) => x * k); }
function misturar(a, b, t) { return a.map((x, i) => lerp(x, b[i], t)); }
function h2(i, j, s) { const v = Math.sin(i * 91.7 + j * 47.3 + s * 13.1) * 43758.5; return v - Math.floor(v); }

// ───────── definição dos personagens (interpretação fan-art, estilizada) ─────────
const ELENCO = {
  apresentador: { nome: 'Radar', pele: 0xb9805c, cabelo: { tipo: 'curto', cor: 0x1c1c20 }, barba: { tipo: 'cheia', cor: 0x1c1c20 },
    bigode: 'enrolado', camisa: { cor: 0x1e1e22, manga: 'curta' }, calca: { cor: 0x26365f }, tenis: 0xeeeeee },
  jason: { nome: 'Jason Duval', pele: 0xe0b08e, cabelo: { tipo: 'curto', cor: 0x4a3222 }, barba: { tipo: 'curta', cor: 0x4a3222 },
    camisa: { cor: 0x5d6168, manga: 'regata' }, calca: { cor: 0x3c5679 }, tenis: 0x5a4030, tatuagem: true },
  lucia: { nome: 'Lucia Caminos', feminino: true, pele: 0xc8906a, cabelo: { tipo: 'rabo', cor: 0x2b1d18 },
    camisa: { cor: 0xf2f0ea, manga: 'regata', curta: true }, calca: { cor: 0x6f93c4 }, tenis: 0x222226, acessorios: ['argolas'] },
  cal: { nome: 'Cal Hampton', pele: 0xe2b090, cabelo: { tipo: 'calvo', cor: 0x8a6a48 }, barba: { tipo: 'curta', cor: 0x8a6a48 },
    camisa: { cor: 0x1f8a8a, manga: 'curta', estampa: [0x1f8a8a, 0xff8c42, 0xf2e6c8, 0x14605f] }, calca: { cor: 0xb59a6a, curta: true },
    tenis: 0x6b6b6b, acessorios: ['oculos', 'fones'] },
  brian: { nome: 'Brian Heder', pele: 0xd89a72, cabelo: { tipo: 'penteado', cor: 0xd8d8d2 }, barba: { tipo: 'cheia', cor: 0xd0d0ca },
    camisa: { cor: 0xff2d95, manga: 'curta', estampa: [0xff2d95, 0xf6f0e0, 0xff8c42, 0xc0186f] }, calca: { cor: 0xece6d6, curta: true },
    tenis: 0x7a5636, acessorios: ['oculos_sol'] },
  boobie: { nome: 'Boobie Ike', pele: 0x6e4632, cabelo: { tipo: 'careca', cor: 0x111111 }, barba: { tipo: 'cheia', cor: 0x141414 },
    camisa: { cor: 0xf1e9d8, manga: 'curta' }, calca: { cor: 0x18181c }, tenis: 0x111114, acessorios: ['corrente', 'oculos_sol'] },
  drequan: { nome: "Dre'Quan Priest", pele: 0x5c3a28, cabelo: { tipo: 'twists', cor: 0x151212 }, barba: { tipo: 'cavanhaque', cor: 0x151212 },
    camisa: { cor: 0x5b2a86, manga: 'longa' }, calca: { cor: 0x1b1b22 }, tenis: 0xf2f2f2, acessorios: ['corrente'] },
  baeluxe: { nome: 'Bae-Luxe', feminino: true, pele: 0x7a5038, cabelo: { tipo: 'trancas', cor: 0xff4fa8 },
    camisa: { cor: 0xff2d95, manga: 'regata', curta: true }, calca: { cor: 0xf2f2f2, saia: true }, tenis: 0xf2f2f2, acessorios: ['argolas'] },
  roxy: { nome: 'Roxy', feminino: true, pele: 0x9a6848, cabelo: { tipo: 'longo', cor: 0x1a1414 },
    camisa: { cor: 0x00d8e8, manga: 'regata', curta: true }, calca: { cor: 0x141418, curta: true }, tenis: 0x00d8e8, acessorios: ['argolas'] },
  raul: { nome: 'Raul Bautista', pele: 0xbf8a62, cabelo: { tipo: 'penteado', cor: 0x2a2624 }, bigode: 'grosso', bigodeCor: 0x2a2624,
    camisa: { cor: 0x2b2b30, manga: 'longa' }, calca: { cor: 0x1c1c20 }, tenis: 0x3a2618, acessorios: ['oculos_sol'] },
};

// meio-anel no plano x-y (arco de fone por cima da cabeça)
function arcoGeo(R, r, n, cor) {
  const g = new Geo(), P = [];
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI, c = [Math.cos(a) * R, Math.sin(a) * R, 0];
    P.push([0, 1, 2, 3].map((k) => { const b = k / 4 * Math.PI * 2; const rr = Math.cos(b) * r;
      return [c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, Math.sin(b) * r]; }));
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { const j = (k + 1) % 4;
    g.tri(P[i][k], P[i + 1][k], P[i + 1][j], cor); g.tri(P[i][k], P[i + 1][j], P[i][j], cor); }
  return g;
}

// ───────── construção ─────────
function criarBoneco(def, semente = 1) {
  const PELE = hex(def.pele), CAB = hex(def.cabelo.cor), CAM = hex(def.camisa.cor), CAL = hex(def.calca.cor), TEN = hex(def.tenis);
  const BAR = def.barba ? hex(def.barba.cor) : CAB, OLHO = [0.1, 0.065, 0.055], BOCA = [0.16, 0.07, 0.06];
  const fem = !!def.feminino, ac = def.acessorios || [];
  const r = {}; // juntas
  const raiz = new No(); r.raiz = raiz;
  const sombra = raiz.add(new No(superForma({ rx: 0.24, ry: 0.002, rz: 0.17, su: 12, sv: 2, ph: 2, pv: 2, cor: [0, 0, 0] }), { alfa: 0.35 }));
  sombra.pos = [0, 0.004, 0]; r.sombra = sombra;
  const corpo = raiz.add(new No()); corpo.pos = [0, QUADRIL_Y, 0]; r.corpo = corpo;
  const tronco = corpo.add(new No()); r.tronco = tronco;

  // camisa / tronco
  const larg = fem ? 0.155 : 0.178;
  const estampa = def.camisa.estampa ? def.camisa.estampa.map(hex) : null;
  const corCamisa = (u, v, i, j) => estampa ? estampa[Math.floor(h2(i, j, semente) * estampa.length)] : CAM;
  const formaTronco = (p, u, v) => {
    const k = lerp(fem ? 0.84 : 0.88, 1, v) * (v > 0.78 ? lerp(1, 0.84, (v - 0.78) / 0.22) : 1);  // afina embaixo e nos ombros
    let z = p[2]; if (fem && v > 0.55 && v < 0.85 && p[2] > 0) z *= 1.12;
    return [p[0] * k, p[1], z];
  };
  if (def.camisa.curta) {
    tronco.add(new No(superForma({ rx: larg * 0.9, ry: 0.1, rz: 0.1, su: 8, sv: 3, ph: 3, pv: 3, cor: PELE, centro: [0, 0.1, 0], jitter: 0.03 })));
    tronco.add(new No(superForma({ rx: larg, ry: 0.13, rz: 0.115, su: 8, sv: 4, ph: 3, pv: 3.2, cor: CAM, corFn: estampa ? corCamisa : null,
      deform: formaTronco, centro: [0, 0.25, 0], jitter: 0.04 })));
  } else {
    tronco.add(new No(superForma({ rx: larg, ry: 0.2, rz: 0.12, su: 8, sv: 5, ph: 3, pv: 2.7, cor: CAM, corFn: estampa ? corCamisa : null,
      deform: formaTronco, centro: [0, 0.18, 0], jitter: 0.04 })));
  }
  if (def.calca.saia) {
    corpo.add(new No(superForma({ rx: 0.19, ry: 0.1, rz: 0.15, su: 8, sv: 3, ph: 2.4, pv: 6, cor: CAL, centro: [0, -0.06, 0],
      deform: (p, u, v) => [p[0] * lerp(1.15, 0.85, v), p[1], p[2] * lerp(1.15, 0.85, v)] })));
  }
  // pescoço e corrente
  const pesc = tronco.add(new No(membro({ h: 0.08, r0: 0.05, r1: 0.055, lados: 6, cor: PELE }))); pesc.pos = [0, 0.43, -0.005];
  if (ac.includes('corrente')) {
    const c = tronco.add(new No(toro(0.095, 0.011, 12, 4, hex(0xf5c542)), { emis: 0.25 })); c.pos = [0, 0.335, 0.045]; c.rot = [0.75, 0, 0];
    const m = tronco.add(new No(superForma({ rx: 0.025, ry: 0.03, rz: 0.01, su: 6, sv: 3, cor: hex(0xf5c542) }), { emis: 0.3 }));
    m.pos = [0, 0.255, 0.125];
  }

  // cabeça
  const cab = tronco.add(new No()); cab.pos = [0, CABECA_Y, 0]; cab.esc = [ESC_CABECA, ESC_CABECA, ESC_CABECA]; r.cabeca = cab;
  const HX = fem ? 0.14 : 0.15, HY = fem ? 0.18 : 0.19, HZ = 0.152;
  const cranio = (p, u, v) => { const k = v < 0.45 ? lerp(0.86, 1, v / 0.45) : 1; return [p[0] * k, p[1], p[2] * lerp(0.95, 1, v)]; };
  cab.add(new No(superForma({ rx: HX, ry: HY, rz: HZ, su: 10, sv: 8, ph: 2.9, pv: 2.5, cor: PELE, deform: cranio, centro: [0, 0.19, 0], jitter: 0.025 })));
  for (const s of [-1, 1]) { // orelhas
    const o = cab.add(new No(superForma({ rx: 0.022, ry: 0.045, rz: 0.035, su: 6, sv: 4, cor: escurecer(PELE, 0.93) })));
    o.pos = [s * (HX - 0.005), 0.18, -0.01];
    if (ac.includes('argolas')) {
      const a = cab.add(new No(toro(0.028, 0.005, 10, 3, hex(0xf5c542)), { emis: 0.3 })); a.pos = [s * (HX + 0.012), 0.11, -0.005]; a.rot = [0, 0, Math.PI / 2];
    }
  }
  const nariz = cab.add(new No(superForma({ rx: 0.024, ry: 0.032, rz: 0.03, su: 6, sv: 3, ph: 2.4, pv: 2.4, cor: escurecer(PELE, 0.95) })));
  nariz.pos = [0, 0.15, HZ - 0.002];
  r.olhos = []; r.sobr = [];
  for (const s of [-1, 1]) {
    const o = cab.add(new No(superForma({ rx: 0.015, ry: 0.021, rz: 0.012, su: 6, sv: 4, cor: OLHO })));
    o.pos = [s * 0.055, 0.205, HZ - 0.012]; r.olhos.push(o);
    const b = cab.add(new No(superForma({ rx: 0.036, ry: fem ? 0.007 : 0.011, rz: 0.012, su: 6, sv: 2, ph: 3, pv: 4, cor: def.barba ? BAR : CAB })));
    b.pos = [s * 0.06, 0.255, HZ - 0.006]; b.rot = [0, 0, s * -0.1]; b.base = b.pos[1]; r.sobr.push(b);
  }
  if (fem) { // cílios/olhos maiores e lábios
    r.olhos.forEach((o) => { o.esc = [1.1, 1.15, 1]; });
  }
  const boca = cab.add(new No(superForma({ rx: 0.034, ry: 0.012, rz: 0.012, su: 8, sv: 3, cor: fem ? hex(0xa8484e) : BOCA })));
  boca.pos = [0, 0.095, HZ - 0.01]; r.boca = boca;

  // barba e bigode
  const tb = def.barba && def.barba.tipo;
  if (tb === 'cheia' || tb === 'curta') {
    const cheia = tb === 'cheia', cor = cheia ? BAR : misturar(PELE, BAR, 0.55);
    const k = cheia ? 1.06 : 1.025;
    cab.add(new No(superForma({ rx: HX * k, ry: HY * (cheia ? 1.16 : 1.03), rz: HZ * (k + 0.01), su: 10, sv: 4, ph: 2.9, pv: 2.5,
      u0: -0.33, u1: 0.33, v0: 0, v1: 0.5, cor, centro: [0, cheia ? 0.175 : 0.188, 0.002], jitter: 0.06,
      deform: (p, u, v) => {
        p = cranio(p, u, v); if (v < 0.3) p[0] *= lerp(0.78, 1, v / 0.3); const fr = Math.max(0, Math.cos(u * Math.PI * 2));
        const lim = lerp(0.03, cheia ? -0.1 : -0.095, Math.pow(fr, 0.8));   // costeleta alta, frente na altura da boca
        return [p[0], Math.min(p[1], lim), p[2]];
      } })));
    boca.pos = [0, 0.095, HZ * k + 0.004];
  } else if (tb === 'cavanhaque') {
    const g = cab.add(new No(superForma({ rx: 0.05, ry: 0.05, rz: 0.03, su: 6, sv: 4, cor: BAR }))); g.pos = [0, 0.045, HZ - 0.03];
    boca.pos = [0, 0.095, HZ + 0.002];
  }
  if (def.bigode === 'enrolado' || def.bigode === 'grosso' || tb === 'cheia') {
    const cor = def.bigodeCor ? hex(def.bigodeCor) : BAR, enr = def.bigode === 'enrolado';
    for (const s of [-1, 1]) {
      const b = cab.add(new No(superForma({ rx: 0.048, ry: def.bigode === 'grosso' ? 0.02 : 0.016, rz: 0.018, su: 6, sv: 3, cor,
        deform: (p) => [p[0], p[1] * lerp(1, 0.55, Math.abs(p[0]) / 0.048 * (p[0] * s > 0 ? 1 : 0)), p[2]] })));
      b.pos = [s * 0.042, 0.123, boca.pos[2] + 0.004]; b.rot = [0, 0, s * 0.2];
      if (enr) {
        const p = cab.add(new No(superForma({ rx: 0.012, ry: 0.02, rz: 0.012, su: 6, sv: 3, cor }))); p.pos = [s * 0.087, 0.14, boca.pos[2] - 0.004]; p.rot = [0, 0, s * -0.5];
      }
    }
  }

  // cabelo
  const tc = def.cabelo.tipo;
  const calota = (frente) => superForma({ rx: HX * 1.045, ry: HY * 1.045, rz: HZ * 1.05, su: 10, sv: 4, ph: 2.9, pv: 2.5, v0: 0.6, v1: 1, cor: CAB,
    centro: [0, 0.19, -0.004], jitter: 0.02,
    deform: (p, u, v) => {
      const fr = Math.max(0, Math.cos(u * Math.PI * 2)); // 1 na frente
      const lim = lerp(0.0, frente, Math.pow(fr, 1.5));
      return [p[0], Math.max(p[1], lim), p[2]];
    } });
  if (tc === 'curto' || tc === 'penteado' || tc === 'rabo' || tc === 'longo' || tc === 'trancas' || tc === 'twists') {
    cab.add(new No(calota(tc === 'penteado' ? 0.13 : 0.125)));
    if (tc === 'penteado') { const t = cab.add(new No(superForma({ rx: HX * 0.95, ry: 0.06, rz: HZ * 1.05, su: 8, sv: 3, cor: CAB, jitter: 0.05 }))); t.pos = [0, 0.37, -0.01]; }
  } else if (tc === 'calvo') {
    cab.add(new No(superForma({ rx: HX * 1.05, ry: HY * 1.04, rz: HZ * 1.06, su: 8, sv: 3, ph: 2.9, pv: 2.5, u0: 0.18, u1: 0.82, v0: 0.42, v1: 0.82,
      cor: CAB, centro: [0, 0.19, -0.004], jitter: 0.05 })));
  }
  if (tc === 'rabo') {
    for (const s of [-1, 1]) { const m = cab.add(new No(superForma({ rx: 0.022, ry: 0.11, rz: 0.035, su: 6, sv: 4, cor: CAB, jitter: 0.06 }))); m.pos = [s * (HX - 0.005), 0.2, 0.06]; m.rot = [0, 0, s * 0.08]; }
    const coque = cab.add(new No(superForma({ rx: 0.06, ry: 0.05, rz: 0.06, su: 6, sv: 4, cor: CAB, jitter: 0.06 }))); coque.pos = [0, 0.39, -0.1];
    const rb = cab.add(new No()); rb.pos = [0, 0.39, -0.14]; r.rabo = rb;
    rb.add(new No(superForma({ rx: 0.045, ry: 0.13, rz: 0.045, su: 6, sv: 5, cor: CAB, centro: [0, -0.1, -0.02], jitter: 0.08,
      deform: (p, u, v) => [p[0] * lerp(0.5, 1, Math.sin(v * Math.PI)), p[1], p[2] - 0.04 * (1 - v)] })));
    const el = cab.add(new No(toro(0.03, 0.008, 8, 3, hex(0xff2d95)))); el.pos = [0, 0.39, -0.145]; el.rot = [Math.PI / 2 - 0.4, 0, 0];
  }
  if (tc === 'longo') {
    const t = cab.add(new No(superForma({ rx: HX * 1.06, ry: 0.2, rz: 0.07, su: 8, sv: 4, ph: 3, pv: 3, cor: CAB, jitter: 0.06,
      deform: (p, u, v) => [p[0] * lerp(0.85, 1, v), p[1], p[2]] }))); t.pos = [0, 0.1, -0.11]; r.rabo = t;
    for (const s of [-1, 1]) { const m = cab.add(new No(superForma({ rx: 0.03, ry: 0.15, rz: 0.06, su: 6, sv: 4, cor: CAB, jitter: 0.06 }))); m.pos = [s * (HX + 0.01), 0.12, 0.0]; }
  }
  if (tc === 'trancas') {
    r.trancas = [];
    for (let i = 0; i < 7; i++) {
      const a = [1.25, 1.75, 2.3, Math.PI, -2.3, -1.75, -1.25][i], tr = cab.add(new No(membro({ h: 0.3, r0: 0.018, r1: 0.012, lados: 4, cor: CAB })));
      tr.pos = [Math.sin(a) * HX * 0.95, 0.3, Math.cos(a) * HZ * 0.95 - 0.04]; tr.rot = [Math.cos(a) * -0.35 - 0.15, 0, Math.sin(a) * 0.3];
      tr.base = tr.rot.slice(); r.trancas.push(tr);
    }
  }
  if (tc === 'twists') {
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2 + 0.2, rr = 0.6 + 0.4 * h2(i, 3, semente);
      const t = cab.add(new No(membro({ h: 0.07, r0: 0.012, r1: 0.022, lados: 4, cor: CAB })));
      t.pos = [Math.sin(a) * HX * 0.7 * rr, 0.37, Math.cos(a) * HZ * 0.7 * rr - 0.01]; t.rot = [Math.PI - Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5];
    }
  }

  // acessórios de cabeça
  if (ac.includes('oculos') || ac.includes('oculos_sol')) {
    const sol = ac.includes('oculos_sol'), arm = hex(sol ? 0x111111 : 0x3a2a20);
    for (const s of [-1, 1]) {
      const lente = sol ? superForma({ rx: 0.04, ry: 0.028, rz: 0.008, su: 6, sv: 3, ph: 4, pv: 4, cor: hex(0x0d0d14) }) : toro(0.032, 0.005, 8, 3, arm);
      const l = cab.add(new No(lente, { emis: 0 })); l.pos = [s * 0.057, 0.205, HZ + 0.012]; if (!sol) l.rot = [Math.PI / 2, 0, 0];
      const h = cab.add(new No(caixa(0.006, 0.008, 0.17, arm))); h.pos = [s * (HX + 0.004), 0.215, 0.07];
    }
    const p = cab.add(new No(caixa(0.03, 0.008, 0.008, arm))); p.pos = [0, 0.215, HZ + 0.012];
  }
  if (ac.includes('fones')) {
    const f = hex(0x202024), arco = cab.add(new No(arcoGeo(HX + 0.03, 0.013, 10, f))); arco.pos = [0, 0.19, 0]; arco.esc = [1, 1.3, 1];
    for (const s of [-1, 1]) { const c = cab.add(new No(superForma({ rx: 0.03, ry: 0.055, rz: 0.055, su: 6, sv: 4, ph: 3, pv: 3, cor: f }))); c.pos = [s * (HX + 0.025), 0.18, -0.005]; }
    const luz = cab.add(new No(superForma({ rx: 0.006, ry: 0.012, rz: 0.012, su: 4, sv: 2, cor: hex(0x00f0ff) }), { emis: 1 })); luz.pos = [HX + 0.057, 0.18, -0.005];
  }

  // braços
  const manga = def.camisa.manga;
  const tatu = def.tatuagem ? (i) => (i % 3 === 0 ? escurecer(PELE, 0.55) : PELE) : null;
  for (const [lado, s] of [['E', 1], ['D', -1]]) {
    const om = tronco.add(new No()); om.pos = [s * (larg - 0.018), OMBRO_Y, 0]; r['braco' + lado] = om;
    if (manga === 'regata') {
      om.add(new No(superForma({ rx: 0.05, ry: 0.05, rz: 0.05, su: 6, sv: 4, cor: PELE })));
      om.add(new No(membro({ h: BRACO, r0: 0.05, r1: 0.044, lados: 6, cor: PELE, corFn: tatu })));
    } else {
      if (manga === 'curta') {
        const mg = om.add(new No(membro({ h: 0.13, r0: 0.05, r1: 0.064, lados: 6, cor: estampa ? estampa[1] : CAM }))); mg.pos = [0, 0.03, 0];
        const pele = om.add(new No(membro({ h: BRACO - 0.08, r0: 0.046, r1: 0.044, lados: 6, cor: PELE, corFn: tatu }))); pele.pos = [0, -0.08, 0];
      } else om.add(new No(membro({ h: BRACO, r0: 0.062, r1: 0.056, lados: 6, cor: CAM })));
    }
    const cot = om.add(new No()); cot.pos = [0, -BRACO, 0]; r['cotovelo' + lado] = cot;
    cot.add(new No(superForma({ rx: 0.045, ry: 0.045, rz: 0.045, su: 6, sv: 3, cor: manga === 'longa' ? CAM : PELE })));
    cot.add(new No(membro({ h: ANTEBRACO, r0: manga === 'longa' ? 0.055 : 0.044, r1: manga === 'longa' ? 0.05 : 0.04, lados: 6,
      cor: manga === 'longa' ? CAM : PELE, corFn: manga === 'longa' ? null : tatu })));
    const mao = cot.add(new No(superForma({ rx: 0.036, ry: 0.05, rz: 0.042, su: 6, sv: 4, ph: 3, pv: 2.6, cor: PELE, jitter: 0.06 })));
    mao.pos = [0, -ANTEBRACO - 0.035, 0.004]; r['mao' + lado] = mao;
  }

  // pernas
  for (const [lado, s] of [['E', 1], ['D', -1]]) {
    const q = corpo.add(new No()); q.pos = [s * 0.075, 0, 0]; r['perna' + lado] = q;
    if (def.calca.saia) q.add(new No(membro({ h: COXA + 0.02, r0: 0.055, r1: 0.048, lados: 6, cor: PELE })));
    else q.add(new No(membro({ h: COXA + 0.02, r0: 0.075, r1: 0.068, lados: 6, cor: CAL })));
    const j = q.add(new No()); j.pos = [0, -COXA, 0]; r['joelho' + lado] = j;
    const curta = def.calca.curta || def.calca.saia;
    if (def.calca.curta && !def.calca.saia) { const b = j.add(new No(membro({ h: 0.03, r0: 0.07, r1: 0.07, lados: 6, cor: CAL }))); b.pos = [0, 0.02, 0]; }
    j.add(new No(membro({ h: CANELA, r0: curta ? 0.045 : 0.068, r1: curta ? 0.04 : 0.064, lados: 6, cor: curta ? PELE : CAL })));
    const pe = j.add(new No()); pe.pos = [0, -CANELA, 0]; r['pe' + lado] = pe;
    pe.add(new No(superForma({ rx: 0.062, ry: 0.05, rz: 0.11, su: 8, sv: 4, ph: 3, pv: 2.8, cor: TEN, centro: [0, -0.045, 0.035], jitter: 0.05,
      deform: (p, u, v) => [p[0], p[1] * (p[2] > 0 ? lerp(1, 0.6, p[2] / 0.11) : 1), p[2]] })));
    pe.add(new No(superForma({ rx: 0.067, ry: 0.016, rz: 0.115, su: 8, sv: 2, ph: 3, pv: 6, cor: misturar(TEN, [1, 1, 1], 0.5), centro: [0, -0.085, 0.037] })));
  }

  r.def = def; r.semente = semente;
  return r;
}

// ───────── poses e animação ─────────
// Pose = objeto com campos opcionais; aplicarPose zera tudo e aplica.
function poseNeutra() {
  return { x: 0, y: 0, z: 0, ry: 0, esc: 1, bob: 0, tronco: [0, 0, 0], cabeca: [0, 0, 0],
    bracoE: [0, 0, 0.14], cotoveloE: [0, 0, 0], bracoD: [0, 0, -0.14], cotoveloD: [0, 0, 0],
    pernaE: [0, 0, 0], joelhoE: 0, pernaD: [0, 0, 0], joelhoD: 0, peE: 0, peD: 0, boca: 0, piscar: 0, sobr: 0, rabo: 0 };
}
function aplicarPose(r, p) {
  r.raiz.pos = [p.x, p.y, p.z]; r.raiz.rot = [0, p.ry, 0]; r.raiz.esc = [p.esc, p.esc, p.esc];
  r.sombra.pos[1] = 0.004 - p.y; r.sombra.esc = [1 / Math.max(1 + p.y * 1.5, 0.3), 1, 1 / Math.max(1 + p.y * 1.5, 0.3)];
  r.sombra.alfa = 0.35 / (1 + p.y * 2);
  r.corpo.pos[1] = QUADRIL_Y + p.bob;
  r.tronco.rot = p.tronco; r.cabeca.rot = p.cabeca;
  r.bracoE.rot = p.bracoE; r.cotoveloE.rot = p.cotoveloE; r.bracoD.rot = p.bracoD; r.cotoveloD.rot = p.cotoveloD;
  r.pernaE.rot = p.pernaE; r.joelhoE.rot = [p.joelhoE, 0, 0]; r.pernaD.rot = p.pernaD; r.joelhoD.rot = [p.joelhoD, 0, 0];
  r.peE.rot = [p.peE, 0, 0]; r.peD.rot = [p.peD, 0, 0];
  r.boca.esc = [1 - p.boca * 0.15, 1 + p.boca * 2.4, 1];
  r.olhos.forEach((o) => { o.esc[1] = (r.def.feminino ? 1.15 : 1) * Math.max(0.08, 1 - p.piscar); });
  r.sobr.forEach((b) => { b.pos[1] = b.base + p.sobr * 0.018; });
  if (r.rabo) r.rabo.rot = [p.rabo * 0.4, 0, p.rabo * 0.3];
  if (r.trancas) r.trancas.forEach((t, i) => { t.rot = [t.base[0] + p.rabo * 0.25, 0, t.base[2] + Math.sin(i + p.rabo * 3) * p.rabo * 0.15]; });
}
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

// misturar duas poses (para transições)
function mixPose(a, b, t) {
  const o = {};
  for (const k in a) o[k] = Array.isArray(a[k]) ? a[k].map((x, i) => lerp(x, b[k][i], t)) : lerp(a[k], b[k], t);
  return o;
}

const ANIM = {
  // respiração, balanço e piscadas — base de tudo
  vivo(p, t, s = 0) {
    p.tronco = add3(p.tronco, [0.02 * Math.sin(t * 2.1), 0.04 * ruido(t * 0.4, s), 0.015 * ruido(t * 0.5, s + 3)]);
    p.bob += 0.004 * Math.sin(t * 2.1);
    p.cabeca = add3(p.cabeca, [0.03 * ruido(t * 0.6, s + 1), 0.1 * ruido(t * 0.35, s + 2), 0.03 * ruido(t * 0.45, s + 4)]);
    p.bracoE = add3(p.bracoE, [0.04 * ruido(t * 0.5, s + 5), 0, 0.02 * Math.sin(t * 2.1)]);
    p.bracoD = add3(p.bracoD, [0.04 * ruido(t * 0.5, s + 6), 0, -0.02 * Math.sin(t * 2.1)]);
    p.cotoveloE = add3(p.cotoveloE, [-0.08 - 0.05 * ruido(t * 0.4, s + 7), 0, 0]);
    p.cotoveloD = add3(p.cotoveloD, [-0.08 - 0.05 * ruido(t * 0.4, s + 8), 0, 0]);
    const per = 3.1 + (s % 3) * 0.4, f = ((t + s * 0.77) % per) / per;
    p.piscar = f > 0.955 ? Math.sin((f - 0.955) / 0.045 * Math.PI) : 0;
    p.rabo += 0.15 * Math.sin(t * 2.1 + 1);
    return p;
  },
  falar(p, t, s = 0, gesto = 1) {
    const sil = Math.abs(Math.sin(t * 11 + Math.sin(t * 3.3) * 2));
    const pausa = ruido(t * 1.3, s + 9) > -0.55 ? 1 : 0;
    p.boca = Math.max(p.boca, sil * pausa * 0.9);
    p.cabeca = add3(p.cabeca, [0.05 * Math.sin(t * 5.5) * pausa, 0.06 * ruido(t * 0.9, s), 0.04 * ruido(t * 0.7, s + 1)]);
    p.sobr = Math.max(p.sobr, 0.6 * Math.max(0, ruido(t * 1.1, s + 2)));
    if (gesto) {
      const g = 0.5 + 0.5 * ruido(t * 0.8, s + 3);
      p.bracoD = add3(p.bracoD, [-0.55 * g * gesto - 0.1 * Math.sin(t * 5), 0.3 * g, -0.15 * g]);
      p.cotoveloD = add3(p.cotoveloD, [-1.1 * g * gesto, 0, 0]);
      const g2 = 0.5 + 0.5 * ruido(t * 0.7, s + 4);
      p.bracoE = add3(p.bracoE, [-0.35 * g2 * gesto, -0.2 * g2, 0.1 * g2]);
      p.cotoveloE = add3(p.cotoveloE, [-0.8 * g2 * gesto, 0, 0]);
    }
    return p;
  },
  acenar(p, t, lado = 'D', k = 1) {
    const s = lado === 'D' ? -1 : 1;
    p['braco' + lado] = [lerp(p['braco' + lado][0], -0.2, k), 0, lerp(p['braco' + lado][2], s * 2.5, k)];
    p['cotovelo' + lado] = [0, 0, s * (0.3 + 0.45 * Math.sin(t * 12)) * k];
    p.tronco = add3(p.tronco, [0, 0, -s * 0.06 * k]);
    p.cabeca = add3(p.cabeca, [0, 0, s * 0.08 * k]);
    p.sobr = Math.max(p.sobr, k * 0.7);
    return p;
  },
  bracosCruzados(p, k = 1) { // antebraços na horizontal, um por cima do outro na frente do peito
    p.bracoE = mixArr(p.bracoE, [-0.32, 0, 0.16], k); p.cotoveloE = mixArr(p.cotoveloE, [-1.55, -1.25, 0], k);
    p.bracoD = mixArr(p.bracoD, [-0.42, 0, -0.16], k); p.cotoveloD = mixArr(p.cotoveloD, [-1.7, 1.25, 0], k);
    return p;
  },
  maosCintura(p, k = 1) { // cotovelos pra fora, mãos no quadril
    p.bracoE = mixArr(p.bracoE, [0.12, 0, 0.8], k); p.cotoveloE = mixArr(p.cotoveloE, [0, 0, -1.75], k);
    p.bracoD = mixArr(p.bracoD, [0.12, 0, -0.8], k); p.cotoveloD = mixArr(p.cotoveloD, [0, 0, 1.75], k);
    return p;
  },
  apontar(p, lado = 'D', alvo = [0, 0], k = 1) { // alvo: [ângulo horizontal, vertical]
    p['braco' + lado] = mixArr(p['braco' + lado], [-1.5 - alvo[1], alvo[0], lado === 'D' ? -0.15 : 0.15], k);
    p['cotovelo' + lado] = mixArr(p['cotovelo' + lado], [-0.1, 0, 0], k);
    p.cabeca = add3(p.cabeca, [0, alvo[0] * 0.4 * k, 0]);
    return p;
  },
  comemorar(p, t, k = 1) {
    const b = Math.abs(Math.sin(t * 7));
    p.bracoE = mixArr(p.bracoE, [-0.2, 0, 2.5 + 0.2 * b], k); p.bracoD = mixArr(p.bracoD, [-0.2, 0, -2.5 - 0.2 * b], k);
    p.cotoveloE = mixArr(p.cotoveloE, [0, 0, 0.4 * b], k); p.cotoveloD = mixArr(p.cotoveloD, [0, 0, -0.4 * b], k);
    p.boca = Math.max(p.boca, 0.8 * k); p.sobr = Math.max(p.sobr, k);
    return p;
  },
  dancar(p, t, bpm = 104, s = 0, k = 1) {
    const b = t * bpm / 60 * Math.PI * 2, bt = Math.abs(Math.sin(b / 2));
    p.bob -= 0.035 * bt * k; p.joelhoE += 0.4 * bt * k; p.joelhoD += 0.4 * bt * k;
    p.pernaE = add3(p.pernaE, [-0.2 * bt * k, 0, 0]); p.pernaD = add3(p.pernaD, [-0.2 * bt * k, 0, 0]);
    p.tronco = add3(p.tronco, [0.08 * bt * k, 0.25 * Math.sin(b / 4) * k, 0.12 * Math.sin(b / 2) * k]);
    p.cabeca = add3(p.cabeca, [0.15 * bt * k, 0, -0.1 * Math.sin(b / 2) * k]);
    p.bracoE = add3(p.bracoE, [(-0.9 - 0.5 * Math.sin(b / 2 + s)) * k, 0, 0.3 * k]);
    p.bracoD = add3(p.bracoD, [(-0.9 + 0.5 * Math.sin(b / 2 + s)) * k, 0, -0.3 * k]);
    p.cotoveloE = add3(p.cotoveloE, [-1.3 * k, 0, 0]); p.cotoveloD = add3(p.cotoveloD, [-1.3 * k, 0, 0]);
    p.rabo += 0.6 * Math.sin(b / 2) * k;
    return p;
  },
  andar(p, t, vel = 1, k = 1) {
    const f = t * 7 * vel, sw = Math.sin(f);
    p.pernaE = add3(p.pernaE, [0.55 * sw * k, 0, 0]); p.pernaD = add3(p.pernaD, [-0.55 * sw * k, 0, 0]);
    p.joelhoE += Math.max(0, -Math.cos(f)) * 0.7 * k; p.joelhoD += Math.max(0, Math.cos(f)) * 0.7 * k;
    p.bracoE = add3(p.bracoE, [-0.45 * sw * k, 0, 0]); p.bracoD = add3(p.bracoD, [0.45 * sw * k, 0, 0]);
    p.cotoveloE = add3(p.cotoveloE, [-0.3 * k, 0, 0]); p.cotoveloD = add3(p.cotoveloD, [-0.3 * k, 0, 0]);
    p.bob += 0.02 * Math.abs(Math.cos(f)) * k; p.tronco = add3(p.tronco, [0.05 * k, 0.08 * sw * k, 0]);
    p.rabo += 0.4 * sw * k;
    return p;
  },
  digitar(p, t, k = 1) {
    p.bracoE = mixArr(p.bracoE, [-0.45, 0, 0.12], k); p.cotoveloE = mixArr(p.cotoveloE, [-1.15 + 0.1 * Math.sin(t * 19), -0.35, 0], k);
    p.bracoD = mixArr(p.bracoD, [-0.45, 0, -0.12], k); p.cotoveloD = mixArr(p.cotoveloD, [-1.15 + 0.1 * Math.sin(t * 17 + 1), 0.35, 0], k);
    p.cabeca = add3(p.cabeca, [0.18 * k, 0, 0]); p.tronco = add3(p.tronco, [0.12 * k, 0, 0]);
    return p;
  },
  encolher(p, t, k = 1) { // "sei lá" — ombros e palmas pra cima
    p.bracoE = mixArr(p.bracoE, [-0.1, 0, 0.35], k); p.cotoveloE = mixArr(p.cotoveloE, [-1.35, 0.7, 0], k);
    p.bracoD = mixArr(p.bracoD, [-0.1, 0, -0.35], k); p.cotoveloD = mixArr(p.cotoveloD, [-1.35, -0.7, 0], k);
    p.cabeca = add3(p.cabeca, [0, 0, 0.18 * k]); p.sobr = Math.max(p.sobr, k); return p;
  },
  // salto de entrada: cai do alto com amortecimento (t em segundos desde o início)
  entradaPulo(p, t, dur = 0.7) {
    if (t < dur) { const u = t / dur; p.y += 2.2 * (1 - u) * (1 - u); p.esc *= 1; p.pernaE[0] -= 0.4 * (1 - u); p.joelhoE += 0.8 * (1 - u); }
    else if (t < dur + 0.35) { const u = (t - dur) / 0.35, sq = Math.sin(u * Math.PI); p.bob -= 0.07 * sq; p.joelhoE += 0.9 * sq; p.joelhoD += 0.9 * sq;
      p.pernaE[0] -= 0.45 * sq; p.pernaD[0] -= 0.45 * sq; p.bracoE[2] += 0.6 * sq; p.bracoD[2] -= 0.6 * sq; }
    return p;
  },
  surgir(p, t, dur = 0.45) { p.esc *= easeOutBack(t / dur); return p; },
};
function mixArr(a, b, k) { return a.map((x, i) => lerp(x, b[i], k)); }

Object.assign(window, { ELENCO, criarBoneco, poseNeutra, aplicarPose, mixPose, ANIM, add3 });
