#!/usr/bin/env python
"""
Adapter — workflow output (DB shapes) -> the shell's data contract.

    python build/adapt.py runs/43-3031.workflow.json data/005-bookkeeping.json

The workflow returns tasks and vendors in database shape because that is what
reads well in a prompt. components.js wants a different shape. This is the one
place that translation happens, so neither side has to know about the other.
"""
import json, re, sys

GRAD = ["linear-gradient(135deg,#C41E3A,#9A1830)", "linear-gradient(135deg,#B45309,#92400E)",
        "linear-gradient(135deg,#2563EB,#1D4ED8)", "linear-gradient(135deg,#059669,#047857)"]
TYPE = {"ai augmented": "a", "traditional": "h", "ai created human": "h",
        "ai_augmented": "a", "ai created": "h"}
REPLACED_AT = 75          # a task with production evidence at/above this APS reads as "replaced"


def short(text, n=40):
    """First clause, trimmed to a grid-friendly label."""
    s = re.split(r"[,;(]| through | using | that ", text)[0].strip()
    return (s[:n].rstrip() if len(s) > n else s) or text[:n]


def adapt(d):
    # ---- tasks -------------------------------------------------------
    covered = {}
    for v in d.get("vendors", []):
        prod = v.get("evidence") == "Production"
        for t in v.get("tasks", []):
            key = t["name"][:40]
            covered[key] = max(covered.get(key, 0), t["aps"] if prod else 0)

    tasks = []
    for t in d.get("tasks", []):
        text = t.get("text") or t.get("task_text", "")
        base = TYPE.get((t.get("type") or "").strip().lower(), "h")
        best = max((v for k, v in covered.items() if k[:24] and k[:24] in text[:60]), default=0)
        raw = (t.get("type") or "").strip().lower()
        row = {
            "name": short(text),
            "type": "r" if best >= REPLACED_AT else base,
            "desc": text if text.endswith(".") else text + ".",
            "vendor": t.get("top_vendor") or ("No vendor — human only" if base == "h" else "See vendor matrix"),
        }
        # AI-created tasks collapse to "h" for the task grid (they ARE human work), but the
        # sidebar's "Emerging Roles" block needs to know they were invented by the machine.
        if "created" in raw:
            row["origin"] = "ai-created"
        tasks.append(row)

    # ---- vendors -----------------------------------------------------
    vendors = []
    for i, v in enumerate(d.get("vendors", [])):
        name = v["name"]
        vendors.append({
            "id": re.sub(r"[^a-z0-9]", "", name.lower())[:6] or f"v{i}",
            "name": name,
            "initials": v.get("initials") or name[:2].upper(),
            "stage": (v.get("stage") or "Private").rstrip(". "),
            # Bubble size encodes EVIDENCE STRENGTH (avg trust_score, a real DB field).
            # "Workers reached" was an editorial estimate the database never held.
            "reach": v.get("trust") or 60,
            "products": v.get("products", 1),
            "evidence": v.get("evidence", "Pilot"),
            "logo": GRAD[i % len(GRAD)],
            "desc": v.get("desc", ""),
            "note": v.get("note", ""),
            "tasks": [{"name": short(t["name"], 44), "aps": t["aps"], "vec": t.get("vec", "Cognitive")}
                      for t in v.get("tasks", [])],
        })

    d["tasks"], d["vendors"] = tasks, vendors
    return d


def main():
    if len(sys.argv) < 3:
        sys.exit("usage: python build/adapt.py <workflow.json> <out-data.json>")
    raw = json.load(open(sys.argv[1], encoding="utf-8"))
    data = raw.get("data", raw)
    out = adapt(data)

    missing = [k for k in ("role", "scores", "tasks", "vendors", "matrix", "econ", "shift", "sections")
               if not out.get(k)]
    if missing:
        sys.exit(f"adapted data is missing: {', '.join(missing)}")

    # extract.sql builds an `anchors` set from rpi.roles precisely so the Exhibit 1
    # comparison can never drift from the canonical scores. It was never carried
    # across here, so chartEx() fell back to rendering nothing and the exhibit
    # vanished silently. Warn rather than exit: an article without the chart is
    # still publishable, but nobody should ship one without being told.
    if not out.get("anchors"):
        print("  WARNING: no `anchors` — Exhibit 1 (RPI comparison chart) will be omitted")

    json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    quotes = sum(1 for s in out["sections"] for b in s.get("blocks", []) if b.get("t") == "pq")
    imgs = sum(1 for s in out["sections"] for b in s.get("blocks", []) if b.get("t") == "img")
    words = sum(len(str(b.get("text", "")).split())
                for s in out["sections"] for b in s.get("blocks", []))
    print(f"adapted -> {sys.argv[2]}")
    print(f"  {len(out['tasks'])} tasks · {len(out['vendors'])} vendors · {len(out['sections'])} sections")
    print(f"  ~{words:,} words · {quotes} pull quotes · {imgs} image slots")
    reach = {v["reach"] for v in out["vendors"]}
    if len(reach) == 1:
        print(f"  note: every vendor has trust {reach.pop()} — matrix bubbles will be equal-sized")


if __name__ == "__main__":
    main()
