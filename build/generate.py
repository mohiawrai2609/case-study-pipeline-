#!/usr/bin/env python
"""
Generation stage — turn each img block's `prompt` into an image via Flux.

    set FAL_KEY=...            (or REPLICATE_API_TOKEN=...)
    python build/generate.py data/001-fast-food.json --provider fal
    python build/generate.py data/001-fast-food.json --dry-run     # no key needed

Writes media/<issue>/<slot>.png, ready for build/media.py. Never overwrites an
existing file unless --force, so a re-run only fills what is missing and you can
hand-replace any single image without the pipeline clobbering it.

Prompts are Flux-native. Midjourney's --ar/--style/--v flags do not apply here:
aspect ratio is a request parameter, so any such flags in a prompt are stripped
and the ratio is taken from the block's role (cover / full-width / inline).
"""
import argparse, json, os, re, sys, time, urllib.request, urllib.error

# Brand lock: Replaceable.ai is crimson #C41E3A on obsidian #0D0D0F. The article
# these images sit inside is that dark, so any image carrying a warm-gold or
# cool-blue cast reads as imported stock the moment it lands next to the chrome.
# Crimson is the ONLY accent permitted. Amber and emerald are reserved for RPI
# score bands and must never appear as a photographic accent, and gold #F5B800
# belongs to Attacked.ai -- it never appears in a Replaceable.ai output at all.
BRAND = ("Single accent colour only: deep crimson red, hex #C41E3A -- present as a practical "
         "light source, a reflection, or one crimson object in frame, holding roughly a tenth "
         "of the frame. An accent, never a colour wash. Everything else stays neutral "
         "desaturated grey and near-black. No amber, orange, gold, yellow, green, teal, blue, "
         "purple or pink cast anywhere in the image.")
HOUSE_STYLE = ("Editorial documentary photograph, photorealistic, medium-format sensor. "
         
         "Very dark near-black background, hex #0D0D0F obsidian, low-key single-source "
         "dramatic lighting, deep shadows. Cinematic shallow depth of field. High contrast, "
         "precision-editorial restraint. "
         + BRAND +
         " No text, no logos, no watermarks, no UI overlays, no direct eye contact.")
# block role -> aspect ratio
RATIO = {"cover": "4:5", "full": "16:9", "inline": "3:2"}
FAL_MODEL = "fal-ai/flux-pro/v1.1"
REPLICATE_MODEL = "black-forest-labs/flux-1.1-pro"
MJ_FLAGS = re.compile(r"\s--(?:ar|v|s|style|q|chaos|no|stylize)\s+\S+", re.I)


def role_of(block):
    if block.get("slot") == "cover_photo":
        return "cover"
    return "full" if block.get("full") else "inline"


def compose_prompt(block):
    base = MJ_FLAGS.sub("", block.get("prompt", "")).strip().rstrip(",.")
    if not base:
        return None
    return f"{base}. {HOUSE_STYLE}"


def post(url, body, headers, timeout=180):
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def gen_fal(prompt, ratio, key):
    size = {"4:5": "portrait_4_3", "16:9": "landscape_16_9", "3:2": "landscape_4_3"}[ratio]
    out = post(f"https://fal.run/{FAL_MODEL}",
               {"prompt": prompt, "image_size": size, "num_images": 1,
                "output_format": "png", "enable_safety_checker": True},
               {"Authorization": f"Key {key}"})
    return out["images"][0]["url"]


def gen_replicate(prompt, ratio, key):
    out = post(f"https://api.replicate.com/v1/models/{REPLICATE_MODEL}/predictions",
               {"input": {"prompt": prompt, "aspect_ratio": ratio, "output_format": "png"}},
               {"Authorization": f"Bearer {key}", "Prefer": "wait"})
    if out.get("status") == "failed":
        raise RuntimeError(out.get("error"))
    o = out.get("output")
    return o[0] if isinstance(o, list) else o


def download(url, path):
    with urllib.request.urlopen(url, timeout=180) as r, open(path, "wb") as f:
        f.write(r.read())
    return os.path.getsize(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data")
    ap.add_argument("--provider", choices=["fal", "replicate"], default="fal")
    ap.add_argument("--out", default="", help="default media/<issue>")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--retries", type=int, default=2)
    a = ap.parse_args()

    data = json.load(open(a.data, encoding="utf-8"))
    issue = str(data.get("issue", 0)).zfill(3)
    outdir = a.out or os.path.join("media", issue)
    os.makedirs(outdir, exist_ok=True)

    blocks = [b for s in data["sections"] for b in s.get("blocks", [])
              if b.get("t") == "img" and b.get("slot")]
    hero = data.get("hero") if isinstance(data.get("hero"), dict) else None
    if not blocks and not (hero and (hero.get("posterPrompt") or hero.get("prompt"))):
        sys.exit("no img blocks with a `slot`, and no hero prompt, in this data file")

    env = "FAL_KEY" if a.provider == "fal" else "REPLICATE_API_TOKEN"
    key = os.environ.get(env, "")
    if not key and not a.dry_run:
        sys.exit(f"{env} is not set. Export it, or run with --dry-run to preview prompts.")

    gen = gen_fal if a.provider == "fal" else gen_replicate
    made = skipped = failed = 0

    # The hero prompt was written for video, so it ends with loop *instructions*
    # that mean nothing to a still generator. Only those are removed — earlier
    # attempts to strip camera language too left ungrammatical fragments, which
    # produce worse images than simply leaving the scene description intact.
    LOOP_INSTR = re.compile(
        r"\s*Seamless loop[^.]*\.|\s*The last frame must match the first\.?"
        r"|\s*No cuts\.?", re.I)

    if hero is not None:
        raw = (hero.get("posterPrompt") or hero.get("prompt") or "").strip()
        path = os.path.join(outdir, "hero_poster.png")
        if not raw:
            pass
        elif os.path.exists(path) and not a.force:
            print(f"  keep   {'hero_poster':<24} already present")
            skipped += 1
        else:
            still = LOOP_INSTR.sub("", MJ_FLAGS.sub("", raw)).strip().rstrip(",.")
            still = re.sub(r"\s{2,}", " ", still)
            prompt = f"{still}. {HOUSE_STYLE}"
            if a.dry_run:
                print(f"  dry    {'hero_poster':<24} [16:9] {prompt[:96]}...")
                made += 1
            else:
                try:
                    open(path, "wb").write(gen(prompt, "16:9", key))
                    print(f"  made   {'hero_poster':<24} [16:9]")
                    made += 1
                except Exception as e:
                    print(f"  FAIL   {'hero_poster':<24} {e}")
                    failed += 1

    for b in blocks:
        slot, ratio = b["slot"], RATIO[role_of(b)]
        path = os.path.join(outdir, f"{slot}.png")
        if os.path.exists(path) and not a.force:
            print(f"  keep   {slot:<24} already present")
            skipped += 1
            continue
        prompt = compose_prompt(b)
        if not prompt:
            print(f"  SKIP   {slot:<24} no `prompt` on this block")
            skipped += 1
            continue
        if a.dry_run:
            print(f"  dry    {slot:<24} [{ratio}] {prompt[:96]}...")
            made += 1
            continue
        for attempt in range(a.retries + 1):
            try:
                url = gen(prompt, ratio, key)
                size = download(url, path)
                print(f"  ok     {slot:<24} [{ratio}] {size/1024:.0f} KB")
                made += 1
                break
            except Exception as e:
                if attempt == a.retries:
                    print(f"  FAIL   {slot:<24} {type(e).__name__}: {e}")
                    failed += 1
                else:
                    time.sleep(2 * (attempt + 1))

    print(f"\n{made} generated, {skipped} skipped, {failed} failed -> {outdir}")
    if failed:
        print("Re-run to retry only the failures; existing files are kept.")
    if not a.dry_run and made:
        print(f"Next:  python build/media.py {a.data} {outdir} --mode url --base <storage-url>")


if __name__ == "__main__":
    main()
