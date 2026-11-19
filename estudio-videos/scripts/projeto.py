"""
projeto.py — carrega um projeto de vídeo (projeto.json + marca + rede) e lê o roteiro.

Estrutura de um projeto (projetos/<slug>/):
    projeto.json        {"titulo", "marca", "rede", "estilo"}
    roteiro.md          blocos com FALA, TEXTO_TELA e as linhas de visual
    assets/imagens/     fotos e screenshots       (nome do arquivo sem extensão = chave usada no roteiro)
    assets/recortes/    personagens recortados (.png com transparência) + meta.js
    assets/clipes/      trechos de vídeo
    assets/trilha.*     trilha própria (opcional; sem ela gera synthwave original)
    build/              gerado: narração, durações, cenas renderizadas
    saida/              vídeo final + legendas .srt
"""
from __future__ import annotations

import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
EXT_IMG = (".png", ".jpg", ".jpeg", ".webp")
EXT_VID = (".mp4", ".mov", ".m4v", ".webm", ".mkv")
EXT_AUD = (".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac")
ESTILOS = ("cinema", "recorte", "limpo", "slides", "bonecos")


def _mesclar(a: dict, b: dict) -> dict:
    out = dict(a)
    for k, v in b.items():
        out[k] = _mesclar(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


class Projeto:
    def __init__(self, caminho: str | Path):
        p = Path(caminho)
        if not p.is_absolute() and not p.exists():
            p = RAIZ / "projetos" / p.name if (RAIZ / "projetos" / p.name).exists() else RAIZ / p
        if p.is_file():
            p = p.parent
        if not (p / "projeto.json").is_file():
            raise SystemExit(f"Não achei {p}/projeto.json. Crie com: python scripts/novo_projeto.py <nome>")
        self.dir = p.resolve()
        self.slug = self.dir.name
        self.cfg = json.loads((p / "projeto.json").read_text(encoding="utf-8"))
        padrao = json.loads((RAIZ / "marcas" / "padrao.json").read_text(encoding="utf-8"))
        nome_marca = self.cfg.get("marca", "padrao")
        arq_marca = RAIZ / "marcas" / f"{nome_marca}.json"
        if not arq_marca.is_file():
            raise SystemExit(f"Marca '{nome_marca}' não existe em marcas/. Disponíveis: {[m.stem for m in (RAIZ / 'marcas').glob('*.json')]}")
        self.marca = _mesclar(padrao, json.loads(arq_marca.read_text(encoding="utf-8")))
        redes = json.loads((RAIZ / "redes.json").read_text(encoding="utf-8"))
        nome_rede = self.cfg.get("rede", "tiktok")
        if nome_rede not in redes:
            raise SystemExit(f"Rede '{nome_rede}' não existe em redes.json. Disponíveis: {[k for k in redes if not k.startswith('_')]}")
        self.rede = redes[nome_rede]
        self.rede_id = nome_rede
        self.estilo = self.cfg.get("estilo", "cinema")
        self.W, self.H, self.fps = self.rede["largura"], self.rede["altura"], self.rede.get("fps", 30)
        self.roteiro = self.dir / "roteiro.md"
        self.assets = self.dir / "assets"
        self.build = self.dir / "build"
        self.saida = self.dir / "saida"

    # cores da marca como tuplas RGB
    def cor(self, nome: str) -> tuple[int, int, int]:
        h = self.marca["paleta"].get(nome, nome).lstrip("#")
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

    def fonte(self, uso: str) -> Path:
        nome = self.marca["fontes"].get(uso) or self.marca["fontes"]["titulo"]
        for cand in (self.assets / "fontes" / nome, RAIZ / "recursos" / "fontes" / nome):
            if cand.is_file():
                return cand
        for c in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "C:/Windows/Fonts/arialbd.ttf",
                  "/System/Library/Fonts/Supplemental/Arial Bold.ttf"):
            if Path(c).is_file():
                return Path(c)
        raise SystemExit(f"Fonte {nome} não encontrada (rode setup.sh)")

    def achar(self, nome: str, pastas=("imagens", "recortes", "clipes"), exts=EXT_IMG + EXT_VID) -> Path | None:
        """Acha um arquivo de asset pelo nome (com ou sem extensão)."""
        nome = nome.split("@")[0]
        for pasta in pastas:
            base = self.assets / pasta
            cand = base / nome
            if cand.is_file():
                return cand
            for e in exts:
                if (base / (nome + e)).is_file():
                    return base / (nome + e)
        cand = self.dir / nome
        return cand if cand.is_file() else None

    def trilha_propria(self) -> Path | None:
        for e in EXT_AUD:
            if (self.assets / f"trilha{e}").is_file():
                return self.assets / f"trilha{e}"
        return None


# ───────────────────────── roteiro ─────────────────────────
RE_BLOCO = re.compile(r"^##\s*BLOCO\s*(\d+)\s*[—–\-:]*\s*(.*?)\s*(?:\(([^)]*)\))?\s*$", re.IGNORECASE)
RE_CAMPO = re.compile(r"^(IMAGE[MN]S?|CLIPES?|TEXTO_TELA|FALA|DURA[CÇ][AÃ]O|VISUAL|FIGURINHA|TAG|CREDITO|CRÉDITO|EFEITO|LOGO)\s*:\s*(.*)$",
                      re.IGNORECASE)
RE_INTERVALO = re.compile(r"^\s*(\d+(?::\d+)?(?:[.,]\d+)?)\s*s?\s*(?:-|–|—|a|até)\s*(\d+(?::\d+)?(?:[.,]\d+)?)\s*s?\s*$", re.I)
RE_DUR = re.compile(r"^\s*(\d+(?:[.,]\d+)?)\s*s\s*$", re.I)
PALAVRAS_POR_SEGUNDO = 2.6


def parse_tempo(txt: str) -> float:
    txt = txt.strip().replace(",", ".")
    if ":" in txt:
        m, s = txt.split(":", 1)
        return int(m) * 60 + float(s)
    return float(txt)


def limpar_marcacao(txt: str) -> str:
    return txt.replace("*", "")


def _valor(v: str):
    try:
        return float(v)
    except ValueError:
        return v


def parse_camada(tipo: str, texto: str) -> dict:
    """'foto praia | foco 0.5 0.4 | zoom 1 1.2' → {'tipo': 'visual', 'tipo2': 'foto', 'args': ['praia'], 'foco': [0.5, 0.4], ...}"""
    partes = [p.strip() for p in texto.split("|")]
    d: dict = {"camada": tipo.lower()}
    cabeca = partes[0]
    if tipo.lower() in ("tag", "credito", "crédito"):
        d["texto"] = cabeca
    else:
        ps = cabeca.split()
        d["tipo"] = ps[0].lower() if ps else ""
        d["nome"] = ps[0] if ps else ""
        d["args"] = ps[1:]
    for opc in partes[1:]:
        ps = opc.split()
        if not ps:
            continue
        vals = [_valor(v) for v in ps[1:]]
        d[ps[0].lower()] = vals[0] if len(vals) == 1 else (vals if vals else True)
    return d


def ler_roteiro(caminho: Path) -> list[dict]:
    blocos: list[dict] = []
    atual = None
    ultimo = None
    for n_linha, bruta in enumerate(caminho.read_text(encoding="utf-8").splitlines(), 1):
        linha = bruta.strip()
        m = RE_BLOCO.match(linha)
        if m:
            titulo, par = m.group(2), m.group(3)
            intervalo = dur = None
            if par:
                mi, md = RE_INTERVALO.match(par), RE_DUR.match(par)
                if mi:
                    intervalo = (parse_tempo(mi.group(1)), parse_tempo(mi.group(2)))
                elif md:
                    dur = parse_tempo(md.group(1))
                else:
                    titulo = f"{titulo} ({par})".strip()
            atual = {"numero": int(m.group(1)), "titulo": titulo, "intervalo": intervalo, "dur_cabecalho": dur, "midias": [],
                     "texto_tela": "", "fala": "", "duracao_declarada": None, "visuais": [], "camadas": [], "linha": n_linha}
            blocos.append(atual)
            ultimo = None
            continue
        if atual is None:
            continue
        if not linha or linha.startswith(">") or linha.startswith("<!--"):
            ultimo = None
            continue
        mc = RE_CAMPO.match(linha)
        if mc:
            chave, valor = mc.group(1).upper(), mc.group(2).strip()
            ultimo = None
            if chave.startswith("IMAGE") or chave.startswith("CLIPE"):
                atual["midias"] += [v.strip() for v in valor.split(",") if v.strip()]
            elif chave == "TEXTO_TELA":
                atual["texto_tela"], ultimo = valor, "texto_tela"
            elif chave == "FALA":
                atual["fala"], ultimo = valor, "fala"
            elif chave.startswith("DURA"):
                atual["duracao_declarada"] = parse_tempo(valor.rstrip("sS "))
            elif chave == "VISUAL":
                atual["visuais"].append(parse_camada("visual", valor))
            else:
                atual["camadas"].append(parse_camada(chave.replace("CRÉDITO", "CREDITO"), valor))
        elif ultimo:
            atual[ultimo] = (atual[ultimo] + " " + linha).strip()

    for b in blocos:
        if b["duracao_declarada"]:
            b["duracao"], b["origem_duracao"] = b["duracao_declarada"], "DURACAO"
        elif b["dur_cabecalho"]:
            b["duracao"], b["origem_duracao"] = b["dur_cabecalho"], "cabeçalho"
        elif b["intervalo"] and b["intervalo"][1] > b["intervalo"][0]:
            b["duracao"], b["origem_duracao"] = b["intervalo"][1] - b["intervalo"][0], "cabeçalho"
        else:
            palavras = len(limpar_marcacao(b["fala"]).split())
            b["duracao"] = max(2.5, round(palavras / PALAVRAS_POR_SEGUNDO, 1))
            b["origem_duracao"] = "estimada pela fala"
    t = 0.0
    for b in blocos:
        b["inicio"], b["fim"] = t, t + b["duracao"]
        t = b["fim"]
    return blocos


def reescrever_tempos(roteiro: Path, blocos: list[dict], duracoes: list[float]) -> None:
    texto = roteiro.read_text(encoding="utf-8")
    t = 0.0
    for b, d in zip(blocos, duracoes):
        ini, fim = t, t + d
        padrao = re.compile(rf"^(##\s*BLOCO\s*{b['numero']}\b[^\n(]*?)\s*(\([^)]*\))?\s*$", re.M)
        texto = padrao.sub(lambda m: f"{m.group(1).rstrip()} ({ini:.1f}-{fim:.1f}s)", texto, count=1)
        t = fim
    roteiro.write_text(texto, encoding="utf-8")
