# Media prompts — No. 004: Heavy and Tractor-Trailer Truck Driver

RPI 18.2% · APS 38% capable · HRF 52% human-protected · 17 tasks · 5 vendors

## How to use this

1. Generate each item below in whatever tool you prefer.
2. Save it into `media/004/` using the **exact filename given**.
3. Run the two commands at the bottom. That's it — filenames do the binding.

Anything you skip stays an empty slot; the article still builds and reads fine.

**2 slot(s) already filled from free archives — no prompt needed:** `fifth_wheel_coupling`, `sunbelt_corridor_dusk`
  - `fifth_wheel_coupling` — Photo: Asurnipal, CC BY SA, via wikimedia
  - `sunbelt_corridor_dusk` — View road windscreen (public domain, via rawpixel)

**3 slot(s) below need generating.**

---

## Hero video

**Save as:** `media/004/hero.mp4`  ·  **16:9, 6–10s, silent, seamless loop**

For Veo / Kling / Runway / Sora:

```
Slow cinematic tracking shot through the working environment of a heavy and tractor-trailer truck driver. Late shift, low ambient light, one dominant practical light source. Equipment and screens present but no readable text. Camera drifts steadily, no cuts. Atmospheric, observational, unhurried. Shallow depth of field. Muted desaturated colour with a single warm accent. No people facing camera, no logos, no on-screen text. Seamless loop.
```

> Do NOT depict identifiable real people, real company premises, real branding, or anything that could be mistaken for documentary evidence of a specific deployment. Composed and atmospheric, never reportage.

---

## Images to generate (3)

### 1. `predawn_yard_inspection`

**Save as:** `media/004/predawn_yard_inspection.png`  ·  **16:9** (full-bleed)

*Caption in article:* The pre-trip inspection is now performed twice: once by a human with a torch, and once by the tablet recording that he did it.

**ChatGPT / Gemini / Copilot** — paste as-is:

```
A truck driver in a high-visibility vest kneeling beside the front axle of a red tractor unit in a freight yard before dawn, sodium lamps overhead, wet tarmac reflecting light, holding a rugged handheld tablet displaying a digital inspection checklist in one hand and a torch in the other, fifty-three-foot dry van trailer receding into darkness behind, breath visible in cold air, documentary photojournalism, natural light. Editorial documentary photograph, photorealistic, medium-format sensor. Very dark near-black background, low-key single-source lighting, deep shadows. Cinematic shallow depth of field, muted desaturated palette with one warm accent. No text, no logos, no watermarks, no UI overlays, no direct eye contact. Aspect ratio 16:9.
```

**Midjourney:**

```
A truck driver in a high-visibility vest kneeling beside the front axle of a red tractor unit in a freight yard before dawn, sodium lamps overhead, wet tarmac reflecting light, holding a rugged handheld tablet displaying a digital inspection checklist in one hand and a torch in the other, fifty-three-foot dry van trailer receding into darkness behind, breath visible in cold air, documentary photojournalism, natural light. Editorial documentary photograph, photorealistic, medium-format sensor. Very dark near-black background, low-key single-source lighting, deep shadows. Cinematic shallow depth of field, muted desaturated palette with one warm accent. No text, no logos, no watermarks, no UI overlays, no direct eye contact. --ar 16:9 --style raw --v 6.1 --s 750
```

*Free alternative:* search Openverse for `truck driver inspecting lorry` — `python build/source_media.py fix-53-3032.00.json` does this automatically.

### 2. `cab_telematics_interior`

**Save as:** `media/004/cab_telematics_interior.png`  ·  **3:2** (inline)

*Caption in article:* Nine of the role's seventeen tasks are now performed through a screen. None of them is the driving.

**ChatGPT / Gemini / Copilot** — paste as-is:

```
Interior of a modern tractor-trailer cab from the passenger side, showing a windscreen-mounted telematics display and a rugged handheld device in a dash cradle displaying a delivery manifest, a small forward-facing and driver-facing dual dash camera below the mirror, the driver's hands on a large steering wheel, motorway ahead in flat morning light, realistic documentary photography, shallow depth of field. Editorial documentary photograph, photorealistic, medium-format sensor. Very dark near-black background, low-key single-source lighting, deep shadows. Cinematic shallow depth of field, muted desaturated palette with one warm accent. No text, no logos, no watermarks, no UI overlays, no direct eye contact. Aspect ratio 3:2.
```

**Midjourney:**

```
Interior of a modern tractor-trailer cab from the passenger side, showing a windscreen-mounted telematics display and a rugged handheld device in a dash cradle displaying a delivery manifest, a small forward-facing and driver-facing dual dash camera below the mirror, the driver's hands on a large steering wheel, motorway ahead in flat morning light, realistic documentary photography, shallow depth of field. Editorial documentary photograph, photorealistic, medium-format sensor. Very dark near-black background, low-key single-source lighting, deep shadows. Cinematic shallow depth of field, muted desaturated palette with one warm accent. No text, no logos, no watermarks, no UI overlays, no direct eye contact. --ar 3:2 --style raw --v 6.1 --s 750
```

*Free alternative:* search Openverse for `truck driver cab` — `python build/source_media.py fix-53-3032.00.json` does this automatically.

### 3. `roadside_tyre_change`

**Save as:** `media/004/roadside_tyre_change.png`  ·  **3:2** (inline)

*Caption in article:* The stationary tasks are the expensive ones, and they are the ones the technology has not reached.

**ChatGPT / Gemini / Copilot** — paste as-is:

```
A truck driver crouched on a motorway hard shoulder at dusk changing a trailer tyre, torque wrench in hand, spare tyre leaning against the trailer, orange warning triangles set out behind, headlights of passing traffic streaking in the background, wet asphalt, high-visibility jacket, realistic photojournalistic documentary style, available light. Editorial documentary photograph, photorealistic, medium-format sensor. Very dark near-black background, low-key single-source lighting, deep shadows. Cinematic shallow depth of field, muted desaturated palette with one warm accent. No text, no logos, no watermarks, no UI overlays, no direct eye contact. Aspect ratio 3:2.
```

**Midjourney:**

```
A truck driver crouched on a motorway hard shoulder at dusk changing a trailer tyre, torque wrench in hand, spare tyre leaning against the trailer, orange warning triangles set out behind, headlights of passing traffic streaking in the background, wet asphalt, high-visibility jacket, realistic photojournalistic documentary style, available light. Editorial documentary photograph, photorealistic, medium-format sensor. Very dark near-black background, low-key single-source lighting, deep shadows. Cinematic shallow depth of field, muted desaturated palette with one warm accent. No text, no logos, no watermarks, no UI overlays, no direct eye contact. --ar 3:2 --style raw --v 6.1 --s 750
```

*Free alternative:* search Openverse for `truck tyre repair` — `python build/source_media.py fix-53-3032.00.json` does this automatically.

---

## When your files are in place

```bash
python build/media.py data/fix-53-3032.00.json media/004 --mode inline
node build/build.mjs data/fix-53-3032.00.json
```

For the web build instead, use `--mode url --base <storage-url>`, or run `python build/release.py data/fix-53-3032.00.json` to produce both.

> Do NOT depict identifiable real people, real company premises, real branding, or anything that could be mistaken for documentary evidence of a specific deployment. Composed and atmospheric, never reportage.
