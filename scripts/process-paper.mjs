/**
 * Processes a PDF from inbox/papers/ using Groq's free-tier LLM API.
 * Extracts metadata + the verbatim abstract, renders a first-page preview and
 * a key figure, and generates a Markdown content file.
 *
 * If the PDF is already on the site (same file, or same title), the existing
 * entry is updated (abstract, preview, figure) instead of creating a duplicate —
 * hand-curated fields like title, authors and venue are left alone.
 *
 * Usage: node scripts/process-paper.mjs <path-to-pdf>
 * Requires: GROQ_API_KEY env var (free key at console.groq.com)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  ABSTRACT_INSTRUCTIONS,
  askGroqJson,
  extractText,
  normalizeTitle,
  renderAssets,
  setFrontmatterField,
} from './lib/papers.mjs';

const CONTENT_DIR = 'src/content/papers';

const pdfPath = process.argv[2];
if (!pdfPath || !fs.existsSync(pdfPath)) {
  console.error(`File not found: ${pdfPath}`);
  process.exit(1);
}

console.log(`Reading PDF: ${pdfPath}`);
const { head, tail } = await extractText(pdfPath);

console.log('Calling Groq to extract metadata...');
let meta;
try {
  meta = await askGroqJson(`Extract structured metadata from this academic paper text. Return ONLY valid JSON with these fields:
{
  "title": "exact paper title",
  "authors": ["Author One", "Author Two"],
  "year": 2024,
  "venue": "Conference or Journal name (or null)",
  ${ABSTRACT_INSTRUCTIONS},
  "tags": ["keyword1", "keyword2", "keyword3"],
  "doi": "doi string if present (or null)"
}

Text from the first pages:
---
${head}
---
Text from the last pages:
---
${tail}
---`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

// Guard against missing fields so a sloppy response can't crash the frontmatter step
meta.authors = Array.isArray(meta.authors) ? meta.authors : [];
meta.tags = Array.isArray(meta.tags) ? meta.tags : [];
meta.abstract = typeof meta.abstract === 'string' ? meta.abstract.trim() : '';
if (!meta.title) {
  console.error('Groq response missing title:', JSON.stringify(meta));
  process.exit(1);
}

// --- Is this paper already on the site? Match by identical PDF, then by title ---
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const pdfHash = sha(pdfPath);
const existing = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md')).find(f => {
  const content = fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8');
  const pdfUrl = content.match(/^pdf_url:\s*"?([^"\n\r]+)"?/m)?.[1];
  const existingPdf = pdfUrl && path.join('public', pdfUrl.replace(/^\//, ''));
  if (existingPdf && fs.existsSync(existingPdf) && sha(existingPdf) === pdfHash) return true;
  const title = content.match(/^title:\s*"?(.+?)"?\s*$/m)?.[1];
  return normalizeTitle(title) === normalizeTitle(meta.title);
});

if (existing) {
  const slug = existing.replace(/\.md$/, '');
  const mdPath = path.join(CONTENT_DIR, existing);
  console.log(`Already on the site as ${slug} — updating abstract, preview and figure.`);

  let content = fs.readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n');
  const pdfUrl = content.match(/^pdf_url:\s*"?([^"\n]+)"?/m)?.[1];
  let sitePdf = pdfUrl && path.join('public', pdfUrl.replace(/^\//, ''));
  if (!sitePdf || !fs.existsSync(sitePdf)) {
    // Entry had no PDF yet — attach this one
    sitePdf = `public/papers/${slug}.pdf`;
    fs.copyFileSync(pdfPath, sitePdf);
    content = setFrontmatterField(content, 'pdf_url', `/papers/${slug}.pdf`);
    console.log(`Copied PDF → ${sitePdf}`);
  }
  if (meta.abstract.length > 80) content = setFrontmatterField(content, 'abstract', meta.abstract);
  const { thumbnail, figure } = renderAssets(sitePdf, slug);
  content = setFrontmatterField(content, 'thumbnail', thumbnail);
  content = setFrontmatterField(content, 'figure', figure);
  fs.writeFileSync(mdPath, content);
  console.log(`Updated content file → ${mdPath}`);
  console.log('Done.');
  process.exit(0);
}

// --- New paper ---
if (!meta.year) {
  console.error(`No publication year found in "${meta.title}" — add the paper by hand or re-upload a version that states the year.`);
  process.exit(1);
}

// Generate a URL-safe slug from the title
const slug = meta.title
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .slice(0, 80);

const filename = `${meta.year}-${slug}`;
const pdfDest = `public/papers/${filename}.pdf`;
const mdPath = `${CONTENT_DIR}/${filename}.md`;

// Copy PDF to public/
fs.copyFileSync(pdfPath, pdfDest);
console.log(`Copied PDF → ${pdfDest}`);

const { thumbnail, figure } = renderAssets(pdfDest, filename);

// Generate Markdown frontmatter (JSON strings are valid YAML double-quoted scalars)
const q = s => JSON.stringify(String(s));
const frontmatter = [
  '---',
  `title: ${q(meta.title)}`,
  `authors:`,
  ...meta.authors.map(a => `  - ${q(a)}`),
  `year: ${meta.year}`,
  meta.venue ? `venue: ${q(meta.venue)}` : null,
  `abstract: ${q(meta.abstract)}`,
  `pdf_url: "/papers/${filename}.pdf"`,
  meta.doi ? `doi: ${q(meta.doi)}` : null,
  `tags:`,
  ...meta.tags.map(t => `  - ${q(t)}`),
  `featured: false`,
  thumbnail ? `thumbnail: ${q(thumbnail)}` : null,
  figure ? `figure: ${q(figure)}` : null,
  '---',
  '',
  '<!-- Extended notes, figures, or commentary can go here -->',
  '',
].filter(line => line !== null).join('\n');

fs.writeFileSync(mdPath, frontmatter);
console.log(`Created content file → ${mdPath}`);
console.log('Done.');
