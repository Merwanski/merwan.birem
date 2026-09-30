/**
 * Shared helpers for the papers pipeline: PDF text, Groq calls, preview/figure
 * rendering and frontmatter edits. Used by process-paper.mjs and
 * backfill-paper-assets.mjs.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';

const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'paper-assets-worker.mjs');
export const THUMB_DIR = 'public/papers/thumbs';
export const FIGURE_DIR = 'public/papers/figures';

// Text from the first pages (title, abstract) plus the last pages (theses often
// put the English abstract on the back cover).
export async function extractText(pdfPath, { head = 3, tail = 2, maxChars = 12000 } = {}) {
  const parser = new PDFParse({ data: fs.readFileSync(pdfPath) });
  try {
    const info = await parser.getInfo();
    const total = info.total;
    const headText = (await parser.getText({ first: Math.min(head, total) })).text;
    let tailText = '';
    if (!/\babstract\b/i.test(headText) && total > head) {
      // Long documents (theses) keep the abstract further in — grab the text around it
      const full = (await parser.getText()).text;
      const at = full.search(/^\s*abstract\s*[:.]?\s*$/im);
      if (at !== -1) tailText = full.slice(at, at + 4000);
    } else if (total > head + tail) {
      tailText = (await parser.getText({ partial: Array.from({ length: tail }, (_, i) => total - tail + 1 + i) })).text;
    }
    return { head: headText.slice(0, maxChars), tail: tailText.slice(0, 4000) };
  } finally {
    await parser.destroy();
  }
}

// Chat completion that returns parsed JSON; retries on rate limits (free tier).
export async function askGroqJson(prompt, { maxTokens = 2048 } = {}) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    console.error('GROQ_API_KEY not set — get a free key at https://console.groq.com/keys');
    process.exit(1);
  }
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (res.status === 429 && attempt < 6) {
      const wait = Math.ceil(Number(res.headers.get('retry-after')) || 10 * attempt);
      console.log(`Groq rate limit — waiting ${wait}s...`);
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`Groq API error ${res.status}: ${await res.text()}`);

    const body = await res.json();
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) throw new Error(`No content in Groq response: ${JSON.stringify(body)}`);
    // Strip markdown code fences if present
    return JSON.parse(raw.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, ''));
  }
}

export const ABSTRACT_INSTRUCTIONS = `"abstract": the paper's abstract copied VERBATIM from the text — only rejoin words hyphenated across line breaks and remove line breaks, do not summarize or rephrase. If the abstract is not in English but an English abstract is also present, use the English one. null if the text has no abstract.`;

export async function extractAbstract(pdfPath) {
  const { head, tail } = await extractText(pdfPath);
  const meta = await askGroqJson(`Return ONLY valid JSON: { ${ABSTRACT_INSTRUCTIONS} }

Text from the first pages:
---
${head}
---
Text from the last pages:
---
${tail}
---`);
  return typeof meta.abstract === 'string' && meta.abstract.trim().length > 80 ? meta.abstract.trim() : null;
}

// Renders a first-page preview and picks a key figure in a child process:
// pdf.js can crash on some embedded images in a way try/catch cannot catch,
// so a bad PDF only loses its figure instead of killing the whole run.
export function renderAssets(pdfPath, slug) {
  fs.mkdirSync(THUMB_DIR, { recursive: true });
  fs.mkdirSync(FIGURE_DIR, { recursive: true });
  const thumbPath = path.join(THUMB_DIR, `${slug}.webp`);
  const figurePath = path.join(FIGURE_DIR, `${slug}.webp`);
  fs.rmSync(thumbPath, { force: true });
  fs.rmSync(figurePath, { force: true });

  const result = spawnSync(process.execPath, [WORKER, pdfPath, thumbPath, figurePath], {
    stdio: 'inherit',
    timeout: 180_000,
  });
  if (result.status !== 0) console.warn(`Asset worker exited early for ${slug} — keeping whatever it produced.`);

  return {
    thumbnail: fs.existsSync(thumbPath) ? `/papers/thumbs/${slug}.webp` : null,
    figure: fs.existsSync(figurePath) ? `/papers/figures/${slug}.webp` : null,
  };
}

// Sets (or removes, when value is null) a single-line frontmatter field.
// JSON.stringify output is a valid YAML double-quoted scalar.
export function setFrontmatterField(content, key, value) {
  const line = value == null ? null : `${key}: ${typeof value === 'string' ? JSON.stringify(value) : value}`;
  const re = new RegExp(`^${key}:.*$\\n?`, 'm');
  if (re.test(content)) return content.replace(re, line ? `${line}\n` : '');
  if (!line) return content;
  return content.replace(/^---\n([\s\S]*?)\n---/, (_, fm) => `---\n${fm}\n${line}\n---`);
}

export const normalizeTitle = t => (t ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
