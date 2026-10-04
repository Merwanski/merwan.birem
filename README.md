# merwan.birem

Personal site of Merwan Birem: research, projects, travels, milestones and the Impossible List.
Live at **https://merwanski.github.io/merwan.birem/**.

Built with Astro + Tailwind CSS, deployed to GitHub Pages by GitHub Actions.

## Commands

| Command           | Action                                      |
| :---------------- | :------------------------------------------ |
| `npm install`     | Install dependencies                        |
| `npm run dev`     | Local dev server at `localhost:4321`        |
| `npm run build`   | Build the site to `./dist/`                 |
| `npm run preview` | Preview the build locally                   |

If deleted content still shows up locally: `rm -rf node_modules/.astro .astro dist`.

## Publishing content

See [`inbox/README.md`](inbox/README.md). In short, drop a paper PDF in `inbox/papers/` or a trip folder in `inbox/travels/`, push, and GitHub Actions does the rest (Groq free-tier LLM, needs the `GROQ_API_KEY` secret).

Other content is Markdown in `src/content/` (milestones, impossible list) or lives directly in `src/pages/` (`/now`, projects, home).

## Automation

| Workflow | When | What |
|---|---|---|
| `deploy.yml` | every push | Build and deploy to GitHub Pages |
| `process-paper.yml` | PDF pushed to `inbox/papers/` | Metadata, abstract, preview and figure → paper page |
| `process-travel.yml` | folder pushed to `inbox/travels/` | Location, photos and narrative → trip page |
| `refresh-citations.yml` | weekly | Update citation counts |
| `sync-medium.yml` | twice a month | Sync Medium posts |
| `site-health.yml` | 1st of each month | Open a **Site health report** issue |

## Keeping it up to date

The monthly **Site health report** issue checks that every page loads, runs Lighthouse, lists failed workflows and flags stale content. Work through it, then close it (the next report also closes any that are still open).

| Cadence | Task |
|---|---|
| Automatic | Deploys, citations, Medium sync, health report |
| Monthly (~15 min) | Go through the health report: [Search Console](https://search.google.com/search-console?resource_id=https%3A%2F%2Fmerwanski.github.io%2Fmerwan.birem%2F) numbers, fix anything flagged, add new milestones, papers and talks |
| Weekly, until the backlog is done | 1–3 old trips into `inbox/travels/` |
| Quarterly | Rewrite `/now`, review the Impossible List, refresh the CV (replace `public/cv/Merwan_Birem_CV.pdf`, same name) |
| Yearly | Dependency upgrades (`npm outdated`, Dependabot alerts) |

`public/googleb0670959a0301cae.html` is the Search Console ownership file. Keep it, or the property stops being verified.
