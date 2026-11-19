#!/usr/bin/env python3
"""
baixar_oficiais.py — baixa os retratos e screenshots OFICIAIS do GTA 6 hospedados na wiki do GTA (gta.fandom.com).

    python scripts/baixar_oficiais.py

Retratos → assets/personagens/original/<nome>.png   (depois: python scripts/recortar.py)
Cenas    → assets/cenas_oficiais/*.jpg
Imagens da Rockstar: use em conteúdo de notícia/comentário, sempre com narração e edição próprias.
"""
import json
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
UA = {"User-Agent": "Mozilla/5.0"}
RETRATOS = {"jason": "Jason Duval", "lucia": "Lucia Caminos", "cal": "Cal Hampton", "boobie": "Boobie Ike",
            "drequan": "Dre'Quan Priest", "real": "Real Dimez", "raul": "Raul Bautista", "brian": "Brian Heder"}
CENAS = ["ViceCity-SS8", "LeonidaKeys-SS1", "LeonidaKeys-SS2", "LeonidaKeys-SS3", "Grassrivers-SS4", "PortGellhorn-SS1",
         "MountKalaga-SS6", "Ambrosia-SS1", "JasonDuval-SS5", "LuciaCaminos-SS1", "LuciaCaminos-SS2", "CalHampton-SS4",
         "BrianHeder-SS1", "BoobieIke-SS3", "DreQuanPriest-SS2", "RaulBautista-SS3", "RealDimez-SS4"]


def api(**k):
    k["format"] = "json"
    url = "https://gta.fandom.com/api.php?" + urllib.parse.urlencode(k)
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))


def baixar(url, destino):
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read())
    print("✔", destino.relative_to(RAIZ))


def main():
    d = api(action="query", titles="|".join(RETRATOS.values()), prop="pageimages", pithumbsize="1600")
    por_titulo = {p["title"]: p for p in d["query"]["pages"].values()}
    for nome, titulo in RETRATOS.items():
        p = por_titulo.get(titulo, {})
        if "thumbnail" in p:
            baixar(p["thumbnail"]["source"], RAIZ / "assets/personagens/original" / f"{nome}.png")
    arqs = ["File:OfficialScreenshots-GTAVI-PromotionalWebsite-" + c + ".jpg" for c in CENAS] + ["File:Logo-GTAVI.png"]
    for i in range(0, len(arqs), 10):
        d = api(action="query", titles="|".join(arqs[i:i + 10]), prop="imageinfo", iiprop="url", iiurlwidth=1920)
        for p in d["query"]["pages"].values():
            ii = (p.get("imageinfo") or [{}])[0]
            url = ii.get("thumburl") or ii.get("url")
            if url:
                baixar(url, RAIZ / "assets/cenas_oficiais" / p["title"][5:].replace("OfficialScreenshots-GTAVI-PromotionalWebsite-", ""))


if __name__ == "__main__":
    main()
