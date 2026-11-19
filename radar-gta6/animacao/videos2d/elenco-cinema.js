// elenco-cinema.js — estilo cinematográfico realista: screenshots oficiais em tela cheia, parallax 2.5D, luz e créditos
'use strict';
function grade(t) { luz(t, 0.28); vinheta(0.6); }
const CENAS = [
  { nome: 'gancho', dur: 4.5, desenhar(t) {
    fundo(t, 0, 4.5, 'vc_noite', { foco: [0.52, 0.55], zoom: [1.0, 1.28] });
    grade(t); logo(t, 1.3, W / 2, 820, 760, { fade: true });
    escuro(t, 0, 0.7);
  } },
  { nome: 'quem-e-quem', dur: 5, desenhar(t) {
    const cortes = [['keys1', [0.5, 0.5]], ['grassrivers', [0.45, 0.5]], ['portgellhorn', [0.3, 0.45]], ['kalaga', [0.62, 0.55]], ['ambrosia', [0.35, 0.55]]];
    cortes.forEach(([k, f], i) => { fundo(t, i, i + 1.0001, k, { foco: f, zoom: [1.12, 1.0] }); if (i) flash(t, i, 0.18); });
    grade(t); credito(t, 0.3, 5, '', 'Leonida • o mapa do GTA 6', 600);
  } },
  { nome: 'lucia', dur: 7, desenhar(t) {
    parallax(t, 0, 3.8, 'lucia', { foco: [0.5, 0.36], sobe: 60 });
    fundo(t, 3.8, 7, 'lucia_ss2', { foco: [0.5, 0.55], zoom: [1.05, 1.2] });
    grade(t); credito(t, 0.5, 3.7, '', 'Lucia Caminos • protagonista', 600); flash(t, 3.8, 0.25);
  } },
  { nome: 'jason', dur: 7, desenhar(t) {
    parallax(t, 0, 3.8, 'jason', { foco: [0.5, 0.33], sobe: 60 });
    fundo(t, 3.8, 7, 'keys1', { foco: [0.55, 0.5], zoom: [1.2, 1.02] });
    grade(t); credito(t, 0.5, 3.7, '', 'Jason Duval • protagonista', 600);
    credito(t, 4.2, 7, '', 'Leonida Keys', 600); flash(t, 3.8, 0.25);
  } },
  { nome: 'dupla', dur: 4, desenhar(t) {
    const u = easeInOut(prog(t, 0, 4));
    metade(true, () => { cobrir(desfocado('lucia_orig', 26), [0.5, 0.3], 1.3); posicionar(IMG.lucia_orig, [0.53, 0.27], 1.55 + 0.1 * u, W / 2 + lerp(-50, 50, u), 500); });
    metade(false, () => { cobrir(desfocado('jason_orig', 26), [0.5, 0.3], 1.3); posicionar(IMG.jason_orig, [0.47, 0.21], 1.4 + 0.1 * u, W / 2 + lerp(50, -50, u), 1450); });
    const k = easeOut(prog(t, 0.2, 0.8)); const ctx = getCtx();
    ctx.fillStyle = PAL.rosa; ctx.fillRect(W / 2 - (W / 2) * k, H / 2 - 5, W * k, 10);
    grade(t); escuro(t, 0, 0.3);
  } },
  { nome: 'cal', dur: 7, desenhar(t) {
    parallax(t, 0, 3.6, 'cal', { foco: [0.5, 0.36], sobe: 60 });
    fundo(t, 3.6, 7, 'cal_ss4', { foco: [0.76, 0.4], zoom: [1.0, 1.2] });
    grade(t); credito(t, 0.5, 3.5, '', 'Cal Hampton • amigo do Jason', 600); flash(t, 3.6, 0.25);
  } },
  { nome: 'brian', dur: 6, desenhar(t) {
    parallax(t, 0, 3.2, 'brian', { foco: [0.5, 0.36], sobe: 60 });
    fundo(t, 3.2, 6, 'keys3', { foco: [0.4, 0.5], zoom: [1.0, 1.15] });
    grade(t); credito(t, 0.5, 3.1, '', 'Brian Heder • Leonida Keys', 600); flash(t, 3.2, 0.25);
  } },
  { nome: 'boobie-drequan', dur: 7, desenhar(t) {
    parallax(t, 0, 2.4, 'boobie', { foco: [0.48, 0.36], sobe: 40 });
    parallax(t, 2.4, 4.8, 'drequan', { foco: [0.5, 0.36], sobe: 40 });
    fundo(t, 4.8, 7, 'boobie_ss3', { foco: [0.3, 0.45], foco2: [0.81, 0.45], zoom: [1.05, 1.12], desce: 380 });
    grade(t); credito(t, 0.4, 2.35, '', 'Boobie Ike • lenda de Vice City', 600);
    credito(t, 2.7, 4.75, '', "Dre'Quan Priest • música", 600); flash(t, 2.4, 0.2); flash(t, 4.8, 0.2);
  } },
  { nome: 'real-dimez', dur: 6, desenhar(t) {
    fundo(t, 0, 3.4, 'realdimez_ss4', { foco: [0.3, 0.45], foco2: [0.68, 0.45], zoom: [1.05, 1.12] });
    fundo(t, 3.4, 6, 'real_orig', { foco: [0.45, 0.42], zoom: [1.1, 1.3] });
    grade(t); credito(t, 0.4, 3.3, '', 'Real Dimez • dupla de rap', 600); flash(t, 3.4, 0.25);
  } },
  { nome: 'raul', dur: 5, desenhar(t) {
    parallax(t, 0, 5, 'raul', { foco: [0.5, 0.35], sobe: 80, zf1: 1.24 });
    grade(t); credito(t, 0.5, 5, '', 'Raul Bautista • grandes golpes', 600);
  } },
  { nome: 'cta', dur: 9, desenhar(t) {
    fundo(t, 0, 9, 'vc_noite', { foco: [0.5, 0.5], zoom: [1.3, 1.05] });
    const ctx = getCtx(), quem = ['lucia', 'jason', 'cal', 'brian', 'boobie', 'drequan', 'raul'];
    ctx.fillStyle = 'rgba(11,2,24,0.45)'; ctx.fillRect(0, 0, W, H);
    quem.forEach((k, i) => {
      const a = 0.3 + i * 0.22, e = easeOut(prog(t, a, a + 0.5)); if (e <= 0) return;
      const col = i % 3, lin = Math.floor(i / 3), larg = 300, alt = 380;
      const x = 60 + col * 340 + (lin === 2 ? 340 : 0), y = 640 + lin * 420 + 40 * (1 - e);
      ctx.save(); ctx.globalAlpha = e; ctx.beginPath(); ctx.roundRect(x, y, larg, alt, 24); ctx.clip();
      const M = window.META_RECORTES[k], im = IMG[k + '_orig'], s = Math.max(larg / M.w, alt / (M.h * 0.6));
      ctx.drawImage(im, x + larg / 2 - (M.x + M.w / 2) * s, y - M.y * s + 10, im.width * s, im.height * s);
      ctx.restore(); ctx.save(); ctx.globalAlpha = e; ctx.strokeStyle = i % 2 ? PAL.ciano : PAL.rosa; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.roundRect(x, y, larg, alt, 24); ctx.stroke(); ctx.restore();
    });
    grade(t); flash(t, 6.6, 0.25, PAL.rosa);
  } },
];
window.VIDEO = { nome: 'elenco-cinema', imagens: ASSETS_GTA6, cenas: CENAS };
