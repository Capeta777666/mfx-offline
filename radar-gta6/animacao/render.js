#!/usr/bin/env node
// render.js — renderiza as cenas de um vídeo animado em .mp4 (uma por cena) usando Chromium headless + ffmpeg
//
// uso:
//   node animacao/render.js elenco-gta6                 → todas as cenas em assets/clipes/elenco-gta6/NN-nome.mp4
//   node animacao/render.js elenco-gta6 --cena 3        → só a cena 3 (1 = primeira)
//   node animacao/render.js elenco-gta6 --rapido        → 540x960 (prévia)
//   node animacao/render.js elenco-gta6 --foto 3 2.5    → PNG da cena 3 no segundo 2.5 (pra conferir enquadramento)
'use strict';
const path = require('path'), fs = require('fs'), { spawn } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.error('Falta o Playwright. Rode: npm i -D playwright && npx playwright install chromium'); process.exit(1);
}

const RAIZ = path.resolve(__dirname, '..'), FPS = 30;
const args = process.argv.slice(2), video = args[0];
if (!video) { console.error('uso: node animacao/render.js <video> [--cena N] [--rapido] [--foto N segundos]'); process.exit(1); }
const opc = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const rapido = args.includes('--rapido'), cenaSo = opc('--cena'), foto = opc('--foto');
const [W, H] = rapido ? [540, 960] : [1080, 1920];

(async () => {
  const nav = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
  const pg = await nav.newPage({ viewport: { width: W, height: H } });
  const erros = []; pg.on('pageerror', (e) => erros.push(e.message));
  // vídeos 2D (imagens reais/recortes) ficam em videos2d/; vídeos 3D (bonecos) em videos/
  const player = fs.existsSync(path.join(__dirname, 'videos2d', video + '.js')) ? 'player2d.html' : 'player.html';
  await pg.goto('file://' + path.join(__dirname, player) + `?v=${video}&w=${W}&h=${H}`);
  await pg.evaluate(() => window.pronto);
  if (erros.length) throw new Error(erros.join('\n'));
  const cenas = await pg.evaluate(() => window.cenas());
  const pasta = path.join(RAIZ, 'assets', 'clipes', video); fs.mkdirSync(pasta, { recursive: true });

  if (foto) {
    const i = +foto - 1, t = +(args[args.indexOf('--foto') + 2] || 0);
    await pg.evaluate((i) => preparar(i), i);
    const url = await pg.evaluate((t) => quadro(t, 'image/png'), t);
    const out = path.join(RAIZ, 'saida', `${video}_cena${foto}_${t}s.png`);
    fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log(out); await nav.close(); return;
  }

  let total = 0;
  for (let i = 0; i < cenas.length; i++) {
    if (cenaSo && +cenaSo !== i + 1) continue;
    const c = cenas[i], n = Math.round(c.dur * FPS), nome = `${String(i + 1).padStart(2, '0')}-${c.nome}${rapido ? '_previa' : ''}.mp4`;
    const out = path.join(pasta, nome), t0 = Date.now();
    await pg.evaluate((i) => preparar(i), i);
    const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', rapido ? 'ultrafast' : 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < n; f++) {
      const url = await pg.evaluate((t) => quadro(t), f / FPS);
      if (!ff.stdin.write(Buffer.from(url.split(',')[1], 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await new Promise((r) => ff.on('close', r));
    if (erros.length) throw new Error(erros.join('\n'));
    total += c.dur;
    console.log(`  ✔ ${nome}  ${c.dur}s  (${((Date.now() - t0) / 1000).toFixed(1)}s pra renderizar)`);
  }
  console.log(`Pronto: ${total.toFixed(1)}s de animação em ${path.relative(RAIZ, pasta)}/`);
  await nav.close();
})().catch((e) => { console.error(e); process.exit(1); });
