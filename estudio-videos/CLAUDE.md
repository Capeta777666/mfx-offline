# Estúdio de Vídeos

Repositório para produzir vídeos de qualquer nicho, para qualquer rede social, com narração por voz de IA (PT-BR),
imagens reais animadas (recortes, profundidade 2.5D, Ken Burns), títulos, legendas e trilha. Tudo local e gratuito.

**Para fazer um vídeo, siga a skill `.claude/skills/criar-video/SKILL.md`.**

## Como o usuário pede
"Faz um vídeo sobre <assunto> pro <TikTok/Reels/Shorts/YouTube/feed>, estilo <cinema/recorte/limpo/bonecos>, marca <x>".
O que não for dito usa o padrão da skill. Respostas e vídeos sempre em português do Brasil.

## Estrutura
```
redes.json            formato de cada rede (resolução, duração, área segura)
marcas/*.json         identidade de cada canal (paleta, fontes, voz, tom, CTA, palavras a evitar)
projetos/<slug>/      um vídeo: projeto.json, roteiro.md, assets/, build/, saida/
scripts/              novo_projeto, baixar_imagens, recortar, narrar, preparar, montar_video, trilha_synth, produzir
motor/                cenas animadas: fx2d.js + auto.js (2D) · estilos3d/ (bonecos 3D) · render.js (Chromium → mp4)
recursos/             fontes (Montserrat), vozes Piper, trilhas
```

## Regras
- Nunca inventar fatos: pesquisar, verificar e citar as fontes no chat.
- Imagens de terceiros só em contexto de notícia/comentário, com narração e edição próprias; nada com marca d'água.
- Conferir quadros do vídeo final antes de entregar (rosto cortado, texto sobre rosto, legenda sobre boca).
- Não comitar `build/`, `saida/`, imagens baixadas nem os modelos de voz (o `.gitignore` já cuida disso).
- Instalação do ambiente: `bash setup.sh`. Rede: PyPI, huggingface.co (vozes), fonts.googleapis.com/fonts.gstatic.com (fontes)
  e os hosts das imagens de cada projeto.
