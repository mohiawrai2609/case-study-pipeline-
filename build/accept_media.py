#!/usr/bin/env python
"""
Record a vision-QC decision: accept one candidate for a slot, or reject them all.

    python build/accept_media.py media/004 --accept cab_telematics_interior=1
    python build/accept_media.py media/004 --reject predawn_yard_inspection
    python build/accept_media.py media/004 --status

Accepting copies the chosen candidate to <dir>/<slot>.jpg — the filename media.py
binds on — and records the credit line that CC BY / BY-SA legally require.
Rejected and unrecorded slots are what prompt_pack.py turns into prompts, so you
only ever generate what the free archives genuinely could not supply.
"""
import argparse, io, json, os, shutil, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


def load(d, name):
    p = os.path.join(d, name)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir")
    ap.add_argument("--accept", action="append", default=[], metavar="SLOT=INDEX")
    ap.add_argument("--reject", action="append", default=[], metavar="SLOT")
    ap.add_argument("--status", action="store_true")
    a = ap.parse_args()

    cands = load(a.dir, "_candidates.json")
    acc = load(a.dir, "_accepted.json")

    for spec in a.accept:
        slot, _, idx = spec.partition("=")
        if slot not in cands:
            print(f"  !! {slot}: no candidates on file"); continue
        try:
            c = cands[slot][int(idx or 0)]
        except (ValueError, IndexError):
            print(f"  !! {slot}: no candidate [{idx}]"); continue
        dst = os.path.join(a.dir, f"{slot}.jpg")
        shutil.copy2(c["file"], dst)
        acc[slot] = {"index": int(idx or 0), "file": dst, "credit": c["credit"],
                     "source": c["source"], "licence": c["licence"],
                     "px": f"{c['w']}x{c['h']}", "status": "accepted"}
        print(f"  OK  {slot:<26} <- [{idx}] {c['source']} {c['licence']} {c['w']}x{c['h']}")
        print(f"      credit: {c['credit']}")

    for slot in a.reject:
        acc[slot] = {"status": "rejected"}
        print(f"  --  {slot:<26} rejected -> will be prompted for generation")

    if a.accept or a.reject:
        json.dump(acc, open(os.path.join(a.dir, "_accepted.json"), "w", encoding="utf-8"),
                  indent=1, ensure_ascii=False)

    ok = [s for s, v in acc.items() if v.get("status") == "accepted"]
    no = [s for s in cands if s not in ok]
    print(f"\n  {len(ok)} accepted (no prompt needed): {', '.join(ok) or '-'}")
    print(f"  {len(no)} still open: {', '.join(no) or '-'}")
    print(f"\n  next: python build/prompt_pack.py <data.json>   # prompts ONLY the open slots")


if __name__ == "__main__":
    main()
