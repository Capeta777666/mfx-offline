---
name: video-radar
description: Monta vídeos verticais 1080x1920 para o TikTok @radar.gta6 a partir de um roteiro em markdown (roteiros/*.md) e imagens em assets/imagens, com Ken Burns, texto neon, legendas queimadas, narração e trilha. Use quando o usuário pedir para gerar, montar, renderizar ou fazer prévia de um vídeo do canal Radar GTA6, ou para escrever/revisar um roteiro de vídeo do canal.
---

# Montagem de vídeo — Radar GTA6

Tudo é feito por `scripts/montar_video.py` (ffmpeg + Pillow). **Não** usar IA generativa
de vídeo: é montagem programática das imagens do usuário + a voz dele (seção 6 e 8 do CLAUDE.md).

## Quando usar
- "monta/gera/renderiza o vídeo X" → fluxo completo abaixo
- "faz uma prévia" → mesmo fluxo com `--rapido`
- "escreve o roteiro de X" → escrever em `roteiros/<nome>.md` no formato abaixo e rodar `--validar`

## Entradas
| O quê | Onde | Observação |
|---|---|---|
| Roteiro | `roteiros/<nome>.md` | formato abaixo |
| Imagens | `assets/imagens/<nome>/01.png...` ou `assets/imagens/01.png...` | a subpasta com o nome do roteiro tem prioridade (evita misturar vídeos) |
| Clipes | `assets/clipes/` | `.mp4/.mov`; sempre com narração própria por cima |
| Narração | `assets/audio/narracao/<nome>.wav` (ou .m4a/.mp3) | se não existir: vídeo sai **mudo** pra dublar no CapCut — AVISAR o usuário |
| Trilha | `assets/audio/trilha/<nome>.mp3`, senão a primeira da pasta | mixada a 0.12 (≈ -18 dB) |
| Fonte | `assets/fontes/*.ttf` | sem fonte própria usa DejaVu Sans Bold; sugerir Anton ou Bebas Neue (Google Fonts, grátis) |

## Formato do roteiro
```
# Título do vídeo (opcional, ignorado)

## BLOCO 1 — Gancho (0-4s)
IMAGEM: 01.png, 02.png
TEXTO_TELA: GTA 6 JÁ ESTÁ NO AR
FALA: Acabou a espera. O *GTA 6* destravou à meia-noite.
```
- Tempo no cabeçalho: `(0-4s)`, `(4-12s)`, `(1:02-1:08)`. Ou linha `DURACAO: 5`. Sem nenhum dos dois, estima pela fala (~2,6 palavras/s).
- `IMAGEM:` aceita várias separadas por vírgula. Clipe: `IMAGEM: trailer.mp4@12.5` (começa no segundo 12,5).
- `*palavra*` na FALA = destaque colorido na legenda (alterna rosa/ciano).
- FALA pode continuar na linha de baixo. Linhas começando com `>` são anotações (ignoradas).

## Passos
1. Rodar a validação:
   `python scripts/montar_video.py roteiros/<nome>.md --validar`
   Ela confere imagens, soma das durações, vocabulário sensível e CTA, e grava `scripts/cenas.json`.
2. Ler a saída e **repassar ao usuário todo ✖ e ⚠**. Em especial:
   - **menos de 60s = não monetiza** — dizer isso com todas as letras e sugerir onde esticar;
   - imagem faltando → listar quais arquivos ele precisa gerar no ChatGPT (1080x1920, paleta do canal);
   - bloco longo com uma imagem só → o script repete a imagem com outro movimento, mas sugerir mais imagens;
   - vocabulário sensível → propor a reescrita neutra.
3. Se houver ✖, parar e corrigir (ou pedir os arquivos). Se só houver ⚠, seguir.
4. Renderizar: `python scripts/montar_video.py roteiros/<nome>.md`
   (prévia rápida: `--rapido`; leva segundos e sai em `saida/<nome>_previa.mp4`).
5. Reportar: caminho do `.mp4`, duração final, tamanho, se passou de 60s, e o `.srt` gerado.
   Se o ambiente permitir, extrair um frame (`ffmpeg -ss 5 -i saida/<nome>.mp4 -frames:v 1 frame.png`)
   e olhar antes de dizer que está bom.

## O que o script já garante (não refazer à mão)
- 1080x1920, 30fps, H.264 yuv420p, AAC 192k, `+faststart`; loudness -14 LUFS
- Ken Burns (zoom in/out, pans) alternando a cada plano; imagem sempre preenche a tela (sem borda preta)
- Nenhum plano passa de 3s: bloco longo é quebrado em vários planos
- TEXTO_TELA em caixa alta, terço superior, brilho rosa + aberração cromática rosa/ciano, fade-in 0,3s
- Legendas no terço inferior, até 6 palavras por vez, palavras `*marcadas*` em rosa/ciano
- Narração em 0 dB, trilha a 0.12 em loop com fade-out; blocos esticados/encolhidos
  proporcionalmente pra casar com a duração da narração (`--sem-ajuste` desliga)
- Grão de filme leve (`--sem-grao` desliga)

## Opções úteis
`--rapido` · `--validar` · `--imagens <pasta>` · `--narracao <arq>` · `--trilha <arq>` ·
`--sem-trilha` · `--volume-trilha 0.10` · `--sem-ajuste` · `--sem-grao` · `--manter-temp`

## Regras de conteúdo (ao escrever ou revisar roteiro)
- Gancho nos 3 primeiros segundos; total entre 60s e 180s
- Nunca vocabulário de violência explícita (matar, tráfico, homicídio, arma...) na fala, legenda ou texto de tela.
  Usar formulações neutras ("franquia construída em cima do crime")
- Sempre narração própria por cima de qualquer clipe de terceiros; nunca material com marca d'água
- Sempre terminar com CTA: pedir pra **salvar** + **pergunta aberta** nos comentários
- Fato de lançamento muda rápido: não inventar nota de review, número de vendas ou data. Deixar `[PREENCHER]`
  e pedir ao usuário, ou confirmar a fonte antes
