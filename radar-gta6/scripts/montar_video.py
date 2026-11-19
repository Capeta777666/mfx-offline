#!/usr/bin/env python3
"""
montar_video.py — orquestrador ffmpeg do canal @radar.gta6

Recebe um roteiro em markdown (roteiros/<nome>.md) + imagens/clipes e devolve
saida/<nome>.mp4: 1080x1920, 30fps, Ken Burns, cortes a cada 2-3s, texto de
tela neon, legendas queimadas, narração em 0 dB e trilha em ~-18 dB.

Uso:
    python scripts/montar_video.py roteiros/dia-lancamento.md
    python scripts/montar_video.py roteiros/dia-lancamento.md --validar   # só confere, não renderiza
    python scripts/montar_video.py roteiros/dia-lancamento.md --rapido    # prévia 540x960 em segundos

Formato do roteiro (cada bloco):
    ## BLOCO 1 — Gancho (0-4s)
    IMAGEM: 01.png, 02.png          (vírgula = várias imagens no bloco; .mp4 = clipe de assets/clipes;
                                     clipe.mp4@12.5 = começa no segundo 12.5 do clipe)
    TEXTO_TELA: GTA 6 JÁ ESTÁ NO AR
    FALA: Acabou a espera. O *GTA 6* destravou à meia-noite...
                                    (*palavra* = destaque em rosa/ciano na legenda)

Dependências: ffmpeg (com libass) e Pillow (pip install pillow).
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

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
except ImportError:  # pragma: no cover
    sys.exit("Falta o Pillow. Rode: pip install pillow")

RAIZ = Path(__file__).resolve().parent.parent
FPS = 30
W_FINAL, H_FINAL = 1080, 1920
TOMADA_MAX = 3.0          # nenhum plano passa de 3s (regra: corte a cada 2-3s, nunca >4s)
DURACAO_MIN = 60.0        # Programa de Recompensas
DURACAO_MAX = 180.0
PALAVRAS_POR_SEGUNDO = 2.6  # ritmo médio de narração em PT-BR, usado quando o bloco não tem tempo

ROXO = (0x2A, 0x0A, 0x4A)
ROSA = (0xFF, 0x2D, 0x95)
CIANO = (0x00, 0xF0, 0xFF)
LARANJA = (0xFF, 0x8C, 0x42)
PRETO = (0x0B, 0x02, 0x18)

EXT_IMAGEM = {".png", ".jpg", ".jpeg", ".webp"}
EXT_VIDEO = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
EXT_AUDIO = {".wav", ".m4a", ".mp3", ".aac", ".ogg", ".flac"}

MOVIMENTOS = ["zoom_in", "pan_baixo", "zoom_out", "zoom_in_esq", "pan_cima", "zoom_out_dir"]

# Vocabulário que derruba alcance/monetização (seção 3 do CLAUDE.md). Só avisa, não bloqueia.
RE_VIOLENCIA = re.compile(
    r"\b(mat(ar|a|ou|ando|aram|em)|assassin\w*|homic[ií]d\w*|tr[aá]fic\w*|sangu\w*|tiroteio\w*|"
    r"atir(ar|a|ou|ando)\w*|armas?|mortes?|mort[oa]s?|estupr\w*|drogas?|coca[ií]na|sequestr\w*|"
    r"tortur\w*|chacina\w*|esfaque\w*|execut(ar|ou|ado)\w*)\b",
    re.IGNORECASE,
)


# ───────────────────────────── utilidades ─────────────────────────────

def ass_cor(rgb: tuple[int, int, int]) -> str:
    """#RRGGBB -> &H00BBGGRR (ASS usa BGR)."""
    r, g, b = rgb
    return f"&H00{b:02X}{g:02X}{r:02X}"


def rodar(cmd: list[str], cwd: Path | None = None) -> None:
    res = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if res.returncode != 0:
        sys.stderr.write("\n[ffmpeg falhou]\n" + " ".join(cmd) + "\n" + res.stderr[-3000:] + "\n")
        raise SystemExit(1)


def duracao_midia(caminho: Path) -> float:
    res = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(caminho)],
        capture_output=True, text=True,
    )
    try:
        return float(res.stdout.strip())
    except ValueError:
        raise SystemExit(f"Não consegui ler a duração de {caminho}")


def parse_tempo(txt: str) -> float:
    txt = txt.strip().replace(",", ".")
    if ":" in txt:
        m, s = txt.split(":", 1)
        return int(m) * 60 + float(s)
    return float(txt)


def fmt_ass(t: float) -> str:
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def fmt_srt(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


# ───────────────────────────── roteiro ─────────────────────────────

RE_BLOCO = re.compile(r"^##\s*BLOCO\s*(\d+)\s*[—–\-:]*\s*(.*?)\s*(?:\(([^)]*)\))?\s*$", re.IGNORECASE)
RE_CAMPO = re.compile(r"^(IMAGE[MN]S?|CLIPES?|TEXTO_TELA|FALA|DURA[CÇ][AÃ]O)\s*:\s*(.*)$", re.IGNORECASE)
RE_INTERVALO = re.compile(
    r"^\s*(\d+(?::\d+)?(?:[.,]\d+)?)\s*s?\s*(?:-|–|—|a|até)\s*(\d+(?::\d+)?(?:[.,]\d+)?)\s*s?\s*$",
    re.IGNORECASE,
)


def ler_roteiro(caminho: Path) -> list[dict]:
    blocos: list[dict] = []
    atual: dict | None = None
    ultimo_campo: str | None = None

    for n_linha, bruta in enumerate(caminho.read_text(encoding="utf-8").splitlines(), 1):
        linha = bruta.strip()
        m = RE_BLOCO.match(linha)
        if m:
            titulo, parenteses = m.group(2), m.group(3)
            intervalo = None
            if parenteses:
                mi = RE_INTERVALO.match(parenteses)
                if mi:
                    intervalo = (parse_tempo(mi.group(1)), parse_tempo(mi.group(2)))
                else:
                    titulo = f"{titulo} ({parenteses})".strip()
            atual = {"numero": int(m.group(1)), "titulo": titulo, "intervalo": intervalo,
                     "midias": [], "texto_tela": "", "fala": "", "duracao_declarada": None,
                     "linha": n_linha}
            blocos.append(atual)
            ultimo_campo = None
            continue
        if atual is None:
            continue
        if not linha or linha.startswith(">") or linha.startswith("<!--"):
            ultimo_campo = None
            continue
        mc = RE_CAMPO.match(linha)
        if mc:
            chave, valor = mc.group(1).upper(), mc.group(2).strip()
            if chave.startswith("IMAGE") or chave.startswith("CLIPE"):
                atual["midias"] += [v.strip() for v in valor.split(",") if v.strip()]
                ultimo_campo = None
            elif chave == "TEXTO_TELA":
                atual["texto_tela"] = valor
                ultimo_campo = "texto_tela"
            elif chave == "FALA":
                atual["fala"] = valor
                ultimo_campo = "fala"
            else:  # DURACAO
                atual["duracao_declarada"] = parse_tempo(valor.rstrip("sS "))
                ultimo_campo = None
        elif ultimo_campo:  # continuação de FALA/TEXTO_TELA em várias linhas
            atual[ultimo_campo] = (atual[ultimo_campo] + " " + linha).strip()

    for b in blocos:
        if b["duracao_declarada"]:
            b["duracao"], b["origem_duracao"] = b["duracao_declarada"], "DURACAO"
        elif b["intervalo"] and b["intervalo"][1] > b["intervalo"][0]:
            b["duracao"], b["origem_duracao"] = b["intervalo"][1] - b["intervalo"][0], "cabeçalho"
        else:
            palavras = len(limpar_marcacao(b["fala"]).split())
            b["duracao"] = max(2.5, round(palavras / PALAVRAS_POR_SEGUNDO, 1))
            b["origem_duracao"] = "estimada pela fala"
    return blocos


def limpar_marcacao(txt: str) -> str:
    return txt.replace("*", "")


# ───────────────────────────── mídia ─────────────────────────────

def achar_midia(nome: str, nome_roteiro: str, pasta_imagens: Path, pasta_clipes: Path) -> tuple[Path | None, float, str]:
    """Devolve (caminho, inicio_clipe, tipo)."""
    inicio = 0.0
    if "@" in nome:
        nome, ini = nome.rsplit("@", 1)
        inicio = parse_tempo(ini)
    ext = Path(nome).suffix.lower()
    tipo = "clipe" if ext in EXT_VIDEO else "imagem"
    base = pasta_clipes if tipo == "clipe" else pasta_imagens
    for cand in (base / nome_roteiro / nome, base / nome, RAIZ / nome, Path(nome)):
        if cand.is_file():
            return cand.resolve(), inicio, tipo
    return None, inicio, tipo


def achar_audio(pasta: Path, nome_roteiro: str, explicito: str | None, rotulo: str,
                avisos: list[str], aceitar_unico: bool) -> Path | None:
    if explicito:
        p = Path(explicito)
        if not p.is_file():
            raise SystemExit(f"{rotulo} não encontrada: {explicito}")
        return p.resolve()
    arquivos = sorted(p for p in pasta.glob("*") if p.suffix.lower() in EXT_AUDIO)
    for p in arquivos:
        if p.stem == nome_roteiro:
            return p.resolve()
    if arquivos and aceitar_unico:
        if len(arquivos) > 1:
            avisos.append(f"{rotulo}: nenhum arquivo chamado '{nome_roteiro}.*' — usando {arquivos[0].name}.")
        return arquivos[0].resolve()
    return None


def achar_fonte() -> Path:
    pasta = RAIZ / "assets" / "fontes"
    proprias = sorted(p for p in pasta.glob("*") if p.suffix.lower() in {".ttf", ".otf"})
    if proprias:
        return proprias[0]
    candidatas = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Black.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "C:/Windows/Fonts/ariblk.ttf",
        "C:/Windows/Fonts/impact.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
    ]
    for c in candidatas:
        if Path(c).is_file():
            return Path(c)
    raise SystemExit("Nenhuma fonte encontrada. Coloque um .ttf em assets/fontes/ (ex.: Anton ou Bebas Neue).")


# ───────────────────────────── planejamento ─────────────────────────────

def planejar(blocos: list[dict], args, nome: str) -> tuple[list[dict], list[str], list[str], float]:
    erros: list[str] = []
    avisos: list[str] = []
    pasta_img = Path(args.imagens).resolve() if args.imagens else RAIZ / "assets" / "imagens"
    pasta_clip = RAIZ / "assets" / "clipes"

    if not blocos:
        erros.append("Nenhum bloco encontrado. Os blocos começam com '## BLOCO 1 — título (0-4s)'.")
        return [], erros, avisos, 0.0

    for b in blocos:
        rot = f"BLOCO {b['numero']}"
        b["midias_resolvidas"] = []
        if not b["midias"]:
            erros.append(f"{rot}: sem IMAGEM.")
        for m in b["midias"]:
            caminho, inicio, tipo = achar_midia(m, nome, pasta_img, pasta_clip)
            if caminho is None:
                onde = "assets/clipes" if tipo == "clipe" else str(pasta_img.relative_to(RAIZ) if pasta_img.is_relative_to(RAIZ) else pasta_img)
                erros.append(f"{rot}: '{m}' não existe em {onde}/ (nem em {onde}/{nome}/).")
            else:
                dur = duracao_midia(caminho) if tipo == "clipe" else 0.0
                if tipo == "clipe" and inicio >= dur:
                    erros.append(f"{rot}: '{m}' começa em {inicio}s mas o clipe só tem {dur:.1f}s.")
                b["midias_resolvidas"].append({"arquivo": str(caminho), "inicio_clipe": inicio,
                                               "tipo": tipo, "duracao_clipe": dur})
        if not b["fala"]:
            avisos.append(f"{rot}: sem FALA — esse trecho fica sem legenda.")
        if b["origem_duracao"] == "estimada pela fala":
            avisos.append(f"{rot}: sem tempo no cabeçalho — estimei {b['duracao']:.1f}s pela fala.")
        for campo in ("fala", "texto_tela"):
            achadas = sorted({x.group(0).lower() for x in RE_VIOLENCIA.finditer(b[campo])})
            if achadas:
                avisos.append(f"{rot}: vocabulário sensível em {campo.upper()}: {', '.join(achadas)} "
                              "— trocar por formulação neutra (regra de algoritmo).")

    ultima = blocos[-1]["fala"].lower()
    if "salv" not in ultima or "?" not in ultima:
        avisos.append("Último bloco sem CTA completo: precisa pedir pra SALVAR e fazer uma PERGUNTA aberta.")

    total = sum(b["duracao"] for b in blocos)
    return blocos, erros, avisos, total


def montar_tomadas(blocos: list[dict]) -> list[dict]:
    tomadas: list[dict] = []
    t = 0.0
    i_mov = 0
    for b in blocos:
        b["inicio"], b["fim"] = t, t + b["duracao"]
        midias = b["midias_resolvidas"]
        n = max(len(midias), math.ceil(b["duracao"] / TOMADA_MAX - 1e-9))
        b["n_tomadas"] = n
        usado: dict[int, float] = {}  # clipe usado em vários planos continua de onde parou
        for k in range(n):
            ini = b["inicio"] + b["duracao"] * k / n
            fim = b["inicio"] + b["duracao"] * (k + 1) / n
            frames = round(fim * FPS) - round(ini * FPS)
            midia = dict(midias[k % len(midias)])
            if midia["tipo"] == "clipe":
                j = k % len(midias)
                # se o clipe acabar, dá a volta e recomeça do ponto de entrada
                resto = max(midia["duracao_clipe"] - midia["inicio_clipe"], 0.5)
                midia["inicio_clipe"] += usado.get(j, 0.0) % resto
                usado[j] = usado.get(j, 0.0) + frames / FPS
            tomadas.append({
                "indice": len(tomadas), "bloco": b["numero"], "primeira_do_bloco": k == 0,
                "inicio": round(ini, 3), "fim": round(fim, 3), "frames": frames,
                "movimento": MOVIMENTOS[i_mov % len(MOVIMENTOS)], **midia,
            })
            i_mov += 1
        t = b["fim"]
    return tomadas


# ───────────────────────────── gráficos (Pillow) ─────────────────────────────

def quebrar_linhas(texto: str, fonte, largura_max: int) -> list[str]:
    linhas, atual = [], ""
    for palavra in texto.split():
        teste = f"{atual} {palavra}".strip()
        if fonte.getlength(teste) <= largura_max or not atual:
            atual = teste
        else:
            linhas.append(atual)
            atual = palavra
    if atual:
        linhas.append(atual)
    return linhas


def render_texto_tela(texto: str, fonte_path: Path, destino: Path) -> None:
    """TEXTO_TELA em caixa alta, terço superior, brilho rosa + aberração cromática rosa/ciano."""
    img = Image.new("RGBA", (W_FINAL, H_FINAL), (0, 0, 0, 0))
    texto = limpar_marcacao(texto).upper().strip()
    if texto:
        tamanho = 136
        while True:
            fonte = ImageFont.truetype(str(fonte_path), tamanho)
            linhas = quebrar_linhas(texto, fonte, 940)
            largura_ok = all(fonte.getlength(l) <= 980 for l in linhas)
            if (len(linhas) <= 3 and largura_ok) or tamanho <= 64:
                break
            tamanho -= 8
        alt_linha = int(tamanho * 1.12)
        y0 = 370 - (alt_linha * len(linhas)) // 2  # centro ~19% da altura, logo abaixo da UI do TikTok

        def desenhar(camada, dx, dy, cor, contorno, cor_contorno):
            d = ImageDraw.Draw(camada)
            for i, l in enumerate(linhas):
                x = (W_FINAL - fonte.getlength(l)) / 2 + dx
                d.text((x, y0 + i * alt_linha + dy), l, font=fonte, fill=cor,
                       stroke_width=contorno, stroke_fill=cor_contorno)

        brilho = Image.new("RGBA", img.size, (0, 0, 0, 0))
        desenhar(brilho, 0, 0, ROSA + (255,), 16, ROSA + (255,))
        brilho = brilho.filter(ImageFilter.GaussianBlur(28))
        img = Image.alpha_composite(img, brilho)
        img = Image.alpha_composite(img, brilho)

        aberracao = Image.new("RGBA", img.size, (0, 0, 0, 0))
        desenhar(aberracao, -7, 0, CIANO + (210,), 5, CIANO + (210,))
        desenhar(aberracao, 7, 0, ROSA + (210,), 5, ROSA + (210,))
        img = Image.alpha_composite(img, aberracao)

        principal = Image.new("RGBA", img.size, (0, 0, 0, 0))
        desenhar(principal, 0, 0, (255, 255, 255, 255), 6, ROXO + (255,))
        img = Image.alpha_composite(img, principal)
    img.save(destino)


def render_moldura(destino: Path) -> None:
    """Degradês escuros no topo e na base pra garantir leitura do texto e das legendas."""
    alfas = []
    for y in range(H_FINAL):
        p = y / H_FINAL
        if p < 0.40:
            a = 150 * (1 - p / 0.40) ** 1.5
        elif p > 0.58:
            a = 190 * ((p - 0.58) / 0.42) ** 1.3
        else:
            a = 0
        alfas.append(int(a))
    mascara = Image.new("L", (1, H_FINAL))
    mascara.putdata(alfas)
    mascara = mascara.resize((W_FINAL, H_FINAL))
    img = Image.new("RGBA", (W_FINAL, H_FINAL), PRETO + (0,))
    img.putalpha(mascara)
    img.save(destino)


# ───────────────────────────── legendas ─────────────────────────────

def palavras_com_destaque(fala: str) -> list[tuple[str, int]]:
    """Separa a fala em palavras; *trechos* recebem um id de destaque (1, 2, 3...)."""
    saida, grupo = [], 0
    for parte in re.split(r"(\*[^*]+\*)", fala):
        if parte.startswith("*") and parte.endswith("*") and len(parte) > 2:
            grupo += 1
            saida += [(p, grupo) for p in parte[1:-1].split()]
        else:
            saida += [(p, 0) for p in parte.replace("*", "").split()]
    return saida


def fatiar(palavras: list[tuple[str, int]], max_palavras: int = 6) -> list[list[tuple[str, int]]]:
    pedacos, atual = [], []
    for p in palavras:
        atual.append(p)
        texto = p[0]
        fim_frase = texto[-1:] in ".!?;:…"
        virgula = texto.endswith(",")
        if len(atual) >= max_palavras or (fim_frase and len(atual) >= 2) or (virgula and len(atual) >= 4):
            pedacos.append(atual)
            atual = []
    if atual:
        if pedacos and len(atual) == 1 and len(pedacos[-1]) < max_palavras:
            pedacos[-1] += atual
        else:
            pedacos.append(atual)
    return pedacos


def gerar_legendas(blocos: list[dict], fonte_nome: str, negrito: bool, dest_ass: Path, dest_srt: Path, margem: int = 500) -> int:
    eventos = []
    for b in blocos:
        if not b["fala"]:
            continue
        pedacos = fatiar(palavras_com_destaque(b["fala"]))
        pesos = [sum(len(w) for w, _ in p) + 3 * len(p) for p in pedacos]
        ini_janela, fim_janela = b["inicio"] + 0.05, b["fim"] - 0.05
        t, soma = ini_janela, sum(pesos)
        for p, peso in zip(pedacos, pesos):
            dur = (fim_janela - ini_janela) * peso / soma
            eventos.append((t, t + dur, p))
            t += dur

    cabecalho = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W_FINAL}
PlayResY: {H_FINAL}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Radar,{fonte_nome},80,&H00FFFFFF,&H00FFFFFF,{ass_cor(PRETO)},&H80000000,{-1 if negrito else 0},0,0,0,100,100,0,0,1,6,0,2,90,90,{margem},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    linhas_ass, linhas_srt = [], []
    for i, (ini, fim, pedaco) in enumerate(eventos, 1):
        partes, srt = [], []
        for palavra, grupo in pedaco:
            limpa = palavra.replace("{", "(").replace("}", ")")
            srt.append(palavra)
            if grupo:
                cor = ROSA if grupo % 2 else CIANO
                partes.append(f"{{\\c{ass_cor(cor)}}}{limpa}{{\\r}}")
            else:
                partes.append(limpa)
        linhas_ass.append(f"Dialogue: 0,{fmt_ass(ini)},{fmt_ass(fim)},Radar,,0,0,0,,{{\\blur1}}{' '.join(partes)}")
        linhas_srt.append(f"{i}\n{fmt_srt(ini)} --> {fmt_srt(fim)}\n{' '.join(srt)}\n")
    dest_ass.write_text(cabecalho + "\n".join(linhas_ass) + "\n", encoding="utf-8")
    dest_srt.write_text("\n".join(linhas_srt), encoding="utf-8")
    return len(eventos)


# ───────────────────────────── render ─────────────────────────────

def expr_movimento(mov: str, n: int) -> tuple[str, str, str]:
    z = 0.16
    p = f"(on/{max(n - 1, 1)})"
    centro_x, centro_y = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    if mov == "zoom_in":
        return f"1+{z}*{p}", centro_x, centro_y
    if mov == "zoom_out":
        return f"1+{z}*(1-{p})", centro_x, centro_y
    if mov == "zoom_in_esq":
        return f"1+{z}*{p}", f"(iw-iw/zoom)*(0.5-0.35*{p})", centro_y
    if mov == "zoom_out_dir":
        return f"1+{z}*(1-{p})", f"(iw-iw/zoom)*(0.5+0.35*{p})", centro_y
    if mov == "pan_cima":
        return f"{1 + z}", centro_x, f"(ih-ih/zoom)*(1-{p})"
    if mov == "pan_baixo":
        return f"{1 + z}", centro_x, f"(ih-ih/zoom)*{p}"
    raise ValueError(mov)


def render_tomada(tom: dict, tmp: Path, cfg: dict) -> Path:
    w, h, n = cfg["w"], cfg["h"], tom["frames"]
    saida = tmp / f"tomada_{tom['indice']:03d}.mp4"
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    if tom["tipo"] == "clipe":
        cmd += ["-ss", str(tom["inicio_clipe"]), "-i", tom["arquivo"]]
        base = (f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1,"
                f"fps={FPS},tpad=stop_mode=clone:stop_duration={n / FPS + 1},"
                f"trim=end_frame={n},setpts=PTS-STARTPTS")
    else:
        cmd += ["-i", tom["arquivo"]]
        zx, xx, yx = expr_movimento(tom["movimento"], n)
        base = (f"[0:v]scale={2 * w}:{2 * h}:force_original_aspect_ratio=increase,crop={2 * w}:{2 * h},"
                f"setsar=1,format=yuv444p,"
                f"zoompan=z='{zx}':x='{xx}':y='{yx}':d={n}:s={w}x{h}:fps={FPS}")
    lim = f"{n / FPS + 1:.3f}"  # entradas em loop com fim: o ffmpeg nunca fica esperando pra sempre
    cmd += ["-loop", "1", "-framerate", str(FPS), "-t", lim, "-i", str(cfg["moldura"]),
            "-loop", "1", "-framerate", str(FPS), "-t", lim, "-i", str(cfg["textos"][tom["bloco"]])]
    grao = ",noise=alls=4:allf=t" if cfg["grao"] else ""
    fade = ",fade=t=in:st=0:d=0.3:alpha=1" if tom["primeira_do_bloco"] else ""
    filtro = (f"{base}{grao}[bg];"
              f"[1:v]scale={w}:{h},format=rgba[mo];"
              f"[2:v]scale={w}:{h},format=rgba{fade}[tx];"
              f"[bg][mo]overlay=0:0:shortest=1[b2];"
              f"[b2][tx]overlay=0:0:shortest=1,format=yuv420p[v]")
    cmd += ["-filter_complex", filtro, "-map", "[v]", "-frames:v", str(n), "-r", str(FPS),
            "-c:v", "libx264", "-preset", cfg["preset"], "-crf", "18", "-pix_fmt", "yuv420p",
            "-threads", "2", "-an", str(saida)]
    rodar(cmd)
    return saida


def mixar_e_finalizar(video_mudo: Path, narracao: Path | None, trilha: Path | None, total: float,
                      vol_trilha: float, tmp: Path, destino: Path, cfg: dict) -> None:
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(video_mudo)]
    fmt = "aformat=sample_rates=48000:channel_layouts=stereo"
    fim = f"loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,afade=t=out:st={max(total - 1.5, 0):.2f}:d=1.5,atrim=0:{total:.3f}"
    if narracao and trilha:
        cmd += ["-i", str(narracao), "-stream_loop", "-1", "-i", str(trilha)]
        audio = (f"[1:a]{fmt},apad=whole_dur={total:.3f}[n];"
                 f"[2:a]{fmt},volume={vol_trilha}[t];"
                 f"[n][t]amix=inputs=2:duration=first:normalize=0,{fim}[a]")
    elif narracao:
        cmd += ["-i", str(narracao)]
        audio = f"[1:a]{fmt},apad=whole_dur={total:.3f},{fim}[a]"
    elif trilha and cfg.get("so_trilha"):  # prévia sem narração: só a trilha, em volume alto
        cmd += ["-stream_loop", "-1", "-i", str(trilha)]
        audio = f"[1:a]{fmt},volume=0.8,{fim}[a]"
    else:  # sem narração = vídeo mudo pra dublar no CapCut
        audio = f"anullsrc=r=48000:cl=stereo,atrim=0:{total:.3f}[a]"
    filtro = f"[0:v]ass=legendas.ass:fontsdir=fontes[v];{audio}"
    cmd += ["-filter_complex", filtro, "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-preset", cfg["preset"], "-crf", "20", "-maxrate", cfg["maxrate"], "-bufsize", "16M",
            "-pix_fmt", "yuv420p",
            "-r", str(FPS), "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
            "-movflags", "+faststart", "-t", f"{total:.3f}", str(destino)]
    rodar(cmd, cwd=tmp)


# ───────────────────────────── main ─────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description="Monta vídeo vertical do @radar.gta6 a partir de um roteiro .md")
    ap.add_argument("roteiro", help="caminho do roteiro, ex.: roteiros/dia-lancamento.md")
    ap.add_argument("--validar", action="store_true", help="só valida e gera cenas.json, sem renderizar")
    ap.add_argument("--rapido", action="store_true", help="prévia 540x960 rápida (saida/<nome>_previa.mp4)")
    ap.add_argument("--imagens", help="pasta de imagens (padrão: assets/imagens)")
    ap.add_argument("--narracao", help="arquivo de narração (padrão: assets/audio/narracao/<nome>.*)")
    ap.add_argument("--trilha", help="arquivo de trilha (padrão: assets/audio/trilha/<nome>.* ou a primeira)")
    ap.add_argument("--sem-trilha", action="store_true")
    ap.add_argument("--volume-trilha", type=float, default=0.12, help="0.12 ≈ -18 dB (padrão)")
    ap.add_argument("--sem-ajuste", action="store_true",
                    help="não esticar/encolher os blocos pra casar com a duração da narração")
    ap.add_argument("--sem-grao", action="store_true", help="desliga o grão de filme")
    ap.add_argument("--manter-temp", action="store_true", help="não apaga a pasta temporária")
    ap.add_argument("--legenda-margem", type=int, default=500,
                    help="distância da legenda até a base, em px de 1920 (padrão 500; 330 em vídeo com close de rosto)")
    ap.add_argument("--so-trilha", action="store_true",
                    help="sem narração: em vez de sair mudo, usa só a trilha em volume alto (prévia)")
    args = ap.parse_args()

    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        sys.exit("ffmpeg/ffprobe não encontrados no PATH. Ubuntu/WSL: sudo apt install ffmpeg | "
                 "Windows: baixe em ffmpeg.org e adicione ao PATH.")

    roteiro = Path(args.roteiro)
    if not roteiro.is_absolute() and not roteiro.exists():
        roteiro = RAIZ / roteiro
    if not roteiro.is_file():
        sys.exit(f"Roteiro não encontrado: {args.roteiro}")
    nome = roteiro.stem

    blocos = ler_roteiro(roteiro)
    blocos, erros, avisos, total = planejar(blocos, args, nome)

    narracao = achar_audio(RAIZ / "assets/audio/narracao", nome, args.narracao, "Narração", avisos,
                           aceitar_unico=False)
    trilha = None if args.sem_trilha else achar_audio(RAIZ / "assets/audio/trilha", nome, args.trilha,
                                                      "Trilha", avisos, aceitar_unico=True)
    ajuste = None
    if narracao and not erros:
        dur_narr = duracao_midia(narracao)
        alvo = dur_narr + 0.6
        if not args.sem_ajuste and abs(alvo - total) > 0.3:
            fator = alvo / total
            for b in blocos:
                b["duracao"] *= fator
            ajuste = (total, alvo, fator)
            if abs(fator - 1) > 0.25:
                avisos.append(f"Narração ({dur_narr:.1f}s) muito diferente do roteiro ({total:.1f}s): "
                              f"blocos {'esticados' if fator > 1 else 'encolhidos'} {abs(fator - 1) * 100:.0f}%. "
                              "Confira se as legendas batem com a fala.")
            total = alvo
        elif dur_narr > total + 0.3:
            avisos.append(f"Narração ({dur_narr:.1f}s) é maior que o vídeo ({total:.1f}s) e vai ser cortada.")
    if not narracao and args.so_trilha and trilha:
        avisos.append("Sem narração: prévia com SÓ A TRILHA (--so-trilha). Pra publicar, grave a narração.")
    elif not narracao:
        avisos.append("Sem narração em assets/audio/narracao/ — o vídeo sai MUDO (sem trilha) pra você "
                      f"dublar no CapCut. Pra mixar automático, salve como assets/audio/narracao/{nome}.wav")

    tomadas = montar_tomadas(blocos) if not erros else []
    for b in blocos:
        so_imagens = all(m["tipo"] == "imagem" for m in b["midias_resolvidas"])
        if not erros and so_imagens and len(b["midias_resolvidas"]) < b.get("n_tomadas", 0):
            avisos.append(f"BLOCO {b['numero']}: {b['duracao']:.1f}s com {len(b['midias_resolvidas'])} imagem(ns) — "
                          f"repeti com movimentos diferentes em {b['n_tomadas']} planos. "
                          f"Ideal: {b['n_tomadas']} imagens diferentes.")

    cenas = {
        "roteiro": str(roteiro), "duracao_total": round(total, 2),
        "narracao": str(narracao) if narracao else None, "trilha": str(trilha) if trilha else None,
        "blocos": [{k: v for k, v in b.items() if k != "midias_resolvidas"} for b in blocos],
        "tomadas": tomadas,
    }
    (RAIZ / "scripts" / "cenas.json").write_text(json.dumps(cenas, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n▶ Roteiro: {roteiro.name} — {len(blocos)} blocos, {len(tomadas)} planos, {total:.1f}s")
    if ajuste:
        print(f"  Durações ajustadas à narração: {ajuste[0]:.1f}s → {ajuste[1]:.1f}s (×{ajuste[2]:.2f})")
    print(f"  Narração: {narracao.name if narracao else '—'} | Trilha: {trilha.name if trilha else '—'}")
    for e in erros:
        print(f"  ✖ {e}")
    for a in avisos:
        print(f"  ⚠ {a}")
    if total < DURACAO_MIN:
        print(f"  ⚠ ATENÇÃO: {total:.1f}s é MENOS de 60s — esse vídeo NÃO monetiza no Programa de Recompensas.")
    elif total > DURACAO_MAX:
        print(f"  ⚠ {total:.1f}s passa de 3 minutos — fora do formato do canal (60-180s).")
    if erros:
        sys.exit(1)
    if args.validar:
        print("  ✔ Validação ok (scripts/cenas.json gerado). Nada foi renderizado.\n")
        return

    w, h = (540, 960) if args.rapido else (W_FINAL, H_FINAL)
    destino = RAIZ / "saida" / (f"{nome}_previa.mp4" if args.rapido else f"{nome}.mp4")
    tmp = Path(tempfile.mkdtemp(prefix=f"radar_{nome}_", dir=RAIZ / "saida"))
    try:
        fonte = achar_fonte()
        (tmp / "fontes").mkdir()
        shutil.copy(fonte, tmp / "fontes" / fonte.name)
        familia = ImageFont.truetype(str(fonte), 20).getname()[0]
        negrito = "dejavu" in fonte.name.lower() or "arial" in fonte.name.lower()

        moldura = tmp / "moldura.png"
        render_moldura(moldura)
        textos = {}
        for b in blocos:
            textos[b["numero"]] = tmp / f"texto_{b['numero']:02d}.png"
            render_texto_tela(b["texto_tela"], fonte, textos[b["numero"]])

        cfg = {"w": w, "h": h, "moldura": moldura, "textos": textos, "grao": not args.sem_grao,
               "preset": "ultrafast" if args.rapido else "veryfast",
               "maxrate": "3M" if args.rapido else "8M", "so_trilha": args.so_trilha}
        print(f"  Renderizando {len(tomadas)} planos {w}x{h}...", flush=True)
        with ThreadPoolExecutor(max_workers=max(1, (os.cpu_count() or 2) // 2)) as ex:
            arquivos = list(ex.map(lambda t: render_tomada(t, tmp, cfg), tomadas))

        lista = tmp / "lista.txt"
        lista.write_text("".join(f"file '{a.name}'\n" for a in arquivos), encoding="utf-8")
        video_mudo = tmp / "video_mudo.mp4"
        rodar(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0",
               "-i", lista.name, "-c", "copy", video_mudo.name], cwd=tmp)

        srt = RAIZ / "saida" / f"{nome}.srt"
        n_leg = gerar_legendas(blocos, familia, negrito, tmp / "legendas.ass", srt, args.legenda_margem)
        print(f"  Mixando áudio e queimando {n_leg} legendas...", flush=True)
        mixar_e_finalizar(video_mudo, narracao, trilha, total, args.volume_trilha, tmp, destino, cfg)
    finally:
        if not args.manter_temp:
            shutil.rmtree(tmp, ignore_errors=True)

    dur_final = duracao_midia(destino)
    mb = destino.stat().st_size / 1_048_576
    ok = "✔ passou de 60s (monetizável)" if dur_final >= DURACAO_MIN else "✖ MENOS DE 60s — não monetiza"
    print(f"\n✔ Pronto: {destino.relative_to(RAIZ)}")
    print(f"  Duração: {dur_final:.1f}s | Tamanho: {mb:.1f} MB | {ok}")
    print(f"  Legendas em texto (pra colar/usar no CapCut): {srt.relative_to(RAIZ)}\n")


if __name__ == "__main__":
    main()
