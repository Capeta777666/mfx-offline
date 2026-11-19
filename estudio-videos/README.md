# 🎬 Estúdio de Vídeos

Produz vídeos prontos para **TikTok, Reels, Shorts, Kwai, Facebook, YouTube e feed** sobre qualquer assunto:
roteiro → narração com **voz de IA em português** → cenas animadas com imagens reais → títulos, legendas e trilha → `.mp4`.

Feito para usar com o **Claude Code**: abra esta pasta e peça, por exemplo:

> Faz um vídeo pro TikTok sobre as 5 maiores curiosidades do café, estilo cinema.

O Claude segue a skill [`criar-video`](.claude/skills/criar-video/SKILL.md): pesquisa, escreve o roteiro, busca e recorta
as imagens, gera a voz, renderiza e confere o vídeo antes de entregar.

## Estilos
| Estilo | Visual |
|---|---|
| `cinema` | fotos em tela cheia, profundidade 2.5D (pessoa nítida sobre fundo desfocado), luz, créditos |
| `recorte` | figurinhas com borda branca pulando sobre as imagens, etiquetas, tremidas |
| `limpo` | minimalista, cores da marca, etiquetas e números — não precisa de imagens |
| `slides` | imagens com movimento lento (Ken Burns) |
| `bonecos` | animação 3D com bonecos low-poly articulados |

## Instalação
```bash
bash setup.sh        # ffmpeg, Pillow, numpy, Piper (voz), Playwright/Chromium, vozes PT-BR e fontes
```

## Uso manual
```bash
python scripts/novo_projeto.py cafe-curiosidades --rede tiktok --estilo cinema --titulo "5 curiosidades do café"
# edite projetos/cafe-curiosidades/roteiro.md e coloque as imagens em assets/imagens/
python scripts/produzir.py projetos/cafe-curiosidades
# → projetos/cafe-curiosidades/saida/cafe-curiosidades.mp4 (+ .srt)
```

## Exemplos
- `projetos/gta6-elenco` — TikTok, estilo cinema, imagens oficiais (baixe com `python scripts/baixar_imagens.py projetos/gta6-elenco`
  e recorte com `python scripts/recortar.py projetos/gta6-elenco`)
- `projetos/habitos-sono` — feed 4:5, estilo limpo, sem nenhuma imagem

## Créditos
- Voz: [Piper](https://github.com/rhasspy/piper) com vozes PT-BR do projeto piper-voices (faber, cadu, jeff)
- Fonte: Montserrat (SIL Open Font License 1.1)
- Trilha padrão: synthwave original gerada por `scripts/trilha_synth.py` (sem direitos de terceiros)
