#!/usr/bin/env python3
"""Rebuild every issue and prove the output is byte-for-byte what it was.

    python tests/golden/run.py            # verify (exit 1 on any drift)
    python tests/golden/run.py --update   # re-record, after an intended change

The builder is deterministic: same data + same shell -> same bytes. So a changed
checksum means exactly one of three things happened, and you are expected to know
which: the data changed, the shell changed, or something silently dropped.

This exists because a real drift shipped undetected. components.js recomputes
depth from v.tasks at runtime, so 40 of 43 vendors in No.008 carried a depth in
the JSON that disagreed with the rendered page for weeks. Nothing caught it,
because nothing compared a build to its predecessor.
"""
import hashlib, io, json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STORE = os.path.join(ROOT, 'tests', 'golden', 'checksums.json')


def issues():
    """Every data file that is a real issue (has an issue number and sections)."""
    out = []
    ddir = os.path.join(ROOT, 'data')
    for fn in sorted(os.listdir(ddir)):
        if not fn.endswith('.json') or fn.startswith('_'):
            continue
        try:
            with io.open(os.path.join(ddir, fn), encoding='utf-8') as fh:
                d = json.load(fh)
        except ValueError:
            continue
        if d.get('issue') and d.get('sections'):
            out.append(fn)
    return out


def build_hash(fn, tmp):
    src = os.path.join('data', fn)
    dst = os.path.join(tmp, fn.replace('.json', '.html'))
    r = subprocess.run(['node', 'build/build.mjs', src, dst],
                       cwd=ROOT, capture_output=True, text=True)
    if r.returncode:
        return None, (r.stderr or r.stdout).strip()[:300]
    with io.open(dst, 'rb') as fh:
        return hashlib.sha256(fh.read()).hexdigest(), None


def main():
    update = '--update' in sys.argv
    prev = {}
    if os.path.exists(STORE):
        with io.open(STORE, encoding='utf-8') as fh:
            prev = json.load(fh)

    cur, failed, drifted = {}, [], []
    with tempfile.TemporaryDirectory() as tmp:
        for fn in issues():
            h, err = build_hash(fn, tmp)
            if h is None:
                failed.append((fn, err))
                print(f"  BUILD FAIL  {fn}\n              {err}")
                continue
            cur[fn] = h
            was = prev.get(fn)
            if was is None:
                print(f"  new         {fn}  {h[:16]}")
            elif was != h:
                drifted.append(fn)
                print(f"  DRIFT       {fn}\n              was {was[:16]}  now {h[:16]}")
            else:
                print(f"  ok          {fn}  {h[:16]}")

    if update:
        with io.open(STORE, 'w', encoding='utf-8', newline='\n') as fh:
            json.dump(cur, fh, indent=1, sort_keys=True)
            fh.write('\n')
        print(f"\nrecorded {len(cur)} checksum(s) -> tests/golden/checksums.json")
        return 0

    gone = [k for k in prev if k not in cur and k not in dict(failed)]
    for k in gone:
        print(f"  MISSING     {k}  (was recorded, no longer builds)")
    bad = len(failed) + len(drifted) + len(gone)
    print(f"\n{len(cur)} built | {len(drifted)} drifted | {len(failed)} failed | {len(gone)} missing")
    if bad:
        print("FAIL -- run with --update only if every change above is intended.")
    else:
        print("PASS -- every issue rebuilt to its recorded bytes.")
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
