/**
 * Adds the verbatim abstract, a first-page preview and a key figure to papers
 * that already exist in src/content/papers/.
 *
 * Usage:
 *   node scripts/backfill-paper-assets.mjs                 # all papers
 *   node scripts/backfill-paper-assets.mjs <slug> [...]    # only these papers
 *   add --skip-abstract to only (re)render images
 * Requires: GROQ_API_KEY env var (unless --skip-abstract)
 */

import fs from 'fs';
import path from 'path';
import { extractAbstract, renderAssets, setFrontmatterField } from './lib/papers.mjs';

const CONTENT_DIR = 'src/content/papers';
const args = process.argv.slice(2);
const skipAbstract = args.includes('--skip-abstract');
const only = args.filter(a => !a.startsWith('--'));

const files = fs.readdirSync(CONTENT_DIR)
  .filter(f => f.endsWith('.md'))
  .filter(f => only.length === 0 || only.includes(f.replace(/\.md$/, '')));

let failed = 0;
for (const file of files) {
  const slug = file.replace(/\.md$/, '');
  const mdPath = path.join(CONTENT_DIR, file);
  let content = fs.readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n');

  const pdfUrl = content.match(/^pdf_url:\s*"?([^"\n]+)"?/m)?.[1];
  const pdfPath = pdfUrl ? path.join('public', pdfUrl.replace(/^\//, '')) : null;
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    console.log(`– ${slug}: no PDF, skipped`);
    continue;
  }

  console.log(`• ${slug}`);
  try {
    if (!skipAbstract) {
      const abstract = await extractAbstract(pdfPath);
      if (abstract) content = setFrontmatterField(content, 'abstract', abstract);
      else console.log('  abstract → not found, kept existing');
    }
    const { thumbnail, figure } = renderAssets(pdfPath, slug);
    content = setFrontmatterField(content, 'thumbnail', thumbnail);
    content = setFrontmatterField(content, 'figure', figure);
    fs.writeFileSync(mdPath, content);
  } catch (err) {
    console.error(`  failed: ${err.message}`);
    failed++;
  }
}

console.log(failed ? `Done with ${failed} failure(s).` : 'Done.');
process.exit(failed ? 1 : 0);
