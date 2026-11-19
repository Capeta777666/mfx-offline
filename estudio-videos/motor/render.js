#!/usr/bin/env node
// render.js — renderiza as cenas de um projeto (uma por bloco) em build/cenas/NN.mp4, com Chromium headless + ffmpeg.
//
//   node motor/render.js projetos/<slug>                 → todas as cenas
//   node motor/render.js projetos/<slug> --bloco 3       → só o bloco 3
//   node motor/render.js projetos/<slug> --rapido        → meia resolução (prévia)
//   node motor/render.js projetos/<slug> --foto 3 0.5    → PNG do bloco 3 na metade (0-1) — pra conferir enquadramento
//
// Antes: python scripts/preparar.py projetos/<slug>  (gera build/roteiro.js a partir do roteiro.md)
'use strict';
const path = require('path'), fs = require('fs'), { spawn } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.error('Falta o Playwright: npm i playwright && npx playwright install chromium'); process.exit(1);
}
const RAIZ = path.resolve(__dirname, '..'), FPS = 30;
const args = process.argv.slice(2);
if (!args[0]) { console.error('uso: node motor/render.js projetos/<slug> [--bloco N] [--rapido] [--foto N fração]'); process.exit(1); }
const dir = path.resolve(fs.existsSync(args[0]) ? args[0] : path.join(RAIZ, 'projetos', args[0])), slug = path.basename(dir);
const opc = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const rapido = args.includes('--rapido'), so = opc('--bloco'), foto = opc('--foto');
const projeto = JSON.parse(fs.readFileSync(path.join(dir, 'projeto.json'), 'utf8'));
if (!fs.existsSync(path.join(dir, 'build', 'roteiro.js'))) { console.error('Rode antes: python scripts/preparar.py ' + args[0]); process.exit(1); }
const player = projeto.estilo === 'bonecos' ? 'player3d.html' : 'player2d.html';

(async () => {
  const nav = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
  const pg = await nav.newPage();
  const erros = []; pg.on('pageerror', (e) => erros.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erros.push(m.text()); }); // cenas.js é opcional
  await pg.goto('file://' + path.join(__dirname, player) + `?p=${encodeURIComponent(slug)}&esc=${rapido ? 0.5 : 1}`);
  await pg.evaluate(() => window.pronto);
  if (erros.length) throw new Error(erros.join('\n'));
  const cenas = await pg.evaluate(() => window.cenas());
  const roteiro = JSON.parse(fs.readFileSync(path.join(dir, 'build', 'roteiro.json'), 'utf8'));
  const pasta = path.join(dir, 'build', rapido ? 'cenas_previa' : 'cenas'); fs.mkdirSync(pasta, { recursive: true });

  if (foto) {
    const i = roteiro.blocos.findIndex((b) => b.numero === +foto), fr = +(args[args.indexOf('--foto') + 2] || 0.5);
    await pg.evaluate((i) => preparar(i), i);
    const url = await pg.evaluate((t) => quadro(t, 'image/png'), cenas[i].dur * fr);
    const out = path.join(dir, 'build', `foto_bloco${foto}_${fr}.png`);
    fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log(out);
    if (erros.length) console.error('⚠', erros.join('\n')); await nav.close(); return;
  }
  let total = 0;
  for (let i = 0; i < cenas.length; i++) {
    const num = roteiro.blocos[i].numero;
    if (so && +so !== num) continue;
    const n = Math.round(cenas[i].dur * FPS), out = path.join(pasta, `${String(num).padStart(2, '0')}.mp4`), t0 = Date.now();
    await pg.evaluate((i) => preparar(i), i);
    const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', rapido ? 'ultrafast' : 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < n; f++) {
      const url = await pg.evaluate((t) => quadro(t), f / FPS);
      if (!ff.stdin.write(Buffer.from(url.split(',')[1], 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await new Promise((r) => ff.on('close', r));
    total += cenas[i].dur;
    console.log(`  ✔ bloco ${num}  ${cenas[i].dur.toFixed(1)}s  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  if (erros.length) console.error('⚠ avisos do motor:\n' + [...new Set(erros)].join('\n'));
  console.log(`Pronto: ${total.toFixed(1)}s em ${path.relative(RAIZ, pasta)}/`);
  await nav.close();
})().catch((e) => { console.error(e); process.exit(1); });
