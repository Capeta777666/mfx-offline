#!/usr/bin/env python3
"""
narrar.py — gera a narração com voz de IA (Piper, PT-BR, roda local) a partir das FALAs do roteiro.

    python scripts/narrar.py roteiros/elenco-cinema.md                 # voz faber
    python scripts/narrar.py roteiros/elenco-cinema.md --voz cadu      # outra voz (faber | cadu | jeff)
    python scripts/narrar.py roteiros/elenco-cinema.md --velocidade 1.1

Gera:
  assets/audio/narracao/<nome>.wav   — narração completa, cada bloco começando no início da sua cena
  assets/audio/narracao/<nome>.json  — duração de cada cena (o render.js usa pra esticar/encolher as cenas)
e reescreve os tempos "(a-bs)" de cada bloco no roteiro pra bater com a voz.
Garante ≥ 60s (Programa de Recompensas): se a fala ficar curta, aumenta as pausas e depois desacelera a voz
(melhor ainda: escrever FALAs um pouco mais longas, pra voz manter o ritmo natural).

Instalação (uma vez):
    pip install piper-tts
    cd assets/vozes && for v in faber cadu jeff; do
      curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/$v/medium/pt_BR-$v-medium.onnx
      curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/$v/medium/pt_BR-$v-medium.onnx.json
    done
"""
import argparse
import json
import re
import sys
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from montar_video import ler_roteiro, limpar_marcacao  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
MINIMO = 61.0  # um pouco acima de 60s, por segurança


def sintetizar(voz, texto, ritmo):
    from piper import SynthesisConfig
    pedacos = list(voz.synthesize(texto, syn_config=SynthesisConfig(length_scale=ritmo)))
    sr = pedacos[0].sample_rate
    audio = np.concatenate([p.audio_float_array for p in pedacos]).astype(np.float32)
    # corta silêncio do começo/fim
    ativo = np.nonzero(np.abs(audio) > 0.01)[0]
    if len(ativo):
        audio = audio[max(0, ativo[0] - int(0.03 * sr)): ativo[-1] + int(0.08 * sr)]
    return audio, sr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("roteiro")
    ap.add_argument("--voz", default="faber", help="faber | cadu | jeff")
    ap.add_argument("--velocidade", type=float, default=1.08, help="1.0 = normal; maior = mais rápido")
    ap.add_argument("--pausa", type=float, default=0.3, help="respiro depois de cada bloco (s)")
    a = ap.parse_args()

    from piper import PiperVoice
    roteiro = Path(a.roteiro) if Path(a.roteiro).exists() else RAIZ / a.roteiro
    nome = roteiro.stem
    blocos = ler_roteiro(roteiro)
    voz = PiperVoice.load(str(RAIZ / "assets" / "vozes" / f"pt_BR-{a.voz}-medium.onnx"))

    ritmo = 1 / a.velocidade
    for tentativa in range(6):
        falas = [sintetizar(voz, limpar_marcacao(b["fala"]), ritmo) if b["fala"] else (np.zeros(1, np.float32), 22050) for b in blocos]
        sr = falas[0][1]
        fala_total = sum(len(f) / sr for f, _ in falas)
        pausa = a.pausa
        if fala_total + pausa * len(blocos) < MINIMO:
            pausa = min(0.8, (MINIMO - fala_total) / len(blocos))
        if fala_total + pausa * len(blocos) >= MINIMO or tentativa == 5:
            break
        ritmo *= 1.06  # ainda curto: fala um pouco mais devagar
        print(f"  narração curta ({fala_total:.1f}s) — desacelerando a voz")

    duracoes = [round(max(len(f) / sr + pausa, 2.0), 3) for f, _ in falas]
    total = sum(duracoes)
    trilha = np.zeros(int(round(total * sr)) + sr, np.float32)
    t = 0.0
    for (f, _), d in zip(falas, duracoes):
        i = int(round((t + 0.12) * sr))
        trilha[i:i + len(f)] += f
        t += d
    trilha = trilha[: int(round(total * sr))]
    trilha /= max(1e-6, np.abs(trilha).max()) / 0.9

    pasta = RAIZ / "assets" / "audio" / "narracao"
    pasta.mkdir(parents=True, exist_ok=True)
    with wave.open(str(pasta / f"{nome}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((trilha * 32767).astype("<i2").tobytes())
    (pasta / f"{nome}.json").write_text(json.dumps({"voz": a.voz, "duracoes": duracoes}, indent=1), encoding="utf-8")

    # reescreve os tempos do roteiro
    texto = roteiro.read_text(encoding="utf-8")
    t = 0.0
    for b, d in zip(blocos, duracoes):
        ini, fim = t, t + d
        padrao = re.compile(rf"^(##\s*BLOCO\s*{b['numero']}\b.*?)\s*\([^)]*\)\s*$", re.M)
        texto = padrao.sub(lambda m: f"{m.group(1)} ({ini:.1f}-{fim:.1f}s)", texto, count=1)
        t = fim
    roteiro.write_text(texto, encoding="utf-8")

    print(f"✔ narração: assets/audio/narracao/{nome}.wav  ({total:.1f}s, voz {a.voz})")
    for b, d in zip(blocos, duracoes):
        print(f"   BLOCO {b['numero']:>2}  {d:5.2f}s  {b['titulo']}")
    if total < 60:
        print("  ⚠ ainda abaixo de 60s — aumente as FALAs pra monetizar")


if __name__ == "__main__":
    main()
