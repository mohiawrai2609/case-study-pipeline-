#!/usr/bin/env python3
"""Merge a workflow's composed prose into an extracted data file.

The compose stage returns cover/econ/shift/sections; everything else in the data
file is workbook fact and must survive untouched. Reads the run journal rather
than requiring the payload to be pasted.

  python build/apply_workflow.py <run_dir_or_journal> <data.json> [--dry-run]
"""
import json, sys, os, argparse, io, glob


def load_journal(path):
    """Yield every JSON value found in a journal.jsonl (or a plain result JSON)."""
    if os.path.isdir(path):
        cands = [os.path.join(path, 'journal.jsonl')]
        cands += sorted(glob.glob(os.path.join(path, '*.jsonl')))
    else:
        cands = [path]
    for c in cands:
        if not os.path.exists(c):
            continue
        with io.open(c, encoding='utf-8', errors='replace') as f:
            head = f.read(1)
            f.seek(0)
            if head == '[':                       # a plain JSON array
                try:
                    for v in json.load(f):
                        yield v
                except Exception:
                    pass
                continue
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except Exception:
                    continue


def deep_find(obj, want, depth=0):
    """Find dicts containing all keys in `want`, anywhere in a nested structure."""
    if depth > 8:
        return
    if isinstance(obj, dict):
        if all(k in obj for k in want):
            yield obj
        for v in obj.values():
            yield from deep_find(v, want, depth + 1)
        # journals often stash the payload as a JSON string
        for v in obj.values():
            if isinstance(v, str) and len(v) > 200 and v.lstrip()[:1] in '{[':
                try:
                    yield from deep_find(json.loads(v), want, depth + 1)
                except Exception:
                    pass
    elif isinstance(obj, list):
        for v in obj:
            yield from deep_find(v, want, depth + 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('journal')
    ap.add_argument('data')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    drafts, audits = [], []
    for rec in load_journal(a.journal):
        for d in deep_find(rec, ('cover', 'sections', 'shift')):
            if isinstance(d.get('sections'), list) and d['sections']:
                drafts.append(d)
        for d in deep_find(rec, ('ok', 'issues')):
            if isinstance(d.get('issues'), list):
                audits.append(d)

    if not drafts:
        sys.exit('no composed draft found in %s' % a.journal)
    draft = max(drafts, key=lambda d: len(json.dumps(d)))

    data = json.load(io.open(a.data, encoding='utf-8'))
    words = sum(len(str(b.get('text', '')).split())
                for s in draft['sections'] for b in s.get('blocks', []))

    print('draft found: %d sections, %d shift entries, ~%d words'
          % (len(draft['sections']), len(draft.get('shift') or []), words))
    print('cover: %s' % json.dumps(draft.get('cover'), ensure_ascii=False)[:160])

    econ = draft.get('econ')
    if econ:
        print('econ: op=%s base=%s fixed=%s @%s' % (econ.get('op'), econ.get('labourBase'),
                                                    econ.get('techFixed'), econ.get('baseVolume')))
        print('  basis: %s' % str(econ.get('basis'))[:220])
    else:
        print('econ: NOT RETURNED -- calculator will render em-dashes')

    if audits:
        au = max(audits, key=lambda d: len(json.dumps(d)))
        blockers = [i for i in au['issues'] if i.get('severity') == 'blocker']
        print('audit: ok=%s  %d blocker(s), %d warning(s)'
              % (au.get('ok'), len(blockers), len(au['issues']) - len(blockers)))
        for i in au['issues']:
            print('  [%s] %s -- %s' % (i.get('severity'), i.get('where'), i.get('problem'))[:300])

    if a.dry_run:
        print('\n(dry run -- nothing written)')
        return

    # prose only; every fact field stays as the workbook produced it
    data['cover'] = {**data.get('cover', {}), **(draft.get('cover') or {})}
    data['shift'] = draft.get('shift') or []
    data['sections'] = draft['sections']
    if econ:
        keep = data.get('econ', {})
        data['econ'] = {**keep, **econ}

    json.dump(data, io.open(a.data, 'w', encoding='utf-8', newline='\n'),
              ensure_ascii=False, indent=1)
    print('\nmerged into %s' % a.data)


main()
