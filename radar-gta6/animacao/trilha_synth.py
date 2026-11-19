#!/usr/bin/env python3
"""
trilha_synth.py — gera uma trilha synthwave ORIGINAL (sem direitos autorais de terceiros) em .wav

    python animacao/trilha_synth.py assets/audio/trilha/elenco-gta6.wav --duracao 68 --bpm 104

Bumbo, caixa, chimbal, baixo pulsado, pad e arpejo em Lá menor (Am–F–C–G). Só usa numpy.
"""
import argparse
import wave

import numpy as np

SR = 44100


def nota(n):  # número MIDI -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)


def saw(f, t):
    return 2 * (t * f - np.floor(0.5 + t * f))


def passa_baixa(x, corte):
    a = np.exp(-2 * np.pi * corte / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):  # um polo; rápido o bastante para ~1 min de áudio
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def gerar(dur, bpm, semente=7):
    rng = np.random.default_rng(semente)
    n = int(dur * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    batida = 60 / bpm
    compasso = 4 * batida
    acordes = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G
    duck = np.ones(n)

    def por(sinal, ini, l=None, r=None, g=1.0):
        i = int(ini * SR)
        if i >= n:
            return
        s = sinal[: n - i] * g
        L[i:i + len(s)] += s * (1 if l is None else l)
        R[i:i + len(s)] += s * (1 if r is None else r)

    # bateria
    tk = np.arange(int(0.35 * SR)) / SR
    bumbo = np.sin(2 * np.pi * (45 * tk + (120 - 45) * (1 - np.exp(-tk * 30)) / 30)) * np.exp(-tk * 9)
    tc = np.arange(int(0.25 * SR)) / SR
    caixa = (rng.standard_normal(len(tc)) * 0.6 + np.sin(2 * np.pi * 190 * tc) * 0.5) * np.exp(-tc * 18)
    th = np.arange(int(0.06 * SR)) / SR
    chimbal = np.diff(rng.standard_normal(len(th) + 1)) * np.exp(-th * 70) * 0.25
    b = 0
    t = 0.0
    while t < dur:
        por(bumbo, t, g=0.9)
        i = int(t * SR)
        k = np.arange(min(int(0.3 * SR), n - i))
        duck[i:i + len(k)] = np.minimum(duck[i:i + len(k)], 0.35 + 0.65 * (k / len(k)) ** 0.6) if len(k) else duck[i:i]
        if b % 2 == 1:
            por(caixa, t, g=0.45)
        por(chimbal, t + batida / 2, l=0.7, r=1.0)
        por(chimbal, t, l=1.0, r=0.7, g=0.6)
        t += batida
        b += 1

    # baixo, pad e arpejo
    ttot = np.arange(n) / SR
    baixo = np.zeros(n)
    pad = np.zeros((2, n))
    arp = np.zeros(n)
    c = 0
    t0 = 0.0
    while t0 < dur:
        ac = acordes[c % 4]
        i0, i1 = int(t0 * SR), min(int((t0 + compasso) * SR), n)
        tt = ttot[i0:i1] - t0
        # pad desafinado L/R com ataque lento
        env = np.minimum(1, tt / 0.6) * np.minimum(1, (compasso - tt) / 0.3)
        for m in ac:
            pad[0, i0:i1] += saw(nota(m) * 1.003, tt) * env * 0.07
            pad[1, i0:i1] += saw(nota(m) * 0.997, tt) * env * 0.07
        # baixo em colcheias (oitavas)
        for k in range(8):
            a = t0 + k * batida / 2
            j0, j1 = int(a * SR), min(int((a + batida / 2 * 0.9) * SR), n)
            if j0 >= n:
                break
            tb = ttot[j0:j1] - a
            baixo[j0:j1] += saw(nota(ac[0] - 24 + (12 if k % 2 else 0)), tb) * np.exp(-tb * 5) * 0.5
        # arpejo em semicolcheias, começa no 3º compasso
        if c >= 2:
            seq = [ac[0] + 12, ac[1] + 12, ac[2] + 12, ac[1] + 24]
            for k in range(16):
                a = t0 + k * batida / 4
                j0, j1 = int(a * SR), min(int((a + batida / 4) * SR), n)
                if j0 >= n:
                    break
                ta = ttot[j0:j1] - a
                arp[j0:j1] += np.sign(np.sin(2 * np.pi * nota(seq[k % 4]) * ta)) * np.exp(-ta * 14) * 0.06
        c += 1
        t0 += compasso

    baixo = passa_baixa(baixo, 700) * duck
    pad = np.stack([passa_baixa(pad[0], 1800), passa_baixa(pad[1], 1800)]) * duck
    arp = passa_baixa(arp, 3500)
    eco = np.zeros(n)
    d = int(batida * 0.75 * SR)
    eco[d:] = arp[:-d] * 0.4
    L += baixo + pad[0] + arp + eco * 0.3
    R += baixo + pad[1] + arp * 0.8 + eco * 0.6

    fade = np.ones(n)
    fi = int(2.0 * SR)
    fade[-fi:] = np.linspace(1, 0, fi)
    mix = np.stack([L, R], axis=1) * fade[:, None]
    mix /= np.abs(mix).max() / 0.89
    return mix


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("saida")
    ap.add_argument("--duracao", type=float, default=68)
    ap.add_argument("--bpm", type=float, default=104)
    a = ap.parse_args()
    mix = gerar(a.duracao, a.bpm)
    with wave.open(a.saida, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype("<i2").tobytes())
    print(f"✔ {a.saida} ({a.duracao:.0f}s, {a.bpm:.0f} bpm)")


if __name__ == "__main__":
    main()
