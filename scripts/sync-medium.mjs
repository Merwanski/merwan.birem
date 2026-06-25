/**
 * Sync Medium blog posts and take a profile screenshot.
 *
 * Saves:
 *   src/data/medium-posts.json   — parsed RSS entries
 *   public/medium-profile.png    — screenshot of the Medium profile page
 *
 * Usage:
 *   node scripts/sync-medium.mjs
 *
 * Requires puppeteer for the screenshot step:
 *   npm install --no-save puppeteer
 * If puppeteer is not installed the script still runs and just skips the screenshot.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const USERNAME   = 'just-merwan';
const RSS_URL    = `https://medium.com/feed/@${USERNAME}`;
const PROFILE_URL = `https://medium.com/@${USERNAME}`;
const POSTS_FILE  = './src/data/medium-posts.json';
const SCREENSHOT  = './public/medium-profile.png';

// ── RSS parsing ────────────────────────────────────────────────────────────
function parseMediumRSS(xml) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  return items.map(([, item]) => {
    const title =
      item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]>/)?.[1]?.trim() ??
      item.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? '';

    const rawUrl =
      item.match(/<link>(https?:\/\/[^<\s]+)<\/link>/)?.[1] ??
      item.match(/<guid[^>]*>(https?:\/\/[^<\s]+)<\/guid>/)?.[1] ?? '';
    const url = rawUrl.split('?')[0]; // strip ?source=rss-... tracking params

    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? '';
    const date    = pubDate ? new Date(pubDate).toISOString().split('T')[0] : '';

    const tags = [...item.matchAll(/<category><!\[CDATA\[(.*?)\]\]>/g)]
      .map(m => m[1]).slice(0, 4);

    const rawDesc  = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>/)?.[1] ?? '';
    const stripped = rawDesc
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x[\da-f]+;/gi, c => String.fromCharCode(parseInt(c.slice(3, -1), 16)))
      .replace(/Continue reading on Medium\s*[»›]?/gi, '')
      .replace(/\s+/g, ' ').trim();
    const summary  = stripped.slice(0, 220) + (stripped.length > 220 ? '…' : '');

    const readingMatch = rawDesc.match(/(\d+)\s*min\s*read/i);
    const readingTime  = readingMatch ? `${readingMatch[1]} min` : null;

    return { title, url, date, summary, tags, readingTime };
  }).filter(p => p.title && p.url);
}

// ── Fetch & save posts ─────────────────────────────────────────────────────
async function syncPosts() {
  console.log(`\nFetching RSS: ${RSS_URL}`);
  const res = await fetch(RSS_URL, {
    headers: { 'User-Agent': 'MerwanBirem-site/1.0 (https://merwanbirem.github.io)' },
  });
  if (!res.ok) throw new Error(`RSS fetch failed with status ${res.status}`);

  const posts = parseMediumRSS(await res.text());
  console.log(`  → ${posts.length} post(s) found`);

  await mkdir('./src/data', { recursive: true });
  await writeFile(POSTS_FILE, JSON.stringify(posts, null, 2) + '\n');
  console.log(`  ✓ Saved to ${POSTS_FILE}`);
  return posts;
}

// ── Screenshot ─────────────────────────────────────────────────────────────
async function takeScreenshot() {
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch {
    console.warn('\n  ⚠ puppeteer not installed — skipping screenshot.');
    console.warn('    Run: npm install --no-save puppeteer');
    return;
  }

  console.log(`\nTaking screenshot: ${PROFILE_URL}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 860 });
    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.goto(PROFILE_URL, { waitUntil: 'networkidle2', timeout: 45_000 });
    // Wait for JS-rendered content to settle
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({
      path: SCREENSHOT,
      clip: { x: 0, y: 0, width: 1280, height: 860 },
    });
    console.log(`  ✓ Screenshot saved to ${SCREENSHOT}`);
  } finally {
    await browser.close();
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  await syncPosts();
  try {
    await takeScreenshot();
  } catch (err) {
    console.warn('\n  ⚠ Screenshot failed (non-fatal):', err.message);
  }
  console.log('\nSync complete.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
