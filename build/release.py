#!/usr/bin/env python
"""
Release stage — produce both deliverables from one data file, non-destructively.

    python build/release.py data/001-fast-food.json

  output/<slug>.web.html         URL-referenced media, small + cacheable  -> the site
  output/<slug>.standalone.html  base64 media, one portable file          -> download/email
  media/<issue>/_web/            optimised WebP files to upload to storage

The source data file is never modified: each variant is built from a scratch copy,
so the pristine prose-and-slots version stays the single source of truth.
"""
import json, os, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORAGE = os.environ.get(
    "ANATOMY_STORAGE_BASE",
    "https://qpibugnhpuoxlsmyuksz.supabase.co/storage/v1/object/public/anatomy")


def run(cmd):
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if r.returncode:
        print(r.stdout, r.stderr, sep="\n")
        sys.exit(f"failed: {' '.join(cmd)}")
    return r.stdout


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: python build/release.py <data.json>")
    data_path = os.path.abspath(sys.argv[1])
    data = json.load(open(data_path, encoding="utf-8"))
    issue = str(data.get("issue", 0)).zfill(3)
    slug = data["role"]["title"].lower().replace("&", "and")
    slug = "".join(c if c.isalnum() else "-" for c in slug).strip("-")
    while "--" in slug:
        slug = slug.replace("--", "-")

    media_dir = os.path.join(ROOT, "media", issue)
    outdir = os.path.join(ROOT, "output")
    os.makedirs(outdir, exist_ok=True)
    has_media = os.path.isdir(media_dir) and any(
        f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
        for f in os.listdir(media_dir))

    results = []
    for mode, suffix in (("url", "web"), ("inline", "standalone")):
        tmp = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False,
                                          encoding="utf-8", dir=os.path.join(ROOT, "data"))
        json.dump(data, tmp, indent=1, ensure_ascii=False)
        tmp.close()
        try:
            if has_media:
                cmd = [sys.executable, "build/media.py", tmp.name, media_dir, "--mode", mode]
                if mode == "url":
                    cmd += ["--base", f"{STORAGE}/{issue}", "--out", os.path.join(media_dir, "_web")]
                run(cmd)
            out = os.path.join(outdir, f"Anatomy_{issue}_{slug}.{suffix}.html")
            run(["node", "build/build.mjs", tmp.name, out])
            results.append((suffix, out, os.path.getsize(out)))
        finally:
            for p in (tmp.name, tmp.name + ".bak"):
                if os.path.exists(p):
                    os.remove(p)

    print(f"\nNo. {issue} — {data['role']['title']}")
    print("-" * 62)
    for suffix, path, size in results:
        print(f"  {suffix:<12}{size/1024:>8.0f} KB   {os.path.basename(path)}")
    if len(results) == 2:
        web, standalone = results[0][2], results[1][2]
        if web:
            print(f"\n  web build is {standalone/web:.0f}x smaller and caches its media")
    if has_media:
        print(f"\n  upload {os.path.join('media', issue, '_web')} -> {STORAGE}/{issue}/")
    else:
        print("\n  no media found — slots left open, both builds still valid")
    print(f"  source data untouched: {os.path.relpath(data_path, ROOT)}")


if __name__ == "__main__":
    main()
