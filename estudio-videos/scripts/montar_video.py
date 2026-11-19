#!/usr/bin/env python3
"""
montar_video.py — monta o vídeo final de um projeto: cenas/imagens + título + legendas + narração + trilha.

    python scripts/montar_video.py projetos/<slug>              # vídeo final
    python scripts/montar_video.py projetos/<slug> --validar    # só confere
    python scripts/montar_video.py projetos/<slug> --rapido     # prévia em meia resolução

Para cada bloco do roteiro usa, nesta ordem:
  1. build/cenas/NN.mp4 (cena renderizada pelo motor, quando o bloco tem VISUAL)
  2. IMAGEM: arquivos de assets/imagens ou assets/clipes (com Ken Burns nas imagens)
Resolução, área segura e margem das legendas vêm de redes.json; cores, fontes e estilo do título, da marca.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from projeto import EXT_VID, Projeto, ler_roteiro, limpar_marcacao  # noqa: E402

TOMADA_MAX = 3.0
MOVIMENTOS = ["zoom_in", "pan_baixo", "zoom_out", "zoom_in_esq", "pan_cima", "zoom_out_dir"]


def ass_cor(rgb):
    r, g, b = rgb
    return f"&H00{b:02X}{g:02X}{r:02X}"


def rodar(cmd, cwd=None):
    res = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if res.returncode != 0:
        sys.stderr.write("\n[ffmpeg falhou]\n" + " ".join(map(str, cmd)) + "\n" + res.stderr[-3000:] + "\n")
        raise SystemExit(1)


def duracao_midia(caminho) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(caminho)],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        raise SystemExit(f"Não consegui ler a duração de {caminho}")


def fmt_ass(t):
    cs = int(round(t * 100)); h, cs = divmod(cs, 360000); m, cs = divmod(cs, 6000); s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def fmt_srt(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


# ───────────────────────── validação ─────────────────────────
def validar(P: Projeto, blocos: list[dict]) -> tuple[list[str], list[str]]:
    erros, avisos = [], []
    if not blocos:
        erros.append("Nenhum bloco no roteiro ('## BLOCO 1 — título').")
        return erros, avisos
    proibidas = [p.lower() for p in P.marca.get("palavras_evitar", [])]
    for b in blocos:
        rot = f"BLOCO {b['numero']}"
        cena = P.build / "cenas" / f"{b['numero']:02d}.mp4"
        b["midias_resolvidas"] = []
        if b["visuais"] or P.estilo == "bonecos":
            if cena.is_file():
                b["midias_resolvidas"] = [{"arquivo": str(cena), "inicio_clipe": 0.0, "tipo": "clipe", "duracao_clipe": duracao_midia(cena)}]
            else:
                erros.append(f"{rot}: cena ainda não renderizada (build/cenas/{b['numero']:02d}.mp4). Rode: node motor/render.js projetos/{P.slug}")
        else:
            if not b["midias"]:
                erros.append(f"{rot}: sem VISUAL e sem IMAGEM.")
            for m in b["midias"]:
                arq = P.achar(m)
                inicio = float(m.split("@")[1]) if "@" in m else 0.0
                if not arq:
                    erros.append(f"{rot}: '{m}' não existe em assets/imagens ou assets/clipes.")
                    continue
                tipo = "clipe" if arq.suffix.lower() in EXT_VID else "imagem"
                b["midias_resolvidas"].append({"arquivo": str(arq), "inicio_clipe": inicio, "tipo": tipo,
                                               "duracao_clipe": duracao_midia(arq) if tipo == "clipe" else 0})
        if not b["fala"]:
            avisos.append(f"{rot}: sem FALA (fica sem narração e sem legenda).")
        texto = (b["fala"] + " " + b["texto_tela"]).lower()
        achadas = sorted({p for p in proibidas if re.search(r"\b" + re.escape(p), texto)})
        if achadas:
            avisos.append(f"{rot}: palavras que a marca evita: {', '.join(achadas)}.")
    if "?" not in blocos[-1]["fala"]:
        avisos.append("Último bloco sem pergunta pro público (CTA de comentário).")
    return erros, avisos


# ───────────────────────── planos ─────────────────────────
def montar_tomadas(blocos):
    tomadas, i_mov = [], 0
    for b in blocos:
        midias = b["midias_resolvidas"]
        n = max(len(midias), math.ceil(b["duracao"] / TOMADA_MAX - 1e-9))
        usado = {}
        for k in range(n):
            ini = b["inicio"] + b["duracao"] * k / n
            fim = b["inicio"] + b["duracao"] * (k + 1) / n
            frames = round(fim * 30) - round(ini * 30)
            j = k % len(midias)
            m = dict(midias[j])
            if m["tipo"] == "clipe":  # clipe dividido em planos continua de onde parou
                resto = max(m["duracao_clipe"] - m["inicio_clipe"], 0.5)
                m["inicio_clipe"] += usado.get(j, 0.0) % resto
                usado[j] = usado.get(j, 0.0) + frames / 30
            tomadas.append({"indice": len(tomadas), "bloco": b["numero"], "primeira_do_bloco": k == 0, "frames": frames,
                            "movimento": MOVIMENTOS[i_mov % len(MOVIMENTOS)], **m})
            i_mov += 1
    return tomadas


def expr_movimento(mov, n):
    z, p = 0.16, f"(on/{max(n - 1, 1)})"
    cx, cy = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    return {"zoom_in": (f"1+{z}*{p}", cx, cy), "zoom_out": (f"1+{z}*(1-{p})", cx, cy),
            "zoom_in_esq": (f"1+{z}*{p}", f"(iw-iw/zoom)*(0.5-0.35*{p})", cy),
            "zoom_out_dir": (f"1+{z}*(1-{p})", f"(iw-iw/zoom)*(0.5+0.35*{p})", cy),
            "pan_cima": (f"{1 + z}", cx, f"(ih-ih/zoom)*(1-{p})"), "pan_baixo": (f"{1 + z}", cx, f"(ih-ih/zoom)*{p}")}[mov]


def render_tomada(tom, tmp, cfg):
    w, h, n = cfg["w"], cfg["h"], tom["frames"]
    saida = tmp / f"tomada_{tom['indice']:03d}.mp4"
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    if tom["tipo"] == "clipe":
        cmd += ["-ss", f"{tom['inicio_clipe']:.3f}", "-i", tom["arquivo"]]
        base = (f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1,fps=30,"
                f"tpad=stop_mode=clone:stop_duration={n / 30 + 1},trim=end_frame={n},setpts=PTS-STARTPTS")
    else:
        cmd += ["-i", tom["arquivo"]]
        zx, xx, yx = expr_movimento(tom["movimento"], n)
        base = (f"[0:v]scale={2 * w}:{2 * h}:force_original_aspect_ratio=increase,crop={2 * w}:{2 * h},setsar=1,format=yuv444p,"
                f"zoompan=z='{zx}':x='{xx}':y='{yx}':d={n}:s={w}x{h}:fps=30")
    lim = f"{n / 30 + 1:.3f}"  # entradas em loop com fim: o ffmpeg nunca fica esperando pra sempre
    cmd += ["-loop", "1", "-framerate", "30", "-t", lim, "-i", str(cfg["moldura"]),
            "-loop", "1", "-framerate", "30", "-t", lim, "-i", str(cfg["textos"][tom["bloco"]])]
    grao = ",noise=alls=4:allf=t" if cfg["grao"] else ""
    fade = ",fade=t=in:st=0:d=0.3:alpha=1" if tom["primeira_do_bloco"] else ""
    filtro = (f"{base}{grao}[bg];[1:v]scale={w}:{h},format=rgba[mo];[2:v]scale={w}:{h},format=rgba{fade}[tx];"
              f"[bg][mo]overlay=0:0:shortest=1[b2];[b2][tx]overlay=0:0:shortest=1,format=yuv420p[v]")
    cmd += ["-filter_complex", filtro, "-map", "[v]", "-frames:v", str(n), "-r", "30", "-c:v", "libx264", "-preset", cfg["preset"],
            "-crf", "18", "-pix_fmt", "yuv420p", "-threads", "2", "-an", str(saida)]
    rodar(cmd)
    return saida


# ───────────────────────── gráficos ─────────────────────────
def quebrar(texto, fonte, largura):
    linhas, atual = [], ""
    for p in texto.split():
        t = f"{atual} {p}".strip()
        if fonte.getlength(t) <= largura or not atual:
            atual = t
        else:
            linhas.append(atual)
            atual = p
    return linhas + ([atual] if atual else [])


def render_titulo(P: Projeto, texto, destino):
    """TEXTO_TELA no terço superior, no estilo de título da marca: neon | brilho | limpo."""
    W, H, e = P.W, P.H, min(P.W, P.H) / 1080
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    texto = limpar_marcacao(texto).strip()
    if P.marca["titulo"].get("caixa_alta", True):
        texto = texto.upper()
    if texto:
        fp = P.fonte("titulo")
        tam = int(132 * e)
        while True:
            f = ImageFont.truetype(str(fp), tam)
            linhas = quebrar(texto, f, W * 0.86)
            if (len(linhas) <= 3 and all(f.getlength(l) <= W * 0.9 for l in linhas)) or tam <= 56 * e:
                break
            tam -= max(1, int(6 * e))
        alt = int(tam * 1.12)
        y0 = max(int(P.rede["seguro"]["topo"] + 10 * e), int(P.H * P.rede["titulo_y"] - alt * len(linhas) / 2))

        def desenhar(cam, dx, dy, cor, contorno, cor_c):
            d = ImageDraw.Draw(cam)
            for i, l in enumerate(linhas):
                d.text(((W - f.getlength(l)) / 2 + dx, y0 + i * alt + dy), l, font=f, fill=cor, stroke_width=int(contorno), stroke_fill=cor_c)

        def nova():
            return Image.new("RGBA", (W, H), (0, 0, 0, 0))

        estilo = P.marca["titulo"].get("estilo", "neon")
        pri, sec, esc = P.cor("principal"), P.cor("secundaria"), P.cor("escura")
        if estilo in ("neon", "brilho"):
            br = nova(); desenhar(br, 0, 0, pri + (255,), 16 * e, pri + (255,)); br = br.filter(ImageFilter.GaussianBlur(28 * e))
            img = Image.alpha_composite(Image.alpha_composite(img, br), br)
            if estilo == "neon":  # aberração cromática nas cores da marca
                ab = nova(); desenhar(ab, -7 * e, 0, sec + (210,), 5 * e, sec + (210,)); desenhar(ab, 7 * e, 0, pri + (210,), 5 * e, pri + (210,))
                img = Image.alpha_composite(img, ab)
            pr = nova(); desenhar(pr, 0, 0, (255, 255, 255, 255), 6 * e, esc + (255,)); img = Image.alpha_composite(img, pr)
        else:  # limpo: branco, sombra suave e um traço na cor principal
            sb = nova(); desenhar(sb, 0, 6 * e, (0, 0, 0, 200), 8 * e, (0, 0, 0, 200)); sb = sb.filter(ImageFilter.GaussianBlur(10 * e))
            img = Image.alpha_composite(img, sb)
            pr = nova(); desenhar(pr, 0, 0, (255, 255, 255, 255), 0, (0, 0, 0, 0)); img = Image.alpha_composite(img, pr)
            yb = y0 + alt * len(linhas) + 14 * e
            ImageDraw.Draw(img).rectangle([W / 2 - 60 * e, yb, W / 2 + 60 * e, yb + 8 * e], fill=pri + (255,))
    img.save(destino)


def render_moldura(P: Projeto, destino):
    """Degradês escuros no topo e na base: leitura do título e das legendas."""
    W, H, fundo = P.W, P.H, P.cor("fundo")
    alfas = []
    for y in range(H):
        p = y / H
        a = 150 * (1 - p / 0.4) ** 1.5 if p < 0.4 else (190 * ((p - 0.58) / 0.42) ** 1.3 if p > 0.58 else 0)
        alfas.append(int(a))
    m = Image.new("L", (1, H)); m.putdata(alfas)
    img = Image.new("RGBA", (W, H), fundo + (0,)); img.putalpha(m.resize((W, H))); img.save(destino)


def palavras_destaque(fala):
    out, g = [], 0
    for parte in re.split(r"(\*[^*]+\*)", fala):
        if parte.startswith("*") and parte.endswith("*") and len(parte) > 2:
            g += 1; out += [(p, g) for p in parte[1:-1].split()]
        else:
            out += [(p, 0) for p in parte.replace("*", "").split()]
    return out


def fatiar(pal, maxp=6):
    ped, at = [], []
    for p in pal:
        at.append(p); t = p[0]
        if len(at) >= maxp or (t[-1:] in ".!?;:…" and len(at) >= 2) or (t.endswith(",") and len(at) >= 4):
            ped.append(at); at = []
    if at:
        if ped and len(at) == 1 and len(ped[-1]) < maxp:
            ped[-1] += at
        else:
            ped.append(at)
    return ped


def gerar_legendas(P: Projeto, blocos, familia, negrito, dest_ass, dest_srt, atraso=0.12):
    e = min(P.W, P.H) / 1080
    ev = []
    for b in blocos:
        if not b["fala"]:
            continue
        ped = fatiar(palavras_destaque(b["fala"]))
        pesos = [sum(len(w) for w, _ in p) + 3 * len(p) for p in ped]
        fala_fim = b.get("fim_fala", b["fim"] - 0.05)
        t, soma = b["inicio"] + atraso, sum(pesos)
        for p, w in zip(ped, pesos):
            d = (fala_fim - b["inicio"] - atraso) * w / soma
            ev.append((t, t + d, p)); t += d
    pri, sec = P.cor("principal"), P.cor("secundaria")
    margem = P.cfg.get("legenda_margem", P.rede["legenda_margem"])
    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {P.W}
PlayResY: {P.H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: L,{familia},{int(76 * e)},&H00FFFFFF,&H00FFFFFF,{ass_cor(P.cor('fundo'))},&H80000000,{-1 if negrito else 0},0,0,0,100,100,0,0,1,{max(3, int(6 * e))},0,2,{int(90 * e)},{int(90 * e) + P.rede['seguro'].get('direita', 0) // 2},{margem},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    la, ls = [], []
    for i, (a, b, p) in enumerate(ev, 1):
        partes = []
        for w, g in p:
            w = w.replace("{", "(").replace("}", ")")
            partes.append(f"{{\\c{ass_cor(pri if g % 2 else sec)}}}{w}{{\\r}}" if g else w)
        la.append(f"Dialogue: 0,{fmt_ass(a)},{fmt_ass(b)},L,,0,0,0,,{{\\blur1}}{' '.join(partes)}")
        ls.append(f"{i}\n{fmt_srt(a)} --> {fmt_srt(b)}\n{' '.join(w for w, _ in p)}\n")
    dest_ass.write_text(cab + "\n".join(la) + "\n", encoding="utf-8")
    dest_srt.write_text("\n".join(ls), encoding="utf-8")
    return len(ev)


def mixar(video, narr, trilha, total, vol, tmp, destino, cfg):
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(video)]
    fmt = "aformat=sample_rates=48000:channel_layouts=stereo"
    fim = f"loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,afade=t=out:st={max(total - 1.5, 0):.2f}:d=1.5,atrim=0:{total:.3f}"
    if narr and trilha:
        cmd += ["-i", str(narr), "-stream_loop", "-1", "-i", str(trilha)]
        audio = f"[1:a]{fmt},apad=whole_dur={total:.3f}[n];[2:a]{fmt},volume={vol}[t];[n][t]amix=inputs=2:duration=first:normalize=0,{fim}[a]"
    elif narr:
        cmd += ["-i", str(narr)]
        audio = f"[1:a]{fmt},apad=whole_dur={total:.3f},{fim}[a]"
    elif trilha:  # prévia sem voz: trilha alta
        cmd += ["-stream_loop", "-1", "-i", str(trilha)]
        audio = f"[1:a]{fmt},volume=0.8,{fim}[a]"
    else:
        audio = f"anullsrc=r=48000:cl=stereo,atrim=0:{total:.3f}[a]"
    cmd += ["-filter_complex", f"[0:v]ass=legendas.ass:fontsdir=fontes[v];{audio}", "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-preset", cfg["preset"], "-crf", "20", "-maxrate", cfg["maxrate"], "-bufsize", "16M", "-pix_fmt", "yuv420p",
            "-r", "30", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-t", f"{total:.3f}", str(destino)]
    rodar(cmd, cwd=tmp)


# ───────────────────────── main ─────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("projeto")
    ap.add_argument("--validar", action="store_true")
    ap.add_argument("--rapido", action="store_true", help="prévia em meia resolução")
    ap.add_argument("--sem-voz", action="store_true", help="ignora a narração (prévia só com trilha)")
    ap.add_argument("--volume-trilha", type=float, default=0.12, help="0.12 ≈ -18 dB abaixo da voz")
    ap.add_argument("--sem-grao", action="store_true")
    ap.add_argument("--manter-temp", action="store_true")
    a = ap.parse_args()
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg não encontrado (rode setup.sh)")

    P = Projeto(a.projeto)
    blocos = ler_roteiro(P.roteiro)
    erros, avisos = validar(P, blocos)
    total = sum(b["duracao"] for b in blocos)

    narr = None if a.sem_voz else (P.build / "narracao.wav" if (P.build / "narracao.wav").is_file() else None)
    trilha = P.trilha_propria() or (P.build / "trilha.wav" if (P.build / "trilha.wav").is_file() else None)
    dj = P.build / "duracoes.json"
    if narr and dj.is_file():  # legendas acompanham o fim real de cada fala
        for b, f in zip(blocos, json.loads(dj.read_text()).get("falas", [])):
            b["fim_fala"] = b["inicio"] + 0.12 + f
    if not narr and not a.sem_voz:
        avisos.append(f"Sem narração (build/narracao.wav). Gere com: python scripts/narrar.py projetos/{P.slug}")

    print(f"\n▶ {P.cfg.get('titulo', P.slug)} — {P.rede['nome']} {P.W}x{P.H} — estilo {P.estilo} — marca {P.marca['nome']}")
    print(f"  {len(blocos)} blocos, {total:.1f}s | voz: {'sim' if narr else 'não'} | trilha: {trilha.name if trilha else '—'}")
    for x in erros:
        print("  ✖", x)
    for x in avisos:
        print("  ⚠", x)
    if total < P.rede["dur_min"]:
        print(f"  ⚠ {total:.1f}s está abaixo do mínimo de {P.rede['dur_min']}s para {P.rede['nome']}. {P.rede.get('nota', '')}")
    if total > P.rede["dur_max"]:
        print(f"  ⚠ {total:.1f}s passa do máximo de {P.rede['dur_max']}s para {P.rede['nome']}.")
    if erros:
        sys.exit(1)
    if a.validar:
        print("  ✔ validação ok\n")
        return

    fator = 0.5 if a.rapido else 1
    w, h = int(P.W * fator) // 2 * 2, int(P.H * fator) // 2 * 2
    P.saida.mkdir(parents=True, exist_ok=True)
    destino = P.saida / (f"{P.slug}_previa.mp4" if a.rapido else f"{P.slug}.mp4")
    tmp = Path(tempfile.mkdtemp(prefix="montar_", dir=P.saida))
    try:
        fl = P.fonte("legenda")
        (tmp / "fontes").mkdir()
        shutil.copy(fl, tmp / "fontes" / fl.name)
        fam, est = ImageFont.truetype(str(fl), 20).getname()
        negrito = "bold" in est.lower() or "dejavu" in fl.name.lower()
        moldura = tmp / "moldura.png"
        render_moldura(P, moldura)
        textos = {}
        for b in blocos:
            textos[b["numero"]] = tmp / f"titulo_{b['numero']:02d}.png"
            render_titulo(P, b["texto_tela"], textos[b["numero"]])
        tomadas = montar_tomadas(blocos)
        cfg = {"w": w, "h": h, "moldura": moldura, "textos": textos, "grao": not a.sem_grao,
               "preset": "ultrafast" if a.rapido else "veryfast", "maxrate": "3M" if a.rapido else "8M"}
        print(f"  Renderizando {len(tomadas)} planos {w}x{h}...", flush=True)
        with ThreadPoolExecutor(max_workers=max(1, (os.cpu_count() or 2) // 2)) as ex:
            arqs = list(ex.map(lambda t: render_tomada(t, tmp, cfg), tomadas))
        (tmp / "lista.txt").write_text("".join(f"file '{x.name}'\n" for x in arqs))
        rodar(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "lista.txt", "-c", "copy", "mudo.mp4"], cwd=tmp)
        srt = P.saida / f"{P.slug}.srt"
        n = gerar_legendas(P, blocos, fam, negrito, tmp / "legendas.ass", srt)
        print(f"  Mixando áudio e queimando {n} legendas...", flush=True)
        mixar(tmp / "mudo.mp4", narr, trilha, total, a.volume_trilha, tmp, destino, cfg)
    finally:
        if not a.manter_temp:
            shutil.rmtree(tmp, ignore_errors=True)
    d = duracao_midia(destino)
    ok = "✔ dentro do formato da rede" if P.rede["dur_min"] <= d <= P.rede["dur_max"] else "⚠ fora da duração da rede"
    print(f"\n✔ Pronto: projetos/{P.slug}/saida/{destino.name}")
    print(f"  {d:.1f}s | {destino.stat().st_size / 1048576:.1f} MB | {ok}\n")


if __name__ == "__main__":
    main()
