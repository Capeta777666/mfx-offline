#!/usr/bin/env bash
# setup.sh — instala tudo que o Estúdio de Vídeos precisa (Ubuntu/WSL/macOS com Homebrew).
set -e
cd "$(dirname "$0")"

echo "▶ ffmpeg"
if ! command -v ffmpeg >/dev/null; then
  if command -v apt-get >/dev/null; then sudo apt-get update && sudo apt-get install -y ffmpeg fonts-noto-color-emoji
  elif command -v brew >/dev/null; then brew install ffmpeg
  else echo "  instale o ffmpeg manualmente (ffmpeg.org) e rode de novo"; exit 1; fi
fi

echo "▶ Python: Pillow, numpy, Piper"
python3 -m pip install -q -r requirements.txt

echo "▶ Node: Playwright + Chromium"
if ! node -e "require('playwright')" 2>/dev/null; then npm install --no-audit --no-fund && npx playwright install chromium; fi

echo "▶ Vozes PT-BR (Piper)"
mkdir -p recursos/vozes
for v in faber cadu jeff; do
  n=pt_BR-$v-medium
  for ext in onnx onnx.json; do
    [ -s recursos/vozes/$n.$ext ] || curl -sSL -o recursos/vozes/$n.$ext "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/$v/medium/$n.$ext"
  done
done

echo "▶ Fontes (Montserrat)"
mkdir -p recursos/fontes
for w in 600 700 900; do
  f=recursos/fontes/Montserrat-$w.ttf
  if [ ! -s "$f" ]; then
    url=$(curl -s -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Montserrat:wght@$w" | grep -oE 'https://fonts.gstatic.com/[^)]+\.ttf' | head -1)
    curl -sSL -o "$f" "$url"
  fi
done
echo "✔ pronto. Teste: python scripts/produzir.py projetos/habitos-sono"
