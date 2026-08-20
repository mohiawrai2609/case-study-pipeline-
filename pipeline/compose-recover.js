export const meta = {
  name: 'anatomy-compose-recover',
  description: 'Re-run only the compose stage for roles whose compose died, reusing already-verified evidence',
  whenToUse: 'A batch produced verified evidence but compose failed on a transient API error. args: {jobs:[{soc,issue,prompt}]}',
  phases: [{ title: 'Compose', detail: 'retry compose from the recovered prompt' }],
}

const JOBS = (args?.jobs || []).filter(j => j?.prompt)
if (!JOBS.length) throw new Error('pass {jobs:[{soc,issue,prompt}]}')
log(`recovering compose for ${JOBS.length} role(s) — research and verification are reused, not re-run`)

const SECTIONS = {
  type: 'object', additionalProperties: false, required: ['cover', 'sections', 'shift'],
  properties: {
    cover: { type: 'object', additionalProperties: false, required: ['title', 'subtitle'],
      properties: { title: { type: 'string' }, subtitle: { type: 'string' } } },
    shift: { type: 'array', minItems: 8, maxItems: 12, items: {
      type: 'object', additionalProperties: false, required: ['time', 'task', 'type', 'desc'],
      properties: { time: { type: 'string' }, task: { type: 'string' },
        type: { type: 'string', enum: ['automated', 'augmented', 'human'] }, desc: { type: 'string' } } } },
    sections: { type: 'array', minItems: 9, maxItems: 13, items: {
      type: 'object', additionalProperties: false, required: ['blocks'],
      properties: { id: { type: 'string' }, label: { type: 'string' }, title: { type: 'string' },
        blocks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['t'],
          properties: { t: { type: 'string', enum: ['p', 'h3', 'pq', 'ins', 'img', 'component'] },
            text: { type: 'string' }, cite: { type: 'string' }, label: { type: 'string' },
            drop: { type: 'boolean' }, name: { type: 'string' }, slot: { type: 'string' },
            caption: { type: 'string' }, prompt: { type: 'string' }, full: { type: 'boolean' } } } } } } },
  },
}

// Both roles died on transient API errors (529 / stream interrupted), so retry is the whole point.
const out = await parallel(JOBS.map(j => async () => {
  let draft = null
  for (let attempt = 1; attempt <= 4 && !draft; attempt++) {
    draft = await agent(
      attempt === 1 ? j.prompt
        : `${j.prompt}\n\n(Retry ${attempt} — an earlier attempt was cut off by a server error before ` +
          `returning. Produce the complete structured object in a single call.)`,
      { label: `compose:${j.soc}${attempt > 1 ? `#${attempt}` : ''}`, phase: 'Compose',
        schema: SECTIONS, model: 'opus', effort: 'high' })
    if (!draft && attempt < 4) log(`${j.soc}: attempt ${attempt} returned nothing — retrying`)
  }
  if (!draft) { log(`${j.soc}: FAILED after 4 attempts`); return { soc: j.soc, failed: true } }
  const words = draft.sections.flatMap(s => s.blocks || [])
    .reduce((n, b) => n + String(b.text || '').split(/\s+/).filter(Boolean).length, 0)
  const quotes = draft.sections.flatMap(s => s.blocks || []).filter(b => b.t === 'pq').length
  log(`${j.soc}: composed — ${draft.sections.length} sections, ~${words} words, ${quotes} quotes`)
  return { soc: j.soc, issue: j.issue, draft, words, quotes }
}))

const ok = out.filter(r => r && !r.failed)
return { recovered: ok.length, of: JOBS.length, roles: ok }
