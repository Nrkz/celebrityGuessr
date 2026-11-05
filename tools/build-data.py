"""Télécharge une fois les données Pokémon (noms FR) et Amiibo (figurines) dans data/.
Relancer ce script pour mettre les données à jour : python tools/build-data.py"""
import json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

OUT = os.path.join(os.path.dirname(__file__), "..", "data")
UA = {"User-Agent": "blurrio-build/1.0"}

def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return json.load(r)
        except Exception:
            time.sleep(1.5 * (i + 1))
    raise RuntimeError("échec " + url)

def write(name, var, data):
    with open(os.path.join(OUT, name + ".js"), "w", encoding="utf-8") as f:
        f.write("// généré par tools/build-data.py\nconst " + var + "=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")

GEN = {"generation-i":1,"generation-ii":2,"generation-iii":3,"generation-iv":4,"generation-v":5,
       "generation-vi":6,"generation-vii":7,"generation-viii":8,"generation-ix":9}

def pokemon():
    count = get("https://pokeapi.co/api/v2/pokemon-species?limit=1")["count"]
    def one(i):
        d = get(f"https://pokeapi.co/api/v2/pokemon-species/{i}")
        names = {n["language"]["name"]: n["name"] for n in d["names"]}
        return {"id": d["id"], "fr": names.get("fr") or names.get("en"), "en": names.get("en"),
                "gen": GEN[d["generation"]["name"]]}
    with ThreadPoolExecutor(8) as ex:
        res = list(ex.map(one, range(1, count + 1)))
    write("pokemon", "POKEMON", res)
    print("pokémon:", len(res))

# Séries Nintendo retenues (les autres, Monster Hunter, Street Fighter… sont écartées).
NINTENDO = {"Super Mario","Animal Crossing","The Legend of Zelda","Fire Emblem","Splatoon","Metroid","Kirby",
            "Kid Icarus","Star Fox","Pikmin","Donkey Kong","Classic Nintendo","F-Zero","Earthbound","Xenoblade",
            "ARMS","Punch Out","Yoshi's Woolly World","Mario Sports Superstars"}

def amiibo():
    d = get("https://amiiboapi.org/api/amiibo/?type=figure")["amiibo"]
    chars = {}
    for x in d:
        if x["gameSeries"] not in NINTENDO: continue
        k = (x["gameSeries"], x["character"])
        c = chars.setdefault(k, {"name": x["character"], "series": x["gameSeries"], "images": []})
        if x["image"] not in c["images"]: c["images"].append(x["image"])
    res = sorted(chars.values(), key=lambda c: (c["series"], c["name"]))
    write("nintendo", "NINTENDO", res)
    per = {}
    for c in res: per[c["series"]] = per.get(c["series"], 0) + 1
    print("nintendo:", len(res), "personnages", dict(sorted(per.items(), key=lambda kv: -kv[1])))

    # Super Smash Bros : un combattant par nom (le « Mii » générique est écarté), série = franchise d'origine.
    smash = {}
    for x in d:
        if x["amiiboSeries"] != "Super Smash Bros." or x["character"] == "Mii": continue
        c = smash.setdefault(x["character"], {"name": x["character"], "series": x["gameSeries"], "images": []})
        if x["image"] not in c["images"]: c["images"].append(x["image"])
    smash = sorted(smash.values(), key=lambda c: c["name"])
    # Autres univers (Monster Hunter…) : tout ce qui n'est ni Nintendo ni Pokémon ni Mii/Wii Fit.
    skip = NINTENDO | {"Pokemon", "Mii", "Wii Fit"}
    extra = {}
    for x in d:
        if x["gameSeries"] in skip: continue
        c = extra.setdefault((x["gameSeries"], x["character"]), {"name": x["character"], "series": x["gameSeries"], "images": []})
        if x["image"] not in c["images"]: c["images"].append(x["image"])
    extra = sorted(extra.values(), key=lambda c: (c["series"], c["name"]))
    with open(os.path.join(OUT, "jv.js"), "w", encoding="utf-8") as f:
        f.write("// généré par tools/build-data.py\nconst SMASH=" + json.dumps(smash, ensure_ascii=False, separators=(",", ":"))
                + ";\nconst EXTRA=" + json.dumps(extra, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print("smash:", len(smash), "| autres univers:", len(extra))

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    which = sys.argv[1:] or ["amiibo", "pokemon"]      # ex. : python tools/build-data.py amiibo
    if "amiibo" in which: amiibo()
    if "pokemon" in which: pokemon()
