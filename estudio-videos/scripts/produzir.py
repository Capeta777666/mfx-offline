#!/usr/bin/env python3
"""
produzir.py — produz o vídeo de um projeto do começo ao fim:

    1. narração (voz de IA)         scripts/narrar.py      → build/narracao.wav + tempos no roteiro
    2. trilha                       scripts/trilha_synth.py → build/trilha.wav (se não houver assets/trilha.*)
    3. roteiro → motor              scripts/preparar.py    → build/roteiro.js
    4. cenas                        motor/render.js        → build/cenas/NN.mp4  (blocos com VISUAL ou estilo bonecos)
    5. montagem final               scripts/montar_video.py → saida/<slug>.mp4 + .srt

    python scripts/produzir.py projetos/<slug>
    python scripts/produzir.py projetos/<slug> --sem-voz      # sem narração (prévia com trilha)
    python scripts/produzir.py projetos/<slug> --rapido       # prévia em meia resolução
    python scripts/produzir.py projetos/<slug> --pular-voz    # reaproveita a narração já gerada
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from projeto import RAIZ, Projeto, ler_roteiro  # noqa: E402


def etapa(nome, cmd):
    print(f"\n━━ {nome}", flush=True)
    r = subprocess.run(cmd, cwd=RAIZ)
    if r.returncode != 0:
        sys.exit(f"✖ falhou em: {nome}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("projeto")
    ap.add_argument("--sem-voz", action="store_true")
    ap.add_argument("--pular-voz", action="store_true")
    ap.add_argument("--rapido", action="store_true")
    a = ap.parse_args()
    P = Projeto(a.projeto)
    py, rel = sys.executable, f"projetos/{P.slug}"

    if not a.sem_voz and not a.pular_voz:
        etapa("1/5 narração", [py, "scripts/narrar.py", rel])
    blocos = ler_roteiro(P.roteiro)
    total = sum(b["duracao"] for b in blocos)
    if not P.trilha_propria():
        etapa("2/5 trilha", [py, "scripts/trilha_synth.py", str(P.build / "trilha.wav"), "--duracao", f"{total + 2:.1f}",
                              "--bpm", str(P.marca.get("trilha", {}).get("bpm", 100))])
    etapa("3/5 preparar roteiro", [py, "scripts/preparar.py", rel])
    precisa_motor = P.estilo == "bonecos" or any(b["visuais"] for b in blocos)
    if precisa_motor:
        cmd = ["node", "motor/render.js", rel] + (["--rapido"] if a.rapido else [])
        etapa("4/5 cenas", cmd)
        if a.rapido:  # a montagem usa build/cenas; na prévia, aponta pra versão rápida
            prev, fin = P.build / "cenas_previa", P.build / "cenas"
            fin.mkdir(exist_ok=True)
            for f in prev.glob("*.mp4"):
                (fin / f.name).write_bytes(f.read_bytes())
    montar = [py, "scripts/montar_video.py", rel] + (["--rapido"] if a.rapido else []) + (["--sem-voz"] if a.sem_voz else [])
    etapa("5/5 montagem", montar)
    print(json.dumps({"projeto": rel, "saida": f"{rel}/saida/{P.slug}{'_previa' if a.rapido else ''}.mp4"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
