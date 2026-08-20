# Media Brief — Automation Anatomy No. 008, Vibe Coders

Six slots: one hero video, five stills. **Two stills are already filled** from Openverse (CC0).
**Four are open** — the hero video and three stills. Prompts below are verbatim from the data
file, so what you generate matches what the captions already claim.

---

## Hard rules for every asset

These are not style preferences. This series kills roughly two-thirds of its claims in
verification, and pseudo-documentary imagery would undercut that:

- **No identifiable people.** No faces, no hands in frame, no reflections of people.
- **No real company names, logos, or legible product UI.** Code and dashboards must read as
  generic, not as a screenshot of a named vendor's tool.
- **Nothing that reads as evidence of a specific event.** These illustrate; they don't document.
- **No text overlays or captions burned in.**

---

## 1. HERO VIDEO — `hero_loop` (OPEN)

Sits behind the cover title. Autoplay, muted, looping.

**Specs**
- Deliver a **16:9 master**; the cover crops to roughly **4:5**, so keep the subject centred
  inside a safe area.
- **6–10 seconds**, seamless loop — the last frame must match the first.
- **No audio, no text, no hard cuts.** One continuous move.
- MP4 (H.264). Target **under 3 MB** if you can — the reference article's hero video alone was
  2.75 MB, which was 56% of that file's total weight.

**Prompt**
```
Slow push-in on a single monitor in a dark room, a coding agent's output scrolling
steadily upward — plan steps resolving, file paths appearing, test results ticking
green then red then green. The scroll never stops and no one touches the keyboard,
which sits lit but idle in the foreground. The room around the screen stays black.
No people, no faces, no hands, no readable logos or company names, no legible
product UI. Cool monitor light, heavy shadow, shallow depth of field, editorial
documentary tone. Seamless loop: the last frame must match the first.
```

**Why this shot:** the article's thesis is that the practitioner has moved off the keyboard.
An idle keyboard beside an agent that will not stop scrolling is the whole argument in one frame.

---

## 2. `agent_terminal_night` — FULL-BLEED (OPEN)

Section: **The Score**. Full-bleed, **16:9**, minimum **1600px** wide.

**Prompt**
```
A dark desk at night lit only by a large monitor showing a terminal window filled
with an AI coding agent's scrolling output — plan steps, file diffs, test results
in green and red — with a single natural-language prompt line at the bottom of the
screen. A second smaller monitor shows a browser preview of a half-finished web
application. No visible faces, no identifiable people, hands out of frame.
Documentary photography, shallow depth of field, cool monitor light against warm
room shadow.
```

---

## 3. `incident_dashboard` — INLINE (OPEN)

Section: **The Cautionary Tales**. Inline, **3:2**, minimum **1200px** wide.

**Prompt**
```
A wall-mounted observability dashboard in a dim engineering area, showing a
defect-rate line trending sharply upward over a ninety-day window, alongside error
traces and a deployment timeline dense with releases. Screen glow is the only light
source. No people, no faces, no readable company names or logos. Editorial
documentary style, high contrast, slightly desaturated.
```

---

## 4. `empty_desk_two_paths` — FULL-BLEED (OPEN)

Section: **Looking Ahead**. Full-bleed, **16:9**, minimum **1600px** wide.

**Prompt**
```
A single empty desk in a large open workspace at dusk, one monitor still awake
showing a paused agent session, chair pushed back, the rest of the floor dark and
unoccupied. A second desk in the background is bare with no equipment at all. No
people, no faces, no readable logos or company names. Wide editorial photograph,
long shadows, cool blue evening light with a single warm screen glow.
```

---

## 5. `review_diff_screen` — INLINE (FILLED, replaceable)

Section: **The Anatomy**. Currently: *Free code screen photo*, CC0 via rawpixel, 1024×683.

The stock photo shows plain syntax-highlighted JavaScript — **no diff, no warning markers** —
so the caption was rewritten to match it. If you generate the prompt below instead, tell me and
I will restore the original caption about security-relevant lines under review.

**Prompt**
```
Close crop of a code review interface on a monitor, showing a side-by-side diff
with added lines highlighted in green and removed lines in red, several lines
flagged with warning markers relating to dependency and secrets handling. A cursor
hovers over an unresolved comment thread. Anonymous — no faces, no reflections of
people, no identifiable branding. Sharp technical detail, muted editorial colour grade.
```

---

## 6. `spec_whiteboard` — INLINE (FILLED, good match)

Section: **The Human Fortress**. Currently: *Whiteboard Post-Itnotes*, Startup Stock Photos,
CC0 via StockSnap, 960×640.

This one is a genuine find — real sprint planning, week-by-week Design/Dev columns, sticky
notes, "Infrastructure Recs: Laravel + Backbone", "Admin API". It is literally the requirements
work the article says no vendor touches. **My recommendation is to keep it.** Prompt retained
below only if you want a generated version for visual consistency with the other four.

**Prompt**
```
A whiteboard covered in hand-drawn boxes, arrows and crossed-out constraints, with
a laptop closed on the table in front of it and two empty chairs at odd angles
suggesting a conversation just ended. Sticky notes cluster around a contradiction
marked with a question mark. No people in frame, no faces, no readable company
names. Natural window light, warm neutral tones, documentary editorial photography.
```

---

## How to send them back

**Name each file exactly after its slot** — that is how the media stage binds them:

```
media/008/agent_terminal_night.jpg
media/008/incident_dashboard.jpg
media/008/empty_desk_two_paths.jpg
media/008/hero_loop.mp4
```

Then one command rebinds and rebuilds everything:

```bash
cd C:/Users/mohin/Replaceable_Pipeline && python build/media.py data/008-vibe-coders.json media/008/ --mode inline && node build/build.mjs data/008-vibe-coders.json
```

Anything unmatched is reported, never guessed. Existing images are not overwritten unless you
pass `--force`, so you can send them one at a time.

**The video is the exception.** There is no ffmpeg on this machine, so video can never be
inlined as base64 — it has to be hosted and referenced by URL. Either give me a hosted URL and
I will set `hero.video` directly, or send the file and we run `--mode url` with a base path.

---

## Disk warning

Your C: drive is at **0 bytes free**. The last image fetch failed with ENOSPC and I finished by
processing in memory and writing only web-sized files. Clear space before sending a 3 MB video,
or the bind step will fail the same way.
