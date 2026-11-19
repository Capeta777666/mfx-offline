// elenco-gta6.js — "O GTA 6 saiu: conheça quem manda em Leonida"
// Cada cena: dur (s), preset de luz, montar() -> { raiz, quadro(t) => câmera }
'use strict';

// câmera: lista de planos [{ate, de:[olho, alvo, fov], para:[olho, alvo, fov]}] — corte seco entre planos
function camera(planos, t) {
  let ini = 0;
  for (const p of planos) {
    if (t <= p.ate || p === planos[planos.length - 1]) {
      const k = easeInOut((t - ini) / (p.ate - ini)), a = p.de, b = p.para || p.de;
      return { olho: a[0].map((x, i) => lerp(x, b[0][i], k)), alvo: a[1].map((x, i) => lerp(x, b[1][i], k)), fov: lerp(a[2], b[2], k) };
    }
    ini = p.ate;
  }
}
const janela = (t, a, b, f = 0.3) => suave((t - a) / f) * (1 - suave((t - b) / f)); // 0→1→0 entre a e b

function ruaNoite(raiz, opc = {}) {
  raiz.add(chao(0x14061f));
  const pr = predios(11, opc.semente || 7, -9); raiz.add(pr);
  [[-3.2, -3, 3.4], [3.4, -3.5, 3.1], [-5.5, -5.5, 3.8], [5.8, -6, 3.6], [-1.6, -7, 3.2], [2.2, -7.5, 3.5]].forEach(([x, z, h], i) => {
    const p = raiz.add(palmeira(h, i + 3)); p.pos = [x, 0, z];
  });
  return raiz;
}

function ator(raiz, quem, s) { const b = criarBoneco(ELENCO[quem], s); raiz.add(b.raiz); return b; }

const CENAS = [
  { nome: 'gancho', dur: 4.5, preset: 'noite', montar() {
    const raiz = ruaNoite(new No()), car = carro(COR.rosa); raiz.add(car.raiz);
    const lu = ator(raiz, 'lucia', 2), ja = ator(raiz, 'jason', 1);
    return { raiz, quadro(t) {
      const kc = easeInOut(t / 1.3);
      car.raiz.pos = [lerp(7, 0, kc), 0, -0.9]; car.raiz.rot = [0, -Math.PI / 2, 0];
      car.rodas.forEach((w) => { w.rot = [-(1 - kc) * t * 30, 0, 0]; });
      [[lu, 0.5, 1.2], [ja, -0.5, 1.45]].forEach(([b, x, t0], i) => {
        const p = poseNeutra(); p.x = x; p.z = 0.5; ANIM.vivo(p, t, i);
        if (t < t0) { p.esc = 0; } else { ANIM.entradaPulo(p, t - t0, 0.55); }
        const k = suave((t - t0 - 0.9) / 0.4);
        if (i === 0) { ANIM.maosCintura(p, k); p.tronco[2] += 0.08 * k; p.cabeca[2] -= 0.1 * k; }
        else { ANIM.bracosCruzados(p, k); p.cabeca[0] -= 0.08 * k; }
        p.ry = (i === 0 ? -0.25 : 0.25) * k;
        aplicarPose(b, p);
      });
      return camera([{ ate: 2.4, de: [[1.6, 0.4, 6.4], [0, 0.75, 0], 42], para: [[0.8, 0.6, 5.2], [0, 0.85, 0], 40] },
        { ate: 4.5, de: [[0.3, 0.85, 4.0], [0, 0.95, 0], 38], para: [[0.1, 0.9, 3.7], [0, 0.95, 0], 38] }], t);
    } };
  } },

  { nome: 'apresentador', dur: 5, preset: 'noite', montar() {
    const raiz = ruaNoite(new No(), { semente: 11 }), h = ator(raiz, 'apresentador', 5);
    return { raiz, quadro(t) {
      const p = poseNeutra(), kw = easeInOut(t / 1.8);
      p.x = lerp(-2.4, 0, kw); p.ry = lerp(Math.PI / 2, 0, suave((t - 1.4) / 0.5));
      ANIM.vivo(p, t, 5);
      if (t < 1.8) ANIM.andar(p, t, 1, 1 - suave((t - 1.5) / 0.3));
      ANIM.acenar(p, t, 'D', janela(t, 1.9, 3.1, 0.25));
      if (t > 3.0) ANIM.falar(p, t, 5, suave((t - 3.0) / 0.3));
      aplicarPose(h, p);
      return camera([{ ate: 2.6, de: [[0, 0.95, 3.4], [-0.4, 0.82, 0], 34], para: [[0, 0.95, 3.0], [0, 0.82, 0], 34] },
        { ate: 5, de: [[0.35, 1.0, 2.5], [0, 1.08, 0], 32], para: [[0.2, 1.0, 2.3], [0, 1.1, 0], 32] }], t);
    } };
  } },

  { nome: 'lucia', dur: 7, preset: 'rosa', montar() {
    const raiz = new No(); raiz.add(chao(0x2a0a3a));
    const b = ator(raiz, 'lucia', 2);
    return { raiz, quadro(t) {
      const p = poseNeutra(); ANIM.vivo(p, t, 2); ANIM.surgir(p, t, 0.45);
      p.ry = (1 - easeInOut(t / 1.1)) * Math.PI * 2;
      ANIM.maosCintura(p, janela(t, 1.0, 2.6));
      ANIM.apontar(p, 'D', [0, 0.05], janela(t, 2.7, 4.3, 0.25)); p.sobr = Math.max(p.sobr, janela(t, 2.7, 4.3));
      const kc = suave((t - 4.4) / 0.4); ANIM.bracosCruzados(p, kc); p.cabeca[2] += 0.12 * kc; p.cabeca[1] -= 0.15 * kc;
      p.tronco[2] -= 0.05 * kc; p.rabo += janela(t, 4.4, 5) * Math.sin(t * 9) * 0.8;
      aplicarPose(b, p);
      return camera([{ ate: 2.6, de: [[0, 0.8, 3.6], [0, 0.9, 0], 32], para: [[0, 0.85, 3.2], [0, 0.92, 0], 32] },
        { ate: 4.4, de: [[0.15, 0.95, 2.3], [0, 1.1, 0], 32], para: [[0.05, 0.95, 2.1], [0, 1.12, 0], 32] },
        { ate: 7, de: [[-1.3, 0.9, 2.8], [0, 0.95, 0], 32], para: [[1.3, 0.9, 2.8], [0, 0.95, 0], 32] }], t);
    } };
  } },

  { nome: 'jason', dur: 7, preset: 'ciano', montar() {
    const raiz = new No(); raiz.add(chao(0x061626));
    const b = ator(raiz, 'jason', 1);
    return { raiz, quadro(t) {
      const p = poseNeutra(); ANIM.vivo(p, t, 1); ANIM.entradaPulo(p, t, 0.6);
      const kc = janela(t, 1.1, 3.6); ANIM.bracosCruzados(p, kc); p.cabeca[0] += 0.12 * Math.max(0, Math.sin((t - 1.6) * 6)) * janela(t, 1.6, 2.6, 0.1);
      ANIM.encolher(p, t, janela(t, 3.8, 5.2, 0.25));
      const kf = suave((t - 5.3) / 0.35); ANIM.maosCintura(p, kf); p.cabeca[1] += 0.2 * kf;
      aplicarPose(b, p);
      return camera([{ ate: 2.5, de: [[0, 0.5, 3.4], [0, 0.92, 0], 36], para: [[0, 0.6, 3.2], [0, 0.92, 0], 36] },
        { ate: 5.2, de: [[-0.2, 0.95, 2.4], [0, 1.12, 0], 32], para: [[-0.1, 0.95, 2.25], [0, 1.12, 0], 32] },
        { ate: 7, de: [[1.0, 0.75, 3.2], [0, 0.92, 0], 34], para: [[-0.6, 0.85, 3.4], [0, 0.92, 0], 34] }], t);
    } };
  } },

  { nome: 'dupla', dur: 4, preset: 'noite', montar() {
    const raiz = ruaNoite(new No(), { semente: 3 }), car = carro(COR.rosa); raiz.add(car.raiz); car.raiz.pos = [0, 0, -1.4]; car.raiz.rot = [0, -Math.PI / 2, 0];
    const ja = ator(raiz, 'jason', 1), lu = ator(raiz, 'lucia', 2);
    return { raiz, quadro(t) {
      [[ja, -0.42, 1], [lu, 0.42, -1]].forEach(([b, x, s], i) => {
        const p = poseNeutra(); p.x = x; ANIM.vivo(p, t, i + 7);
        const vira = 1 - suave((t - 2.4) / 0.4); p.ry = s * 0.9 * vira;
        const soco = janela(t, 0.6, 2.2, 0.25), lado = s > 0 ? 'D' : 'E';
        if (s > 0) { p.bracoE = add3(p.bracoE, [-1.25 * soco, 0.2 * soco, -0.05 * soco]); }
        else { p.bracoD = add3(p.bracoD, [-1.25 * soco, -0.2 * soco, 0.05 * soco]); }
        if (t > 2.6) { if (i === 1) ANIM.apontar(p, 'D', [0, 0.05], suave((t - 2.6) / 0.3)); else ANIM.bracosCruzados(p, suave((t - 2.6) / 0.3)); }
        p.sobr = Math.max(p.sobr, janela(t, 1.2, 2.0));
        aplicarPose(b, p);
      });
      return camera([{ ate: 2.3, de: [[0, 0.9, 2.9], [0, 0.98, 0], 36], para: [[0, 0.95, 2.6], [0, 0.98, 0], 36] },
        { ate: 4, de: [[0.4, 0.6, 3.4], [0, 0.92, 0], 38], para: [[0.1, 0.7, 3.1], [0, 0.92, 0], 38] }], t);
    } };
  } },

  { nome: 'cal', dur: 7, preset: 'ciano', montar() {
    const raiz = new No(); raiz.add(chao(0x061626)); const m = mesaCal(); raiz.add(m); m.pos = [0, 0, 0.42]; m.rot = [0, Math.PI, 0];
    const b = ator(raiz, 'cal', 4);
    return { raiz, quadro(t) {
      const p = poseNeutra(); ANIM.vivo(p, t, 4);
      const kd = 1 - suave((t - 3.3) / 0.3); ANIM.digitar(p, t, kd);
      const susto = suave((t - 3.3) / 0.15); p.sobr = Math.max(p.sobr, susto); p.boca = Math.max(p.boca, 0.7 * janela(t, 3.4, 4.6, 0.15));
      p.bob += 0.03 * janela(t, 3.3, 3.6, 0.1);
      ANIM.encolher(p, t, janela(t, 4.6, 6.6, 0.3));
      if (t > 4.6) ANIM.falar(p, t, 4, 0);
      m.led.visivel = Math.sin(t * 12) > 0;
      aplicarPose(b, p);
      return camera([{ ate: 3.3, de: [[-1.4, 1.35, -0.9], [0.05, 0.8, 0.3], 40], para: [[-1.2, 1.3, -0.7], [0.05, 0.8, 0.3], 40] },
        { ate: 7, de: [[1.7, 1.1, 1.9], [0.15, 1.05, 0], 34], para: [[1.55, 1.1, 1.8], [0.15, 1.05, 0], 34] }], t);
    } };
  } },

  { nome: 'brian', dur: 6, preset: 'mar', montar() {
    const raiz = new No(); raiz.add(chao(0x0b2a3a)); const c = cais(8); raiz.add(c); c.pos = [0, 0, -1];
    const bt = barco(); raiz.add(bt); bt.pos = [-1.4, -0.05, -1.6]; bt.rot = [0, 0.3, 0];
    const p1 = raiz.add(palmeira(3.4, 9)); p1.pos = [2.2, 0, -2.5];
    const b = ator(raiz, 'brian', 6);
    return { raiz, quadro(t) {
      bt.pos[1] = -0.05 + 0.03 * Math.sin(t * 1.8); bt.rot[2] = 0.03 * Math.sin(t * 1.4);
      const p = poseNeutra(); p.z = 0.3; ANIM.vivo(p, t, 6);
      const ka = janela(t, 0.3, 2.6, 0.35); ANIM.acenar(p, t * 0.6, 'E', ka);
      const kh = suave((t - 2.8) / 0.4); ANIM.maosCintura(p, kh);
      const riso = janela(t, 3.4, 5.4, 0.3); p.cabeca[0] -= 0.25 * riso; p.boca = Math.max(p.boca, riso * (0.5 + 0.5 * Math.abs(Math.sin(t * 14))));
      p.tronco[0] -= 0.08 * riso; p.bob += 0.01 * riso * Math.sin(t * 14);
      aplicarPose(b, p);
      return camera([{ ate: 3.0, de: [[0.8, 0.9, 3.8], [-0.2, 0.92, 0], 36], para: [[0.4, 0.9, 3.4], [-0.1, 0.92, 0], 36] },
        { ate: 6, de: [[0.1, 1.0, 2.6], [0, 1.12, 0.3], 32], para: [[-0.15, 1.0, 2.45], [0, 1.12, 0.3], 32] }], t);
    } };
  } },

  { nome: 'boobie-drequan', dur: 7, preset: 'clube', montar() {
    const raiz = new No(); raiz.add(chao(0x12051f)); const cl = clube(); raiz.add(cl);
    const bo = ator(raiz, 'boobie', 8), dq = ator(raiz, 'drequan', 9);
    return { raiz, quadro(t) {
      cl.bola.rot = [0, t * 1.5, 0]; cl.cones.forEach((c, i) => { c.rot = [0.35 * Math.sin(t * 1.3 + i * 2), 0, 0.45 * Math.sin(t * 1.1 + i)]; });
      cl.aneis.forEach((a, i) => { a.esc = [1 + 0.05 * Math.sin(t * 7 + i), 1, 1 + 0.05 * Math.sin(t * 7 + i)]; });
      const p = poseNeutra(); p.x = -0.45; p.ry = 0.2; ANIM.vivo(p, t, 8); ANIM.bracosCruzados(p, 1);
      p.cabeca[0] += 0.1 * Math.max(0, Math.sin(t * 104 / 60 * Math.PI)); aplicarPose(bo, p);
      const q = poseNeutra(); q.x = 0.5; q.ry = -0.25; ANIM.vivo(q, t, 9);
      ANIM.falar(q, t, 9, 1); q.boca *= 0.6; ANIM.dancar(q, t, 104, 0, 0.35 + 0.65 * suave((t - 4.8) / 0.3)); aplicarPose(dq, q);
      return camera([{ ate: 2.6, de: [[0, 1.0, 3.8], [0, 1.02, 0], 38], para: [[0, 1.0, 3.4], [0, 1.02, 0], 38] },
        { ate: 4.8, de: [[-0.35, 1.0, 2.4], [-0.45, 1.12, 0], 32], para: [[-0.4, 1.0, 2.25], [-0.45, 1.12, 0], 32] },
        { ate: 7, de: [[0.65, 1.0, 2.6], [0.5, 1.08, 0], 34], para: [[0.4, 1.0, 2.7], [0.5, 1.08, 0], 34] }], t);
    } };
  } },

  { nome: 'real-dimez', dur: 6, preset: 'clube', montar() {
    const raiz = new No(); raiz.add(chao(0x12051f)); const cl = clube(); raiz.add(cl);
    const a = ator(raiz, 'baeluxe', 10), b = ator(raiz, 'roxy', 11);
    return { raiz, quadro(t) {
      cl.bola.rot = [0, t * 1.5, 0]; cl.cones.forEach((c, i) => { c.rot = [0.4 * Math.sin(t * 2 + i * 2), 0, 0.5 * Math.sin(t * 1.7 + i)]; });
      [[a, -0.4, 0], [b, 0.4, Math.PI]].forEach(([bn, x, fase], i) => {
        const p = poseNeutra(); p.x = x; ANIM.vivo(p, t, 10 + i); ANIM.dancar(p, t, 104, fase, 1);
        const pulo = janela(t, 3.3, 3.9, 0.1); p.y += 0.25 * Math.sin(clamp((t - 3.3) / 0.6) * Math.PI); ANIM.comemorar(p, t, pulo);
        p.ry = Math.sin(t * 1.7 + i) * 0.35; aplicarPose(bn, p);
      });
      const ang = t * 0.35 - 0.9;
      return camera([{ ate: 3.2, de: [[Math.sin(ang) * 3.2, 0.8, Math.cos(ang) * 3.2], [0, 0.8, 0], 38], para: [[Math.sin(ang + 1.1) * 3.2, 0.8, Math.cos(ang + 1.1) * 3.2], [0, 0.8, 0], 38] },
        { ate: 6, de: [[0, 0.4, 2.8], [0, 0.95, 0], 40], para: [[0, 0.55, 2.6], [0, 0.95, 0], 40] }], t);
    } };
  } },

  { nome: 'raul', dur: 5, preset: 'laranja', montar() {
    const raiz = new No(); raiz.add(chao(0x1f0a06)); const b = ator(raiz, 'raul', 12);
    return { raiz, quadro(t) {
      const p = poseNeutra(); ANIM.vivo(p, t, 12);
      const kw = easeInOut(t / 2.2); p.z = lerp(-2.2, 0.2, kw); if (t < 2.2) ANIM.andar(p, t, 0.75, 1 - suave((t - 1.9) / 0.3));
      const ko = janela(t, 2.3, 3.4, 0.25); p.bracoD = mixArr(p.bracoD, [-2.0, 0.6, -0.2], ko); p.cotoveloD = mixArr(p.cotoveloD, [-2.1, 0, 0], ko);
      ANIM.bracosCruzados(p, suave((t - 3.5) / 0.35)); p.cabeca[0] -= 0.08 * suave((t - 3.5) / 0.35);
      aplicarPose(b, p);
      return camera([{ ate: 2.3, de: [[0.3, 0.35, 3.6], [0, 0.95, -1], 36], para: [[0.2, 0.45, 3.2], [0, 0.95, 0], 36] },
        { ate: 5, de: [[-0.2, 1.0, 2.6], [0, 1.12, 0.2], 32], para: [[-0.1, 1.0, 2.45], [0, 1.12, 0.2], 32] }], t);
    } };
  } },

  { nome: 'cta', dur: 9, preset: 'noite', montar() {
    const raiz = ruaNoite(new No(), { semente: 21 });
    const atras = ['brian', 'cal', 'boobie', 'drequan', 'raul'], frente = ['baeluxe', 'jason', 'lucia', 'roxy'];
    const lista = [];
    atras.forEach((q, i) => lista.push([ator(raiz, q, 30 + i), (i - 2) * 0.62, -0.9]));
    frente.forEach((q, i) => lista.push([ator(raiz, q, 40 + i), (i - 1.5) * 0.66, -0.15]));
    const h = ator(raiz, 'apresentador', 5);
    return { raiz, quadro(t) {
      const festa = suave((t - 6.6) / 0.3);
      lista.forEach(([b, x, z], i) => {
        const p = poseNeutra(); p.x = x; p.z = z; ANIM.vivo(p, t, i + 20);
        ANIM.dancar(p, t, 104, i * 0.7, 0.3 + 0.4 * festa);
        ANIM.comemorar(p, t + i * 0.2, festa * (i % 2 ? 1 : 0.8));
        p.y += 0.18 * festa * Math.max(0, Math.sin((t + i * 0.15) * 7));
        aplicarPose(b, p);
      });
      const p = poseNeutra(); p.z = 0.75; ANIM.vivo(p, t, 5);
      ANIM.falar(p, t, 5, 1 - suave((t - 2.6) / 0.3));
      ANIM.apontar(p, 'D', [0, 0.05], janela(t, 2.7, 4.6, 0.3)); if (t > 2.7 && t < 6.5) ANIM.falar(p, t, 6, 0);
      ANIM.comemorar(p, t, festa); p.y += 0.2 * festa * Math.max(0, Math.sin(t * 7));
      aplicarPose(h, p);
      return camera([{ ate: 2.6, de: [[0, 1.05, 3.4], [0, 1.16, 0.75], 30], para: [[0, 1.05, 3.2], [0, 1.16, 0.75], 30] },
        { ate: 4.8, de: [[0.2, 1.05, 3.1], [0, 1.18, 0.75], 28], para: [[0.1, 1.05, 3.0], [0, 1.18, 0.75], 28] },
        { ate: 9, de: [[0, 1.2, 4.4], [0, 1.0, 0], 42], para: [[0, 1.35, 5.0], [0, 1.02, 0], 42] }], t);
    } };
  } },
];

window.VIDEO = { nome: 'elenco-gta6', cenas: CENAS };
