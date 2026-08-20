#!/usr/bin/env python3
"""Bridge between sourced candidates and the vision-qc workflow.

    python build/vision_qc.py args  data/008-role.json media/008 > runs/qc-008.args.json
    #   ... run pipeline/vision-qc.js with that file as args ...
    python build/vision_qc.py apply runs/qc-008.result.json

`args` collects each slot's editorial brief and its downloaded candidates so the
agent judges against what the slot is FOR, not just the filename. `apply` writes
the decisions through build/accept_media.py, so there is exactly one code path
that mutates the media directory and its credit records.
"""
import argparse, io, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def img_blocks(data):
    """Every img block carrying a slot, with the brief the compose stage wrote."""
    out = {}
    for sec in data.get('sections', []):
        for b in sec.get('blocks', []):
            if b.get('t') == 'img' and b.get('slot'):
                out[b['slot']] = {'caption': b.get('caption', ''),
                                  'prompt': b.get('prompt', ''),
                                  'query': b.get('query', '')}
    return out


def cmd_args(a):
    with io.open(a.data, encoding='utf-8') as fh:
        d = json.load(fh)
    cand_path = os.path.join(a.dir, '_candidates.json')
    if not os.path.exists(cand_path):
        sys.exit(f"no {cand_path} -- run build/source_media.py first")
    with io.open(cand_path, encoding='utf-8') as fh:
        cands = json.load(fh)
    briefs = img_blocks(d)
    slots = []
    for slot, files in cands.items():
        b = briefs.get(slot, {})
        slots.append({
            'slot': slot, 'caption': b.get('caption', ''), 'prompt': b.get('prompt', ''),
            'query': b.get('query', ''),
            'files': [{'file': os.path.join(ROOT, f['file'].replace(chr(92), os.sep)),
                       'title': f.get('title', ''), 'w': f.get('w'), 'h': f.get('h')}
                      for f in files],
        })
    json.dump({'issue': d.get('issue'), 'dir': a.dir,
               'role': (d.get('role') or {}).get('title', ''), 'slots': slots},
              sys.stdout, ensure_ascii=False, indent=1)
    print(file=sys.stderr)
    print(f"{len(slots)} slot(s), {sum(len(s['files']) for s in slots)} candidate(s)", file=sys.stderr)


def cmd_apply(a):
    with io.open(a.result, encoding='utf-8') as fh:
        res = json.load(fh)
    decisions = res.get('decisions') or []
    mdir = a.dir or res.get('dir')
    if not mdir:
        sys.exit('no media dir: pass --dir or include it in the result')
    acc = [d for d in decisions if d.get('decision') == 'accept' and d.get('index') is not None]
    rej = [d for d in decisions if d not in acc]
    argv = [sys.executable, os.path.join('build', 'accept_media.py'), mdir]
    for d in acc:
        argv += ['--accept', f"{d['slot']}={d['index']}"]
    for d in rej:
        argv += ['--reject', d['slot']]
    if a.dry_run:
        print(' '.join(argv))
        return
    r = subprocess.run(argv, cwd=ROOT, capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip())
    for d in decisions:
        print(f"  {d['decision']:<7}{d['slot']:<28}{str(d.get('reason',''))[:80]}")
    sys.exit(r.returncode)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    p1 = sub.add_parser('args'); p1.add_argument('data'); p1.add_argument('dir')
    p2 = sub.add_parser('apply'); p2.add_argument('result')
    p2.add_argument('--dir'); p2.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    (cmd_args if a.cmd == 'args' else cmd_apply)(a)


if __name__ == '__main__':
    main()
