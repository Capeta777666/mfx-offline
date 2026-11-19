// fx2d.js — efeitos 2D (canvas) para vídeos com imagens reais: figurinhas, parallax 2.5D, etiquetas, luz, etc.
'use strict';
const W = 1080, H = 1920;
const PAL = { roxo: '#2A0A4A', rosa: '#FF2D95', ciano: '#00F0FF', laranja: '#FF8C42', preto: '#0B0218' };
const IMG = {}, CACHE = {};
let ctx = null;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const suave = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOutBack = (t) => { t = clamp(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const prog = (t, a, b) => clamp((t - a) / (b - a));
const dentro = (t, a, b) => t >= a && t < b;
function ruido(x, s = 0) { const h = (n) => { const v = Math.sin(n * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(h(i), h(i + 1), u) * 2 - 1; }

function carregar(lista) {
  return Promise.all(Object.entries(lista).map(([k, src]) => new Promise((ok, falha) => {
    if (IMG[k]) return ok(); const i = new Image(); i.onload = () => { IMG[k] = i; ok(); }; i.onerror = () => falha('não carregou: ' + src); i.src = src;
  })));
}
function tela(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

// versão desfocada (feita em resolução baixa: rápido e suave)
function desfocado(k, px) {
  const ch = k + '|blur' + px; if (CACHE[ch]) return CACHE[ch];
  const im = IMG[k], f = 0.25, [c, g] = tela(Math.round(im.width * f), Math.round(im.height * f));
  g.filter = `blur(${px * f}px)`; g.drawImage(im, -px * f, -px * f, c.width + 2 * px * f, c.height + 2 * px * f);
  return (CACHE[ch] = c);
}

// figurinha: recorte + borda branca + sombra, pré-calculada uma vez
function figurinha(k, altMax = 1100, borda = 16) {
  const ch = k + '|fig'; if (CACHE[ch]) return CACHE[ch];
  const im = IMG[k], s = Math.min(1, altMax / im.height), w = Math.round(im.width * s), h = Math.round(im.height * s), p = borda + 40;
  const [c, g] = tela(w + 2 * p, h + 2 * p);
  const [m, gm] = tela(c.width, c.height);
  for (let a = 0; a < 24; a++) gm.drawImage(im, p + Math.cos(a / 24 * 6.283) * borda, p + Math.sin(a / 24 * 6.283) * borda, w, h);
  gm.globalCompositeOperation = 'source-in'; gm.fillStyle = '#fff'; gm.fillRect(0, 0, c.width, c.height);
  g.filter = 'blur(14px)'; g.globalAlpha = 0.55; g.drawImage(m, 10, 22); g.filter = 'none'; g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'source-over';
  g.drawImage(m, 0, 0); g.drawImage(im, p, p, w, h);
  return (CACHE[ch] = c);
}

// imagem cobrindo a tela; foco = ponto da imagem (0-1) que fica no centro; zoom ≥ 1
function cobrir(src, foco = [0.5, 0.5], zoom = 1, desl = [0, 0]) {
  const iw = src.width, ih = src.height, s = Math.max(W / iw, H / ih) * zoom;
  let x = W / 2 - foco[0] * iw * s + desl[0], y = H / 2 - foco[1] * ih * s + desl[1];
  x = clamp(x, W - iw * s, 0); y = clamp(y, H - ih * s, 0);
  ctx.drawImage(src, x, y, iw * s, ih * s);
  return { x, y, s };
}

// fundo com Ken Burns entre a e b (t global da cena)
function fundo(t, a, b, k, o = {}) {
  if (!dentro(t, a, b)) return;
  const u = easeInOut(prog(t, a, b)), z = lerp(...(o.zoom || [1.05, 1.18]), u);
  const foco = o.foco2 ? [lerp(o.foco[0], o.foco2[0], u), lerp(o.foco[1], o.foco2[1], u)] : (o.foco || [0.5, 0.5]);
  const src = o.blur ? desfocado(k, o.blur) : IMG[k];
  if (o.filtro) ctx.filter = o.filtro;
  if (o.desce) { // imagem deslocada pra baixo (rosto abaixo do título); topo preenchido com versão desfocada
    ctx.filter = 'brightness(0.55)'; cobrir(desfocado(k, 26), foco, z * 1.3); ctx.filter = o.filtro || 'none';
    const s = Math.max(W / src.width, H / src.height) * z; posicionar(src, foco, s, W / 2, H / 2 + o.desce);
    const g = ctx.createLinearGradient(0, o.desce - 60, 0, o.desce + 140); g.addColorStop(0, 'rgba(11,2,24,0.9)'); g.addColorStop(1, 'rgba(11,2,24,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, o.desce + 140);
  } else cobrir(src, foco, z);
  ctx.filter = 'none';
  if (o.tinta) { ctx.globalAlpha = o.tinta[1]; ctx.fillStyle = o.tinta[0]; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

// parallax 2.5D: fundo = imagem original desfocada; frente = recorte nítido alinhado, que anda mais
function parallax(t, a, b, nomeRec, o = {}) {
  if (!dentro(t, a, b)) return;
  const M = window.META_RECORTES[nomeRec], orig = IMG[nomeRec + '_orig'], rec = IMG[nomeRec];
  const u = easeInOut(prog(t, a, b)), foco = o.foco || [0.5, 0.42];
  const zb = lerp(1.0, 1.06, u), zf = lerp(o.zf0 || 1.0, o.zf1 || 1.16, u);
  ctx.filter = 'brightness(0.55) saturate(1.1)'; cobrir(desfocado(nomeRec + '_orig', 26), foco, zb * 1.3); ctx.filter = 'none';
  // topo escuro: espaço do título; personagem desce pra cabeça ficar abaixo do texto de tela
  const gt = ctx.createLinearGradient(0, 0, 0, 700); gt.addColorStop(0, 'rgba(11,2,24,0.75)'); gt.addColorStop(1, 'rgba(11,2,24,0)');
  ctx.fillStyle = gt; ctx.fillRect(0, 0, W, 700);
  const s0 = Math.max(W / M.W, H / M.H) * zf, dx = (o.deriva || 40) * (u - 0.5);
  const x = W / 2 - foco[0] * M.W * s0 + dx;
  const y = (o.cabeca || 690) - M.y * s0 + (o.sobe || 0) * (1 - u);  // topo do recorte (cabeça) em y≈600
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 40;
  ctx.drawImage(rec, x + M.x * s0, y + M.y * s0, M.w * s0, M.h * s0); ctx.restore();
}

// figurinha animada: entrada 'pop' | 'esq' | 'dir' | 'baixo'; x,y = centro-base (px); alt = altura em px
function fig(t, a, b, k, x, y, alt, o = {}) {
  if (!dentro(t, a, b)) return;
  const f = figurinha(k), u = t - a, e = o.entrada || 'pop', d = 0.45;
  let esc = 1, dx = 0, dy = 0, rot = (o.rot || 0) + 0.035 * Math.sin(u * 2.2 + (o.fase || 0)) * (o.balanco ?? 1);
  if (e === 'pop') esc = easeOutBack(u / d);
  if (e === 'esq') dx = -W * (1 - easeOutBack(u / d));
  if (e === 'dir') dx = W * (1 - easeOutBack(u / d));
  if (e === 'baixo') dy = H * 0.6 * (1 - easeOutBack(u / d));
  const sai = o.saida && t > b - 0.3 ? easeInOut((t - (b - 0.3)) / 0.3) : 0;
  if (o.saida === 'pop') esc *= 1 - sai; if (o.saida === 'esq') dx -= W * sai; if (o.saida === 'dir') dx += W * sai;
  esc *= 1 + (o.pulsa || 0) * Math.abs(Math.sin(u * Math.PI * 104 / 60));
  dy += (o.flutua ?? 8) * Math.sin(u * 1.7 + (o.fase || 0));
  const s = alt / f.height * esc;
  ctx.save(); ctx.translate(x + dx, y + dy); ctx.rotate(rot); ctx.scale(s, s);
  ctx.drawImage(f, -f.width / 2, -f.height); ctx.restore();
}

// etiqueta (tag) estilo adesivo
function tag(t, a, b, texto, x, y, o = {}) {
  if (!dentro(t, a, b)) return;
  const u = t - a, esc = easeOutBack(u / 0.35) * (o.saida !== false && t > b - 0.2 ? 1 - prog(t, b - 0.2, b) : 1);
  const tam = o.tam || 56, cor = o.cor || PAL.rosa, txt = o.txtCor || '#fff';
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot ?? -0.05); ctx.scale(esc, esc);
  ctx.font = `900 ${tam}px "DejaVu Sans", sans-serif`; const w = ctx.measureText(texto).width + tam * 0.9, h = tam * 1.45;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ret(-w / 2 + 8, -h / 2 + 10, w, h, h * 0.22); ctx.fill();
  ctx.fillStyle = cor; ret(-w / 2, -h / 2, w, h, h * 0.22); ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = txt; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(texto, 0, 3);
  ctx.restore();
}
function ret(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

// crédito estilo cinema (linha + nome + função), entra deslizando
function credito(t, a, b, nome, funcao, y = 1300) {
  if (!dentro(t, a, b)) return;
  const u = easeOut(prog(t, a, a + 0.6)), sai = 1 - prog(t, b - 0.35, b), x = 90;
  ctx.save(); ctx.globalAlpha = sai;
  const g = ctx.createLinearGradient(0, y - 90, 0, y + 70); g.addColorStop(0, 'rgba(11,2,24,0)'); g.addColorStop(0.5, 'rgba(11,2,24,0.55)'); g.addColorStop(1, 'rgba(11,2,24,0)');
  ctx.fillStyle = g; ctx.fillRect(0, y - 90, W, 160);
  ctx.fillStyle = PAL.rosa; ctx.fillRect(x, y - 52, 360 * u, 6); ctx.fillStyle = PAL.ciano; ctx.fillRect(x, y - 40, 180 * u, 3);
  ctx.font = '600 38px "DejaVu Sans", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.textBaseline = 'top';
  ctx.save(); ctx.beginPath(); ctx.rect(x, y - 30, 900 * u, 120); ctx.clip();
  ctx.fillText(funcao.toUpperCase().split('').join(' '), x, y - 10); ctx.restore();
  ctx.restore();
}

function flash(t, tp, dur = 0.25, cor = '#fff') { const k = 1 - prog(t, tp, tp + dur); if (t < tp || k <= 0) return;
  ctx.globalAlpha = k * 0.85; ctx.fillStyle = cor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }

function vinheta(forca = 0.55) {
  const g = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.5, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(5,0,12,${forca})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// vazamento de luz cinematográfico (manchas quentes passando)
function luz(t, forca = 0.5, s = 0) {
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  [[PAL.laranja, 0.3], [PAL.rosa, 0.7]].forEach(([c, f], i) => {
    const x = W * (0.5 + 0.7 * ruido(t * 0.25 + i * 3, s)), y = H * (0.3 + 0.5 * ruido(t * 0.2 + i * 7, s + 1));
    const g = ctx.createRadialGradient(x, y, 0, x, y, H * 0.55); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = forca * (0.5 + 0.5 * ruido(t * 0.6 + i, s + 2)) * f; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });
  ctx.restore();
}

// retícula de pontos (estilo HQ/recorte) sobre a tela
function retícula(alfa = 0.18, cor = PAL.rosa, passo = 22) {
  const ch = 'ret|' + cor + passo; if (!CACHE[ch]) { const [c, g] = tela(passo, passo); g.fillStyle = cor; g.beginPath(); g.arc(passo / 2, passo / 2, passo * 0.22, 0, 6.3); g.fill(); CACHE[ch] = ctx.createPattern(c, 'repeat'); }
  ctx.globalAlpha = alfa; ctx.fillStyle = CACHE[ch]; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
}

// linhas de velocidade irradiando do centro (impacto)
function linhasVelocidade(t, a, b, cx = W / 2, cy = H / 2, cor = '#fff') {
  if (!dentro(t, a, b)) return; const k = 1 - prog(t, a, b);
  ctx.save(); ctx.globalAlpha = 0.5 * k; ctx.strokeStyle = cor; ctx.lineWidth = 10;
  for (let i = 0; i < 28; i++) { const ang = i / 28 * 6.283 + ruido(i, 3) * 0.2, r0 = 420 + 200 * (1 - k) + ruido(i * 3.1, 9) * 80;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0); ctx.lineTo(cx + Math.cos(ang) * 2000, cy + Math.sin(ang) * 2000); ctx.stroke(); }
  ctx.restore();
}

// ondas de rádio saindo de um ponto (Cal escutando a Guarda Costeira)
function ondas(t, a, b, x, y, cor = PAL.ciano) {
  if (!dentro(t, a, b)) return; ctx.save(); ctx.strokeStyle = cor; ctx.lineWidth = 9; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) { const f = ((t - a) * 0.9 + i / 4) % 1; ctx.globalAlpha = (1 - f) * 0.9;
    ctx.beginPath(); ctx.arc(x, y, 60 + f * 360, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke(); }
  ctx.restore();
}

// equalizador pulsando na batida
function equalizador(t, a, b, y = 1880, cor = PAL.ciano) {
  if (!dentro(t, a, b)) return; const n = 18, lw = W / n;
  for (let i = 0; i < n; i++) { const hgt = 60 + 260 * Math.abs(ruido(t * 4 + i * 0.7, i)) * (0.6 + 0.4 * Math.abs(Math.sin(t * Math.PI * 104 / 60)));
    ctx.fillStyle = i % 2 ? cor : PAL.rosa; ctx.globalAlpha = 0.75; ctx.fillRect(i * lw + 6, y - hgt, lw - 12, hgt); }
  ctx.globalAlpha = 1;
}

function notas(t, a, b) {
  if (!dentro(t, a, b)) return; ctx.save(); ctx.font = '900 110px "DejaVu Sans", sans-serif'; ctx.textAlign = 'center';
  for (let i = 0; i < 7; i++) { const f = ((t - a) * 0.35 + i / 7) % 1, x = W * (0.12 + 0.76 * ((i * 0.37) % 1)) + 40 * Math.sin(t * 2 + i), y = H * (0.95 - 0.7 * f);
    ctx.globalAlpha = Math.sin(f * Math.PI); ctx.fillStyle = i % 2 ? PAL.ciano : PAL.rosa; ctx.fillText(i % 3 ? '♪' : '♫', x, y); }
  ctx.restore();
}

function tremor(t, tp, forca = 18, dur = 0.35) {
  if (t < tp || t > tp + dur) return; const k = 1 - (t - tp) / dur;
  ctx.translate(ruido(t * 60, 1) * forca * k, ruido(t * 60, 2) * forca * k);
}

// split: duas metades (cima/baixo) com imagens diferentes
// desenha a imagem com o ponto 'foco' (0-1) em (cx, cy), escala absoluta, sem travar nas bordas
function posicionar(src, foco, esc, cx, cy) { ctx.drawImage(src, cx - foco[0] * src.width * esc, cy - foco[1] * src.height * esc, src.width * esc, src.height * esc); }
function metade(cima, desenhar) { ctx.save(); ctx.beginPath(); ctx.rect(0, cima ? 0 : H / 2, W, H / 2); ctx.clip(); desenhar(); ctx.restore(); }

Object.assign(window, { posicionar, W, H, PAL, IMG, carregar, fundo, parallax, fig, tag, credito, flash, vinheta, luz, retícula, linhasVelocidade, ondas,
  equalizador, notas, tremor, metade, figurinha, cobrir, desfocado, lerp, clamp, suave, easeOut, easeInOut, easeOutBack, prog, dentro, ruido,
  setCtx: (c) => { ctx = c; }, getCtx: () => ctx });

// imagens padrão do GTA 6 (recortes, originais e screenshots oficiais) — caminhos relativos a animacao/
const ASSETS_GTA6 = (() => {
  const r = '../assets/personagens/recortes/', o = '../assets/personagens/original/', c = '../assets/cenas_oficiais/', m = {};
  ['jason', 'lucia', 'cal', 'brian', 'boobie', 'drequan', 'raul'].forEach((n) => { m[n] = r + n + '.png'; m[n + '_orig'] = o + n + '.png'; });
  Object.assign(m, { real_orig: o + 'real.png', logo: c + 'Logo-GTAVI.png', vc_noite: c + 'ViceCity-SS8.jpg', keys1: c + 'LeonidaKeys-SS1.jpg',
    keys2: c + 'LeonidaKeys-SS2.jpg', keys3: c + 'LeonidaKeys-SS3.jpg', grassrivers: c + 'Grassrivers-SS4.jpg', portgellhorn: c + 'PortGellhorn-SS1.jpg',
    kalaga: c + 'MountKalaga-SS6.jpg', ambrosia: c + 'Ambrosia-SS1.jpg', lucia_ss1: c + 'LuciaCaminos-SS1.jpg', lucia_ss2: c + 'LuciaCaminos-SS2.jpg',
    jason_ss5: c + 'JasonDuval-SS5.jpg', cal_ss4: c + 'CalHampton-SS4.jpg', brian_ss1: c + 'BrianHeder-SS1.jpg', boobie_ss3: c + 'BoobieIke-SS3.jpg',
    drequan_ss2: c + 'DreQuanPriest-SS2.jpg', realdimez_ss4: c + 'RealDimez-SS4.jpg' });
  return m;
})();
function logo(t, a, x, y, larg, o = {}) {
  if (t < a) return; const u = t - a, e = o.fade ? easeOut(u / 0.8) : easeOutBack(u / 0.5), im = IMG.logo, w = larg * (o.fade ? lerp(0.92, 1, e) : e);
  ctx.save(); ctx.globalAlpha = o.fade ? e : 1; ctx.shadowColor = PAL.rosa; ctx.shadowBlur = 50; ctx.translate(x, y); ctx.rotate((o.rot || 0) + (o.balanco ? 0.03 * Math.sin(u * 3) : 0));
  ctx.drawImage(im, -w / 2, -w * im.height / im.width / 2, w, w * im.height / im.width); ctx.restore();
}
function escuro(t, a, b, entrando = true) { const k = entrando ? 1 - prog(t, a, b) : prog(t, a, b); if (k <= 0) return; ctx.globalAlpha = k; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
Object.assign(window, { ASSETS_GTA6, logo, escuro });
