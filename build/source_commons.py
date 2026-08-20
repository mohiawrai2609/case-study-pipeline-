#!/usr/bin/env python
"""
Media sourcing — search Wikimedia Commons for a slot, download usable candidates.

    python build/source_commons.py data/008-role.json --out media/008

For every img block carrying a `query`, this fetches candidates, applies the
deterministic filters (licence, resolution, aspect, file type), and writes the
survivors to <out>/_candidates/<slot>/ with an attribution sidecar.

It deliberately does NOT choose. Picking the best candidate — or rejecting all of
them because none are good enough — is a judgement call made by the vision QC
stage, which can actually look at the images. Slots left unresolved fall through
to generation.

No API key required. Commons asks only for a descriptive User-Agent.
"""
import argparse, io, json, os, re, sys, urllib.parse, urllib.request

# Windows consoles default to cp1252 and choke on arrows/dashes in captions
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "ReplaceableAI-AutomationAnatomy/1.0 (editorial research; contact via replaceable.ai)"}

# Ranked by how little friction they create downstream. CC BY-SA is usable but
# share-alike, so it is accepted last and always with a visible credit line.
LICENCE_RANK = {
    "public domain": 0, "cc0": 0, "pd": 0,
    "cc by 4.0": 1, "cc by 3.0": 1, "cc by 2.0": 1, "cc by 2.5": 1,
    "cc by-sa 4.0": 2, "cc by-sa 3.0": 2, "cc by-sa 2.0": 2, "cc by-sa 2.5": 2,
}
MIN_W, MIN_H = 1200, 800
MAX_CANDIDATES = 4


def strip_html(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s or "")).strip()


def licence_rank(name):
    n = (name or "").strip().lower()
    for k, v in LICENCE_RANK.items():
        if n.startswith(k):
            return v
    return 99


def search(query, limit=12):
    p = {"action": "query", "format": "json", "generator": "search",
         "gsrsearch": f"filetype:bitmap {query}", "gsrnamespace": "6",
         "gsrlimit": str(limit), "prop": "imageinfo",
         "iiprop": "url|size|mime|extmetadata", "iiurlwidth": "2000"}
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(p), headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def candidates_for(query):
    try:
        data = search(query)
    except Exception as e:
        print(f"      search failed: {type(e).__name__}: {e}")
        return []
    pages = (data.get("query") or {}).get("pages") or {}
    out = []
    for pg in pages.values():
        ii = (pg.get("imageinfo") or [{}])[0]
        md = ii.get("extmetadata") or {}
        lic = strip_html((md.get("LicenseShortName") or {}).get("value"))
        w, h = ii.get("width") or 0, ii.get("height") or 0
        rank = licence_rank(lic)
        if rank == 99:                       # unknown or restrictive licence
            continue
        if w < MIN_W or h < MIN_H:           # too small to run full-bleed
            continue
        if (ii.get("mime") or "").split("/")[-1] not in ("jpeg", "png", "webp"):
            continue
        out.append({
            "title": pg.get("title"),
            "url": ii.get("thumburl") or ii.get("url"),
            "descurl": ii.get("descriptionurl"),
            "w": w, "h": h, "licence": lic, "licence_rank": rank,
            "artist": strip_html((md.get("Artist") or {}).get("value"))[:80],
            "desc": strip_html((md.get("ImageDescription") or {}).get("value"))[:220],
        })
    out.sort(key=lambda c: (c["licence_rank"], -(c["w"] * c["h"])))
    return out[:MAX_CANDIDATES]


def credit(c):
    """Attribution line required by CC BY / CC BY-SA, rendered into the caption."""
    if c["licence_rank"] == 0:
        return f"{c['title'].replace('File:', '')} (public domain, Wikimedia Commons)"
    who = c["artist"] or "unknown"
    return f"Photo: {who}, {c['licence']}, via Wikimedia Commons"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data"); ap.add_argument("--out", default="")
    ap.add_argument("--limit", type=int, default=MAX_CANDIDATES)
    a = ap.parse_args()

    d = json.load(open(a.data, encoding="utf-8"))
    issue = str(d.get("issue", 0)).zfill(3)
    outdir = a.out or os.path.join("media", issue)
    cdir = os.path.join(outdir, "_candidates")
    os.makedirs(cdir, exist_ok=True)

    slots = [b for s in d["sections"] for b in s.get("blocks", []) if b.get("t") == "img"]
    if not slots:
        sys.exit("no img blocks in this data file")

    found = empty = 0
    manifest = {}
    for b in slots:
        slot, q = b.get("slot"), b.get("query")
        if not q:
            print(f"  {slot:<28} no `query` — routed straight to generation")
            empty += 1
            continue
        cands = candidates_for(q)
        print(f"  {slot:<28} \"{q[:44]}\" → {len(cands)} candidate(s)")
        if not cands:
            empty += 1
            continue
        sdir = os.path.join(cdir, slot)
        os.makedirs(sdir, exist_ok=True)
        kept = []
        for i, c in enumerate(cands[:a.limit]):
            path = os.path.join(sdir, f"{i}.jpg")
            try:
                req = urllib.request.Request(c["url"], headers=UA)
                with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
                    f.write(r.read())
            except Exception as e:
                print(f"      download failed: {type(e).__name__}")
                continue
            c["file"] = path
            c["credit"] = credit(c)
            kept.append(c)
            print(f"      [{i}] {c['w']}x{c['h']:<6} {c['licence']:<14} {c['artist'][:34]}")
        if kept:
            manifest[slot] = kept
            found += 1
        else:
            empty += 1

    mpath = os.path.join(outdir, "_candidates.json")
    json.dump(manifest, open(mpath, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"\n{found} slot(s) with candidates · {empty} routed to generation")
    print(f"manifest: {mpath}")
    print("next: vision QC picks or rejects, then generate.py fills whatever is left")


if __name__ == "__main__":
    main()
