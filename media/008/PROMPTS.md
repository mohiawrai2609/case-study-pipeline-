# Media prompts — No. 008: Vibe Coders

RPI 22.05% · APS 49% capable · HRF 55% human-protected · 13 tasks · 43 vendors

## How to use this

1. Generate each item below in whatever tool you prefer.
2. Save it into `media/008/` using the **exact filename given**.
3. Run the two commands at the bottom. That's it — filenames do the binding.

Anything you skip stays an empty slot; the article still builds and reads fine.

**5 slot(s) already filled from free archives — no prompt needed:** `agent_terminal_night`, `empty_desk_two_paths`, `incident_dashboard`, `review_diff_screen`, `spec_whiteboard`

**0 slot(s) below need generating.** Nothing to do — every slot is already filled.

---

## Hero video

**Save as:** `media/008/hero.mp4`  ·  **16:9, 6–10s, silent, seamless loop**

For Veo / Kling / Runway / Sora:

```
Slow cinematic tracking shot through the working environment of a vibe coders. Late shift, low ambient light, one dominant practical light source. Equipment and screens present but no readable text. Camera drifts steadily, no cuts. Atmospheric, observational, unhurried. Shallow depth of field. Muted desaturated colour with a single warm accent. No people facing camera, no logos, no on-screen text. Seamless loop.
```

> Do NOT depict identifiable real people, real company premises, real branding, or anything that could be mistaken for documentary evidence of a specific deployment. Composed and atmospheric, never reportage.

---

## Images to generate (0)

---

## When your files are in place

```bash
python build/media.py data/008-vibe-coders.json media/008 --mode inline
node build/build.mjs data/008-vibe-coders.json
```

For the web build instead, use `--mode url --base <storage-url>`, or run `python build/release.py data/008-vibe-coders.json` to produce both.

> Do NOT depict identifiable real people, real company premises, real branding, or anything that could be mistaken for documentary evidence of a specific deployment. Composed and atmospheric, never reportage.
