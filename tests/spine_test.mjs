// Evaluate the compose spine against every data file in the corpus.
//
// The spine is the only place the pipeline MANUFACTURES factual sentences rather
// than passing workbook values through, so a bug here publishes a falsehood that
// no verifier can catch -- prompt text is asserted to the model as true. It has
// already done so once: reading `status` blind on a role that carries none made
// it claim every task had vendor evidence.
//
// The block is extracted verbatim from the workflow between its SPINE markers, so
// this exercises the shipped code rather than a copy that can drift.
import { readFileSync, readdirSync } from 'node:fs'

const SRC = readFileSync('pipeline/anatomy.custom.js', 'utf8')
const afterMarker = SRC.split('// ---- SPINE:BEGIN')[1].split('// ---- SPINE:END')[0]
// drop the remainder of the BEGIN marker's own line, which is prose not code
const body = afterMarker.slice(afterMarker.indexOf('\n') + 1)

let fails = 0
let checked = 0
const files = readdirSync('data').filter(f => f.endsWith('.json') && !f.startsWith('_')).sort()

for (const f of files) {
  const D = JSON.parse(readFileSync(`data/${f}`, 'utf8'))
  if (!D.tasks || !D.scores) continue
  checked++
  const S = D.scores
  let SPINE = ''
  let err = null
  try {
    SPINE = new Function('D', 'S', body + '\nreturn SPINE')(D, S)
  } catch (e) {
    err = e.message
  }

  const hasAps = (D.tasks || []).some(t => Number(t.aps) > 0)
  // "unserved" is spelled two ways in the corpus: an empty field (No.008) or a
  // sentinel string like "No vendor - human only" (7 of 10 roles). The test must
  // recognise BOTH, or it validates the spine against the same blind spot.
  const NO_VENDOR = /^\s*(no vendor|none|n\/?a|-{1,2}|tbd|unserved)/i
  const noVendor = (D.tasks || []).filter(t => {
    const v = String(t.vendor || '').trim()
    return !v || NO_VENDOR.test(v)
  }).length
  const problems = []

  if (err) {
    problems.push('threw: ' + err)
  } else {
    if (/undefined|NaN|\[object/.test(SPINE)) problems.push('spine contains undefined/NaN')
    if (!hasAps && /Lowest automation potential/.test(SPINE)) {
      problems.push('states a per-task APS figure for a role that carries none')
    }
    if (noVendor > 0 && /Every one of the/.test(SPINE)) {
      problems.push(`claims full coverage but ${noVendor} task(s) have no vendor`)
    }
    if (noVendor === 0 && /carry NO vendor evidence/.test(SPINE)) {
      problems.push('claims unserved tasks when every task has a vendor')
    }
    // the number the spine PRINTS must equal the number actually unserved
    const m = SPINE.match(/^\s*(\d+) of (\d+) tasks carry NO vendor evidence/m)
    const hasStatus = (D.tasks || []).some(t => String(t.status || '').trim())
    if (m && !hasStatus && Number(m[1]) !== noVendor) {
      problems.push(`spine says ${m[1]} unserved, data shows ${noVendor}`)
    }
  }

  if (problems.length) fails++
  const tag = problems.length ? 'FAIL' : 'ok  '
  const detail = problems.length ? problems.join('; ') : `${SPINE.split('\n').length} lines`
  console.log(`  ${tag} ${f.padEnd(26)} aps=${hasAps ? 'yes' : 'no '} unserved=${noVendor}  ${detail}`)
}

console.log(fails
  ? `\nFAIL -- ${fails} of ${checked} roles`
  : `\nPASS -- spine is honest on all ${checked} data files.`)
process.exit(fails ? 1 : 0)
