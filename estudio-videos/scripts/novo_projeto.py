#!/usr/bin/env python3
"""
novo_projeto.py — cria um projeto de vídeo a partir de um modelo.

    python scripts/novo_projeto.py <slug> --marca padrao --rede tiktok --estilo cinema --titulo "5 curiosidades sobre café"

Estilos: cinema (fotos reais, profundidade, créditos) · recorte (figurinhas e etiquetas)
         limpo (minimalista) · slides (imagens com Ken Burns, sem motor) · bonecos (3D low-poly, cenas em código)
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from projeto import ESTILOS, RAIZ  # noqa: E402

MODELO = """# {titulo}

> Marca: {marca} · Rede: {rede} · Estilo: {estilo}
> Fluxo: python scripts/produzir.py projetos/{slug}
> Cada bloco = uma cena. A duração vem da narração (scripts/narrar.py reescreve os tempos).
> Linhas de visual (veja o SKILL.md): VISUAL, FIGURINHA, TAG, CREDITO, LOGO, EFEITO.

## BLOCO 1 — Gancho
VISUAL: cor escura fundo
TAG: TROQUE ESTE GANCHO | y 0.45 | cor principal
TEXTO_TELA: TÍTULO FORTE AQUI
FALA: Frase de gancho nos três primeiros segundos, que faz a pessoa parar de rolar.

## BLOCO 2 — Desenvolvimento
VISUAL: cor fundo escura
TAG: PONTO 1 | y 0.45 | cor secundaria | texto_cor fundo
TEXTO_TELA: PONTO 1
FALA: Desenvolva o assunto aqui, com informação concreta e verificada.

## BLOCO 3 — CTA
VISUAL: cor escura fundo
TAG: SALVA ✔ | x 0.3 | y 0.45 | cor principal
TAG: COMENTA | x 0.7 | y 0.52 | cor secundaria | texto_cor fundo | em 0.3
TEXTO_TELA: SALVA ESSE VÍDEO
FALA: {cta}
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--marca", default="padrao")
    ap.add_argument("--rede", default="tiktok")
    ap.add_argument("--estilo", default="cinema", choices=ESTILOS)
    ap.add_argument("--titulo", default="")
    a = ap.parse_args()
    d = RAIZ / "projetos" / a.slug
    if d.exists():
        sys.exit(f"projetos/{a.slug} já existe")
    redes = json.loads((RAIZ / "redes.json").read_text(encoding="utf-8"))
    if a.rede not in redes:
        sys.exit(f"Rede inválida. Opções: {[k for k in redes if not k.startswith('_')]}")
    if not (RAIZ / "marcas" / f"{a.marca}.json").is_file():
        sys.exit(f"Marca inválida. Opções: {[m.stem for m in (RAIZ / 'marcas').glob('*.json')]}")
    marca = json.loads((RAIZ / "marcas" / f"{a.marca}.json").read_text(encoding="utf-8"))
    for sub in ("assets/imagens", "assets/recortes", "assets/clipes", "build", "saida"):
        (d / sub).mkdir(parents=True, exist_ok=True)
    titulo = a.titulo or a.slug.replace("-", " ").capitalize()
    (d / "projeto.json").write_text(json.dumps({"titulo": titulo, "marca": a.marca, "rede": a.rede, "estilo": a.estilo}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    cta = marca.get("cta") or "Salva esse vídeo e me conta nos comentários: o que você achou?"
    (d / "roteiro.md").write_text(MODELO.format(titulo=titulo, marca=a.marca, rede=a.rede, estilo=a.estilo, slug=a.slug, cta=cta), encoding="utf-8")
    if a.estilo == "bonecos":
        exemplo = (RAIZ / "motor" / "estilos3d" / "exemplo-elenco.js").read_text(encoding="utf-8")
        (d / "cenas3d.js").write_text(exemplo, encoding="utf-8")
    print(f"✔ projetos/{a.slug} criado ({a.marca} · {redes[a.rede]['nome']} · {a.estilo})")


if __name__ == "__main__":
    main()
