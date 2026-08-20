#!/usr/bin/env node
/**
 * Automation Anatomy — deterministic builder.
 *
 *   node build/build.mjs data/001-fast-food.json [out.html]
 *
 * Takes a data file (scores + prose + vendors) and injects it into the tested
 * shell. The model never writes CSS or JS — those come from shell/, already
 * verified. Output is one self-contained .html file, same as the v5 engine
 * produced, minus the class of bugs that came from regenerating the chrome.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT  = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHELL = join(ROOT, 'shell');
const read  = p => readFileSync(p, 'utf8');
const esc   = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ── inline markup allowed inside prose: **bold**, *em*, [text](url) ──
const rich = s => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
  .replace(/\[(.+?)\]\((https?:\/\/[^)\s]+)\)/g,
           '<a href="$2" target="_blank" rel="noopener">$1</a>');

// ── block renderers ──────────────────────────────────────────
const partial = name => {
  const p = join(SHELL, 'partials', `${name}.html`);
  if (!existsSync(p)) throw new Error(`unknown component "${name}" (no partials/${name}.html)`);
  return read(p);
};

const BLOCK = {
  p:   b => `<p class="bt${b.drop ? ' drop' : ''}">${rich(b.text)}</p>`,
  h3:  b => `<h3>${rich(b.text)}</h3>`,
  pq:  b => `<div class="pq reveal"><p>${rich(b.text)}</p>`
          + (b.cite ? `<cite>${rich(b.cite)}</cite>` : '') + `</div>`,
  ins: b => `<div class="ins reveal"><div class="ins-l">${esc(b.label)}</div>`
          + `<p>${rich(b.text)}</p></div>`,
  img: b => b.src
          ? `<div class="ed-img${b.full ? ' ed-img-full' : ''} reveal">`
            + `<img src="${esc(b.src)}" alt="${esc(b.caption || '')}">`
            + (b.caption ? `<div class="ed-img-cap">${rich(b.caption)}</div>` : '')
            + `</div>`
          : `<!-- MEDIA_SLOT:${b.slot} -->`,
  // chartEx was baked with fast-food anchors ("Where Fast Food Sits", Data Entry 67.2%…).
  // Render it from this role's own anchor set, with the subject highlighted.
  component: b => b.name === 'chartEx' ? chartEx() : partial(b.name),
  html: b => b.html,
};

function chartEx() {
  const a = (D.anchors || []).filter(x => x && x.rpi != null);
  // Silence here is how article 002 shipped without its comparison exhibit: the
  // block was present, the anchors were not, and the chart simply never rendered.
  if (!a.length) {
    console.warn('  WARNING: chartEx block present but D.anchors is empty — Exhibit 1 omitted');
    return '';
  }
  const rows = [...a].sort((x, y) => y.rpi - x.rpi);
  const max = Math.max(...rows.map(r => r.rpi), 1);
  const me = (D.role.title || '').toLowerCase();
  return `<div class="chart-ex reveal">\n`
    + `      <div class="chart-ex-n">Exhibit 1</div>\n`
    + `      <div class="chart-ex-t">Where ${esc(D.role.title.split(',')[0])} Sit: RPI Across Occupations</div>\n`
    + rows.map(r => {
        const self = (r.title || '').toLowerCase() === me;
        const col = self ? 'var(--c)' : r.rpi >= 40 ? 'var(--c)' : r.rpi >= 20 ? 'var(--am)' : 'var(--t4)';
        const op = self ? '' : ';opacity:.7';
        return `      <div class="cb${self ? ' active' : ''}">`
          + `<div class="cb-l">${esc(r.label || r.title)}${self ? ' ◄' : ''}</div>`
          + `<div class="cb-tr"><div class="cb-f" style="width:${Math.round(r.rpi / max * 100)}%;background:${col}${op}"></div></div>`
          + `<div class="cb-v" style="color:${col}${op}">${Number(r.rpi).toFixed(1)}%</div></div>`;
      }).join('\n')
    + `\n    </div>`;
}

const renderBlocks = (blocks = []) => blocks.map(b => {
  const fn = BLOCK[b.t];
  if (!fn) throw new Error(`unknown block type "${b.t}"`);
  return '      ' + fn(b);
}).join('\n\n');

const renderSection = s => {
  // the lede has no label/title — it is just prose under the cover
  const head = s.id
    ? `  <div class="sec" id="${esc(s.id)}">\n`
      + (s.label ? `    <span class="cl">${esc(s.label)}</span>\n` : '')
      + (s.title ? `    <h2 class="ct">${rich(s.title)}</h2>\n` : '')
      + `    <div class="dv"></div>\n`
    : `  <div class="sec">\n`;
  return head + renderBlocks(s.blocks) + `\n  </div>`;
};

// ── main ─────────────────────────────────────────────────────
const dataPath = process.argv[2];
if (!dataPath) { console.error('usage: node build/build.mjs <data.json> [out.html]'); process.exit(1); }
const D = JSON.parse(read(resolve(dataPath)));

for (const k of ['role','scores','tasks','vendors','matrix','econ','shift','sections'])
  if (!D[k]) throw new Error(`data file is missing required key "${k}"`);

const article = D.sections.map(renderSection).join('\n\n');

// Runs disagree on the label/title convention: some put the kicker ("The Score") in
// `label` and an editorial headline in `title`; others put "01" in `label` and the
// kicker in `title`. Prefer a label that carries actual words; fall back to title.
const navName = s => {
  const l = (s.label || '').trim(), t = (s.title || '').trim();
  if (l && !/^\d+$/.test(l)) return l;           // "The Score"  — a real kicker
  if (t) return t.length <= 34 ? t : t.slice(0, 32).replace(/\s\S*$/, '') + '…';
  return l;
};
const toc = D.sections.filter(s => s.id && (s.title || s.label))
  .map(s => `    <a href="#${s.id}">${esc(navName(s))}</a>`).join('\n');

// ── everything below was hardcoded to fast food in the v20 shell ──
const V = D.vendors || [];
const byReach = [...V].sort((a, b) =>
  (b.tasks?.length || 0) - (a.tasks?.length || 0) || (b.reach || 0) - (a.reach || 0));
const TIERS = ['gold', 'silver', 'bronze'];

const partnerCard = (v, i) => {
  const tier = TIERS[i] || 'bronze';
  return `  <div class="sb-block sb-ad">`
    + `<div class="sb-ad-l">Featured Partner <span class="tier-badge tier-${tier}" style="float:right">`
    + `${tier[0].toUpperCase()}${tier.slice(1)}</span></div>`
    + `<div class="sb-ad-logo">Partner Logo</div>`
    + `<div class="sb-ad-n">${esc(v.name)}</div>`
    + `<div class="sb-ad-d">${esc(v.desc || v.note || '').slice(0, 110)}</div>`
    + `<a href="javascript:void(0)" onclick="openVendorProfile('${esc(v.id)}')" class="sb-ad-btn">`
    + `View on Marketplace →</a></div>`;
};

// AI-created tasks are the roles the machine invented — real data, not invented copy.
const created = D.tasks.filter(t => t.origin === 'ai-created' || /created/i.test(t.type || ''));
const emergingBlock = created.length
  ? `  <div class="sb-block sb-dark"><div class="sb-dark-l">Emerging Roles</div>`
    + `<div class="sb-dark-t">Work That Didn't Exist Two Years Ago</div>`
    + created.slice(0, 5).map(t =>
        `<div class="sb-job"><div class="sb-job-t">${esc(t.name)}</div>`
        + `<div class="sb-job-c">${esc(D.role.title).slice(0, 34)}</div>`
        + `<span class="sb-tag sb-ai">AI-Created</span></div>`).join('')
    + `</div>`
  : '';

const vendorBar = (v, dark) => v
  ? `<div class="vb${dark ? ' vb-dark' : ''}"><div class="vb-i"><div>`
    + `<div class="vb-l">Featured Partner <span class="tier-badge tier-${dark ? 'gold' : 'silver'}">`
    + `${dark ? 'Gold' : 'Silver'}</span></div>`
    + `<div class="vb-n">${esc(v.name)}</div></div>`
    + `<div class="vb-d">${esc(v.desc || v.note || '').slice(0, 150)}</div>`
    + `<a href="javascript:void(0)" onclick="openVendorProfile('${esc(v.id)}')" class="vb-btn">`
    + `View Profile →</a></div></div>`
  : '';

// References come from the claims that actually survived verification.
const refs = (D.sources || []);
// A custom role (source_type rpi_custom) has NO BLS series and NO O*NET row.
// Emitting those two citations anyway attributes the data to authorities that
// do not hold it — a fabricated citation in an article about sourcing. Custom
// roles cite the curated record instead, and O*NET only for the anchor SOC.
const isCustom = D.role.sourceType === 'rpi_custom';
const provenance = isCustom
  ? `  <li>Replaceable.ai, <em>RPI Custom Role Record</em>, ${esc(D.role.soc)}. Task decomposition, `
    + `vendor evidence and verification status curated for this role. Not an O*NET occupation; `
    + `no BLS employment or wage series exists.</li>\n`
    + (D.role.anchorSoc
        ? `  <li>O*NET OnLine, <em>Task Statements and Work Activities</em>, SOC ${esc(D.role.anchorSoc)} `
          + `— structural and calibration anchor for this role.</li>\n`
        : '')
  : `  <li>U.S. Bureau of Labor Statistics, <em>Occupational Employment and Wage Statistics</em>, `
    + `SOC ${esc(D.role.soc)}. Employment ${D.role.emp_k ? Math.round(D.role.emp_k * 1000).toLocaleString() : 'n/a'}, `
    + `median wage $${(D.role.wage || 0).toLocaleString()}.</li>\n`
    + `  <li>O*NET OnLine, <em>Task Statements and Work Activities</em>, SOC ${esc(D.role.soc)}.</li>\n`;

// Image credits are part of the citation record, not decoration: CC BY / BY-SA
// require attribution, and a sourced photograph is a claim about provenance.
const credits = [];
for (const s of (D.sections || []))
  for (const b of (s.blocks || []))
    if (b.t === 'img' && b.credit && b.credit.title)
      credits.push(`  <li>Photograph: <em>${esc(b.credit.title)}</em>`
        + `${b.credit.creator ? `, ${esc(b.credit.creator)}` : ''}`
        + `${b.credit.license ? `, ${esc(String(b.credit.license).toUpperCase())}` : ''}`
        + `${b.credit.source ? ` via ${esc(b.credit.source)}` : ''}`
        + `${b.credit.landing ? ` — <a href="${esc(b.credit.landing)}" target="_blank" rel="noopener">link</a>` : ''}`
        + `</li>`);

// refsExternalOnly drops the provenance and methodology entries so References
// lists only sources a reader can go and check. Off by default: for a standard
// role the BLS and O*NET rows are real external records, not self-citation.
const externalOnly = D.refsExternalOnly === true;
const references =
  `<div class="refs"><h4>References</h4><ol>\n`
  + (externalOnly ? '' : provenance)
  + (externalOnly ? ''
      : `  <li>Replaceable.ai, <em>RPI Scoring Methodology</em>. RPI = APS × (1 − HRF) × 100; `
        + `APS ${D.scores.aps}%, HRF ${D.scores.hrf}%, RPI ${D.scores.rpi}%.</li>\n`)
  + refs.map(s => `  <li>${esc(s.name || 'Source')}${s.date ? `, <em>${esc(s.date)}</em>` : ''}`
      + `${s.url ? ` — <a href="${esc(s.url)}" target="_blank" rel="noopener">link</a>` : ''}</li>`).join('\n')
  + (credits.length ? `\n${credits.join('\n')}` : '')
  + `\n</ol></div>`;

const premium = `<div class="premium-grid">`
  + [['Report', `${D.role.title} — Full Task Scoring`, `All ${D.tasks.length} tasks with APS, vector and vendor coverage.`],
     ['Dataset', `Raw RPI Data: ${(D.role.group || D.role.title)}`, 'Task-level scores, vendor evidence and source URLs.'],
     ['Briefing', 'Vendor Landscape Deep Dive', `Profiles for all ${V.length} vendors with evidence tiers.`]]
    .map(([t, ti, d]) => `<div class="premium-card"><div class="premium-lock">🔒</div>`
      + `<div class="premium-card-type">${esc(t)}</div>`
      + `<div class="premium-card-title">${esc(ti)}</div>`
      + `<div class="premium-card-desc">${esc(d)}</div></div>`).join('')
  + `</div>`;

// The overlay is a per-vendor microsite; render a compact, data-driven version.
const overlay = `<div class="vendor-overlay" id="vendorOverlay">
  <nav class="vo-nav"><div class="vo-crumb"><a onclick="closeVendorProfile()">${esc(D.role.title)}</a>
    › <span id="voCrumbName"></span></div>
    <a class="vo-close" onclick="closeVendorProfile()">✕ Close</a></nav>
  <div class="vo-body"><div class="vo-hero"><div class="vo-meta">
    <h1 id="voName"></h1><div class="vo-ticker" id="voTicker"></div>
    <p class="vo-lede" id="voLede"></p></div></div>
    <div class="vo-sec"><h3>Task Coverage in This Role</h3><div id="voTasks"></div></div>
    <div class="vo-sec"><h3>Evidence</h3><div id="voEvidence"></div></div>
  </div>
  <footer class="vo-foot"><div>Replace<b>able</b>.ai · Vendor Intelligence</div>
    <div><a onclick="closeVendorProfile()">← Back to Case Study</a></div></footer>
</div>`;

const runtime =
  `<script>\n/* Injected by build.mjs — data only. Runtime lives in shell/components.js */\n`
  + `const D = ${JSON.stringify(D, null, 1)};\n</script>\n`
  + `<script>\n${read(join(SHELL, 'components.js'))}\n</script>`;

const readTime = Math.max(1, Math.round(
  D.sections.flatMap(s => s.blocks || []).filter(b => b.t === 'p' || b.t === 'pq')
    .reduce((n, b) => n + String(b.text || '').split(/\s+/).length, 0) / 230));

let out = read(join(SHELL, 'anatomy.shell.html'));
const fill = {
  TITLE:        `${D.role.title} — Automation Anatomy No. ${String(D.issue).padStart(3,'0')} | Replaceable.ai`,
  ISSUE_BADGE:  `Automation Anatomy · No. ${String(D.issue).padStart(3,'0')}`,
  COVER_TITLE:  D.cover.title,
  COVER_SUB:    D.cover.subtitle,
  PUB_DATE:     D.cover.published,
  OCCUPATION:   D.role.title,
  READ_TIME:    `${readTime} minutes`,
  TOC:          toc,
  ARTICLE:      article,
  MAIN_CSS:     `<style>${read(join(SHELL, '_main.css'))}</style>`,
  OVERLAY_CSS:  `<style>${read(join(SHELL, '_overlay.css'))}</style>`,
  RUNTIME:      runtime,
  OG_TITLE:     `${D.cover.title.replace(/<[^>]+>/g, '')} — Replaceable.ai`,
  OG_DESC:      `${D.role.emp_k ? Math.round(D.role.emp_k * 1000).toLocaleString() + ' workers. ' : ''}`
                + `${D.tasks.length} tasks scored. RPI ${D.scores.rpi}%. ${D.cover.subtitle}`.slice(0, 200),
  SIDEBAR_BLOCKS: byReach.slice(0, 3).map(partnerCard).join('\n') + '\n' + emergingBlock,
  VENDOR_BAR:   vendorBar(byReach[0], false),
  VENDOR_BAR2:  vendorBar(byReach[1], true),
  REFERENCES:   references,
  PREMIUM:      premium,
  VENDOR_OVERLAY: overlay,
  COVER_MEDIA:  (() => {
    const v = D.hero?.video || '', img = D.hero?.poster || '';
    if (v) return `<video autoplay muted loop playsinline${img ? ` poster="${img}"` : ''}>`
             + `<source src="${v}" type="video/mp4"></video>`;
    return img ? `<img src="${img}" alt="">` : '';
  })(),
};
for (const [k, v] of Object.entries(fill)) out = out.split(`{{${k}}}`).join(v);

const left = out.match(/\{\{[A-Z_0-9]+\}\}/g);
if (left) throw new Error(`unfilled markers: ${[...new Set(left)].join(', ')}`);

const slug = D.role.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const outPath = process.argv[3]
  || join(ROOT, 'output', `Replaceable_AI_Automation_Anatomy_${String(D.issue).padStart(3,'0')}_${slug}.html`);
writeFileSync(outPath, out, 'utf8');

const words = out.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ')
                 .split(/\s+/).filter(Boolean).length;
const slots = (out.match(/<!-- MEDIA_SLOT:/g) || []).length;
console.log(`built  ${outPath}`);
console.log(`       ${(out.length/1024).toFixed(0)} KB · ${words.toLocaleString()} words · `
          + `${D.sections.length} sections · ${D.tasks.length} tasks · ${D.vendors.length} vendors`
          + (slots ? ` · ${slots} media slots open` : ' · no open media slots'));
