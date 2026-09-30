/**
 * Processes a PDF from inbox/papers/ using Groq's free-tier LLM API.
 * Extracts metadata and generates a Markdown content file.
 *
 * Usage: node scripts/process-paper.mjs <path-to-pdf>
 * Requires: GROQ_API_KEY env var (free key at console.groq.com)
 */

import fs from 'fs';

// pdf-parse (v2 API) is installed temporarily during CI
const { PDFParse } = await import('pdf-parse').catch(() => {
  console.error('pdf-parse not available — install it first: npm install --no-save pdf-parse@^2');
  process.exit(1);
});

const pdfPath = process.argv[2];
if (!pdfPath || !fs.existsSync(pdfPath)) {
  console.error(`File not found: ${pdfPath}`);
  process.exit(1);
}

console.log(`Reading PDF: ${pdfPath}`);
const pdfBuffer = fs.readFileSync(pdfPath);
const parser = new PDFParse({ data: pdfBuffer });
const parsed = await parser.getText();
await parser.destroy();

// Truncate to ~8000 chars to stay within token limits for extraction
const text = parsed.text.slice(0, 8000);

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error('GROQ_API_KEY not set — get a free key at https://console.groq.com/keys');
  process.exit(1);
}
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

console.log(`Calling Groq (${GROQ_MODEL}) to extract metadata...`);
const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${GROQ_API_KEY}`,
  },
  body: JSON.stringify({
    model: GROQ_MODEL,
    max_tokens: 2048,
    reasoning_effort: 'low',
    response_format: { type: 'json_object' },
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
  }),
});

if (!groqRes.ok) {
  console.error(`Groq API error ${groqRes.status}: ${await groqRes.text()}`);
  process.exit(1);
}

const groqBody = await groqRes.json();
const rawContent = groqBody.choices?.[0]?.message?.content;
if (!rawContent) {
  console.error('No content in Groq response:', JSON.stringify(groqBody));
  process.exit(1);
}

let meta;
try {
  // Strip markdown code fences if present
  const jsonStr = rawContent.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  meta = JSON.parse(jsonStr);
} catch (err) {
  console.error('Failed to parse Groq response:', rawContent);
  process.exit(1);
}

// Guard against missing fields so a sloppy response can't crash the frontmatter step
meta.authors = Array.isArray(meta.authors) ? meta.authors : [];
meta.tags = Array.isArray(meta.tags) ? meta.tags : [];
meta.abstract = meta.abstract || '';
if (!meta.title || !meta.year) {
  console.error('Groq response missing title or year:', rawContent);
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
