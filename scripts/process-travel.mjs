/**
 * Processes a trip folder from inbox/travels/ using Groq's free-tier LLM API.
 * Folder naming convention: YYYY-MM-DD-city-country (e.g. 2024-08-15-kyoto-japan)
 *
 * - Reads GPS coordinates from photo EXIF data, falling back to a free
 *   OpenStreetMap Nominatim geocode of "city, country" when no photo has GPS.
 * - Optimizes photos (resize + compress, HEIC -> JPEG) with sharp.
 * - Sends any notes.md to Groq (Llama) to generate a short narrative + tags.
 * - Writes src/content/travels/<slug>.md and copies photos to public/travels/<slug>/.
 *
 * Usage: node scripts/process-travel.mjs <path-to-inbox-folder>
 * Requires: GROQ_API_KEY env var (free key at console.groq.com)
 */

import fs from 'fs';
import path from 'path';

const exifr = await import('exifr').then(m => m.default ?? m).catch(() => {
  console.error('exifr not available — install it first: npm install exifr');
  process.exit(1);
});
const sharp = await import('sharp').then(m => m.default ?? m).catch(() => {
  console.error('sharp not available.');
  process.exit(1);
});

const folderPath = process.argv[2];
if (!folderPath || !fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
  console.error(`Folder not found: ${folderPath}`);
  process.exit(1);
}

const folderName = path.basename(folderPath);
const match = folderName.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)-([a-z-]+)$/i);
if (!match) {
  console.error(`Folder name "${folderName}" doesn't match YYYY-MM-DD-city-country`);
  process.exit(1);
}
const [, yyyy, mm, dd, citySlug, countrySlug] = match;
const date = `${yyyy}-${mm}-${dd}`;
const cityGuess = citySlug.replace(/-/g, ' ');
const countryGuess = countrySlug.replace(/-/g, ' ');

const IMAGE_EXT = /\.(jpe?g|png|heic|heif)$/i;
const files = fs.readdirSync(folderPath);
const photoFiles = files.filter(f => IMAGE_EXT.test(f)).sort();
const notesPath = files.find(f => ['notes.md', 'notes.txt'].includes(f.toLowerCase()));
const notes = notesPath ? fs.readFileSync(path.join(folderPath, notesPath), 'utf-8') : '';

console.log(`Found ${photoFiles.length} photo(s) in ${folderName}`);

// --- 1. Try to get GPS coordinates from photo EXIF ---
let lat = null;
let lng = null;
for (const photo of photoFiles) {
  try {
    const gps = await exifr.gps(path.join(folderPath, photo));
    if (gps?.latitude && gps?.longitude) {
      lat = gps.latitude;
      lng = gps.longitude;
      console.log(`GPS found in ${photo}: ${lat}, ${lng}`);
      break;
    }
  } catch {
    // no EXIF / unsupported format — keep trying other photos
  }
}

// --- 2. Fall back to free geocoding via OpenStreetMap Nominatim ---
if (lat === null || lng === null) {
  console.log('No GPS in photos, falling back to Nominatim geocode...');
  const query = encodeURIComponent(`${cityGuess}, ${countryGuess}`);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
    headers: { 'User-Agent': 'merwanbirem-online-travel-pipeline/1.0 (github.com/Merwanski/merwan.birem)' },
  });
  const results = await res.json();
  if (results?.[0]) {
    lat = parseFloat(results[0].lat);
    lng = parseFloat(results[0].lon);
    console.log(`Geocoded to: ${lat}, ${lng}`);
  } else {
    console.error(`Could not geocode "${cityGuess}, ${countryGuess}" — set lat/lng manually after generation.`);
    lat = 0;
    lng = 0;
  }
}

// --- 3. Optimize photos and copy to public/travels/<slug>/ ---
const slug = folderName.toLowerCase();
const publicDir = `public/travels/${slug}`;
fs.mkdirSync(publicDir, { recursive: true });

const outputPhotos = [];
for (const photo of photoFiles) {
  const srcPath = path.join(folderPath, photo);
  const base = path.parse(photo).name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const destName = `${base}.jpg`;
  const destPath = path.join(publicDir, destName);
  try {
    await sharp(srcPath).rotate().resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(destPath);
    outputPhotos.push(`/travels/${slug}/${destName}`);
    console.log(`Optimized ${photo} -> ${destPath}`);
  } catch (err) {
    console.error(`Skipping ${photo} (could not process): ${err.message}`);
  }
}

// --- 4. Ask Groq (free tier) for a narrative + tags from notes.md (or folder name alone) ---
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error('GROQ_API_KEY not set — get a free key at https://console.groq.com/keys');
  process.exit(1);
}
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const knownTags = ['Culture', 'Food', 'History', 'Nature', 'Adventure', 'Architecture', 'Desert', 'Art', 'Aurora', 'Home', 'Family'];

console.log(`Calling Groq (${GROQ_MODEL}) to write up the trip...`);
const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${GROQ_API_KEY}`,
  },
  body: JSON.stringify({
    model: GROQ_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: `Write up a short personal trip log entry. Return ONLY valid JSON with these fields:
{
  "title": "City, Country",
  "city": "properly capitalized city name",
  "country": "properly capitalized country name",
  "flag": "the country's flag emoji",
  "highlights": "2-4 sentence first-person-adjacent narrative capturing the trip (warm, concise, no cliches)",
  "tags": ["pick 1-4 from this list, or add a new short one-word tag if none fit: ${knownTags.join(', ')}"]
}

Folder name: ${folderName} (guessed city: "${cityGuess}", guessed country: "${countryGuess}")
Date: ${date}
Raw notes (may be empty, terse, or bullet points — polish them, don't invent facts not implied by them):
---
${notes || '(no notes provided — write a minimal, generic entry from the location and date alone)'}
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
  const jsonStr = rawContent.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  meta = JSON.parse(jsonStr);
} catch (err) {
  console.error('Failed to parse Groq response:', rawContent);
  process.exit(1);
}

// --- 5. Write the content file ---
const mdPath = `src/content/travels/${slug}.md`;
const frontmatter = [
  '---',
  `title: "${meta.title.replace(/"/g, '\\"')}"`,
  `country: "${meta.country.replace(/"/g, '\\"')}"`,
  `flag: "${meta.flag}"`,
  `city: "${meta.city.replace(/"/g, '\\"')}"`,
  `date: ${date}`,
  `lat: ${lat}`,
  `lng: ${lng}`,
  `highlights: "${meta.highlights.replace(/"/g, '\\"')}"`,
  meta.tags?.length ? `tags:` : `tags: []`,
  ...(meta.tags ?? []).map(t => `  - ${t}`),
  outputPhotos.length ? `cover: "${outputPhotos[0]}"` : `cover: null`,
  outputPhotos.length ? `photos:` : `photos: []`,
  ...outputPhotos.map(p => `  - "${p}"`),
  '---',
  '',
].join('\n');

fs.mkdirSync('src/content/travels', { recursive: true });
fs.writeFileSync(mdPath, frontmatter);
console.log(`Created content file -> ${mdPath}`);
console.log('Done.');
