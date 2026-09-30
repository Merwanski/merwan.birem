/**
 * Child process spawned by renderAssets() in papers.mjs.
 * Writes a first-page preview, then scans the first pages for the largest
 * embedded raster figure. The best candidate is written after every page, so a
 * crash on a later page still leaves a usable figure behind.
 *
 * Usage: node paper-assets-worker.mjs <pdf> <thumb.webp> <figure.webp>
 */

import fs from 'fs';
import sharp from 'sharp';
import { PDFParse } from 'pdf-parse';

const [pdfPath, thumbPath, figurePath] = process.argv.slice(2);
const MAX_PAGES = 8;
const MIN_W = 400;
const MIN_H = 250;

const parser = new PDFParse({ data: fs.readFileSync(pdfPath) });

// 1. First-page preview
const shot = await parser.getScreenshot({ partial: [1], desiredWidth: 800, imageBuffer: true });
await sharp(Buffer.from(shot.pages[0].data)).webp({ quality: 80 }).toFile(thumbPath);
console.log(`  preview → ${thumbPath}`);

// 2. Key figure: largest embedded image that isn't a logo, banner or full-page scan
const { total } = await parser.getInfo();
let best = null;
for (let page = 1; page <= Math.min(MAX_PAGES, total); page++) {
  let images;
  try {
    images = (await parser.getImage({ partial: [page], imageThreshold: 100, imageBuffer: true })).pages[0]?.images ?? [];
  } catch {
    continue;
  }

  const candidates = images.filter(img => {
    const ratio = img.width / img.height;
    if (img.width < MIN_W || img.height < MIN_H) return false;
    if (ratio > 5 || ratio < 0.2) return false;
    // A lone portrait image on a page is almost always a scanned page, not a figure
    if (images.length === 1 && ratio > 0.65 && ratio < 0.8) return false;
    return true;
  });

  for (const img of candidates) {
    if (best && img.width * img.height <= best.width * best.height) continue;
    try {
      await sharp(Buffer.from(img.data))
        .resize({ width: 1200, withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .webp({ quality: 82 })
        .toFile(figurePath);
      best = { width: img.width, height: img.height, page };
    } catch {
      // Undecodable image data — skip it
    }
  }
}

console.log(best ? `  figure  → ${figurePath} (page ${best.page}, ${best.width}×${best.height})` : '  figure  → none found');
await parser.destroy();
