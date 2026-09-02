// Run the workflow end to end with stubbed agents, for every role in the corpus.
//
// The first live launch of No.001 died in 95ms on `RD.pct` -- readiness is absent
// on roles that did not come from a workbook. It cost nothing only by luck: the
// throw happened before the first agent was spawned. A prompt-assembly bug that
// threw slightly later would have burned most of a 119-agent run first.
//
// So this executes the real script with agent()/parallel()/phase()/log() stubbed,
// which exercises every prompt-assembly path -- HEAD, LIMITS, GROUNDING, the
// spine, the section briefs -- without spending anything. Reaching the compose
// stage is the pass condition; compose then fails on the stub, which is expected.
import { readFileSync, readdirSync } from 'node:fs'

const SRC = readFileSync('pipeline/anatomy.custom.js', 'utf8')
const BODY = SRC.replace(/^export const meta = \{[\s\S]*?\n\}\n/m, '')

const EXPECTED = /compose failed after 3 attempts/

let fails = 0
let checked = 0
const files = readdirSync('data').filter(f => f.endsWith('.json') && !f.startsWith('_')).sort()

for (const f of files) {
  const D = JSON.parse(readFileSync('data/' + f, 'utf8'))
  if (!D.tasks || !D.scores || !D.role) continue
  checked++

  const prompts = []
  const stubs = {
    args: D,
    // research must return claims, or the verify prompts -- 110 of the 119 agents
    // in a deep run -- are never assembled and go untested.
    agent: async (prompt) => {
      prompts.push(String(prompt))
      if (/RESEARCH LENS/.test(prompt)) {
        return { claims: [
          { kind: 'quote', text: 'A stub claim.', speaker: 'A Person', speaker_role: 'A Role',
            source_name: 'Stub Weekly', source_date: '2026-01-01', source_url: 'https://example.invalid/a' },
          { kind: 'pricing', text: 'A stub price.', source_name: 'Stub Docs',
            source_date: '2026-01-01', source_url: 'https://example.invalid/b' },
        ] }
      }
      if (/Try to REFUTE/.test(prompt)) return { verified: true }
      return null
    },
    parallel: async (thunks) => Promise.all(thunks.map(t => {
      try { return Promise.resolve(t()).catch(() => null) } catch { return null }
    })),
    phase: () => {},
    log: () => {},
  }

  let outcome = null
  try {
    const fn = new Function('args', 'agent', 'parallel', 'phase', 'log',
      '"use strict"; return (async () => {\n' + BODY + '\n})()')
    await fn(stubs.args, stubs.agent, stubs.parallel, stubs.phase, stubs.log)
    outcome = 'returned'
  } catch (e) {
    outcome = e.message
  }

  const problems = []
  // reaching the compose failure means every prompt was assembled successfully
  if (!EXPECTED.test(outcome) && outcome !== 'returned') {
    problems.push('died before compose: ' + outcome)
  }
  if (!prompts.length) problems.push('no prompt was ever assembled')
  // the research SUBJECT must be this role: No.008's lenses asked every role about
  // AI coding agents, and the answers verified as true -- about the wrong occupation
  const research = prompts.filter(p => /RESEARCH LENS/.test(p))
  if (research.length && !research.every(p => p.includes(D.role.title))) {
    problems.push('a research lens does not name the role')
  }
  const LEAK = /AI[- ]coding|coding agent|AI-generated code|software development|engineering leaders/i
  const isSoftware = /^15-/.test(String(D.role.soc))
  if (!isSoftware && research.some(p => LEAK.test(p))) {
    problems.push('research lens carries software-role vocabulary')
  }
  for (const p of prompts) {
    const m = p.match(/.{0,40}(undefined|NaN|\[object Object\]).{0,25}/)
    if (m) { problems.push('prompt contains ' + m[1] + ': "' + m[0].trim() + '"'); break }
  }

  if (problems.length) fails++
  const tag = problems.length ? 'FAIL' : 'ok  '
  const detail = problems.length ? problems.join('; ')
    : prompts.length + ' prompts assembled, longest ' +
      Math.max(...prompts.map(p => p.length)) + 'b'
  console.log('  ' + tag + ' ' + f.padEnd(26) + detail)
}

console.log(fails
  ? '\nFAIL -- ' + fails + ' of ' + checked + ' roles would crash or assemble a broken prompt'
  : '\nPASS -- all ' + checked + ' roles assemble every prompt cleanly.')
process.exit(fails ? 1 : 0)
