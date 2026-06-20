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

## Conferences (`inbox/conferences/`)

_Coming soon_ — Drop 1-2 images + a `notes.txt` file describing the event.

---

## Milestones (`inbox/milestones/`)

_Coming soon_ — Drop a `milestone.txt` with: title, date, category, and a short description.

---

## Setup Required

Before automation works, add this secret to your GitHub repository:
- `ANTHROPIC_API_KEY` — your Anthropic API key (Settings → Secrets → Actions)
