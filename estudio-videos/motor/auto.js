// auto.js — transforma o roteiro (build/roteiro.js) em cenas animadas, sem programar nada.
// Cada bloco vira uma cena: os VISUAIS se revezam como fundo (cortes) e as CAMADAS ficam por cima.
// Tempos nas camadas ("em", "ate") são frações do bloco: 0 = começo, 1 = fim.
'use strict';

function corDe(c, padrao) {
  if (!c) return padrao;
  if (typeof c === 'string' && c.startsWith('#')) return c;
  return PAL[c] || padrao;
}
const num = (v, p) => (v === undefined || v === null || v === true ? p : +v);
const par = (v, p) => (Array.isArray(v) ? v.map(Number) : (v === undefined ? p : [+v, +v]));

// divide o bloco entre os visuais (opção "dur" = fração do bloco; o resto é dividido igualmente)
function janelas(b) {
  const n = b.visuais.length; if (!n) return [];
  const fr = b.visuais.map((v) => num(v.dur, 0)), fixo = fr.reduce((a, c) => a + c, 0), livres = fr.filter((x) => !x).length;
  let acc = 0;
  return fr.map((f) => { const d = (f || Math.max(0, 1 - fixo) / Math.max(livres, 1)) * b.dur; const j = [acc, acc + d]; acc += d; return j; });
}

function desenharVisual(v, t, a, z, i, est) {
  if (!dentro(t, a, z)) return;
  const k = v.args && v.args[0];
  const zoomPadrao = i % 2 ? [1.18, 1.04] : [1.04, 1.18];
  if (v.tipo === 'foto') {
    if (!IMG[k]) return erroImg(k);
    const o = { foco: par(v.foco, [0.5, 0.5]), zoom: par(v.zoom, zoomPadrao) };
    if (v.foco2) o.foco2 = par(v.foco2);
    if (v.blur) o.blur = num(v.blur, 14);
    if (v.desce) o.desce = num(v.desce, 0) * H;
    if (v.tinta) o.tinta = [corDe(Array.isArray(v.tinta) ? v.tinta[0] : v.tinta, PAL.escura), Array.isArray(v.tinta) ? +v.tinta[1] : 0.45];
    if (est === 'recorte' && !v.nitido && o.blur === undefined) { o.blur = 14; o.tinta = o.tinta || [PAL.escura, 0.45]; }
    fundo(t, a, z, k, o);
    if (est === 'recorte' && !v.nitido) retícula(0.1);
  } else if (v.tipo === 'parallax') {
    if (!IMG[k] || !window.META_RECORTES[k]) return erroImg(k + ' (recorte)');
    parallax(t, a, z, k, { foco: par(v.foco, [0.5, 0.36]), cabeca: v.cabeca ? num(v.cabeca) * H : undefined, sobe: num(v.sobe, 60 * E), zf1: num(v.zoom, 1.16) });
  } else if (v.tipo === 'cor') {
    const c1 = corDe(v.args[0], PAL.escura), c2 = corDe(v.args[1], PAL.fundo), g = getCtx().createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, c1); g.addColorStop(1, c2); getCtx().fillStyle = g; getCtx().fillRect(0, 0, W, H);
    if (est === 'recorte') retícula(0.12);
  } else if (v.tipo === 'split') {
    const [k1, k2] = v.args, u = easeInOut(prog(t, a, z)), ctx = getCtx();
    [[k1, true, par(v.focoa, [0.5, 0.3])], [k2, false, par(v.focob, [0.5, 0.3])]].forEach(([kk, cima, f]) => {
      if (!IMG[kk]) return erroImg(kk);
      metade(cima, () => { cobrir(desfocado(kk, 26), f, 1.3); const s = Math.max(W / IMG[kk].width, (H / 2) / IMG[kk].height) * 1.35 * (1 + 0.08 * u);
        posicionar(IMG[kk], f, s, W / 2 + (cima ? 1 : -1) * lerp(-40, 40, u) * E, cima ? H / 4 : H * 3 / 4); });
    });
    const e = easeOut(prog(t, a + 0.15, a + 0.7)); ctx.fillStyle = PAL.rosa; ctx.fillRect(W / 2 - (W / 2) * e, H / 2 - 5 * E, W * e, 10 * E);
  } else if (v.tipo === 'mosaico') {
    const ctx = getCtx(), kf = v.fundo || v.args[0]; if (IMG[kf]) cobrir(desfocado(kf, 26), [0.5, 0.5], 1.3); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
    const lista = v.args, col = W > H ? 4 : 3, larg = (W - 60 * E * (col + 1)) / col, alt = larg * 1.25;
    lista.forEach((kk, j) => {
      const im = IMG[kk]; if (!im) return; const ini = a + 0.15 + j * 0.18, e = easeOut(prog(t, ini, ini + 0.5)); if (e <= 0) return;
      const c = j % col, l = Math.floor(j / col), x = 60 * E + c * (larg + 60 * E), y = H * 0.33 + l * (alt + 40 * E) + 40 * E * (1 - e);
      ctx.save(); ctx.globalAlpha = e; ctx.beginPath(); ctx.roundRect(x, y, larg, alt, 24 * E); ctx.clip();
      const M = window.META_RECORTES[kk], orig = M ? IMG[M.original] : im;
      if (M) { const s = Math.max(larg / M.w, alt / (M.h * 0.6)); ctx.drawImage(orig, x + larg / 2 - (M.x + M.w / 2) * s, y - M.y * s + 10 * E, orig.width * s, orig.height * s); }
      else { const s = Math.max(larg / im.width, alt / im.height); ctx.drawImage(im, x + larg / 2 - im.width * s / 2, y + alt / 2 - im.height * s / 2, im.width * s, im.height * s); }
      ctx.restore(); ctx.save(); ctx.globalAlpha = e; ctx.strokeStyle = j % 2 ? PAL.ciano : PAL.rosa; ctx.lineWidth = 5 * E;
      ctx.beginPath(); ctx.roundRect(x, y, larg, alt, 24 * E); ctx.stroke(); ctx.restore();
    });
  }
}

function desenharCamada(c, t, b) {
  const a = num(c.em, 0) * b.dur, z = Math.max(num(c.ate, 1) * b.dur, a + 0.01) + (num(c.ate, 1) >= 1 ? 0.01 : 0);
  switch (c.camada) {
    case 'figurinha': {
      const k = c.nome; if (!IMG[k]) return erroImg(k);
      fig(t, a, z, k, num(c.x, 0.5) * W, H + 70 * E, num(c.alt, 0.6) * H, { entrada: c.entrada || 'pop', rot: num(c.rot, 0), fase: num(c.fase, 0), pulsa: num(c.pulsa, 0) });
      break;
    }
    case 'tag':
      tag(t, a, z, c.texto, num(c.x, 0.5) * W, num(c.y, 0.38) * H, { cor: corDe(c.cor, PAL.rosa), txtCor: corDe(c.texto_cor, '#fff'), rot: num(c.rot, -0.05), tam: c.tam ? num(c.tam) * E : undefined });
      break;
    case 'credito':
      credito(t, a, z, '', c.texto, c.y ? num(c.y) * H : undefined);
      break;
    case 'logo': {
      const k = c.nome; if (!IMG[k]) return erroImg(k);
      logo(t, a, W / 2, num(c.y, 0.43) * H, num(c.larg, 0.7) * W, { fade: c.entrada !== 'pop', balanco: c.entrada === 'pop' });
      break;
    }
    case 'efeito':
      if (c.tipo === 'ondas') ondas(t, a, z, num(c.x, 0.7) * W, num(c.y, 0.5) * H, corDe(c.cor, PAL.ciano));
      if (c.tipo === 'equalizador') equalizador(t, a, z, H - 40 * E, corDe(c.cor, PAL.ciano));
      if (c.tipo === 'notas') notas(t, a, z);
      if (c.tipo === 'linhas') linhasVelocidade(t, a, a + 0.7, W / 2, num(c.y, 0.55) * H);
      if (c.tipo === 'flash') flash(t, a, 0.25, corDe(c.cor, '#fff'));
      if (c.tipo === 'escuro') escuro(t, a, a + 0.7);
      break;
  }
}

const faltando = new Set();
function erroImg(k) { if (!faltando.has(k)) { faltando.add(k); console.error('imagem não encontrada: ' + k); } }

function cenasDoRoteiro(R) {
  return R.blocos.map((b) => ({
    nome: 'bloco' + b.numero, dur: b.dur,
    desenhar(t) {
      const ctx = getCtx(), js = janelas(b);
      // tremor antes de desenhar (camadas com efeito tremor)
      b.camadas.filter((c) => c.camada === 'efeito' && c.tipo === 'tremor').forEach((c) => tremor(t, num(c.em, 0) * b.dur, 24 * E));
      b.visuais.forEach((v, i) => desenharVisual(v, t, js[i][0], i === js.length - 1 ? js[i][1] + 0.05 : js[i][1], i, R.estilo));
      if (!b.visuais.length) { ctx.fillStyle = PAL.fundo || '#000'; ctx.fillRect(0, 0, W, H); }
      if (R.estilo === 'cinema') { luz(t, 0.28); vinheta(0.6); }
      b.camadas.filter((c) => !(c.camada === 'efeito' && c.tipo === 'tremor')).forEach((c) => desenharCamada(c, t, b));
      if (R.estilo !== 'limpo') js.slice(1).forEach(([a]) => flash(t, a, 0.2));
      if (window.CENAS_EXTRA && window.CENAS_EXTRA[b.numero]) window.CENAS_EXTRA[b.numero](t, b);
    },
  }));
}
window.cenasDoRoteiro = cenasDoRoteiro;
