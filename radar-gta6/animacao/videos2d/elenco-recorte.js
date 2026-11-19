// elenco-recorte.js — estilo "recorte/figurinha": personagens oficiais recortados pulando sobre os screenshots
'use strict';
const BASE = 1990; // pé das figurinhas (um pouco abaixo da tela: corta na cintura)
function fundoRecorte(t, a, b, k, cor = PAL.roxo, o = {}) { fundo(t, a, b, k, { blur: 14, tinta: [cor, 0.45], zoom: [1.1, 1.22], ...o }); if (dentro(t, a, b)) retícula(0.1); }

const CENAS = [
  { nome: 'gancho', dur: 4.5, desenhar(t) {
    tremor(t, 0.25, 26);
    fundo(t, 0, 4.5, 'vc_noite', { foco: [0.55, 0.5], zoom: [1.35, 1.08], tinta: [PAL.roxo, 0.35] }); retícula(0.08);
    linhasVelocidade(t, 0.25, 0.9, W / 2, 900);
    const sobe = easeInOut(prog(t, 1.3, 1.8));
    logo(t, 0.25, W / 2, lerp(980, 830, sobe), lerp(820, 600, sobe), { balanco: true });
    fig(t, 1.4, 4.5, 'lucia', 320, BASE, 1080, { entrada: 'esq', rot: 0.06 });
    fig(t, 1.6, 4.5, 'jason', 770, BASE, 1130, { entrada: 'dir', rot: -0.05, fase: 2 });
    tag(t, 2.3, 4.5, 'SAIU!', 830, 1080, { cor: PAL.laranja, tam: 84, rot: 0.12 });
    flash(t, 0.25); flash(t, 1.4, 0.15, PAL.rosa);
  } },
  { nome: 'quem-e-quem', dur: 5, desenhar(t) {
    fundoRecorte(t, 0, 5, 'vc_noite', PAL.rosa, { foco: [0.4, 0.5] });
    const ordem = [['brian', 190, 1060], ['cal', 540, 1040], ['boobie', 890, 1060], ['drequan', 190, 1500], ['raul', 540, 1480], ['lucia', 890, 1500], ['jason', 540, 1960]];
    ordem.forEach(([k, x, y], i) => fig(t, 0.15 + i * 0.32, 5, k, x, y, i === 6 ? 620 : 470, { rot: (i % 2 ? 0.07 : -0.06), fase: i, flutua: 6 }));
    tag(t, 2.6, 5, '7 PERSONAGENS', 540, 610, { cor: PAL.ciano, txtCor: PAL.preto, tam: 62, rot: -0.04 });
  } },
  { nome: 'lucia', dur: 7, desenhar(t) {
    fundoRecorte(t, 0, 3.6, 'lucia_ss2', PAL.rosa, { foco: [0.45, 0.5] });
    fig(t, 0, 3.6, 'lucia', 540, BASE, 1280, { rot: 0.03 });
    tag(t, 0.6, 3.6, 'PROTAGONISTA', 300, 700, { rot: -0.08 });
    tag(t, 1.4, 3.6, '1ª MULHER DA SÉRIE', 690, 820, { cor: PAL.ciano, txtCor: PAL.preto, tam: 50, rot: 0.06 });
    fundo(t, 3.6, 7, 'lucia_ss1', { foco: [0.6, 0.3], zoom: [1.0, 1.15] });
    fig(t, 3.9, 7, 'lucia', 270, BASE, 760, { entrada: 'esq', rot: 0.08 });
    tag(t, 4.4, 7, 'SAIU DA CADEIA', 720, 1180, { cor: PAL.laranja, rot: -0.06 });
    flash(t, 3.6, 0.2);
  } },
  { nome: 'jason', dur: 7, desenhar(t) {
    fundoRecorte(t, 0, 3.6, 'jason_ss5', PAL.ciano, { foco: [0.45, 0.5] });
    fig(t, 0, 3.6, 'jason', 540, BASE, 1300, { entrada: 'baixo', rot: -0.03 });
    tag(t, 0.7, 3.6, 'EX-EXÉRCITO', 290, 720, { cor: PAL.ciano, txtCor: PAL.preto, rot: -0.07 });
    tag(t, 1.6, 3.6, 'SÓ QUER PAZ', 770, 840, { rot: 0.07 });
    fundo(t, 3.6, 7, 'keys1', { foco: [0.5, 0.5], zoom: [1.15, 1.0] });
    fig(t, 3.9, 7, 'jason', 800, BASE, 780, { entrada: 'dir', rot: -0.07 });
    tag(t, 4.4, 7, 'LEONIDA KEYS', 330, 1160, { cor: PAL.laranja, rot: -0.05 });
    flash(t, 3.6, 0.2);
  } },
  { nome: 'dupla', dur: 4, desenhar(t) {
    tremor(t, 0.42, 30);
    fundoRecorte(t, 0, 4, 'vc_noite', PAL.rosa, { foco: [0.6, 0.5] });
    linhasVelocidade(t, 0.42, 1.1, W / 2, 1200);
    fig(t, 0, 4, 'lucia', 330, BASE, 1150, { entrada: 'esq', rot: 0.07 });
    fig(t, 0, 4, 'jason', 760, BASE, 1200, { entrada: 'dir', rot: -0.06, fase: 1 });
    tag(t, 0.6, 4, 'JUNTOS', 540, 760, { cor: PAL.laranja, tam: 96, rot: -0.05 });
    flash(t, 0.42, 0.18);
  } },
  { nome: 'cal', dur: 7, desenhar(t) {
    fundoRecorte(t, 0, 3.6, 'cal_ss4', PAL.ciano, { foco: [0.6, 0.45] });
    ondas(t, 0.3, 3.6, 800, 960);
    fig(t, 0, 3.6, 'cal', 520, BASE, 1250, { rot: -0.03 });
    tag(t, 0.7, 3.6, 'AMIGO DO JASON', 320, 700, { rot: -0.07, tam: 60 });
    tag(t, 1.6, 3.6, 'CONSPIRAÇÃO', 740, 830, { cor: PAL.ciano, txtCor: PAL.preto, tam: 60, rot: 0.05 });
    fundo(t, 3.6, 7, 'cal_ss4', { foco: [0.76, 0.4], zoom: [1.0, 1.18] });
    ondas(t, 3.6, 7, 560, 1050, '#fff');
    tag(t, 4.2, 7, 'ESCUTA A GUARDA COSTEIRA', 540, 760, { cor: PAL.laranja, tam: 42, rot: -0.04 });
    flash(t, 3.6, 0.2);
  } },
  { nome: 'brian', dur: 6, desenhar(t) {
    fundoRecorte(t, 0, 3.2, 'brian_ss1', PAL.laranja, { foco: [0.55, 0.45] });
    fig(t, 0, 3.2, 'brian', 540, BASE, 1250, { rot: 0.03 });
    tag(t, 0.6, 3.2, 'VETERANO DAS KEYS', 330, 700, { cor: PAL.laranja, rot: -0.07, tam: 50 });
    tag(t, 1.5, 3.2, 'ALUGUEL DE GRAÇA', 720, 830, { rot: 0.06, tam: 50 });
    fundo(t, 3.2, 6, 'keys3', { foco: [0.45, 0.5], zoom: [1.0, 1.15] });
    fig(t, 3.5, 6, 'brian', 790, BASE, 760, { entrada: 'dir', rot: -0.06 });
    flash(t, 3.2, 0.2);
  } },
  { nome: 'boobie-drequan', dur: 7, desenhar(t) {
    fundoRecorte(t, 0, 3.6, 'boobie_ss3', PAL.rosa, { foco: [0.5, 0.45] });
    equalizador(t, 0, 3.6, 1930);
    fig(t, 0, 3.6, 'boobie', 320, BASE, 1080, { entrada: 'esq', rot: 0.05 });
    fig(t, 0.3, 3.6, 'drequan', 780, BASE, 1080, { entrada: 'dir', rot: -0.05, fase: 2 });
    tag(t, 0.8, 3.6, 'LENDA DE VICE CITY', 330, 720, { rot: -0.07, tam: 46 });
    tag(t, 1.5, 3.6, 'MÚSICA', 790, 820, { cor: PAL.ciano, txtCor: PAL.preto, rot: 0.07 });
    fundo(t, 3.6, 5.3, 'boobie_ss3', { foco: [0.3, 0.45], zoom: [1.05, 1.12], desce: 380 });
    fundo(t, 5.3, 7, 'boobie_ss3', { foco: [0.81, 0.45], zoom: [1.12, 1.05], desce: 380 }); flash(t, 5.3, 0.15);
    tag(t, 4.0, 7, 'CLUBE • IMÓVEIS • ESTÚDIO', 540, 1280, { cor: PAL.laranja, tam: 46, rot: -0.03 });
    flash(t, 3.6, 0.2);
  } },
  { nome: 'real-dimez', dur: 6, desenhar(t) {
    const pulso = 0.03 * Math.pow(Math.abs(Math.sin(t * Math.PI * 104 / 60)), 8);
    fundo(t, 0, 3.4, 'realdimez_ss4', { foco: [0.35, 0.45], foco2: [0.66, 0.45], zoom: [1.05 + pulso, 1.15 + pulso] });
    notas(t, 0, 6);
    tag(t, 0.6, 3.4, 'DUPLA DE RAP', 300, 1180, { rot: -0.06 });
    tag(t, 1.6, 3.4, 'VIRAL NAS REDES', 760, 1300, { cor: PAL.ciano, txtCor: PAL.preto, rot: 0.06 });
    fundo(t, 3.4, 6, 'real_orig', { foco: [0.45, 0.42], zoom: [1.1 + pulso, 1.25 + pulso] });
    equalizador(t, 3.4, 6, 1930);
    flash(t, 3.4, 0.2, PAL.rosa);
  } },
  { nome: 'raul', dur: 5, desenhar(t) {
    fundoRecorte(t, 0, 5, 'raul_orig', PAL.roxo, { foco: [0.5, 0.4] });
    fig(t, 0, 5, 'raul', 540, BASE, 1280, { entrada: 'baixo', rot: -0.02 });
    tag(t, 0.7, 5, 'VETERANO DOS GOLPES', 330, 700, { cor: PAL.laranja, tam: 48, rot: -0.07 });
    tag(t, 1.8, 5, 'PROCURA TALENTOS', 740, 830, { rot: 0.06, tam: 48 });
  } },
  { nome: 'cta', dur: 9, desenhar(t) {
    fundoRecorte(t, 0, 9, 'vc_noite', PAL.roxo, { foco: [0.5, 0.5], zoom: [1.05, 1.2] });
    const pul = t > 6.6 ? 0.05 : 0;
    [['brian', 130], ['cal', 335], ['boobie', 540], ['drequan', 745], ['raul', 950]].forEach(([k, x], i) => fig(t, 0.1 + i * 0.18, 9, k, x, 1420, 520, { rot: (i % 2 ? 0.06 : -0.06), fase: i, pulsa: pul }));
    fig(t, 1.1, 9, 'lucia', 330, BASE, 900, { entrada: 'esq', rot: 0.05, pulsa: pul });
    fig(t, 1.25, 9, 'jason', 760, BASE, 940, { entrada: 'dir', rot: -0.05, fase: 3, pulsa: pul });
    tag(t, 2.2, 9, 'SALVA ✔', 290, 700, { cor: PAL.rosa, tam: 70, rot: -0.1 });
    tag(t, 3.6, 9, 'COMENTA AÍ', 780, 810, { cor: PAL.ciano, txtCor: PAL.preto, tam: 66, rot: 0.08 });
    if (t > 6.6) linhasVelocidade(t, 6.6, 7.3, W / 2, 1200);
    flash(t, 6.6, 0.2, PAL.rosa);
  } },
];
window.VIDEO = { nome: 'elenco-recorte', imagens: ASSETS_GTA6, cenas: CENAS };
