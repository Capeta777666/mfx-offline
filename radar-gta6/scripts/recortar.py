#!/usr/bin/env python3
"""
recortar.py — recorta personagens de imagens SEM IA: contorno aproximado (polígono) + refino de borda por cor.

    python scripts/recortar.py               # recorta todos de assets/personagens/contornos.json
    python scripts/recortar.py jason lucia   # só esses

Como funciona:
 1. contornos.json traz, por personagem, a imagem de origem e um polígono aproximado em coordenadas
    de uma versão da imagem com 500px de largura (fácil de desenhar olhando uma grade).
 2. Gera um "trimap": dentro com folga = personagem, fora com folga = fundo, faixa no meio = dúvida.
 3. Na faixa de dúvida, cada pixel vira personagem/fundo conforme se parece mais com as cores
    do personagem ou do fundo DAQUELA região (modelos de cor locais, k-means por bloco).
 4. Suaviza a borda com filtro guiado pela própria imagem (preserva fios de cabelo e contornos).
Saída: assets/personagens/recortes/<nome>.png (RGBA, recortado no tamanho do personagem).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RAIZ = Path(__file__).resolve().parent.parent
PASTA = RAIZ / "assets" / "personagens"


def morf(mask, raio, dilatar):
    """Erosão/dilatação aproximada (disco) via desfoque + limiar; borda da imagem conta como 'dentro' na erosão."""
    m = Image.fromarray((mask * 255).astype(np.uint8))
    pad = int(raio * 2)
    base = Image.new("L", (m.width + 2 * pad, m.height + 2 * pad), 0 if dilatar else 255)
    base.paste(m, (pad, pad))
    if not dilatar:  # fora da imagem só conta como "dentro" onde a máscara toca a borda
        a = np.asarray(base).copy()
        a[:pad, :] = a[pad:pad + 1, :]
        a[-pad:, :] = a[-pad - 1:-pad, :]
        a[:, :pad] = a[:, pad:pad + 1]
        a[:, -pad:] = a[:, -pad - 1:-pad]
        base = Image.fromarray(a)
    b = np.asarray(base.filter(ImageFilter.BoxBlur(raio)).filter(ImageFilter.BoxBlur(raio // 2 + 1)), dtype=np.float32) / 255
    b = b[pad:-pad, pad:-pad]
    return b > 0.02 if dilatar else b > 0.98


def kmeans(x, k, it=8, rng=np.random.default_rng(1)):
    if len(x) <= k:
        return x
    c = x[rng.choice(len(x), k, replace=False)]
    for _ in range(it):
        d = ((x[:, None, :] - c[None]) ** 2).sum(-1)
        r = d.argmin(1)
        for j in range(k):
            s = x[r == j]
            if len(s):
                c[j] = s.mean(0)
    return c


def caixa(a, r):
    """Média em janela (2r+1)² via somas acumuladas."""
    p = np.pad(a, ((r + 1, r), (r + 1, r)), mode="edge").cumsum(0).cumsum(1)
    n = 2 * r + 1
    return (p[n:, n:] - p[:-n, n:] - p[n:, :-n] + p[:-n, :-n]) / (n * n)


def filtro_guiado(guia, alvo, r, eps):
    mI, mp = caixa(guia, r), caixa(alvo, r)
    cov = caixa(guia * alvo, r) - mI * mp
    var = caixa(guia * guia, r) - mI * mI
    a = cov / (var + eps)
    b = mp - a * mI
    return caixa(a, r) * guia + caixa(b, r)


cfg_arquivo_atual = [""]


def recortar(nome, cfg):
    cfg_arquivo_atual[0] = cfg["arquivo"]
    img = Image.open(PASTA / "original" / cfg["arquivo"]).convert("RGB")
    W, H = img.size
    k = W / 500
    pol = [(x * k, y * k) for x, y in cfg["poligono"]]
    for _ in range(3):  # Chaikin: arredonda os cantos do polígono
        novo = []
        for i in range(len(pol)):
            (x0, y0), (x1, y1) = pol[i], pol[(i + 1) % len(pol)]
            novo += [(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1), (0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1)]
        pol = novo
    mascara = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mascara).polygon(pol, fill=255)
    m = np.asarray(mascara) > 127
    if not cfg.get("refino", False):  # estilo recorte de papel: polígono suave, levemente pra dentro
        dentro = morf(m, max(2, int(W * 0.004)), False)
        alfa = np.asarray(Image.fromarray((dentro * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(max(1, W // 900))), dtype=np.float32) / 255
        return salvar(nome, img, alfa)

    faixa = max(8, int(W * cfg.get("faixa", 0.018)))
    fg = morf(m, faixa, False)
    bg = ~morf(m, faixa, True)
    duvida = ~fg & ~bg

    rgb = np.asarray(img, dtype=np.float32) / 255
    # espaço de cor com mais peso na crominância (separa melhor pele/roupa do fundo)
    Y = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    feat = np.dstack([Y, (rgb[..., 2] - Y) * 1.6, (rgb[..., 0] - Y) * 1.6])

    alfa = fg.astype(np.float32)
    bloco = max(48, faixa * 2)
    ys, xs = np.nonzero(duvida)
    for by in range(0, H, bloco):
        for bx in range(0, W, bloco):
            sel = duvida[by:by + bloco, bx:bx + bloco]
            if not sel.any():
                continue
            y0, y1 = max(0, by - bloco), min(H, by + 2 * bloco)
            x0, x1 = max(0, bx - bloco), min(W, bx + 2 * bloco)
            f = feat[y0:y1, x0:x1]
            amF = f[fg[y0:y1, x0:x1]][::7]
            amB = f[bg[y0:y1, x0:x1]][::7]
            if len(amF) < 10 or len(amB) < 10:
                # sem amostra de um dos lados: vale o polígono
                alfa[by:by + bloco, bx:bx + bloco][sel] = m[by:by + bloco, bx:bx + bloco][sel]
                continue
            cF, cB = kmeans(amF, 5), kmeans(amB, 5)
            px = feat[by:by + bloco, bx:bx + bloco][sel]
            dF = ((px[:, None] - cF[None]) ** 2).sum(-1).min(1)
            dB = ((px[:, None] - cB[None]) ** 2).sum(-1).min(1)
            a = dB / (dF + dB + 1e-6)
            # leve viés para o polígono desenhado (evita "furos" quando as cores se parecem)
            pm = m[by:by + bloco, bx:bx + bloco][sel].astype(np.float32)
            alfa[by:by + bloco, bx:bx + bloco][sel] = np.clip(0.85 * a + 0.15 * pm, 0, 1)

    alfa = np.clip((alfa - 0.45) / 0.25, 0, 1)  # contraste: decide os casos duvidosos
    # abertura morfológica leve: some com manchinhas soltas na faixa de dúvida
    r = max(2, W // 400)
    am = Image.fromarray((alfa * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(2 * r + 1)).filter(ImageFilter.MaxFilter(2 * r + 1))
    alfa = np.minimum(alfa, np.asarray(am, dtype=np.float32) / 255 + 0.02)
    alfa = filtro_guiado(Y, alfa, max(4, W // 250), 2e-3)
    alfa[fg] = 1
    alfa[bg] = 0
    alfa = np.clip(alfa, 0, 1)

    return salvar(nome, img, alfa)


def salvar(nome, img, alfa):
    out = np.dstack([np.asarray(img), (alfa * 255).astype(np.uint8)])
    sai = Image.fromarray(out, "RGBA")
    bb = sai.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
    sai = sai.crop(bb)
    (PASTA / "recortes").mkdir(exist_ok=True)
    sai.save(PASTA / "recortes" / f"{nome}.png")
    # posição do recorte dentro da imagem original (pra alinhar com o fundo no efeito 2.5D)
    meta_arq = PASTA / "recortes" / "meta.js"
    meta = {}
    if meta_arq.exists():
        meta = json.loads(meta_arq.read_text(encoding="utf-8").split("=", 1)[1].rstrip(";\n"))
    meta[nome] = {"original": img.width and cfg_arquivo_atual[0], "x": bb[0], "y": bb[1], "w": sai.width, "h": sai.height,
                  "W": img.width, "H": img.height}
    meta_arq.write_text("window.META_RECORTES = " + json.dumps(meta, ensure_ascii=False) + ";\n", encoding="utf-8")
    return sai.size


def main():
    cfgs = json.loads((PASTA / "contornos.json").read_text(encoding="utf-8"))
    alvo = sys.argv[1:] or list(cfgs)
    for nome in alvo:
        print(f"✂  {nome}: {recortar(nome, cfgs[nome])}")


if __name__ == "__main__":
    main()
