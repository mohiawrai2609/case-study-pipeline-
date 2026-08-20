export const meta = {
  name: 'anatomy-headlines',
  description: 'Write editorial section headlines for already-composed case studies, without touching the prose',
  whenToUse: 'A compose run produced sections with kickers but no editorial headlines. args: {jobs:[{soc,role,rpi,sections}]}',
  phases: [{ title: 'Headlines', detail: 'one pass per article, reading the prose that already exists' }],
}

// args use compact keys (i/k/e) to keep the payload small — normalise here
const JOBS = (args?.jobs || []).filter(j => j?.sections?.length).map(j => ({
  ...j, sections: j.sections.map(s => ({
    id: s.id || ('s-' + s.i), label: s.label ?? s.k ?? '', excerpt: s.excerpt ?? s.e ?? '' })) }))
if (!JOBS.length) throw new Error('pass {jobs:[{soc,role,rpi,sections:[{id,label,excerpt}]}]}')
log(`writing headlines for ${JOBS.length} article(s) — prose is read, never rewritten`)

const HEADLINES = {
  type: 'object', additionalProperties: false, required: ['headlines'],
  properties: {
    headlines: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'title'],
        properties: { id: { type: 'string' }, title: { type: 'string' } },
      },
    },
  },
}

const out = await parallel(JOBS.map(j => async () => {
  const body = j.sections.map(s =>
    `--- ${s.id}  (kicker: "${s.label}")\n${s.excerpt}`).join('\n\n')

  const res = await agent(
`You are the section editor for Replaceable.ai's Automation Anatomy series — long-form data
journalism in the register of an FT Big Read. British spelling.

ARTICLE: ${j.role} · RPI ${j.rpi}%  (APS ${j.aps ?? '?'}% capable, HRF ${j.hrf ?? '?'}% human-protected,
${j.n ?? '?'} scored tasks, ${j.v ?? '?'} vendors with deployment evidence)

Below is each section's fixed kicker plus the opening of the prose that is ALREADY WRITTEN.
Write ONE original editorial headline per section. You are not rewriting the article — you are
titling sections that already exist, so each headline must be true to the prose beneath it.

RULES:
- 4-12 words. A specific claim, not a category.
- Draw on the actual content: a number, a tension, a concrete detail from that section's prose.
- NEVER reuse the kicker as the headline. "The Score" is a kicker, never a headline.
- No numbering, no colons introducing a subtitle, no "How to" or listicle phrasing.
- Vary the construction across the eleven — do not write eleven headlines to one template.
- Spell out numbers at the start of a headline ("Seventy-six per cent capable…").

GOOD (from a published issue in this series):
  s-score    → Seventy-six per cent capable, nineteen per cent protected
  s-shift    → One Tuesday, from the overnight run to the last unmatched line
  s-tasks    → Sixteen tasks, none of them traditional any more
BAD: "The Score" · "01" · "Overview" · "Understanding the Data"

Return one entry per section id below, in the same order.

${body}`,
    { label: `headlines:${j.soc}`, phase: 'Headlines', schema: HEADLINES,
      model: 'opus', effort: 'high' })

  if (!res?.headlines?.length) { log(`${j.soc}: no headlines returned`); return null }
  const bad = res.headlines.filter(h => /^\d+$/.test(h.title.trim())
    || j.sections.some(s => s.id === h.id && s.label.toLowerCase() === h.title.trim().toLowerCase()))
  if (bad.length) log(`${j.soc}: ${bad.length} headline(s) still match the kicker — review`)
  log(`${j.soc}: ${res.headlines.length} headlines`)
  return { soc: j.soc, headlines: res.headlines }
}))

const ok = out.filter(Boolean)
return { written: ok.length, of: JOBS.length, articles: ok }
