#!/usr/bin/env python3
"""
baixar_imagens.py — baixa as imagens de um projeto para assets/imagens/.

    python scripts/baixar_imagens.py projetos/<slug>

Lê assets/fontes.json do projeto, que pode ter:
    {
      "urls":   {"praia": "https://.../foto.jpg"},                       # nome → URL direta
      "fandom": {"wiki": "gta", "paginas": {"jason_retrato": "Jason Duval"},   # imagem principal de páginas de uma wiki Fandom
                 "arquivos": {"vc_noite": "File:OfficialScreenshots-...jpg"}}  # arquivos da wiki
    }
Rede: o host precisa estar liberado no ambiente (ex.: gta.fandom.com e static.wikia.nocookie.net).
Use imagens com direito de uso ou em contexto de notícia/comentário, com narração e edição próprias.
"""
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from projeto import Projeto  # noqa: E402

UA = {"User-Agent": "Mozilla/5.0 (estudio-videos)"}


def get(url, timeout=90):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()


def salvar(P, nome, url):
    ext = Path(urllib.parse.urlparse(url).path).suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".png" if ".png" in url.lower() else ".jpg"
    destino = P.assets / "imagens" / f"{nome}{ext}"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(get(url))
    print(f"  ✔ {nome}{ext}")


def fandom(P, cfg):
    api = f"https://{cfg['wiki']}.fandom.com/api.php?"
    paginas = cfg.get("paginas", {})
    if paginas:
        q = urllib.parse.urlencode({"action": "query", "titles": "|".join(paginas.values()), "prop": "pageimages", "pithumbsize": "1600", "format": "json"})
        d = json.loads(get(api + q, 60))
        por_titulo = {p["title"]: p for p in d["query"]["pages"].values()}
        for nome, titulo in paginas.items():
            p = por_titulo.get(titulo, {})
            if "thumbnail" in p:
                salvar(P, nome, p["thumbnail"]["source"])
            else:
                print(f"  ✖ {nome}: página '{titulo}' sem imagem principal")
    arqs = list(cfg.get("arquivos", {}).items())
    for i in range(0, len(arqs), 10):
        lote = dict(arqs[i:i + 10])
        q = urllib.parse.urlencode({"action": "query", "titles": "|".join(lote.values()), "prop": "imageinfo", "iiprop": "url", "iiurlwidth": "1920", "format": "json"})
        d = json.loads(get(api + q, 60))
        por_titulo = {p["title"].replace("_", " "): p for p in d["query"]["pages"].values()}
        for nome, titulo in lote.items():
            p = por_titulo.get(titulo.replace("_", " "), {})
            ii = (p.get("imageinfo") or [{}])[0]
            url = ii.get("thumburl") or ii.get("url")
            if url:
                salvar(P, nome, url)
            else:
                print(f"  ✖ {nome}: arquivo '{titulo}' não encontrado")


def main():
    if len(sys.argv) < 2:
        sys.exit("uso: python scripts/baixar_imagens.py projetos/<slug>")
    P = Projeto(sys.argv[1])
    arq = P.assets / "fontes.json"
    if not arq.is_file():
        sys.exit(f"Sem {arq.relative_to(P.dir.parent.parent)} (lista do que baixar)")
    cfg = json.loads(arq.read_text(encoding="utf-8"))
    for nome, url in cfg.get("urls", {}).items():
        salvar(P, nome, url)
    if "fandom" in cfg:
        fandom(P, cfg["fandom"])


if __name__ == "__main__":
    main()
