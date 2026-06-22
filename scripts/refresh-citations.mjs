/**
 * Refresh citation counts for all papers using the Semantic Scholar API.
 * Free, no API key required. Rate limit: 100 requests / 5 minutes.
 *
 * Usage: node scripts/refresh-citations.mjs
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PAPERS_DIR = './src/content/papers';
const API_BASE = 'https://api.semanticscholar.org/graph/v1';
const DELAY_MS = 2000; // stay well within rate limit

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function searchByTitle(title, authors) {
  const query = encodeURIComponent(`${title} ${authors[0] ?? ''}`);
  const url = `${API_BASE}/paper/search?query=${query}&limit=3&fields=title,authors,citationCount,externalIds`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MerwanBirem-site/1.0' } });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.[0] ?? null;
}

async function searchByDoi(doi) {
  const url = `${API_BASE}/paper/DOI:${encodeURIComponent(doi)}?fields=citationCount`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MerwanBirem-site/1.0' } });
  if (!res.ok) return null;
  const json = await res.json();
  return json.citationCount ?? null;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w[\w_]*):\s*(.+)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  fm._raw = match[1];
  fm._after = content.slice(match[0].length);
  return fm;
}

function updateCitations(content, newCount) {
  // Replace existing citations field or append it
  if (/^citations:/m.test(content)) {
    return content.replace(/^citations:.*$/m, `citations: ${newCount}`);
  }
  return content.replace(/^---\n([\s\S]*?)\n---/, (_, fm) => `---\n${fm}\ncitations: ${newCount}\n---`);
}

async function main() {
  const files = (await readdir(PAPERS_DIR)).filter(f => f.endsWith('.md'));
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const file of files) {
    const path = join(PAPERS_DIR, file);
    const content = await readFile(path, 'utf8');
    const fm = parseFrontmatter(content);
    if (!fm) { failed++; continue; }

    const title = fm.title?.replace(/^["']|["']$/g, '') ?? '';
    const doi = fm.doi?.replace(/^["']|["']$/g, '').replace(/null/i, '') ?? '';
    const currentCitations = parseInt(fm.citations ?? '0', 10);

    let newCitations = null;

    try {
      if (doi && doi !== 'null') {
        newCitations = await searchByDoi(doi);
      }

      if (newCitations === null) {
        const authorsMatch = content.match(/authors:\s*\n([\s\S]*?)(?=\n\w)/);
        const authors = authorsMatch
          ? [...authorsMatch[1].matchAll(/- ["']?(.+?)["']?$/gm)].map(m => m[1])
          : [];
        const result = await searchByTitle(title, authors);
        if (result) newCitations = result.citationCount ?? null;
      }
    } catch (e) {
      console.warn(`  ⚠ API error for ${file}:`, e.message);
    }

    if (newCitations !== null && newCitations !== currentCitations) {
      const updated_content = updateCitations(content, newCitations);
      await writeFile(path, updated_content, 'utf8');
      console.log(`  ✓ ${file}: ${currentCitations} → ${newCitations}`);
      updated++;
    } else if (newCitations !== null) {
      console.log(`  – ${file}: ${currentCitations} (unchanged)`);
      unchanged++;
    } else {
      console.log(`  ? ${file}: could not find on Semantic Scholar`);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone: ${updated} updated, ${unchanged} unchanged, ${failed} not found.`);
}

main().catch(err => { console.error(err); process.exit(1); });
