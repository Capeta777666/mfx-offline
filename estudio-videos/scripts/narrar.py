#!/usr/bin/env python3
"""
narrar.py — narração com voz de IA (Piper, roda local, grátis) a partir das FALAs do roteiro.

    python scripts/narrar.py projetos/<slug>                       # voz da marca
    python scripts/narrar.py projetos/<slug> --voz pt_BR-cadu-medium --velocidade 1.1

Gera build/narracao.wav (cada bloco começa no início da sua cena) e build/duracoes.json,
e reescreve os tempos "(a-bs)" de cada bloco no roteiro pra cena durar o mesmo que a fala.
Se a fala ficar abaixo do mínimo da rede, avisa (escreva FALAs mais longas em vez de desacelerar a voz).
"""
import argparse
import json
import sys
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from projeto import RAIZ, Projeto, ler_roteiro, limpar_marcacao, reescrever_tempos  # noqa: E402

ATRASO = 0.12  # a fala começa um pouquinho depois do corte


def sintetizar(voz, texto, ritmo):
    from piper import SynthesisConfig
    pedacos = list(voz.synthesize(texto, syn_config=SynthesisConfig(length_scale=ritmo)))
    sr = pedacos[0].sample_rate
    audio = np.concatenate([p.audio_float_array for p in pedacos]).astype(np.float32)
    ativo = np.nonzero(np.abs(audio) > 0.01)[0]
    if len(ativo):
        audio = audio[max(0, ativo[0] - int(0.03 * sr)): ativo[-1] + int(0.08 * sr)]
    return audio, sr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("projeto")
    ap.add_argument("--voz", help="modelo em recursos/vozes (padrão: o da marca)")
    ap.add_argument("--velocidade", type=float, help="1.0 = normal (padrão: o da marca)")
    ap.add_argument("--pausa", type=float, default=0.35, help="respiro depois de cada bloco (s)")
    a = ap.parse_args()
    try:
        from piper import PiperVoice
    except ImportError:
        sys.exit("Piper não instalado. Rode: bash setup.sh  (ou pip install piper-tts)")

    P = Projeto(a.projeto)
    blocos = ler_roteiro(P.roteiro)
    modelo = a.voz or P.marca["voz"]["modelo"]
    vel = a.velocidade or P.marca["voz"].get("velocidade", 1.05)
    arq = RAIZ / "recursos" / "vozes" / f"{modelo}.onnx"
    if not arq.is_file():
        sys.exit(f"Voz {modelo} não encontrada em recursos/vozes/ (rode setup.sh)")
    voz = PiperVoice.load(str(arq))

    falas = [sintetizar(voz, limpar_marcacao(b["fala"]), 1 / vel) if b["fala"].strip() else (np.zeros(1, np.float32), 22050) for b in blocos]
    sr = falas[0][1]
    dur_falas = [len(f) / sr for f, _ in falas]
    duracoes = [round(max(d + ATRASO + a.pausa, 2.0), 3) for d in dur_falas]
    total = sum(duracoes)

    audio = np.zeros(int(round(total * sr)) + sr, np.float32)
    t = 0.0
    for (f, _), d in zip(falas, duracoes):
        i = int(round((t + ATRASO) * sr))
        audio[i:i + len(f)] += f
        t += d
    audio = audio[: int(round(total * sr))]
    audio /= max(1e-6, np.abs(audio).max()) / 0.9

    P.build.mkdir(parents=True, exist_ok=True)
    with wave.open(str(P.build / "narracao.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((audio * 32767).astype("<i2").tobytes())
    (P.build / "duracoes.json").write_text(json.dumps({"voz": modelo, "velocidade": vel, "duracoes": duracoes,
                                                        "falas": [round(x, 3) for x in dur_falas]}, indent=1), encoding="utf-8")
    reescrever_tempos(P.roteiro, blocos, duracoes)

    print(f"✔ narração: projetos/{P.slug}/build/narracao.wav — {total:.1f}s (voz {modelo}, velocidade {vel})")
    for b, d in zip(blocos, duracoes):
        print(f"   BLOCO {b['numero']:>2}  {d:5.2f}s  {b['titulo']}")
    if total < P.rede["dur_min"]:
        print(f"  ⚠ {total:.1f}s está abaixo do mínimo de {P.rede['dur_min']}s pra {P.rede['nome']}: escreva FALAs mais longas.")


if __name__ == "__main__":
    main()
