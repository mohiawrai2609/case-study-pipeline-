#!/usr/bin/env python
"""
Media sourcing — find commercially usable photography for a slot, free, no API key.

    python build/source_media.py data/008-role.json --out media/008

Queries Openverse, which indexes Wikimedia Commons AND Flickr, rawpixel, StockSnap
and museum collections. Measured hit rate on realistic occupational queries: 88%,
versus 0% for Commons alone on specific editorial moments — the archives were never
the problem, the licence and resolution filters were.

Licence policy: cc0 / pdm / by / by-sa ONLY. `nc` (non-commercial) and `nd`
(no-derivatives) are excluded outright — Replaceable.ai is a commercial product and
the pipeline resizes every image, so both would be violations.

Downloads candidates; it does NOT choose. Picking one, or rejecting all because none
are good enough, is the vision-QC stage's job. Unresolved slots fall through to
generation.
"""
import os
import argparse, io, json, re, sys, time, urllib.error, urllib.parse, urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

OV = "https://api.openverse.org/v1/images/"
# Wikimedia REQUIRES a User-Agent carrying a real contact URL and email, and it
# explicitly blocks browser-spoofing UAs. Anything else gets a persistent HTTP 429.
# Override the contact with ANATOMY_CONTACT if you want your own address in the logs.
_CONTACT = os.environ.get("ANATOMY_CONTACT", "https://replaceable.ai/; media@replaceable.ai")
UA = {"User-Agent": f"ReplaceableAI-AutomationAnatomy/1.0 ({_CONTACT}) python-urllib/3",
      "Accept": "image/*,*/*"}
OK_LICENCE = {"cc0": 0, "pdm": 0, "by": 1, "by-sa": 2}      # lower = less downstream friction
MIN_W, MIN_H = 1200, 800
MAX_CANDIDATES = 4


def search(query, n=20):
    p = {"q": query, "page_size": str(n), "license": "cc0,pdm,by,by-sa", "size": "large"}
    try:
        r = urllib.request.Request(OV + "?" + urllib.parse.urlencode(p), headers=UA)
        with urllib.request.urlopen(r, timeout=30) as f:
            return json.loads(f.read().decode()).get("results") or []
    except Exception as e:
        print(f"      search failed: {type(e).__name__}")
        return []


def fetch(url, path, idx, tries=4):
    """Wikimedia 429s clients that fire downloads back to back. Throttle and back off."""
    for attempt in range(tries):
        try:
            r = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(r, timeout=60) as f:
                data = f.read()
            if len(data) < 5000:
                print(f"      [{idx}] too small ({len(data)}b), skipped"); return False
            open(path, "wb").write(data)
            time.sleep(0.6)                      # be a good citizen between files
            return True
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < tries - 1:
                wait = 2 ** attempt
                print(f"      [{idx}] rate limited, waiting {wait}s")
                time.sleep(wait); continue
            print(f"      [{idx}] HTTP {e.code}"); return False
        except Exception as e:
            if attempt < tries - 1:
                time.sleep(1.5); continue
            print(f"      [{idx}] {type(e).__name__}"); return False
    return False


def credit(c):
    """CC BY and BY-SA both require attribution; render it into the caption."""
    if c["rank"] == 0:
        return f"{c['title'][:60]} (public domain, via {c['source']})"
    who = c.get("creator") or "unknown"
    lic = c["licence"].upper().replace("-", " ")
    return f"Photo: {who}, CC {lic}, via {c['source']}"


def candidates_for(query):
    out = []
    for r in search(query):
        lic = (r.get("license") or "").lower()
        if lic not in OK_LICENCE:
            continue
        w, h = r.get("width") or 0, r.get("height") or 0
        if w < MIN_W or h < MIN_H:
            continue
        out.append({
            "title": r.get("title") or "", "url": r.get("url"),
            "page": r.get("foreign_landing_url"), "source": r.get("source") or "?",
            "creator": (r.get("creator") or "")[:60],
            "licence": lic, "rank": OK_LICENCE[lic], "w": w, "h": h,
        })
    # prefer permissive licences, then larger images
    out.sort(key=lambda c: (c["rank"], -(c["w"] * c["h"])))
    return out[:MAX_CANDIDATES]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data"); ap.add_argument("--out", default="")
    a = ap.parse_args()

    d = json.load(open(a.data, encoding="utf-8"))
    outdir = a.out or os.path.join("media", str(d.get("issue", 0)).zfill(3))
    cdir = os.path.join(outdir, "_candidates")
    os.makedirs(cdir, exist_ok=True)

    slots = [b for s in d["sections"] for b in s.get("blocks", []) if b.get("t") == "img"]
    if not slots:
        sys.exit("no img blocks in this data file")

    manifest, found, to_gen = {}, 0, []
    for b in slots:
        slot, q = b.get("slot"), b.get("query")
        if not q:
            print(f"  {slot:<26} no query -> generation")
            to_gen.append(slot); continue
        cands = candidates_for(q)
        print(f"  {slot:<26} \"{q[:38]}\" -> {len(cands)}")
        if not cands:
            to_gen.append(slot); continue
        sdir = os.path.join(cdir, slot); os.makedirs(sdir, exist_ok=True)
        kept = []
        for i, c in enumerate(cands):
            path = os.path.join(sdir, f"{i}.jpg")
            if not fetch(c["url"], path, i):
                continue
            c["file"] = path; c["credit"] = credit(c)
            kept.append(c)
            print(f"      [{i}] {c['w']}x{c['h']:<6} {c['licence']:<6} {c['source']:<10} {c['title'][:32]}")
        if kept:
            manifest[slot] = kept; found += 1
        else:
            to_gen.append(slot)

    json.dump(manifest, open(os.path.join(outdir, "_candidates.json"), "w", encoding="utf-8"),
              indent=1, ensure_ascii=False)
    print(f"\n{found} slot(s) sourced · {len(to_gen)} to generate: {', '.join(to_gen) or '-'}")
    print(f"manifest: {os.path.join(outdir, '_candidates.json')}")
    print("next: vision QC picks or rejects -> generate.py fills the rest -> media.py binds")


if __name__ == "__main__":
    main()
