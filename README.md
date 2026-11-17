# MFX Offline

IA que funciona **sem internet** no celular Android, junto com uma biblioteca offline (Wikipédia, guias médicos) do Kiwix. Feita para o moto g17 (4 GB de RAM), mas roda em qualquer Android 13+ com processador 64 bits.

## O que o app faz

- **Chat com IA offline**: roda um modelo pequeno (.gguf) direto no celular, com o motor llama.cpp.
- **Biblioteca offline**: abre arquivos .zim do Kiwix (Wikipédia, WikiMed etc.).
- **Respostas com fonte (RAG)**: antes de responder, o app pesquisa na biblioteca e a IA responde com base nos trechos encontrados. As fontes aparecem embaixo da resposta e abrem o artigo ao tocar.
- **Modo leitura**: pesquisa e abre os artigos direto, sem usar a IA, para economizar bateria.
- **Economia**: tamanho de resposta ajustável, botão de parar, nível da bateria no topo e tema escuro.
- Conversa salva no celular. Segure uma mensagem para copiar.

## Como gerar o APK (sem instalar nada no computador)

1. Crie uma conta em github.com (se ainda não tiver).
2. Clique em **New repository**, dê o nome `mfx-offline` e crie.
3. Na página do repositório, clique em **uploading an existing file** e arraste **todo o conteúdo desta pasta** (incluindo a pasta `.github`). Clique em **Commit changes**.
   - Dica: no computador, a pasta `.github` pode ficar oculta. Se o upload pelo navegador não pegar ela, crie o arquivo manualmente em **Add file › Create new file** com o nome `.github/workflows/build.yml` e cole o conteúdo.
4. Vá na aba **Actions**. A compilação começa sozinha e leva uns 20 a 40 minutos.
5. Quando terminar (ícone verde), vá em **Releases** (lado direito da página inicial do repositório) e baixe o **MFX-Offline.apk** pelo celular.
6. Instale o APK (o Android vai pedir permissão para instalar de fonte desconhecida).

Toda vez que você mudar algum arquivo no repositório, um APK novo é gerado.

## Arquivos para baixar no celular (com internet, antes da emergência)

**Modelo de IA (obrigatório, escolha um):**
- `Qwen2.5-1.5B-Instruct` no formato **Q4_K_M .gguf** (cerca de 1 GB): melhor em português. Procure no Hugging Face por "Qwen2.5-1.5B-Instruct-GGUF".
- `Gemma 3 1B` no formato **Q4_K_M .gguf** (cerca de 800 MB): mais leve e mais rápido.

**Biblioteca offline (recomendado):** em library.kiwix.org
- Wikipédia em português, versão **nopic** (sem imagens), para caber no celular.
- **WikiMed** (medicina) e guias práticos de sobrevivência/primeiros socorros disponíveis no catálogo.

No app: toque em **⋮ › Escolher modelo de IA** e depois **⋮ › Escolher biblioteca (.zim)**.

## Estrutura do projeto

```
.github/workflows/build.yml   automação que compila o APK no GitHub
app/build.gradle.kts           dependências (llama.cpp, Kiwix, Jsoup)
app/src/main/java/com/mfx/offline/
  MainActivity.kt   tela de chat
  ReaderActivity.kt modo leitura da biblioteca
  Rag.kt            busca na biblioteca + montagem da pergunta
  ZimLibrary.kt     leitura dos arquivos .zim
  ModelManager.kt   importação do modelo .gguf
  ChatAdapter.kt    lista de mensagens
  ChatMessage.kt    mensagens e histórico salvo
  Prefs.kt          configurações
```

O motor de IA vem do projeto aberto llama.cpp (pasta `examples/llama.android/lib`), baixado automaticamente na compilação.

## Limitações

- Modelos de 1 a 1,5B erram fatos e se perdem em conversas longas. Para saúde e segurança, confira sempre a fonte.
- Gerar respostas esquenta o celular e gasta bateria. Prefira o modo leitura quando der.
- Licenças: o Kiwix (libkiwix) é GPLv3. Para uso pessoal não há problema; para vender o app, o código precisa ser aberto.
