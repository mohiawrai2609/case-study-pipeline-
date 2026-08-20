# Automation Anatomy — case study pipeline

Builds *Automation Anatomy* case studies: one occupation per issue, researched and
verified by a multi-agent workflow, rendered into a single self-contained HTML article.

The design rule the whole repo turns on: **the model writes facts and prose, never
chrome.** CSS, JS and layout come from `shell/`, which was cut from a hand-built
article that was already reviewed and signed off. `build/build.mjs` injects data into
that shell deterministically. Regenerating the chrome per issue is what the earlier v5
engine did, and it is where its bugs came from.

## Layout

| Path | What lives there |
|---|---|
| `build/` | The stages. Python, plus one Node builder. |
| `pipeline/` | Workflow scripts — the research/verify/compose/audit agent graphs. |
| `shell/` | The tested chrome: CSS, JS, partials, and the originals they came from. |
| `data/` | One JSON data file per issue. The single source of truth for an article. |
| `media/` | Per-issue image working directory: prompts, candidates, credits. |
| `output/` | Built articles. Regenerable, so not tracked. |
| `runs/` | Workflow transcripts. Large and full of model output, so not tracked. |

## The five commands

Issue number `NNN`, role workbook `role.xlsx`. Each stage reads and writes the data
file, so you can stop after any of them and inspect it.

```bash
python build/extract_excel.py role.xlsx data/NNN-role.json --issue NNN
```
**0 — Extract.** Workbook facts into the data-file contract. Facts only; every prose
field is left empty for the compose stage. For a role that *is* in `rpi.*` Postgres,
`build/extract.sql` is the equivalent.

```bash
python build/apply_workflow.py runs/NNN data/NNN-role.json
```
**1 — Compose.** Run `pipeline/anatomy.custom.js` as a workflow first: seven grounded
research lenses, adversarial per-claim refutation, then a single-voice compose and a
grounding audit. This command merges the result in, reading the run journal directly.
It touches `cover`, `econ`, `shift` and `sections` and nothing else — workbook fact
must survive the compose stage untouched.

```bash
python build/source_media.py data/NNN-role.json --out media/NNN
```
**2 — Source media.** Openverse (CC0/PDM/BY/BY-SA only — `nc` and `nd` are excluded
because this is commercial and every image gets resized). Downloads candidates; it
does not choose. Pick with `build/accept_media.py`. Slots where nothing is good enough
fall through to `build/prompt_pack.py` + `build/generate.py`.

```bash
node build/build.mjs data/NNN-role.json output/NNN-role.html
```
**3 — Build.** Data into the shell. One self-contained file out.

```bash
python build/release.py data/NNN-role.json
```
**4 — Release.** Both deliverables from one data file, non-destructively:
`output/<slug>.web.html` (hosted media, small and cacheable) and
`output/<slug>.standalone.html` (base64 media, portable). Each is built from a scratch
copy, so the pristine prose-and-slots data file stays the source of truth.

## Invariants worth knowing before you change anything

- **The data file is the contract.** `build.mjs` and `shell/components.js` agree on one
  shape. `build/adapt.py` is the *only* place DB shapes are translated into it, so
  neither side has to know about the other.
- **Media binds by filename.** An image saved as `cover_photo.png` fills the slot named
  `cover_photo`. There is no manifest to edit. Anything unmatched is reported, never
  guessed.
- **Sourcing never chooses.** Filters are deterministic (licence, resolution, aspect,
  file type); selection is a judgement call made where the images can actually be seen.
- **Generation never overwrites.** A re-run fills only what is missing, so any single
  image can be hand-replaced without the pipeline clobbering it.
- **Generated images must not read as evidence.** `prompt_pack.py` carries a standing
  guard against identifiable people, real premises and real branding — an atmospheric
  image must never be mistakable for documentary proof of a specific deployment.

## Requirements

Python 3 with `openpyxl` and `Pillow`; Node 18+ for the builder. Image generation reads
`FAL_KEY` or `REPLICATE_API_TOKEN` from the environment — `generate.py --dry-run` needs
neither. Sourcing needs no key at all.
