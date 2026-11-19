---
name: criar-video
description: Produz vídeos curtos ou longos para qualquer nicho e rede social (TikTok, Reels, Shorts, Kwai, Facebook, YouTube, feed 4:5, quadrado) com roteiro, imagens reais recortadas ou animadas, narração com voz de IA em PT-BR, trilha, títulos e legendas. Use quando o usuário pedir um vídeo sobre um assunto, um roteiro de vídeo, uma nova marca/canal, ou mudar estilo, voz, fonte ou formato de um vídeo.
---

# Criar vídeo — Estúdio de Vídeos

Tudo roda local e de graça: ffmpeg, Chromium headless (motor de cenas), Piper (voz PT-BR) e Pillow.
Nada de vídeo gerado por IA generativa: é edição programática de imagens + voz, o lado seguro pra monetização.

## 1. Entender o pedido (perguntar só o que faltar)
| Item | Padrão se o usuário não disser |
|---|---|
| Assunto / nicho | (obrigatório) |
| Rede | `tiktok` (ver `redes.json`: tiktok, reels, shorts, kwai, facebook, youtube, feed, quadrado) |
| Marca | `padrao`; canal novo → criar `marcas/<marca>.json` copiando `padrao.json` (paleta, fontes, voz, tom, CTA, palavras a evitar) |
| Estilo | `cinema` se houver fotos reais do assunto; `limpo` se não houver imagens; `recorte` pra tom divertido/viral; `bonecos` pra animação 3D |
| Duração | o mínimo da rede (`dur_min`) com folga; TikTok monetizável = 60s+ |

## 2. Pesquisar o conteúdo
- Pesquise na web e use só fatos verificados. Não invente número, data, nome, nota ou preço. Cite as fontes no chat.
- Se faltar dado, deixe `[PREENCHER]` na FALA e avise.

## 3. Criar o projeto
```
python scripts/novo_projeto.py <slug> --marca <marca> --rede <rede> --estilo <estilo> --titulo "<título>"
```

## 4. Imagens (estilos cinema e recorte)
- Fonte das imagens em `projetos/<slug>/assets/fontes.json` (`urls` diretas ou `fandom` com páginas/arquivos) → `python scripts/baixar_imagens.py projetos/<slug>`.
  Imagens também podem ser colocadas à mão em `assets/imagens/` (nome do arquivo = nome usado no roteiro).
- Host bloqueado → peça liberação do host no ambiente (só o necessário). Imagens de terceiros: só em contexto de notícia/comentário,
  sempre com narração e edição próprias. Evite imagens com armas/violência em destaque (derruba alcance).
- Recortes (pessoa recortada, pra `parallax`, `figurinha`, `mosaico`): `python scripts/recortar.py projetos/<slug> --grade`
  gera `build/grade_*.png` com coordenadas (escala de 500px de largura). Olhe a grade, escreva o polígono em
  `assets/contornos.json` (`{"nome": {"imagem": "<arquivo>", "poligono": [[x,y],...]}}`, ~20-30 pontos, sentido horário,
  justo na silhueta) e rode `python scripts/recortar.py projetos/<slug>`. Confira com `--grade` de novo (contorno verde).

## 5. Escrever o roteiro (`projetos/<slug>/roteiro.md`)
Cada `## BLOCO N — título` vira uma cena. A duração vem da narração (não precisa pôr tempo).
```
## BLOCO 3 — Lucia
VISUAL: parallax lucia | dur 0.55              ← fundos se revezam (cortes)
VISUAL: foto lucia_piscina | foco 0.5 0.55
CREDITO: Protagonista | em 0.07 | ate 0.53     ← camadas por cima
TEXTO_TELA: LUCIA CAMINOS                      ← título grande no topo (fonte/estilo da marca)
FALA: Essa é a *Lucia Caminos*, ...            ← narração e legenda (*palavra* = destaque colorido)
```
**VISUAL** (fundo): `foto <img>` · `parallax <recorte>` (2.5D) · `cor <cor1> <cor2>` (degradê) ·
`split <img1> <img2>` (tela dividida) · `mosaico <rec1> <rec2> ... | fundo <img>`
opções: `foco x y` (0-1, ponto que fica no centro) · `foco2 x y` (panorâmica até) · `zoom a b` · `blur n` ·
`tinta <cor> <alfa>` · `desce 0.2` (desce a imagem pra cabeça não ficar sob o título) · `nitido` · `dur 0.4` (fração do bloco) ·
parallax: `cabeca 0.36` (altura da cabeça, fração da tela) · `zoom 1.2`
**Camadas**: `FIGURINHA: <recorte> | x 0.3 | alt 0.6 | entrada esq|dir|pop|baixo | rot 0.05` ·
`TAG: <texto> | x 0.3 | y 0.37 | cor principal | texto_cor fundo | tam 60 | rot -0.06` ·
`CREDITO: <texto>` · `LOGO: <img> | y 0.43 | larg 0.7 | entrada pop` ·
`EFEITO: ondas|equalizador|notas|linhas|tremor|flash|escuro` (opções x, y, cor)
Todas aceitam `em 0.2 | ate 0.8` (frações do bloco). Cores: `principal`, `secundaria`, `destaque`, `escura`, `fundo` (da marca) ou `#hex`.
Sem VISUAL, o bloco pode usar `IMAGEM: a.jpg, b.jpg` (Ken Burns) ou um clipe `IMAGEM: trecho.mp4@12`.
Estilo `bonecos`: cenas em `projetos/<slug>/cenas3d.js` (uma por bloco; modelo em `motor/estilos3d/exemplo-elenco.js`;
personagens em `ELENCO` de `motor/estilos3d/personagens.js`).

Regras de roteiro:
- Gancho nos 3 primeiros segundos; blocos de 4-8 s; corte de imagem a cada 2-3 s (use 2+ VISUAIS em blocos longos).
- Ritmo natural da voz ≈ 2,5 palavras/s → 60 s ≈ 150-170 palavras de FALA. Se ficar curto, acrescente conteúdo real (nunca desacelere a voz).
- TEXTO_TELA curto (até ~3 palavras por linha, 2 linhas). Nada de texto/rosto na faixa do título (topo) nem na das legendas (base).
- Termine com CTA da marca: pedir pra salvar/compartilhar + pergunta aberta.
- Respeite `palavras_evitar` e o `tom` da marca.

## 6. Produzir
```
python scripts/produzir.py projetos/<slug>             # narração → trilha → cenas → montagem
python scripts/produzir.py projetos/<slug> --pular-voz # depois de mexer só no visual
python scripts/produzir.py projetos/<slug> --sem-voz   # prévia sem narração
```
Peças avulsas: `scripts/narrar.py` (voz: `--voz pt_BR-cadu-medium`, `--velocidade 1.1`), `scripts/preparar.py`,
`node motor/render.js projetos/<slug> [--bloco N] [--foto N 0.5]`, `scripts/montar_video.py`.
Vozes PT-BR em `recursos/vozes`: faber (padrão), cadu, jeff. Trilha própria: `assets/trilha.mp3` (senão gera synthwave original).

## 7. Conferir antes de entregar
- Extraia 5-6 quadros (`ffmpeg -ss <t> -i saida/<slug>.mp4 -frames:v 1 q.png`) e OLHE: rosto cortado? título em cima de rosto?
  legenda em cima de boca? imagem vazia/fora de foco? Corrija `foco`, `desce`, `cabeca`, `y` e rode de novo.
- Confira os avisos do `montar_video` (duração mínima da rede, palavras a evitar, CTA).
- Entregue: o `.mp4`, o `.srt`, duração, tamanho e as fontes da pesquisa. Diga o que não foi verificado.

## Referência rápida
- Formatos/margens por rede: `redes.json` (largura, altura, dur_min/max, área segura, margem da legenda)
- Marcas: `marcas/*.json` · fontes em `recursos/fontes` · vozes em `recursos/vozes` (instale com `bash setup.sh`)
- Exemplos: `projetos/gta6-elenco` (cinema, TikTok, imagens oficiais + recortes) e `projetos/habitos-sono` (limpo, feed 4:5, sem imagens)
