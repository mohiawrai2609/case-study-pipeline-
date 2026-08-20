export const meta = {
  name: 'anatomy-case-study',
  description: 'Research, adversarially verify, and compose one Automation Anatomy case study from DB facts',
  whenToUse: 'Producing a Replaceable.ai case study for one role. Pass the extract.sql facts object as args.',
  phases: [
    { title: 'Research', detail: 'six independent lenses, each web-grounded' },
    { title: 'Verify',   detail: 'adversarial refutation per claim — unverified claims are killed' },
    { title: 'Compose',  detail: 'single voice, writes the sections contract' },
    { title: 'Audit',    detail: 'completeness + grounding check on the composed draft' },
  ],
}

// ── facts come from build/extract.sql, never from the model ──
const F = args
if (!F || !F.role) throw new Error('pass the extract.sql facts object as args')

const R = F.role, S = F.scores, C = F.counts
const HEAD = `ROLE: ${R.title} (SOC ${R.soc})
SCORES (authoritative, from the scoring database — never contradict these):
  RPI ${S.rpi}%  ·  APS ${S.aps}%  ·  HRF ${S.hrf}%  ·  Untouched ${S.untouched}%  ·  AJCI ${S.ajci}%
  Cognitive APS ${S.cognitive}% · Physical APS ${S.physical}% · Band ${R.band} · Timeline ${R.timeline}
  US employment ${R.emp_k}k · median wage $${R.wage} · BLS growth ${R.growth}%
  Formula: RPI = APS x (1 - HRF) x 100
TASKS (${C.tasks} total: ${C.traditional} traditional, ${C.augmented} augmented, ${C.created} AI-created):
${(F.tasks || []).map((t, i) => `  ${i + 1}. [${t.type}/${t.vec}] ${t.text}`).join('\n')}
VENDORS WITH EVIDENCE (${(F.vendors || []).length}):
${(F.vendors || []).map(v => `  - ${v.name}: ${v.task_n} tasks, avg APS ${v.avg_aps}%, ${v.evidence}, ${v.stage}`).join('\n')}`

const GROUNDING = `
HARD RULES:
- Every factual claim needs a real, checkable source: publication name, date, and URL.
- NEVER invent a quote, a person, a job title, a company, or a statistic.
- If you cannot find a real source, return fewer claims. Sparse and true beats full and false.
- Do not restate or contradict the scores above; they are fixed inputs.
- Prefer sources from the last 24 months. Mark anything older with its date.`

const CLAIMS = {
  type: 'object', additionalProperties: false,
  required: ['claims'],
  properties: {
    claims: {
      type: 'array', maxItems: 8,
      items: {
        type: 'object', additionalProperties: false,
        required: ['kind', 'text', 'source_name', 'source_url', 'source_date'],
        properties: {
          kind: { type: 'string', enum: ['quote', 'statistic', 'event', 'deployment', 'argument'] },
          text: { type: 'string' },
          speaker: { type: 'string' },
          speaker_role: { type: 'string' },
          source_name: { type: 'string' },
          source_url: { type: 'string' },
          source_date: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
  },
}

const VERDICT = {
  type: 'object', additionalProperties: false,
  required: ['verified', 'reason'],
  properties: {
    verified: { type: 'boolean' },
    reason: { type: 'string' },
    corrected_text: { type: 'string' },
    corrected_source_url: { type: 'string' },
  },
}

const LENSES = [
  { key: 'industry',    ask: `How is automation actually landing in this occupation right now? Named deployments, adoption rates, what changed in the last 18 months.` },
  { key: 'regional',    ask: `How does this differ outside the US? Cover at least two of Europe, Asia, Latin America. Regulation, labour cost, adoption gaps.` },
  { key: 'quotes',      ask: `Find REAL published statements from named people: workers in this role, executives deploying the tech, union or labour representatives, academics. Each needs speaker name, exact role, publication, date, URL. This is the highest-risk lens — return nothing rather than anything uncertain.` },
  { key: 'deployments', ask: `For the vendors listed above, find documented production deployments: which employer, what scale, what measured result. Also note any vendor whose claims are marketing-only with no independent evidence.` },
  { key: 'counter',     ask: `Find the strongest evidence AGAINST the automation narrative: failed rollouts, reversals, re-hiring, productivity claims that did not survive scrutiny, academic work disputing displacement estimates.` },
  { key: 'cautionary',  ask: `Find specific documented failures or harms from automating this kind of work: safety incidents, discrimination findings, regulatory action, customer or worker backlash with named organisations.` },
]

// ── Phase 1+2: each lens verifies as soon as it lands (no barrier) ──
phase('Research')
const perLens = await pipeline(
  LENSES,
  l => agent(
    `${HEAD}\n\nRESEARCH LENS: ${l.key}\n${l.ask}\n${GROUNDING}\n\nUse web search. Return only claims you could source.`,
    { label: `research:${l.key}`, phase: 'Research', schema: CLAIMS }),

  (res, l) => {
    const claims = (res?.claims || []).slice(0, 5)
    if (!claims.length) { log(`${l.key}: no sourceable claims`); return [] }
    return parallel(claims.map(c => () =>
      agent(
        `Try to REFUTE this claim. You are a fact-checker whose job is to find the reason it is wrong.\n\n` +
        `CLAIM (${c.kind}): ${c.text}\n` +
        (c.speaker ? `ATTRIBUTED TO: ${c.speaker}, ${c.speaker_role || 'role unstated'}\n` : '') +
        `CITED SOURCE: ${c.source_name}, ${c.source_date}\nURL: ${c.source_url}\n\n` +
        `Check: does the URL resolve and actually contain this? Is the person real and in that role at that time? ` +
        `Is the statistic stated as claimed, or distorted? Is the date right?\n` +
        `Set verified=false if you cannot independently confirm it. Default to false when uncertain — ` +
        `an unverified claim is dropped, which is the safe outcome. If it is nearly right, supply corrected_text.`,
        { label: `verify:${l.key}`, phase: 'Verify', schema: VERDICT })
        .then(v => ({ ...c, lens: l.key, verdict: v }))
        .catch(() => null)
    ))
  }
)

const all = perLens.flat().filter(Boolean)
const verified = all.filter(c => c.verdict?.verified)
    .map(c => ({ ...c, text: c.verdict.corrected_text || c.text }))
const killed = all.filter(c => !c.verdict?.verified)
log(`verified ${verified.length}/${all.length} claims — ${killed.length} killed`)

// ── Phase 3: compose, single voice ──
phase('Compose')
const SECTIONS = {
  type: 'object', additionalProperties: false,
  required: ['cover', 'sections', 'shift'],
  properties: {
    cover: {
      type: 'object', additionalProperties: false,
      required: ['title', 'subtitle'],
      properties: { title: { type: 'string' }, subtitle: { type: 'string' } },
    },
    shift: {
      type: 'array', minItems: 8, maxItems: 12,
      items: {
        type: 'object', additionalProperties: false,
        required: ['time', 'task', 'type', 'desc'],
        properties: {
          time: { type: 'string' }, task: { type: 'string' },
          type: { type: 'string', enum: ['automated', 'augmented', 'human'] },
          desc: { type: 'string' },
        },
      },
    },
    sections: {
      type: 'array', minItems: 9, maxItems: 13,
      items: {
        type: 'object', additionalProperties: false,
        required: ['blocks'],
        properties: {
          id: { type: 'string' }, label: { type: 'string' }, title: { type: 'string' },
          blocks: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false,
              required: ['t'],
              properties: {
                t: { type: 'string', enum: ['p', 'h3', 'pq', 'ins', 'img', 'component'] },
                text: { type: 'string' }, cite: { type: 'string' }, label: { type: 'string' },
                drop: { type: 'boolean' }, name: { type: 'string' },
                slot: { type: 'string' }, caption: { type: 'string' },
                prompt: { type: 'string' }, full: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  },
}

const EVIDENCE = verified.length
  ? verified.map(c => `- [${c.lens}/${c.kind}] ${c.text}\n  SOURCE: ${c.source_name}, ${c.source_date} — ${c.source_url}`
      + (c.speaker ? `\n  SPEAKER: ${c.speaker}, ${c.speaker_role}` : '')).join('\n')
  : '(nothing survived verification — write the piece from the scoring data alone and use NO quotes)'

const draft = await agent(
  `${HEAD}

You are writing Automation Anatomy No. ${F.issue || '00X'} for Replaceable.ai — long-form data journalism
in the register of The Economist or FT Big Read. British spelling. No hype, no doom.
The through-line is AUGMENTATION, not apocalypse: what the machine took, what it left, what it created.

VERIFIED EVIDENCE — the ONLY external facts you may assert:
${EVIDENCE}

STRUCTURE — return these sections in order, using these exact ids and component names:
  (no id)       lede, one block: {"t":"p","drop":true} — 120-160 words, scene-setting, no statistics
  s-score       label "The Score"           + {"t":"component","name":"gauge"}, prose, {"t":"component","name":"chartEx"}
  s-shift       label "The Shift"           + {"t":"component","name":"shift"}
  s-tasks       label "The Anatomy"         + {"t":"component","name":"taskGrid"}
  s-vendors     label "The Innovators"      + {"t":"component","name":"matrix"} and {"t":"component","name":"vendorCards"}
  s-wrong       label "The Cautionary Tales"
  s-global      label "Around the World"
  s-fortress    label "The Human Fortress"
  s-voices      label "Industry Voices"
  s-economics   label "The Economics"       + {"t":"component","name":"econ"}
  s-2030        label "Looking Ahead"
  s-feedback    label "Challenge This Score"+ {"t":"component","name":"feedback"}

RULES:
- 7,000-8,500 words of prose across all sections. Sections without a component need 500-900 words each.
- A {"t":"pq"} pull quote is ONLY allowed if it appears verbatim in VERIFIED EVIDENCE above, with its
  cite carrying speaker, role, publication and date. If nothing is verified, use zero pull quotes.
- Never write a task ID (T1, T7). Never put the SOC code in body prose.
- Place 4-6 {"t":"img"} blocks at real visual beats. Each needs slot (snake_case), caption, and a
  prompt: a specific photographic description of THIS role's tools and environment — never a generic
  office. Set full:true for full-bleed. No Midjourney flags; aspect ratio is handled downstream.
- Use {"t":"ins","label":...} for one empirical-anchor callout in s-score.
- The shift array is a real working day for this role, 8-12 entries, referencing actual vendors above.
- Cover title: short, arresting, may contain one <em>...</em>. Subtitle: one sentence, no colon.`,
  { label: 'compose', phase: 'Compose', schema: SECTIONS })

// ── Phase 4: audit the draft against its own evidence ──
phase('Audit')
const AUDIT = {
  type: 'object', additionalProperties: false,
  required: ['ok', 'issues', 'word_count_estimate'],
  properties: {
    ok: { type: 'boolean' },
    word_count_estimate: { type: 'number' },
    issues: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['severity', 'where', 'problem'],
        properties: {
          severity: { type: 'string', enum: ['blocker', 'warning'] },
          where: { type: 'string' }, problem: { type: 'string' },
        },
      },
    },
  },
}
const audit = await agent(
  `Audit this composed case study. Report problems only — do not rewrite.\n\n` +
  // The auditor needs BOTH sources of truth. Without the DB facts it flags
  // database-sourced vendor names, funding stages and task text as unsourced.
  `SOURCE 1 — DATABASE FACTS (authoritative, needs no external citation):\n${HEAD}\n\n` +
  `SOURCE 2 — VERIFIED EXTERNAL EVIDENCE:\n${EVIDENCE}\n\n` +
  `DRAFT:\n${JSON.stringify(draft).slice(0, 90000)}\n\n` +
  `A claim is GROUNDED if it traces to either source. Vendor names, funding stages, task text, ` +
  `APS values and employment figures come from SOURCE 1 and are legitimate without a URL.\n` +
  `BLOCKERS: a pull quote whose wording or attribution is not in SOURCE 2; a statistic in neither ` +
  `source; a named person, employer or product in neither source; any score contradicting ` +
  `RPI ${S.rpi} / APS ${S.aps} / HRF ${S.hrf}; a task ID or SOC code in body prose; ` +
  `a rate or currency figure presented as measured fact but absent from both sources.\n` +
  `WARNINGS: sections under 400 words, missing components, fewer than 4 image blocks, American spelling.`,
  { label: 'audit', phase: 'Audit', schema: AUDIT })

return {
  soc: R.soc, title: R.title,
  claims: { found: all.length, verified: verified.length, killed: killed.length },
  killed_claims: killed.map(c => ({ lens: c.lens, text: c.text.slice(0, 100), why: c.verdict?.reason })),
  audit,
  data: {
    issue: F.issue || 0,
    role: R, scores: S,
    cover: { ...draft.cover, published: F.published || '' },
    matrix: F.matrix || { breadthThreshold: 0.16, depthThreshold: 0.70 },
    econ: F.econ || { labourBase: 34500, techFixed: 17600, baseVolume: 500 },
    tasks: F.tasks, vendors: F.vendors,
    shift: draft.shift, sections: draft.sections,
  },
  sources: verified.map(c => ({ name: c.source_name, url: c.source_url, date: c.source_date })),
}
