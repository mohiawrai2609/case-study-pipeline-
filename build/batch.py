#!/usr/bin/env python
"""
Batch driver — turn one anatomy.batch workflow result into finished articles.

    python build/batch.py runs/batch-01.json
    python build/batch.py runs/batch-01.json --skip-blocked

Runs adapt -> release for every role in the batch and prints one status table.
A role with audit blockers is still built (so you can read it) but is flagged
NEEDS REVIEW; --skip-blocked leaves those unbuilt instead.
"""
import argparse, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower().replace("&", "and")).strip("-")
    return re.sub(r"-{2,}", "-", s)


def run(cmd):
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("result")
    ap.add_argument("--skip-blocked", action="store_true")
    a = ap.parse_args()

    raw = json.load(open(a.result, encoding="utf-8"))
    batch = raw.get("result", raw)
    roles = batch.get("roles") or ([batch] if batch.get("data") else [])
    if not roles:
        sys.exit("no roles in this result file")

    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "runs"), exist_ok=True)

    rows, built, blocked_skipped = [], 0, 0
    for r in roles:
        issue = str(r.get("issue", 0)).zfill(3)
        title = r.get("title", r["data"]["role"]["title"])
        slug = slugify(title)
        blockers = [i for i in (r.get("audit") or {}).get("issues", []) if i["severity"] == "blocker"]
        c = r.get("claims", {})

        if blockers and a.skip_blocked:
            rows.append((issue, title[:34], c, len(blockers), "SKIPPED (blocked)"))
            blocked_skipped += 1
            continue

        run_path = os.path.join(ROOT, "runs", f"{issue}-{slug}.json")
        json.dump(r, open(run_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        data_path = os.path.join(ROOT, "data", f"{issue}-{slug}.json")

        rc, out = run([sys.executable, "build/adapt.py", run_path, data_path])
        if rc:
            rows.append((issue, title[:34], c, len(blockers), "ADAPT FAILED"))
            print(out.strip()[:400])
            continue
        rc, out = run([sys.executable, "build/release.py", data_path])
        if rc:
            rows.append((issue, title[:34], c, len(blockers), "BUILD FAILED"))
            print(out.strip()[:400])
            continue

        built += 1
        status = f"NEEDS REVIEW ({len(blockers)} blockers)" if blockers else "clean"
        rows.append((issue, title[:34], c, len(blockers), status))

    print(f"\n{'No.':<5}{'role':<36}{'claims':>16}{'blockers':>10}  status")
    print("-" * 92)
    for issue, title, c, nb, status in rows:
        cl = f"{c.get('verified',0)}/{c.get('found',0)} ok, {c.get('killed',0)} killed"
        print(f"{issue:<5}{title:<36}{cl:>16}{nb:>10}  {status}")
    print("-" * 92)
    t = batch.get("totals", {})
    if t:
        pct = 100 * t.get("verified", 0) / t["found"] if t.get("found") else 0
        print(f"batch: {t.get('verified',0)}/{t.get('found',0)} claims verified ({pct:.0f}%), "
              f"{t.get('killed',0)} killed, {t.get('blockers',0)} audit blockers")
    print(f"built {built} article(s)" + (f", {blocked_skipped} skipped" if blocked_skipped else ""))
    print("output/  —  each role has a .web.html and a .standalone.html")


if __name__ == "__main__":
    main()
