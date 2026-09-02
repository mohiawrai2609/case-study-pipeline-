// Render the compose/research HEAD for every role and check it asserts nothing false.
//
// HEAD is prepended to every research, verify and compose prompt, so anything wrong
// in it is asserted to the model as fact and reaches no verifier. It was written for
// No.008 -- a custom role with no BLS series -- and stated all of it unconditionally.
// Against No.001 that meant claiming a real O*NET occupation was "NOT an O*NET
// occupation", that it was "anchored structurally to Software Developers", and that
// it had no employment count or wage while the record carries 3,796k at $30,480.
//
// The block is extracted verbatim from the workflow between its HEAD markers.
import { readFileSync, readdirSync } from 'node:fs'

const SRC = readFileSync('pipeline/anatomy.custom.js', 'utf8')
const after = SRC.split('// ---- HEAD:BEGIN')[1].split('// ---- HEAD:END')[0]
const body = after.slice(after.indexOf('\n') + 1)

let fails = 0
let checked = 0
const files = readdirSync('data').filter(f => f.endsWith('.json') && !f.startsWith('_')).sort()

for (const f of files) {
  const D = JSON.parse(readFileSync(`data/${f}`, 'utf8'))
  if (!D.tasks || !D.scores || !D.role) continue
  checked++
  let HEAD = ''
  let err = null
  try {
    HEAD = new Function('D', body + '\nreturn HEAD')(D)
  } catch (e) {
    err = e.message
  }

  const R = D.role
  const isCustom = !/^\d{2}-\d{4}\.\d{2}$/.test(String(R.soc || ''))
  const hasLabour = R.emp_k != null || R.wage != null
  const problems = []

  if (err) {
    problems.push('threw: ' + err)
  } else {
    if (/undefined|NaN|\[object/.test(HEAD)) {
      const m = HEAD.match(/.{0,50}(undefined|NaN|\[object).{0,30}/)
      problems.push(`contains ${m[1]}: "${m[0].trim()}"`)
    }
    if (!isCustom && /NOT an O\*NET occupation/.test(HEAD)) {
      problems.push(`calls O*NET SOC ${R.soc} a custom role`)
    }
    if (hasLabour && /NO employment count/.test(HEAD)) {
      problems.push(`denies employment/wage but record has emp_k=${R.emp_k}, wage=${R.wage}`)
    }
    if (!hasLabour && /US employment/.test(HEAD)) {
      problems.push('states employment for a role that carries none')
    }
    // the anchor must be the one in the record, never a name carried over
    if (/Software Developers/.test(HEAD) && D.anchorRole?.title !== 'Software Developers') {
      problems.push('names Software Developers but that is not this role\'s anchor')
    }
    if (/densest vendor layer/.test(HEAD)) {
      problems.push('carries a corpus-wide superlative written for another role')
    }
    // the unserved count in the header must match the tasks actually unattributed
    const NO_VENDOR = /^\s*(no vendor|none|n\/?a|-{1,2}|tbd|unserved)/i
    const un = D.tasks.filter(t => {
      const v = String(t.vendor || '').trim()
      return !v || NO_VENDOR.test(v)
    }).length
    const m = HEAD.match(/(\d+) with no vendor evidence/)
    if (m && Number(m[1]) !== un) {
      problems.push(`header says ${m[1]} unserved, data shows ${un}`)
    }
    if ((HEAD.match(/NO VENDOR EVIDENCE/g) || []).length !== un) {
      problems.push(`task lines flag ${(HEAD.match(/NO VENDOR EVIDENCE/g) || []).length} unserved, data shows ${un}`)
    }
  }

  if (problems.length) fails++
  const tag = problems.length ? 'FAIL' : 'ok  '
  const detail = problems.length ? problems.join('; ') : `${HEAD.split('\n').length} lines, ${HEAD.length}b`
  console.log(`  ${tag} ${f.padEnd(26)} ${isCustom ? 'custom' : 'onet  '}  ${detail}`)
}

console.log(fails ? `\nFAIL -- ${fails} of ${checked} roles` : `\nPASS -- HEAD is truthful on all ${checked} roles.`)
process.exit(fails ? 1 : 0)
