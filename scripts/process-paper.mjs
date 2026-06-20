/**
 * Processes a PDF from inbox/papers/ using Claude AI.
 * Extracts metadata and generates a Markdown content file.
 *
 * Usage: node scripts/process-paper.mjs <path-to-pdf>
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';

// pdf-parse is installed temporarily during CI
const { default: pdfParse } = await import('pdf-parse').catch(() => {
  console.error('pdf-parse not available — install it first: npm install pdf-parse');
  process.exit(1);
});

const pdfPath = process.argv[2];
if (!pdfPath || !fs.existsSync(pdfPath)) {
  console.error(`File not found: ${pdfPath}`);
  process.exit(1);
}

console.log(`Reading PDF: ${pdfPath}`);
const pdfBuffer = fs.readFileSync(pdfPath);
const parsed = await pdfParse(pdfBuffer);

// Truncate to ~8000 chars to stay within token limits for extraction
const text = parsed.text.slice(0, 8000);

const client = new Anthropic();

console.log('Calling Claude to extract metadata...');
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [
    {
      role: 'user',
      content: `Extract structured metadata from this academic paper text. Return ONLY valid JSON with these fields:
{
  "title": "exact paper title",
  "authors": ["Author One", "Author Two"],
  "year": 2024,
  "venue": "Conference or Journal name (or null)",
  "abstract": "the paper abstract (1-3 sentences max, summarize if needed)",
  "tags": ["keyword1", "keyword2", "keyword3"],
  "doi": "doi string if present (or null)"
}

Paper text:
---
${text}
---`,
    },
  ],
});

let meta;
try {
  const raw = response.content[0].text.trim();
  // Strip markdown code fences if present
  const jsonStr = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  meta = JSON.parse(jsonStr);
} catch (err) {
  console.error('Failed to parse Claude response:', response.content[0].text);
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
const mdPath = `src/content/papers/${filename}.md`;

// Copy PDF to public/
fs.copyFileSync(pdfPath, pdfDest);
console.log(`Copied PDF → ${pdfDest}`);

// Generate Markdown frontmatter
const frontmatter = [
  '---',
  `title: "${meta.title.replace(/"/g, '\\"')}"`,
  `authors:`,
  ...meta.authors.map(a => `  - "${a.replace(/"/g, '\\"')}"`),
  `year: ${meta.year}`,
  meta.venue ? `venue: "${meta.venue}"` : null,
  `abstract: "${meta.abstract.replace(/"/g, '\\"')}"`,
  `pdf_url: "/papers/${filename}.pdf"`,
  meta.doi ? `doi: "${meta.doi}"` : null,
  `tags:`,
  ...meta.tags.map(t => `  - ${t}`),
  `featured: false`,
  '---',
  '',
  '<!-- Extended notes, figures, or commentary can go here -->',
  '',
].filter(line => line !== null).join('\n');

fs.writeFileSync(mdPath, frontmatter);
console.log(`Created content file → ${mdPath}`);
console.log('Done.');
