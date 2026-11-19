#!/usr/bin/env python3
"""
preparar.py — lê o roteiro do projeto e gera build/roteiro.js + build/roteiro.json para o motor de cenas.

    python scripts/preparar.py projetos/<slug>

Também confere se toda imagem citada no roteiro existe em assets/.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from projeto import EXT_IMG, Projeto, ler_roteiro  # noqa: E402


def preparar(P: Projeto) -> list[str]:
    blocos = ler_roteiro(P.roteiro)
    rel = lambda p: "../projetos/" + P.slug + "/" + p.relative_to(P.dir).as_posix()  # noqa: E731
    imagens = {}
    for pasta in ("imagens", "recortes"):
        for f in sorted((P.assets / pasta).glob("*")) if (P.assets / pasta).is_dir() else []:
            if f.suffix.lower() in EXT_IMG:
                imagens[f.stem] = rel(f)
    recortes = {}
    meta = P.assets / "recortes" / "meta.json"
    if meta.is_file():
        recortes = json.loads(meta.read_text(encoding="utf-8"))
    faltando = []
    for b in blocos:
        for v in b["visuais"]:
            if v.get("tipo") in ("foto", "parallax", "split", "mosaico"):
                faltando += [f"BLOCO {b['numero']}: {k}" for k in v.get("args", []) if k not in imagens]
            if v.get("tipo") == "parallax" and v.get("args") and v["args"][0] not in recortes:
                faltando.append(f"BLOCO {b['numero']}: {v['args'][0]} (parallax precisa do recorte: python scripts/recortar.py)")
        for c in b["camadas"]:
            if c["camada"] in ("figurinha", "logo") and c.get("nome") not in imagens:
                faltando.append(f"BLOCO {b['numero']}: {c.get('nome')}")
    dados = {"W": P.W, "H": P.H, "estilo": P.estilo, "paleta": P.marca["paleta"], "imagens": imagens, "recortes": recortes,
             "blocos": [{"numero": b["numero"], "dur": round(b["duracao"], 3), "visuais": b["visuais"], "camadas": b["camadas"],
                         "texto_tela": b["texto_tela"]} for b in blocos]}
    P.build.mkdir(parents=True, exist_ok=True)
    (P.build / "roteiro.json").write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding="utf-8")
    (P.build / "roteiro.js").write_text("window.ROTEIRO = " + json.dumps(dados, ensure_ascii=False) + ";\n", encoding="utf-8")
    return faltando


def main():
    if len(sys.argv) < 2:
        sys.exit("uso: python scripts/preparar.py projetos/<slug>")
    P = Projeto(sys.argv[1])
    faltando = preparar(P)
    print(f"✔ projetos/{P.slug}/build/roteiro.js")
    for f in faltando:
        print("  ✖ imagem não encontrada em assets/:", f)
    if faltando:
        sys.exit(1)


if __name__ == "__main__":
    main()
