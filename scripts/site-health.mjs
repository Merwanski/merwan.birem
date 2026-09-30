/**
 * Builds the monthly site health report (Markdown) used by site-health.yml.
 * Checks: every sitemap URL responds, Lighthouse scores, failed workflow runs,
 * content freshness, and headline numbers — then lists the manual Search
 * Console checks that need a human.
 *
 * Usage: node scripts/site-health.mjs [out.md]
 * Optional env: GITHUB_TOKEN + GITHUB_REPOSITORY (failed-run check). Needs Chrome for Lighthouse.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const SITE = 'https://merwanski.github.io/merwan.birem/';
const out = process.argv[2] || 'site-health-report.md';
const today = new Date();
const daysSince = d => Math.floor((today - new Date(d)) / 86_400_000);
const gitDate = p => execSync(`git log -1 --format=%cs -- "${p}"`, { encoding: 'utf8' }).trim() || null;
const lines = [];
const warnings = [];

// --- 1. Availability: every page in the sitemap should answer 200 ---
async function sitemapUrls(url) {
  const xml = await (await fetch(url)).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  if (xml.includes('<sitemapindex')) return (await Promise.all(locs.map(sitemapUrls))).flat();
  return locs;
}

lines.push('## 🌐 Availability');
try {
  const urls = await sitemapUrls(`${SITE}sitemap-index.xml`);
  const broken = [];
  for (const url of urls) {
    const res = await fetch(url, { redirect: 'follow' }).catch(() => null);
    if (!res || res.status !== 200) broken.push(`${url} → ${res ? res.status : 'no response'}`);
  }
  if (broken.length) {
    warnings.push(`${broken.length} broken page(s)`);
    lines.push(`❌ ${broken.length} of ${urls.length} sitemap pages failed:`, '', ...broken.map(b => `- ${b}`));
  } else {
    lines.push(`✅ All ${urls.length} pages in the sitemap respond.`);
  }
} catch (err) {
  warnings.push('sitemap unreachable');
  lines.push(`❌ Could not read the sitemap: ${err.message}`);
}

// --- 2. Lighthouse (mobile, the stricter one) — the engine behind PageSpeed Insights,
// run locally because the PageSpeed API rejects keyless requests ---
lines.push('', '## ⚡ Lighthouse (mobile)', '', '| Page | Performance | Accessibility | Best practices | SEO |', '|---|---|---|---|---|');
const cats = ['performance', 'accessibility', 'best-practices', 'seo'];
for (const page of ['', 'papers/', 'travels/']) {
  try {
    const json = execSync(
      `npx --yes lighthouse@12 "${SITE + page}" --quiet --output=json --only-categories=${cats.join(',')} --chrome-flags="--headless=new --no-sandbox"`,
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 180_000 },
    );
    const data = JSON.parse(json);
    const scores = cats.map(c => Math.round((data.categories[c]?.score ?? 0) * 100));
    if (scores.some(s => s < 80)) warnings.push(`Lighthouse below 80 on /${page}`);
    lines.push(`| /${page} | ${scores.map(s => `${s < 80 ? '⚠️ ' : ''}${s}`).join(' | ')} |`);
  } catch (err) {
    lines.push(`| /${page} | _unavailable (${err.message.split('\n')[0].slice(0, 80)})_ | | | |`);
  }
}

// --- 3. Automation: failed workflow runs in the last 30 days ---
lines.push('', '## ⚙️ Automation (last 30 days)');
if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
  const since = new Date(today - 30 * 86_400_000).toISOString().slice(0, 10);
  const res = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs?status=failure&created=>=${since}&per_page=50`,
    { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } },
  );
  const runs = res.ok ? (await res.json()).workflow_runs : null;
  if (!runs) lines.push(`_Could not list runs (HTTP ${res.status})._`);
  else if (runs.length === 0) lines.push('✅ No failed workflow runs.');
  else {
    warnings.push(`${runs.length} failed workflow run(s)`);
    lines.push(`❌ ${runs.length} failed run(s):`, '', ...runs.map(r => `- [${r.name}](${r.html_url}) — ${r.created_at.slice(0, 10)}`));
  }
} else {
  lines.push('_Skipped (no GITHUB_TOKEN)._');
}

// --- 4. Freshness ---
const nowUpdated = fs.readFileSync('src/pages/now/index.astro', 'utf8').match(/lastUpdated = '([\d-]+)'/)?.[1];
const cvFile = fs.readdirSync('src/pages/cv').find(f => f.endsWith('.pdf'));
const cvDate = cvFile?.match(/(\d{4})(\d{2})(\d{2})\.pdf$/)?.slice(1).join('-') ?? (cvFile && gitDate(`src/pages/cv/${cvFile}`));
const medium = JSON.parse(fs.readFileSync('src/data/medium-posts.json', 'utf8'));
const lastPost = medium.map(p => p.date).sort().at(-1);

const freshness = [
  ['/now page updated', nowUpdated, 90, 'Rewrite `src/pages/now/index.astro` and bump `lastUpdated`'],
  ['CV refreshed', cvDate, 180, 'Upload a new CV PDF'],
  ['Milestone added', gitDate('src/content/milestones'), 180, 'Add a milestone in `src/content/milestones/`'],
  ['Trip added', gitDate('src/content/travels'), 60, 'Drop a trip folder in `inbox/travels/`'],
  ['Paper added / updated', gitDate('src/content/papers'), 365, 'Drop a PDF in `inbox/papers/`'],
  ['Medium post published', lastPost, 60, 'Publish on Medium (synced automatically)'],
];
lines.push('', '## 🕒 Freshness', '', '| What | Last | Age | Target | Action |', '|---|---|---|---|---|');
for (const [what, date, max, action] of freshness) {
  const age = date ? daysSince(date) : null;
  const stale = age == null || age > max;
  if (stale) warnings.push(`${what} is stale`);
  lines.push(`| ${stale ? '⚠️' : '✅'} ${what} | ${date ?? '—'} | ${age == null ? '—' : `${age} d`} | ≤ ${max} d | ${stale ? action : ''} |`);
}

// --- 5. Headline numbers (compare with last month's report) ---
const papersDir = 'src/content/papers';
const paperFiles = fs.readdirSync(papersDir).filter(f => f.endsWith('.md'));
const citations = paperFiles.reduce((sum, f) => {
  const n = fs.readFileSync(path.join(papersDir, f), 'utf8').match(/^citations:\s*(\d+)/m)?.[1];
  return sum + Number(n ?? 0);
}, 0);
const trips = fs.readdirSync('src/content/travels').filter(f => f.endsWith('.md')).length;
lines.push('', '## 📈 Numbers', '',
  `- Papers: **${paperFiles.length}** · total citations: **${citations}**`,
  `- Trips logged: **${trips}**`,
  `- Medium posts synced: **${medium.length}**`);

// --- 6. Manual checks (Search Console has no data without an API credential) ---
lines.push('', '## 🔍 Your checks (≈10 min)', '',
  '- [ ] [Search Console → Performance](https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Fmerwanski.github.io%2Fmerwan.birem%2F): note clicks, impressions, average position (last 28 days) in a comment below',
  '- [ ] Top queries: where does **"Merwan Birem"** rank? Any surprising queries worth a page or post?',
  '- [ ] [Pages / indexing](https://search.google.com/search-console/index?resource_id=https%3A%2F%2Fmerwanski.github.io%2Fmerwan.birem%2F): any "not indexed" pages that should be?',
  '- [ ] [Sitemaps](https://search.google.com/search-console/sitemaps?resource_id=https%3A%2F%2Fmerwanski.github.io%2Fmerwan.birem%2F): status "Success", discovered page count matches',
  '- [ ] Fix or schedule anything flagged ⚠️/❌ above, then close this issue');

const summary = warnings.length ? `⚠️ ${warnings.length} item(s) need attention: ${warnings.join('; ')}.` : '✅ Everything looks healthy.';
fs.writeFileSync(out, [`Automated monthly check of ${SITE}`, '', `**${summary}**`, '', ...lines, ''].join('\n'));
console.log(summary);
console.log(`Report written to ${out}`);
