export const meta = {
  name: 'anatomy-batch',
  description: 'Bulk-produce Automation Anatomy case studies: extract from Postgres, research, adversarially verify, compose, audit — N roles pipelined',
  whenToUse: 'Producing several Replaceable.ai case studies at once. args: {socs:[...], mode, startIssue, published}',
  phases: [
    { title: 'Extract',  detail: 'query rpi.* for each role — no model invention' },
    { title: 'Research', detail: 'six web-grounded lenses per role' },
    { title: 'Verify',   detail: 'adversarial refutation per claim' },
    { title: 'Compose',  detail: 'single voice per role' },
    { title: 'Audit',    detail: 'grounding check against both sources' },
  ],
}

// ── config ───────────────────────────────────────────────────
const SOCS = (args?.socs || []).filter(Boolean)
if (!SOCS.length) throw new Error('pass {socs:["43-3031.00", ...]}')
const MODE = args?.mode === 'thorough' ? 'thorough' : 'standard'
const CLAIMS_PER_LENS = MODE === 'thorough' ? 5 : 3
const VERIFIER_VOTES = MODE === 'thorough' ? 2 : 1
const START_ISSUE = args?.startIssue ?? 1
const PUBLISHED = args?.published || ''
// Measured across all 2,607 vendor-role pairs: median depth 0.682, mean 0.67.
// The inherited 0.70 cut sat above the median, leaving ~63% of roles with an empty
// Leaders quadrant. A Leader is now "above-median depth AND >=16% task breadth",
// which is a defensible definition rather than an arbitrary constant.
const DEPTH_THRESHOLD = args?.depthThreshold ?? 0.68
const BREADTH_THRESHOLD = args?.breadthThreshold ?? 0.16
const DB = 'mcp__89003456-9b37-407e-83dd-9592eb2eed4d__execute_sql'

// ── MODEL TIERING ────────────────────────────────────────────
// Spend where being wrong is expensive, not where the token count is high.
//   extract  haiku  — tool call + transcription; a code assertion catches errors for free
//   research sonnet — search/summarise; verify is downstream, so errors here are cheap
//   verify   opus   — the subtle catches (CFO vs CEO, stripped footnotes) need real reasoning
//   compose  opus   — reader-facing artifact, ~15 structural constraints, only 1 agent
//   audit    sonnet — bounded "is X in list Y" checking; blockers get human review anyway
// Risk-proportional verification: a misattributed QUOTE is a legal problem, an ARGUMENT is
// framing. Quotes get two Opus votes; facts one; arguments go to Sonnet.
const M = {
  extract:  { model: 'haiku',  effort: 'low' },
  research: { model: 'sonnet', effort: 'medium' },
  verifyHi: { model: 'opus',   effort: 'high' },
  verifyLo: { model: 'sonnet', effort: 'medium' },
  compose:  { model: 'opus',   effort: 'high' },
  audit:    { model: 'sonnet', effort: 'medium' },
}
const HIGH_RISK = new Set(['quote', 'statistic', 'deployment', 'event'])
const votesFor = kind => (kind === 'quote' ? VERIFIER_VOTES + 1 : VERIFIER_VOTES)
const tierFor  = kind => (HIGH_RISK.has(kind) ? M.verifyHi : M.verifyLo)

log(`${SOCS.length} role(s) · mode=${MODE} · ${CLAIMS_PER_LENS} claims/lens · ${VERIFIER_VOTES} verifier vote(s)`)

// ── schemas ──────────────────────────────────────────────────
const FACTS = {
  type: 'object', additionalProperties: false,
  required: ['role', 'scores', 'counts', 'tasks', 'vendors'],
  properties: {
    role: {
      type: 'object', additionalProperties: false,
      required: ['title', 'soc', 'band'],
      properties: { title: { type: 'string' }, soc: { type: 'string' }, group: { type: 'string' },
        rank: { type: 'number' }, emp_k: { type: 'number' }, wage: { type: 'number' },
        growth: { type: 'number' }, timeline: { type: 'string' }, band: { type: 'string' } },
    },
    scores: {
      type: 'object', additionalProperties: false,
      required: ['rpi', 'aps', 'hrf', 'untouched', 'ajci'],
      properties: { rpi: { type: 'number' }, aps: { type: 'number' }, hrf: { type: 'number' },
        untouched: { type: 'number' }, ajci: { type: 'number' },
        cognitive: { type: 'number' }, physical: { type: 'number' } },
    },
    counts: {
      type: 'object', additionalProperties: false,
      required: ['tasks'],
      properties: { tasks: { type: 'number' }, traditional: { type: 'number' },
        augmented: { type: 'number' }, created: { type: 'number' } },
    },
    tasks: {
      type: 'array', minItems: 5,
      items: { type: 'object', additionalProperties: false, required: ['text', 'type'],
        properties: { text: { type: 'string' }, type: { type: 'string' }, vec: { type: 'string' },
          importance: { type: 'number' }, top_vendor: { type: 'string' } } },
    },
    vendors: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['name', 'tasks'],
        properties: { name: { type: 'string' }, initials: { type: 'string' },
          task_n: { type: 'number' }, avg_aps: { type: 'number' }, products: { type: 'number' },
          evidence: { type: 'string' }, stage: { type: 'string' }, trust: { type: 'number' },
          desc: { type: 'string' }, note: { type: 'string' },
          tasks: { type: 'array', items: { type: 'object', additionalProperties: false,
            required: ['name', 'aps'],
            properties: { name: { type: 'string' }, aps: { type: 'number' }, vec: { type: 'string' } } } } } },
    },
    narrative: { type: 'object', additionalProperties: true },
  },
}

const CLAIMS = {
  type: 'object', additionalProperties: false, required: ['claims'],
  properties: { claims: { type: 'array', maxItems: 8, items: {
    type: 'object', additionalProperties: false,
    required: ['kind', 'text', 'source_name', 'source_url', 'source_date'],
    properties: { kind: { type: 'string', enum: ['quote', 'statistic', 'event', 'deployment', 'argument'] },
      text: { type: 'string' }, speaker: { type: 'string' }, speaker_role: { type: 'string' },
      source_name: { type: 'string' }, source_url: { type: 'string' }, source_date: { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] } } } } },
}

const VERDICT = {
  type: 'object', additionalProperties: false, required: ['verified', 'reason'],
  properties: { verified: { type: 'boolean' }, reason: { type: 'string' },
    corrected_text: { type: 'string' }, corrected_source_url: { type: 'string' } },
}

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
      type: 'object', additionalProperties: false, required: ['blocks'],   // id-bearing sections must also carry label + title (enforced in prompt)
      properties: { id: { type: 'string' }, label: { type: 'string' }, title: { type: 'string' },
        blocks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['t'],
          properties: { t: { type: 'string', enum: ['p', 'h3', 'pq', 'ins', 'img', 'component'] },
            text: { type: 'string' }, cite: { type: 'string' }, label: { type: 'string' },
            drop: { type: 'boolean' }, name: { type: 'string' }, slot: { type: 'string' },
            caption: { type: 'string' }, prompt: { type: 'string' }, full: { type: 'boolean' } } } } } } },
  },
}

const AUDIT = {
  type: 'object', additionalProperties: false, required: ['ok', 'issues'],
  properties: { ok: { type: 'boolean' }, word_count_estimate: { type: 'number' },
    issues: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['severity', 'where', 'problem'],
      properties: { severity: { type: 'string', enum: ['blocker', 'warning'] },
        where: { type: 'string' }, problem: { type: 'string' } } } } },
}

const LENSES = [
  { key: 'industry',    ask: 'How is automation actually landing in this occupation right now? Named deployments, adoption rates, what changed in the last 18 months.' },
  { key: 'regional',    ask: 'How does this differ outside the US? At least two of Europe, Asia, Latin America. Regulation, labour cost, adoption gaps.' },
  { key: 'quotes',      ask: 'Find REAL published statements from named people: workers in this role, executives deploying the technology, union or labour representatives, academics. Each needs speaker name, exact role, publication, date and URL. Highest-risk lens — return nothing rather than anything uncertain.' },
  { key: 'deployments', ask: 'For the vendors listed, find documented production deployments: which employer, what scale, what measured result. Note any vendor whose claims are marketing-only.' },
  { key: 'counter',     ask: 'Find the strongest evidence AGAINST the automation narrative: failed rollouts, reversals, re-hiring, productivity claims that did not survive scrutiny, academic work disputing displacement estimates.' },
  { key: 'cautionary',  ask: 'Find specific documented failures or harms from automating this kind of work: safety incidents, discrimination findings, regulatory action, backlash with named organisations.' },
]

const GROUNDING = `
HARD RULES:
- Every factual claim needs a real, checkable source: publication name, date and URL.
- NEVER invent a quote, a person, a job title, a company or a statistic.
- If you cannot find a real source, return fewer claims. Sparse and true beats full and false.
- Do not restate or contradict the supplied scores; they are fixed inputs.
- Prefer sources from the last 24 months; mark anything older with its date.`

const headOf = F => {
  const R = F.role, S = F.scores, C = F.counts
  return `ROLE: ${R.title} (SOC ${R.soc})
SCORES (authoritative, from the scoring database — never contradict these):
  RPI ${S.rpi}%  ·  APS ${S.aps}%  ·  HRF ${S.hrf}%  ·  Untouched ${S.untouched}%  ·  AJCI ${S.ajci}%
  Cognitive APS ${S.cognitive ?? '—'}% · Physical APS ${S.physical ?? '—'}% · Band ${R.band} · Timeline ${R.timeline ?? '—'}
  US employment ${R.emp_k ?? '—'}k · median wage $${R.wage ?? '—'} · BLS growth ${R.growth ?? '—'}%
  Formula: RPI = APS x (1 - HRF) x 100
TASKS (${C.tasks} total: ${C.traditional ?? 0} traditional, ${C.augmented ?? 0} augmented, ${C.created ?? 0} AI-created):
${(F.tasks || []).map((t, i) => `  ${i + 1}. [${t.type}/${t.vec ?? '—'}] ${t.text}`).join('\n')}
VENDORS WITH EVIDENCE (${(F.vendors || []).length}):
${(F.vendors || []).map(v => `  - ${v.name}: ${v.task_n} tasks, avg APS ${v.avg_aps}%, ${v.evidence}, ${v.stage}`).join('\n')}`
}

// ═══ ONE PIPELINE PER ROLE — roles flow independently, no barriers ═══
const results = await pipeline(
  SOCS.map((soc, i) => ({ soc, issue: START_ISSUE + i })),

  // ── Stage 0: extract facts straight from Postgres ──
  async ({ soc }) => {
    const f = await agent(
      `Extract the complete fact base for SOC ${soc} from the Replaceable scoring database.

Use ToolSearch with query "select:${DB}" to load the SQL tool, then run these queries against
schema \`rpi\` (this database is READ-ONLY — SELECT only, never DDL or DML):

1) SELECT title, soc_code, occupation_group, rank, rpi_pct, aps, hrf, untouched, ajci_pct,
     cognitive_aps_pct, physical_aps_pct, risk_band, timeline, us_emp_k, wage_usd_annual,
     bls_growth_pct, task_count, traditional_tasks, ai_augmented_tasks, ai_created_tasks
   FROM rpi.roles WHERE soc_code = '${soc}';

2) SELECT task_text, task_type, ai_vector, importance, top_vendor_src
   FROM rpi.tasks WHERE soc_code = '${soc}' ORDER BY task_seq;

3) SELECT v.display_name, count(DISTINCT e.task_uid) task_n, round(avg(e.task_coverage)*100) avg_aps,
     count(DISTINCT p.product_id) products, round(avg(e.trust_score)) trust,
     bool_or(e.evidence_type IN ('case_study','live_url')) is_prod,
     string_agg(DISTINCT p.product_name, ', ') prods,
     left(max(e.notable_deployments),200) note, left(max(pi.funding_stage),60) funding,
     jsonb_agg(DISTINCT jsonb_build_object('name',left(t.task_text,52),
       'aps',round(e.task_coverage*100),'vec',initcap(t.ai_vector))) tasks
   FROM rpi.tasks t
   JOIN rpi.product_task_evidence e ON e.task_uid=t.task_uid
   JOIN rpi.products p ON p.product_id=e.product_id
   JOIN rpi.vendors v ON v.vendor_id=p.vendor_id
   LEFT JOIN rpi.product_intel pi ON pi.product_id=p.product_id
   WHERE t.soc_code='${soc}' GROUP BY v.vendor_id, v.display_name
   ORDER BY task_n DESC, avg_aps DESC;

4) SELECT role_summary, verdict, aps_case, hrf_case, forward_outlook
   FROM rpi.role_narratives WHERE soc_code = '${soc}';

Return EXACTLY what the database returned. Convert aps/hrf/untouched from 0-1 to whole
percentages (0.76 -> 76) and use rpi_pct as-is. Map is_prod true -> "Production", false ->
"Pilot"; funding -> stage; prods -> desc. Invent nothing: if a field is null, omit it.`,
      { label: `extract:${soc}`, phase: 'Extract', schema: FACTS, ...M.extract })
    if (!f?.role) throw new Error(`extract failed for ${soc}`)

    // Deterministic guard — cheaper and stricter than a bigger model.
    // RPI = APS x (1 - HRF) holds on all 995 rows, so a transcription slip shows up here.
    const S = f.scores
    const expect = S.aps * (1 - S.hrf / 100)
    if (Math.abs(S.rpi - expect) > 0.2) {
      throw new Error(`${soc}: extracted scores fail the RPI identity — ` +
        `rpi=${S.rpi} but aps ${S.aps} x (1 - hrf ${S.hrf}%) = ${expect.toFixed(2)}`)
    }
    if (Math.abs(S.untouched - (100 - S.aps)) > 1.5) {
      throw new Error(`${soc}: untouched=${S.untouched} should be 100 - aps(${S.aps})`)
    }
    if (!f.tasks?.length || !f.counts?.tasks) throw new Error(`${soc}: no tasks extracted`)
    return f
  },

  // ── Stages 1+2: research each lens, verify its claims as soon as it lands ──
  async (F, { soc, issue }) => {
    const HEAD = headOf(F)
    const perLens = await parallel(LENSES.map(l => async () => {
      const res = await agent(
        `${HEAD}\n\nRESEARCH LENS: ${l.key}\n${l.ask}\n${GROUNDING}\n\nUse web search. Return only claims you could source.`,
        { label: `research:${soc}:${l.key}`, phase: 'Research', schema: CLAIMS, ...M.research })
      const claims = (res?.claims || []).slice(0, CLAIMS_PER_LENS)
      if (!claims.length) return []
      return parallel(claims.map(c => () =>
        parallel(Array.from({ length: votesFor(c.kind) }, (_, k) => () =>
          agent(
            `Try to REFUTE this claim. You are a fact-checker whose job is to find the reason it is wrong.\n\n` +
            `CLAIM (${c.kind}): ${c.text}\n` +
            (c.speaker ? `ATTRIBUTED TO: ${c.speaker}, ${c.speaker_role || 'role unstated'}\n` : '') +
            `CITED SOURCE: ${c.source_name}, ${c.source_date}\nURL: ${c.source_url}\n\n` +
            (k === 1
              ? `Lens: ATTRIBUTION AND SCOPE. Is the speaker real and in that role at that date? Is a ` +
                `statistic's population, timeframe or footnote being dropped or widened?`
              : `Check: does the URL resolve and actually contain this? Is the person real and in that ` +
                `role then? Is the statistic stated as claimed or distorted? Is the date right?`) + `\n` +
            `Set verified=false if you cannot independently confirm it. Default to false when uncertain — ` +
            `an unverified claim is dropped, which is the safe outcome. If nearly right, supply corrected_text.`,
            { label: `verify:${soc}:${c.kind}`, phase: 'Verify', schema: VERDICT, ...tierFor(c.kind) })))
        .then(votes => {
          const v = votes.filter(Boolean)
          const ok = v.length && v.every(x => x.verified)      // unanimous, so one doubt kills it
          const fix = v.find(x => x.corrected_text)?.corrected_text
          return { ...c, lens: l.key, ok, fix, why: (v.find(x => !x.verified) || v[0])?.reason }
        })
        .catch(() => null)))
    }))

    const all = perLens.flat().filter(Boolean)
    const verified = all.filter(c => c.ok).map(c => ({ ...c, text: c.fix || c.text }))
    const killed = all.filter(c => !c.ok)
    log(`${soc}: ${verified.length}/${all.length} claims verified, ${killed.length} killed`)
    return { F, soc, issue, HEAD, all, verified, killed }
  },

  // ── Stages 3+4: compose, then audit against BOTH sources ──
  async ({ F, soc, issue, HEAD, all, verified, killed }) => {
    const S = F.scores
    const EVIDENCE = verified.length
      ? verified.map(c => `- [${c.lens}/${c.kind}] ${c.text}\n  SOURCE: ${c.source_name}, ${c.source_date} — ${c.source_url}`
          + (c.speaker ? `\n  SPEAKER: ${c.speaker}, ${c.speaker_role}` : '')).join('\n')
      : '(nothing survived verification — write from the scoring data alone and use NO quotes)'

    // Compose is the most expensive single agent and the one whose loss costs the most:
    // all the research and verification behind it is already paid for. Transient API
    // server_errors killed 2 of 4 composes in the first bulk run, so retry explicitly
    // rather than letting the role drop to null and lose everything upstream.
    const composePrompt =
      `${HEAD}

You are writing Automation Anatomy No. ${String(issue).padStart(3, '0')} for Replaceable.ai — long-form
data journalism in the register of The Economist or FT Big Read. British spelling. No hype, no doom.
The through-line is AUGMENTATION, not apocalypse: what the machine took, what it left, what it created.

VERIFIED EVIDENCE — the ONLY external facts you may assert:
${EVIDENCE}

EVERY section carries TWO distinct fields — do not conflate them:
  "label" = the fixed kicker below, verbatim. Never a number, never invented.
  "title" = an ORIGINAL editorial headline you write for THIS role — the specific claim the
            section makes, in the register of an FT Big Read subhead. 4-12 words. Never reuse
            the label as the title. Good: "Seventy-six per cent capable, nineteen per cent
            protected" · "One Tuesday, from the overnight run to the last unmatched line".
            Bad: "The Score" · "01" · "Overview".

STRUCTURE — return these sections in order, with these exact ids and labels:
  (no id)       lede, one block {"t":"p","drop":true} — 120-160 words, scene-setting, no statistics
  s-score       label "The Score"      + component gauge, prose, component chartEx
  s-shift       label "The Shift"            + component shift
  s-tasks       label "The Anatomy"          + component taskGrid
  s-vendors     label "The Innovators"       + component matrix, component vendorCards
  s-wrong       label "The Cautionary Tales"
  s-global      label "Around the World"
  s-fortress    label "The Human Fortress"
  s-voices      label "Industry Voices"
  s-economics   label "The Economics"        + component econ
  s-2030        label "Looking Ahead"
  s-feedback    label "Challenge This Score" + component feedback

RULES:
- 7,000-8,500 words of prose. Sections without a component need 500-900 words each.
- A {"t":"pq"} pull quote is ONLY allowed if it appears verbatim in VERIFIED EVIDENCE, with its cite
  carrying speaker, role, publication and date. If nothing is verified, use zero pull quotes.
- Never write a task ID (T1, T7). Never put the SOC code in body prose.
- Do NOT state any rate, currency amount or percentage that is not in the evidence or the scores above.
- Place 4-6 {"t":"img"} blocks at real visual beats. Each needs slot (snake_case), caption and a
  prompt describing THIS role's actual tools and environment — never a generic office. full:true for
  full-bleed. No Midjourney flags; aspect ratio is handled downstream.
- One {"t":"ins","label":...} empirical-anchor callout in s-score.
- The shift array is a real working day for this role, 8-12 entries, referencing the vendors above.
- Cover title: short, arresting, may contain one <em>...</em>. Subtitle: one sentence, no colon.`

    let draft = null
    for (let attempt = 1; attempt <= 3 && !draft; attempt++) {
      draft = await agent(
        attempt === 1 ? composePrompt
          : `${composePrompt}\n\n(Retry ${attempt} — a previous attempt failed before returning. ` +
            `Return the complete structured object in one call.)`,
        { label: `compose:${soc}${attempt > 1 ? `#${attempt}` : ''}`,
          phase: 'Compose', schema: SECTIONS, ...M.compose })
      if (!draft && attempt < 3) log(`compose ${soc}: attempt ${attempt} returned nothing — retrying`)
    }
    if (!draft) {
      log(`compose ${soc}: FAILED after 3 attempts — role dropped, research retained in journal`)
      return { soc, title: R.title, failed: 'compose',
               claims: { found: all.length, verified: verified.length, killed: killed.length } }
    }

    const audit = await agent(
      `Audit this composed case study. Report problems only — do not rewrite.\n\n` +
      `SOURCE 1 — DATABASE FACTS (authoritative, needs no external citation):\n${HEAD}\n\n` +
      `SOURCE 2 — VERIFIED EXTERNAL EVIDENCE:\n${EVIDENCE}\n\n` +
      `DRAFT:\n${JSON.stringify(draft).slice(0, 90000)}\n\n` +
      `A claim is GROUNDED if it traces to either source. Vendor names, funding stages, task text, APS ` +
      `values and employment figures come from SOURCE 1 and are legitimate without a URL.\n` +
      `BLOCKERS: a pull quote whose wording or attribution is not in SOURCE 2; a statistic in neither ` +
      `source; a named person, employer or product in neither source; any score contradicting ` +
      `RPI ${S.rpi} / APS ${S.aps} / HRF ${S.hrf}; a task ID or SOC code in body prose; a rate or ` +
      `currency figure presented as measured fact but absent from both sources.\n` +
      `WARNINGS: sections under 400 words, missing components, fewer than 4 image blocks, American spelling.`,
      { label: `audit:${soc}`, phase: 'Audit', schema: AUDIT, ...M.audit })

    return {
      soc, issue, title: F.role.title,
      claims: { found: all.length, verified: verified.length, killed: killed.length },
      killed_claims: killed.map(c => ({ lens: c.lens, text: c.text.slice(0, 120), why: c.why })),
      audit,
      data: {
        issue, role: F.role, scores: S,
        cover: { ...draft.cover, published: PUBLISHED },
        matrix: { breadthThreshold: BREADTH_THRESHOLD, depthThreshold: DEPTH_THRESHOLD },
        econ: { labourBase: Math.round((F.role.wage || 45000) * 0.85),
                techFixed: Math.round((F.role.wage || 45000) * 0.30), baseVolume: 500 },
        tasks: F.tasks, vendors: F.vendors, shift: draft.shift, sections: draft.sections,
      },
      sources: verified.map(c => ({ name: c.source_name, url: c.source_url, date: c.source_date })),
    }
  }
)

const ok = results.filter(Boolean)
const totals = ok.reduce((a, r) => ({
  found: a.found + r.claims.found, verified: a.verified + r.claims.verified,
  killed: a.killed + r.claims.killed,
  blockers: a.blockers + (r.audit?.issues || []).filter(i => i.severity === 'blocker').length,
}), { found: 0, verified: 0, killed: 0, blockers: 0 })
log(`batch done — ${ok.length}/${SOCS.length} roles · ${totals.verified}/${totals.found} claims verified · ${totals.blockers} audit blockers`)

return { mode: MODE, requested: SOCS.length, produced: ok.length, totals, roles: ok }
