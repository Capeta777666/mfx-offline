#!/usr/bin/env python3
"""
recortar.py — recorta pessoas/objetos de imagens SEM IA: contorno (polígono) suavizado, estilo recorte de papel.

    python scripts/recortar.py projetos/<slug>              # todos os contornos do projeto
    python scripts/recortar.py projetos/<slug> --grade      # gera folhas com grade pra desenhar os contornos

assets/contornos.json:
    {"lucia": {"imagem": "lucia_retrato", "poligono": [[235,22],[270,16], ...]}}
  - "imagem": nome (sem extensão) de um arquivo em assets/imagens/
  - "poligono": pontos do contorno numa versão da imagem com 500px de LARGURA (use --grade pra ver as coordenadas)
Saída: assets/recortes/<nome>.png (transparente) + assets/recortes/meta.json (posição no original, pro efeito 2.5D)
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from projeto import Projeto  # noqa: E402


def morf(mask, raio, dilatar):
    """Erosão/dilatação aproximada (desfoque + limiar); na erosão a borda da imagem conta como 'dentro'."""
    m = Image.fromarray((mask * 255).astype(np.uint8))
    pad = int(raio * 2)
    base = Image.new("L", (m.width + 2 * pad, m.height + 2 * pad), 0 if dilatar else 255)
    base.paste(m, (pad, pad))
    if not dilatar:
        a = np.asarray(base).copy()
        a[:pad, :] = a[pad:pad + 1, :]; a[-pad:, :] = a[-pad - 1:-pad, :]
        a[:, :pad] = a[:, pad:pad + 1]; a[:, -pad:] = a[:, -pad - 1:-pad]
        base = Image.fromarray(a)
    b = np.asarray(base.filter(ImageFilter.BoxBlur(raio)).filter(ImageFilter.BoxBlur(raio // 2 + 1)), dtype=np.float32) / 255
    b = b[pad:-pad, pad:-pad]
    return b > 0.02 if dilatar else b > 0.98


def recortar(P: Projeto, nome: str, cfg: dict) -> tuple:
    arq = P.achar(cfg["imagem"], pastas=("imagens",))
    if not arq:
        raise SystemExit(f"{nome}: imagem '{cfg['imagem']}' não está em assets/imagens/")
    img = Image.open(arq).convert("RGB")
    W, H = img.size
    k = W / 500
    pol = [(x * k, y * k) for x, y in cfg["poligono"]]
    for _ in range(3):  # Chaikin: arredonda os cantos
        novo = []
        for i in range(len(pol)):
            (x0, y0), (x1, y1) = pol[i], pol[(i + 1) % len(pol)]
            novo += [(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1), (0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1)]
        pol = novo
    mascara = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mascara).polygon(pol, fill=255)
    dentro = morf(np.asarray(mascara) > 127, max(2, int(W * 0.004)), False)  # levemente pra dentro da silhueta
    alfa = Image.fromarray((dentro * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(max(1, W // 900)))
    out = img.convert("RGBA")
    out.putalpha(alfa)
    bb = alfa.point(lambda v: 255 if v > 10 else 0).getbbox()
    out = out.crop(bb)
    (P.assets / "recortes").mkdir(parents=True, exist_ok=True)
    out.save(P.assets / "recortes" / f"{nome}.png")
    return {"original": cfg["imagem"], "x": bb[0], "y": bb[1], "w": out.width, "h": out.height, "W": W, "H": H}


def grade(P: Projeto, cfgs: dict):
    """Folha com grade de 50 em 50 (em escala de 500px) pra desenhar/ajustar os contornos."""
    nomes = list(cfgs) or [f.stem for f in (P.assets / "imagens").glob("*")]
    for nome in nomes:
        im_nome = cfgs[nome]["imagem"] if nome in cfgs else nome
        arq = P.achar(im_nome, pastas=("imagens",))
        if not arq:
            continue
        im = Image.open(arq).convert("RGB"); w, h = im.size; im = im.resize((500, round(500 * h / w)))
        d = ImageDraw.Draw(im)
        for x in range(0, 500, 50):
            d.line([(x, 0), (x, im.height)], fill=(255, 255, 0)); d.text((x + 2, 2), str(x), fill=(255, 255, 0))
        for y in range(0, im.height, 50):
            d.line([(0, y), (500, y)], fill=(0, 255, 255)); d.text((2, y + 2), str(y), fill=(0, 255, 255))
        if nome in cfgs:
            pts = [tuple(p) for p in cfgs[nome]["poligono"]]
            d.line(pts + [pts[0]], fill=(0, 255, 0), width=2)
            for j, p in enumerate(pts):
                d.text((p[0] + 3, p[1] - 4), str(j), fill=(255, 80, 80))
        destino = P.build / f"grade_{nome}.png"
        P.build.mkdir(parents=True, exist_ok=True)
        im.save(destino)
        print("  grade:", destino)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("projeto")
    ap.add_argument("nomes", nargs="*")
    ap.add_argument("--grade", action="store_true")
    a = ap.parse_args()
    P = Projeto(a.projeto)
    arq = P.assets / "contornos.json"
    cfgs = json.loads(arq.read_text(encoding="utf-8")) if arq.is_file() else {}
    if a.grade:
        grade(P, {k: v for k, v in cfgs.items() if not a.nomes or k in a.nomes} if cfgs else {})
        return
    if not cfgs:
        sys.exit("Sem assets/contornos.json. Rode com --grade pra ver as coordenadas e escreva os contornos.")
    meta_arq = P.assets / "recortes" / "meta.json"
    meta = json.loads(meta_arq.read_text(encoding="utf-8")) if meta_arq.is_file() else {}
    for nome in a.nomes or list(cfgs):
        meta[nome] = recortar(P, nome, cfgs[nome])
        print(f"✂  {nome}: {meta[nome]['w']}x{meta[nome]['h']}")
    meta_arq.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
