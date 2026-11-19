# BRIEFING — RADAR GTA6 (@radar.gta6)
### Documento mestre para execução no Claude Code
**Gerado em:** 17/11/2026 | **Lançamento do GTA 6:** 19/11/2026 (quinta) | **Faltam: 2 dias**

---

## 0. COMO USAR ESTE ARQUIVO

Salve este arquivo na raiz da pasta do projeto no Claude Code como `CLAUDE.md`
(ou `briefing-radar-gta6.md` e referencie com `@briefing-radar-gta6.md`).

O Claude Code lê automaticamente o `CLAUDE.md` da pasta em toda sessão. Tudo que
está aqui vira contexto permanente — você não precisa reexplicar o projeto nunca mais.

**Primeiro comando a rodar no Claude Code, dentro da pasta do projeto:**
```
Leia o CLAUDE.md. Monte a estrutura de pastas descrita na seção 5 e crie a
skill de geração de vídeo descrita na seção 6. Depois me mostre o que ficou pronto.
```

---

## 1. ESTADO ATUAL — LEIA ANTES DE QUALQUER COISA

O projeto foi construído como uma **contagem regressiva até o lançamento**. Essa fase
acabou. Faltam 2 dias. O briefing abaixo já está escrito para a **fase de lançamento
e pós-lançamento**, que é onde está o dinheiro.

### Fatos verificados em 17/11/2026
| Item | Status |
|---|---|
| Lançamento | 19/11/2026, meia-noite no horário local de cada região |
| Plataformas | PS5 e Xbox Series X\|S (sem PC) |
| Preço | US$ 79,99 |
| Pré-load | Aberto desde 10/11, download de **212 GB** |
| Edição física | Caixa à venda desde 12/11, **contém código de download, sem disco** |
| Modo online | **NÃO sai no lançamento** — só o modo história single-player |
| Bônus de pré-venda | Vintage Vice City Pack + 1 mês grátis de GTA+ |
| Classificação | ESRB M (17+) |
| Reviews | Embargo apontado para **18/11** por Insider Gaming, NateTheHate e Mashable — a Rockstar não confirmou oficialmente |

### A janela crítica
As próximas 72 horas concentram o maior volume de busca por "GTA 6" que vai existir.
Depois do dia 19, a atenção migra pra gameplay, guias e bugs. **Quem publica nesse
intervalo colhe muito mais alcance por post do que em qualquer dia dos últimos 5 meses.**

### Decisão estratégica que precisa ser tomada
O canal foi montado com carrosséis (crescimento) + vídeos 1min+ (monetização).
**Carrossel não monetiza no Programa de Recompensas.** Se a meta ainda é monetizar,
a partir de agora o esforço tem que ir para **vídeo de 1min+**, não para carrossel.
É exatamente por isso que a skill de vídeo da seção 6 é a peça central deste briefing.

---

## 2. IDENTIDADE DO CANAL (travada — não mudar)

- **Handle:** @radar.gta6
- **Posicionamento:** central de notícias do GTA 6 em português
- **Idioma:** português do Brasil, sempre
- **Público:** comunidade gamer brasileira

### Paleta e estética (usar em TODO asset gerado)
```
Roxo profundo   #2A0A4A
Rosa neon       #FF2D95
Ciano elétrico  #00F0FF
Laranja pôr do sol #FF8C42
Preto fundo     #0B0218
```
Elementos recorrentes: sol retrô listrado, grade neon em perspectiva, palmeiras em
silhueta, reflexo molhado no asfalto, névoa neon, grão de filme, aberração cromática.
Tipografia: sans-serif pesada, caixa alta, contorno/brilho neon rosa e ciano.

### Bio
```
🚨 Radar ligado em tudo sobre GTA 6
🌴 Notícias, teorias e segredos
🔔 Me segue pra não perder nada
```
> ⚠️ A bio atual termina com "até 19/11". **Trocar hoje** — depois de quinta ela
> fica sem sentido e sinaliza canal abandonado.

---

## 3. REGRAS DE FORMATO (vídeo monetizável)

| Regra | Valor |
|---|---|
| Duração | 60s a 180s (**mínimo 60s** pro Programa de Recompensas) |
| Resolução | 1080x1920 (9:16), 30fps |
| Gancho | nos 3 primeiros segundos |
| Corte de cena | a cada 2-3 segundos |
| Legendas | queimadas no vídeo, fonte grossa, palavras-chave em rosa/ciano |
| Trilha | som trend a 10-15% do volume (≈ -18 dB abaixo da narração) |
| Narração | **sempre voz própria por cima** de qualquer clipe oficial |
| CTA | pedir "salvar" + pergunta aberta nos comentários |

### Regras de algoritmo — nunca violar
- Nunca repostar conteúdo com marca d'água ou sem edição própria
- Nunca deletar e repostar um vídeo
- Não comprar engajamento
- **Evitar vocabulário de violência explícita** na fala inicial, nas legendas e no texto
  dos slides (homicídio, tráfico, matar policial etc.) — derruba alcance e pode travar
  monetização. Usar formulações neutras: "franquia construída em cima do crime"
- Consistência: 1-2 publicações/dia
- Responder todos os comentários nos primeiros 60 minutos

### Horários de postagem (público gamer BR)
- Seg-sex: 12h-13h e 19h-21h (principal: **19h**)
- Sáb-dom: 11h e 20h
- **Exceção dia 19/11:** publicar à **00h30** (logo após o unlock da meia-noite)

---

## 4. PILARES DE CONTEÚDO — PÓS-LANÇAMENTO

A contagem regressiva morre dia 19. Os novos pilares:

1. **Notícias e reação rápida** — reviews, bugs, recordes, declarações da Rockstar.
   Velocidade > perfeição.
2. **Guias e dicas** — "como ganhar dinheiro rápido", "melhores carros", "onde achar X".
   É o pilar de maior retenção e busca no pós-lançamento.
3. **Easter eggs e segredos** — formato que mais gera "salvar" e compartilhamento.
4. **Comparações** — GTA 5 vs GTA 6, Vice City vs Miami real, trailer vs jogo final.
5. **Online** — quando chegar. É o maior assunto do público BR (RP). Até lá, pauta de
   expectativa.

---

## 5. ESTRUTURA DE PASTAS A CRIAR NO CLAUDE CODE

```
radar-gta6/
├── CLAUDE.md                  ← este briefing
├── .claude/
│   └── skills/
│       └── video-radar/
│           └── SKILL.md       ← a skill da seção 6
├── assets/
│   ├── imagens/               ← slides gerados no ChatGPT (1080x1920)
│   ├── clipes/                ← trechos de trailer/gameplay (já editados)
│   ├── audio/
│   │   ├── narracao/          ← sua voz gravada (.wav ou .m4a)
│   │   └── trilha/            ← músicas trend (.mp3)
│   └── fontes/                ← .ttf da fonte das legendas
├── roteiros/                  ← um .md por vídeo
├── saida/                     ← vídeos renderizados (.mp4)
└── scripts/
    └── montar_video.py        ← orquestrador ffmpeg
```

---

## 6. A SKILL DE VÍDEO — ESPECIFICAÇÃO

### 6.1 O que ela faz

Recebe um roteiro em markdown + uma pasta de imagens e devolve um `.mp4` pronto
pro TikTok: 1080x1920, 30fps, com movimento Ken Burns nas imagens, cortes a cada
2-3s, legendas queimadas, narração e trilha mixada em volume baixo.

**Ela NÃO gera vídeo com IA generativa.** Isso é proposital — você já tentou Veo/Flow
e não funcionou. O caminho que funciona de verdade no Claude Code é **montagem
programática com ffmpeg** em cima dos assets que você já produz (imagens do ChatGPT +
sua voz). É mais rápido, é gratuito, roda no seu notebook e o resultado é consistente.

### 6.2 Dependências

```bash
# Ubuntu/WSL
sudo apt install ffmpeg fonts-dejavu python3-pip
pip install pillow

# Windows: baixar ffmpeg em ffmpeg.org e adicionar ao PATH
```

Checar se está tudo certo: `ffmpeg -version`

### 6.3 Pipeline técnico

```
roteiro.md
    ↓ (parse: blocos, falas, textos de tela, duração)
cenas.json
    ↓ (ffmpeg zoompan = Ken Burns em cada imagem)
clipes temporários
    ↓ (concat + drawtext para o texto de tela)
vídeo sem áudio
    ↓ (narração em 0 dB + trilha em -18 dB, amix)
    ↓ (subtitles: SRT gerado do roteiro, queimado)
saida/video_final.mp4
```

### 6.4 Parâmetros ffmpeg que importam

```bash
# Ken Burns (zoom lento) numa imagem estática, 3 segundos
ffmpeg -loop 1 -i slide.png -t 3 \
  -vf "scale=2160:3840,zoompan=z='min(zoom+0.0008,1.3)':d=90:s=1080x1920:fps=30" \
  -c:v libx264 -pix_fmt yuv420p cena01.mp4

# Mixagem: narração em 0 dB, trilha a ~12% do volume
ffmpeg -i video.mp4 -i narracao.wav -i trilha.mp3 \
  -filter_complex "[2:a]volume=0.12[tr];[1:a][tr]amix=inputs=2:duration=first[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k com_audio.mp4

# Legendas queimadas com estilo neon
ffmpeg -i com_audio.mp4 \
  -vf "subtitles=legendas.srt:force_style='FontName=DejaVu Sans,Bold=1,FontSize=16,PrimaryColour=&HFFFFFF&,OutlineColour=&H952DFF&,Outline=3,Alignment=2,MarginV=180'" \
  -c:a copy saida/video_final.mp4
```

> Nota: no formato de cor do ASS, `&H952DFF&` é BGR, não RGB. Rosa neon `#FF2D95`
> vira `&H952DFF&`. Ciano `#00F0FF` vira `&HFFF000&`.

### 6.5 SKILL.md — colar pronto

Crie `.claude/skills/video-radar/SKILL.md` com este conteúdo:

```markdown
---
name: video-radar
description: Monta vídeos verticais 1080x1920 para o TikTok @radar.gta6 a partir de um roteiro em markdown e imagens na pasta assets/imagens. Use quando o usuário pedir para gerar, montar ou renderizar um vídeo do canal Radar GTA6.
---

# Montagem de vídeo — Radar GTA6

## Quando usar
Quando o usuário pedir para montar/gerar/renderizar um vídeo do canal.

## Entradas esperadas
- Um roteiro em `roteiros/*.md` com blocos no formato da seção "Formato do roteiro"
- Imagens em `assets/imagens/` nomeadas `01.png`, `02.png`, ...
- Narração em `assets/audio/narracao/` (se não existir, avisar o usuário e gerar o vídeo mudo para ele dublar no CapCut)
- Trilha em `assets/audio/trilha/`

## Formato do roteiro
Cada bloco:
    ## BLOCO 1 — [titulo] (0-12s)
    IMAGEM: 01.png
    TEXTO_TELA: GTA 6 JÁ ESTÁ NO AR
    FALA: Acabou a espera. O GTA 6 destravou à meia-noite...

## Passos
1. Ler o roteiro e extrair blocos, imagens, textos de tela, falas e durações.
2. Validar: toda imagem referenciada existe? A soma das durações passa de 60s?
   Se der menos de 60s, AVISAR o usuário — o vídeo não vai monetizar.
3. Gerar `cenas.json` em `scripts/`.
4. Para cada bloco, gerar um clipe com Ken Burns (zoompan) de duração igual à do bloco.
   Alternar a direção do zoom entre blocos (in/out) para não ficar repetitivo.
5. Concatenar os clipes.
6. Aplicar `drawtext` com os TEXTO_TELA: caixa alta, fonte pesada, contorno neon,
   posicionado no terço superior, com fade-in de 0.3s.
7. Gerar `legendas.srt` a partir das FALAS, quebrando em linhas de no máximo 6 palavras.
8. Mixar narração (0 dB) + trilha (volume=0.12).
9. Queimar as legendas e exportar em `saida/<nome-do-roteiro>.mp4`
   (H.264, yuv420p, AAC 192k).
10. Reportar: duração final, tamanho do arquivo, e se passou dos 60s.

## Regras visuais obrigatórias
- Paleta: #2A0A4A, #FF2D95, #00F0FF, #FF8C42, fundo #0B0218
- Cortes a cada 2-3 segundos — nenhum bloco pode passar de 4s sem troca de imagem
- Legendas no terço inferior, nunca cobrindo o TEXTO_TELA
- Nunca deixar borda preta: toda imagem preenche 1080x1920

## Regras de conteúdo
- Nunca usar vocabulário de violência explícita nas falas ou legendas
- Sempre narração própria por cima de qualquer clipe de terceiros
- Sempre terminar com CTA de salvar + pergunta aberta
```

### 6.6 Comando de uso no Claude Code

```
Monte o vídeo do roteiro roteiros/dia-lancamento.md usando a skill video-radar.
```

---

## 7. PLANO DE EXECUÇÃO — PRÓXIMAS 72 HORAS

Você tem ~1h30 por noite. O plano abaixo cabe nisso.

### Hoje, 17/11 (terça) — 19h
**Vídeo: "Faltam 2 dias: o checklist pra não se ferrar na quinta"**
Pauta pronta, zero pesquisa necessária:
- Pré-load já está aberto desde o dia 10 — são 212 GB, começa a baixar HOJE
- Quem comprou a caixa física: não tem disco dentro, é código de download
- Destrava à meia-noite no horário local — ou seja, 00h de quinta no Brasil
- **O online não vem no lançamento.** Só o modo história
- Reviews devem sair amanhã, dia 18

Gancho: *"Se você vai jogar GTA 6 na quinta e ainda não fez ISSO, você vai ficar
baixando enquanto todo mundo joga."*

### Amanhã, 18/11 (quarta) — reagir assim que as reviews saírem
**Vídeo: "As notas do GTA 6 saíram"**
Esse é o vídeo de maior potencial da semana. Deixe o roteiro pré-montado com lacunas
pra preencher com as notas. Publicar no máximo 2h depois do embargo cair.

### Quinta, 19/11 — 00h30
**Vídeo: "GTA 6 ESTÁ NO AR"**
Primeiras impressões, primeira meia hora de jogo. Publicar na madrugada e um segundo
vídeo às 19h.

### Do dia 20 em diante
Virar a chave pro pilar de **guias**: "primeiras 5 coisas pra fazer", "como ganhar
dinheiro no início", "easter eggs que ninguém achou". É o conteúdo que sustenta views
nas semanas seguintes.

---

## 8. AVISOS HONESTOS

**Sobre a meta de monetização.** O Programa de Recompensas exige 10k seguidores +
100k views em 30 dias, com vídeos originais de 1min+. Se o canal não chegou perto
disso nos últimos meses, a janela de lançamento é a última chance real de dar o salto
— depois do hype inicial o volume de busca cai bastante. Vale concentrar tudo nos
próximos 10 dias em vez de espalhar.

**Sobre vídeo gerado por IA.** O TikTok vem apertando o cerco em conteúdo de baixo
esforço e exige rotulagem de conteúdo gerado por IA. Montagem programática de imagens
próprias + sua narração **não** é o caso — isso é edição, igual CapCut. Mas vídeo
inteiramente gerado por IA generativa é terreno arriscado pra monetização. A skill
desta seção 6 foi desenhada pra ficar do lado seguro dessa linha.

**Sobre o volume.** Com 1h30/dia e 12x36, 2 vídeos/dia não é sustentável por muito
tempo. Faça o esforço concentrado nos dias 17-22 e depois caia pra 1/dia. Consistência
longa vale mais que um pico seguido de sumiço.

**Sobre a fonte das notícias.** Todo dado deste briefing foi verificado em 17/11/2026.
Dados de lançamento mudam rápido — confirme as notas das reviews antes de publicar,
não presuma.
