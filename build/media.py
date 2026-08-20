#!/usr/bin/env python
"""
Media stage — optimise source images and bind them to the article's slots.

    python build/media.py data/001-fast-food.json media/001/ --mode inline
    python build/media.py data/001-fast-food.json media/001/ --mode url \
        --base https://<project>.supabase.co/storage/v1/object/public/anatomy/001

Matching is by filename: an image named `cover_photo.png` fills the block whose
slot is `cover_photo`. Anything unmatched is reported, never guessed.

--mode inline  base64 into the data file -> one portable self-contained .html
--mode url     rewrite src to a hosted URL -> small, cacheable .html

Writes the data file in place (a .bak is kept). The builder is untouched: it
already renders an `img` block with `src` as an <img>, and without one as an
open <!-- MEDIA_SLOT --> marker.
"""
import argparse, base64, io, json, os, shutil, sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")

# full-bleed images get more pixels than inline ones
MAX_W = {True: 1600, False: 1200}
QUALITY = 82
VIDEO_EXT = {".mp4", ".webm", ".mov", ".m4v"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".avif", ".tif", ".tiff"}


def optimise(path, full_width):
    """Resize + re-encode to WebP. Returns (bytes, mime, w, h, original_size)."""
    original = os.path.getsize(path)
    im = Image.open(path)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGB")
    max_w = MAX_W[bool(full_width)]
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=QUALITY, method=6)
    return buf.getvalue(), "image/webp", im.width, im.height, original


def iter_img_blocks(data):
    for s in data["sections"]:
        for b in s.get("blocks", []):
            if b.get("t") == "img":
                yield b


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data"); ap.add_argument("media_dir")
    ap.add_argument("--mode", choices=["inline", "url"], default="inline")
    ap.add_argument("--base", default="", help="URL prefix, required for --mode url")
    ap.add_argument("--out", default="", help="write optimised files here (url mode)")
    a = ap.parse_args()
    if a.mode == "url" and not a.base:
        sys.exit("--mode url needs --base <public URL prefix>")

    data = json.load(open(a.data, encoding="utf-8"))
    blocks = {b["slot"]: b for b in iter_img_blocks(data) if b.get("slot")}
    if not blocks:
        sys.exit("no img blocks with a `slot` in this data file")

    # index the media folder by basename (without extension)
    files = {}
    for fn in sorted(os.listdir(a.media_dir)):
        stem, ext = os.path.splitext(fn)
        if ext.lower() in IMAGE_EXT | VIDEO_EXT:
            files.setdefault(stem, os.path.join(a.media_dir, fn))

    outdir = a.out or os.path.join(a.media_dir, "_optimised")
    if a.mode == "url":
        os.makedirs(outdir, exist_ok=True)

    filled = skipped = 0
    before = after = 0
    print(f"{'slot':<26}{'source':<22}{'before':>10}{'after':>10}{'saved':>8}")
    print("-" * 76)

    for slot, blk in blocks.items():
        src = files.get(slot)
        if not src:
            print(f"{slot:<26}{'— missing —':<22}{'':>10}{'':>10}{'':>8}")
            skipped += 1
            continue
        ext = os.path.splitext(src)[1].lower()

        if ext in VIDEO_EXT:
            # No ffmpeg here, so video is never inlined — a 2.75 MB hero video
            # inside the HTML defeats caching and dominates the payload.
            size = os.path.getsize(src)
            if a.mode == "url":
                shutil.copy2(src, os.path.join(outdir, os.path.basename(src)))
                blk["src"] = f"{a.base.rstrip('/')}/{os.path.basename(src)}"
                print(f"{slot:<26}{os.path.basename(src):<22}{size/1e6:>9.2f}M"
                      f"{size/1e6:>9.2f}M{'host':>8}")
                before += size; after += size; filled += 1
            else:
                print(f"{slot:<26}{os.path.basename(src):<22}{size/1e6:>9.2f}M"
                      f"{'':>10}{'SKIP':>8}   video needs --mode url")
                skipped += 1
            continue

        payload, mime, w, h, orig = optimise(src, blk.get("full"))
        before += orig; after += len(payload)
        if a.mode == "inline":
            blk["src"] = f"data:{mime};base64," + base64.b64encode(payload).decode()
        else:
            name = f"{slot}.webp"
            open(os.path.join(outdir, name), "wb").write(payload)
            blk["src"] = f"{a.base.rstrip('/')}/{name}"
        blk["w"], blk["h"] = w, h
        filled += 1
        pct = (1 - len(payload) / orig) * 100 if orig else 0
        print(f"{slot:<26}{os.path.basename(src):<22}{orig/1e6:>9.2f}M"
              f"{len(payload)/1e6:>9.2f}M{pct:>7.0f}%")

    # ── hero video ──────────────────────────────────────────────────────────
    # The hero lives at data['hero'], not in sections[].blocks[], so the slot
    # loop above never saw it: prompt_pack.py tells you to save hero.mp4, this
    # script skipped it, and every article shipped <source src="">.
    # Inlining needs no ffmpeg — base64 re-encodes bytes, it does not transcode —
    # so a standalone build can carry its hero the way the v20 reference does.
    hero = data.get("hero")
    if isinstance(hero, dict):
        hsrc = None
        for stem in (hero.get("slot") or "hero", "hero", "hero_loop"):
            f = files.get(stem)
            if f and os.path.splitext(f)[1].lower() in VIDEO_EXT:
                hsrc = f
                break
        if hsrc:
            hsize = os.path.getsize(hsrc)
            if a.mode == "url":
                shutil.copy2(hsrc, os.path.join(outdir, os.path.basename(hsrc)))
                hero["video"] = f"{a.base.rstrip('/')}/{os.path.basename(hsrc)}"
                note = "host"
            else:
                raw = open(hsrc, "rb").read()
                hero["video"] = "data:video/mp4;base64," + base64.b64encode(raw).decode()
                note = "inline"
            print(f"{'hero (video)':<26}{os.path.basename(hsrc):<22}"
                  f"{hsize/1e6:>9.2f}M{hsize/1e6:>9.2f}M{note:>8}")
            if a.mode == "inline" and hsize > 4e6:
                print(f"{'':>26}warning: {hsize/1e6:.1f}M inlines to "
                      f"~{hsize*1.37/1e6:.1f}M of base64 inside the HTML")
            filled += 1
        elif hero.get("prompt"):
            print(f"{'hero (video)':<26}{'— missing —':<22}{'':>10}{'':>10}{'':>8}")
            skipped += 1

    # A cover still: shown on its own when there is no hero video, and used as
    # the video's poster when there is (browsers that block autoplay, and the
    # moment before the first frame decodes, both fall back to it).
    if isinstance(hero, dict):
        psrc = files.get("hero_poster")
        if psrc and os.path.splitext(psrc)[1].lower() in IMAGE_EXT:
            payload, mime, w, h, orig = optimise(psrc, True)
            if a.mode == "inline":
                hero["poster"] = f"data:{mime};base64," + base64.b64encode(payload).decode()
            else:
                open(os.path.join(outdir, "hero_poster.webp"), "wb").write(payload)
                hero["poster"] = f"{a.base.rstrip('/')}/hero_poster.webp"
            before += orig; after += len(payload); filled += 1
            pct = (1 - len(payload) / orig) * 100 if orig else 0
            print(f"{'hero (poster)':<26}{os.path.basename(psrc):<22}{orig/1e6:>9.2f}M"
                  f"{len(payload)/1e6:>9.2f}M{pct:>7.0f}%")

    shutil.copy2(a.data, a.data + ".bak")
    json.dump(data, open(a.data, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    print("-" * 76)
    print(f"{filled} filled, {skipped} still open   "
          f"{before/1e6:.2f}M -> {after/1e6:.2f}M "
          f"({(1-after/before)*100:.0f}% smaller)" if before else "")
    if a.mode == "inline":
        infl = after * 4 / 3
        print(f"base64 inflation adds ~{(infl-after)/1e6:.2f}M -> "
              f"~{infl/1e6:.2f}M inside the HTML (no browser caching)")
    print(f"data file updated: {a.data}  (backup at {a.data}.bak)")
    if skipped:
        print("\nOpen slots keep their <!-- MEDIA_SLOT --> markers; the build still succeeds.")


if __name__ == "__main__":
    main()
