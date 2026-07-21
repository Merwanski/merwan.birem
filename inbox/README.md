# Inbox — Drop Zone

Drop files here to publish content automatically. GitHub Actions picks them up, processes them with AI, and creates pages on your site.

## Papers (`inbox/papers/`)

Drop a **PDF** of a research paper.

**What happens:**
1. GitHub Actions detects the new file on push to `main`
2. Claude extracts: title, authors, year, venue, abstract, tags, DOI
3. A Markdown file is created in `src/content/papers/`
4. The PDF is copied to `public/papers/`
5. The site rebuilds and the paper is live at `/papers/<slug>`

**Naming tip:** You can name the PDF anything — the title is extracted from content, not filename.

---

## Travels (`inbox/travels/`)

Drop a **folder** named `YYYY-MM-DD-city-country` (e.g. `2024-08-15-kyoto-japan`) containing photos and, optionally, a `notes.md` with rough jotted notes.

**What happens:**
1. GitHub Actions detects the new folder on push to `main`
2. Coordinates come from photo GPS EXIF data, or a free OpenStreetMap geocode of the city/country if no photo has GPS
3. Photos are resized/compressed (and HEIC converted to JPEG) and copied to `public/travels/<slug>/`
4. Groq (free-tier Llama) writes a short narrative and tags from `notes.md` (or a minimal entry if none is provided)
5. A Markdown file is created in `src/content/travels/`, the raw upload folder is removed (optimized copies already live in `public/travels/`)
6. The site rebuilds and the trip is live at `/travels/<slug>`

---

## Conferences (`inbox/conferences/`)

_Coming soon_ — Drop 1-2 images + a `notes.txt` file describing the event.

---

## Milestones (`inbox/milestones/`)

_Coming soon_ — Drop a `milestone.txt` with: title, date, category, and a short description.

---

## Setup Required

Before automation works, add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):
- `ANTHROPIC_API_KEY` — your Anthropic API key (used by the papers pipeline)
- `GROQ_API_KEY` — your free Groq API key from console.groq.com/keys (used by the travels pipeline)
