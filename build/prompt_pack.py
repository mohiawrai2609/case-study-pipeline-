#!/usr/bin/env python
"""
Prompt pack — everything needed to generate this article's media by hand.

    python build/prompt_pack.py data/008-role.json

Writes media/<issue>/PROMPTS.md: one numbered prompt per slot, in tool-specific
variants, each stating the EXACT filename to save as. Save with that name and
media.py binds it automatically — no manifest to edit, no config to touch.

The pipeline is indifferent to how a file arrived. Openverse, an API, or your own
ChatGPT session all land in the same folder and bind the same way.
"""
import argparse, io, json, os, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

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
HOUSE = ("Editorial documentary photograph, photorealistic, medium-format sensor. "
         
         "Very dark near-black background, hex #0D0D0F obsidian, low-key single-source "
         "dramatic lighting, deep shadows. Cinematic shallow depth of field. High contrast, "
         "precision-editorial restraint. "
         + BRAND +
         " No text, no logos, no watermarks, no UI overlays, no direct eye contact.")

RATIO = {"cover": "4:5", "full": "16:9", "inline": "3:2"}
MJ_V  = "--style raw --v 6.1 --s 750"

# Never generate anything that could read as documentary proof of a real deployment.
GUARD = ("Do NOT depict identifiable real people, real company premises, real branding, "
         "or anything that could be mistaken for documentary evidence of a specific "
         "deployment. Composed and atmospheric, never reportage.")


def role_of(b):
    if b.get("slot") == "cover_photo": return "cover"
    return "full" if b.get("full") else "inline"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data"); ap.add_argument("--out", default="")
    a = ap.parse_args()

    d = json.load(open(a.data, encoding="utf-8"))
    issue = str(d.get("issue", 0)).zfill(3)
    role = d["role"]["title"]
    outdir = a.out or os.path.join("media", issue)
    os.makedirs(outdir, exist_ok=True)

    allslots = [b for s in d["sections"] for b in s.get("blocks", []) if b.get("t") == "img" and b.get("slot")]

    # Slots already filled from the free archives need no prompt — that is the whole
    # point: you only generate what Openverse could not supply at usable quality.
    acc = {}
    ap_path = os.path.join(outdir, "_accepted.json")
    if os.path.exists(ap_path):
        acc = json.load(open(ap_path, encoding="utf-8"))
    sourced = {k for k, v in acc.items() if v.get("status") == "accepted"}
    # a file already sitting at media/<issue>/<slot>.* also counts as done
    for b in allslots:
        for ext in (".jpg", ".jpeg", ".png", ".webp"):
            if os.path.exists(os.path.join(outdir, b["slot"] + ext)):
                sourced.add(b["slot"])
    slots = [b for b in allslots if b["slot"] not in sourced]
    L = []
    w = L.append

    w(f"# Media prompts — No. {issue}: {role}")
    w("")
    w(f"RPI {d['scores']['rpi']}% · APS {d['scores']['aps']}% capable · "
      f"HRF {d['scores']['hrf']}% human-protected · {len(d['tasks'])} tasks · {len(d['vendors'])} vendors")
    w("")
    w("## How to use this")
    w("")
    w(f"1. Generate each item below in whatever tool you prefer.")
    w(f"2. Save it into `media/{issue}/` using the **exact filename given**.")
    w( "3. Run the two commands at the bottom. That's it — filenames do the binding.")
    w("")
    w("Anything you skip stays an empty slot; the article still builds and reads fine.")
    w("")
    if sourced:
        w(f"**{len(sourced)} slot(s) already filled from free archives — no prompt needed:** "
          + ", ".join(f"`{x}`" for x in sorted(sourced)))
        for x in sorted(sourced):
            cr = (acc.get(x) or {}).get("credit")
            if cr: w(f"  - `{x}` — {cr}")
        w("")
    w(f"**{len(slots)} slot(s) below need generating.**"
      + ("" if slots else " Nothing to do — every slot is already filled."))
    w("")
    w("---")
    w("")

    # ── hero video ──
    w("## Hero video")
    w("")
    w(f"**Save as:** `media/{issue}/hero.mp4`  ·  **16:9, 6–10s, silent, seamless loop**")
    w("")
    w("For Veo / Kling / Runway / Sora:")
    w("")
    w("```")
    w(f"Slow cinematic tracking shot through the working environment of a {role.split(',')[0].lower()}. "
      f"Late shift, low ambient light, one dominant practical light source. Equipment and screens "
      f"present but no readable text. Camera drifts steadily, no cuts. Atmospheric, observational, "
      f"unhurried. Shallow depth of field. Muted desaturated colour with a single warm accent. "
      f"No people facing camera, no logos, no on-screen text. Seamless loop.")
    w("```")
    w("")
    w(f"> {GUARD}")
    w("")
    w("---")
    w("")

    # ── images ──
    w(f"## Images to generate ({len(slots)})")
    w("")
    for i, b in enumerate(slots, 1):
        r = role_of(b); ar = RATIO[r]
        base = (b.get("prompt") or b.get("caption") or b.get("slot", "").replace("_", " ")).strip().rstrip(".")
        w(f"### {i}. `{b['slot']}`")
        w("")
        w(f"**Save as:** `media/{issue}/{b['slot']}.png`  ·  **{ar}** "
          f"({'full-bleed' if r == 'full' else 'cover' if r == 'cover' else 'inline'})")
        if b.get("caption"):
            w("")
            w(f"*Caption in article:* {b['caption']}")
        w("")
        w("**ChatGPT / Gemini / Copilot** — paste as-is:")
        w("")
        w("```")
        w(f"{base}. {HOUSE} Aspect ratio {ar}.")
        w("```")
        w("")
        w("**Midjourney:**")
        w("")
        w("```")
        w(f"{base}. {HOUSE} --ar {ar} {MJ_V}")
        w("```")
        w("")
        if b.get("query"):
            w(f"*Free alternative:* search Openverse for `{b['query']}` — "
              f"`python build/source_media.py {os.path.basename(a.data)}` does this automatically.")
            w("")

    w("---")
    w("")
    w("## When your files are in place")
    w("")
    w("```bash")
    w(f"python build/media.py {a.data} media/{issue} --mode inline")
    w(f"node build/build.mjs {a.data}")
    w("```")
    w("")
    w("For the web build instead, use `--mode url --base <storage-url>`, or run "
      f"`python build/release.py {a.data}` to produce both.")
    w("")
    w(f"> {GUARD}")
    w("")

    path = os.path.join(outdir, "PROMPTS.md")
    open(path, "w", encoding="utf-8").write("\n".join(L))
    print(f"wrote {path}")
    print(f"  {len(slots)} image prompt(s) to generate · {len(sourced)} already sourced free")
    print(f"  save generated files into media/{issue}/ using the filenames in the pack")


if __name__ == "__main__":
    main()
