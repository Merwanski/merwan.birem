# Handoff: merwan.birem site

_Last updated: 5 October 2026 (end of session). Read this first in the next session._

## Goal

A personal brand, portfolio and **legacy site for my kids**, at https://merwanski.github.io/merwan.birem/. It should:

- be **up to date**: /now, CV, projects, papers, milestones;
- **stay up to date with little effort**, through inbox automations and a monthly health report;
- **look good**: dark blue design in the style of Brittany Chiang, with the Ecoriz palette and no text-only pages.

## Where we are

### Done (2026-09-30 → 2026-10-05)

| Area | State |
|---|---|
| **Hosting** | GitHub Pages builds from GitHub Actions (the old Jekyll build is gone). Astro **7.3.5**, `npm audit` reports 0 vulnerabilities. |
| **Search** | Google Search Console verified (`public/googleb0670959a0301cae.html`; **keep this file**). |
| **Pipelines** | Papers and travels both run on **Groq** (`GROQ_API_KEY`; model `openai/gpt-oss-120b`). There is no Anthropic key. Both were tested end to end in CI. |
| **Papers** | 22 papers, each with its real abstract (from the PDF), a first-page preview and a key figure (18 of them). Re-uploading an existing PDF updates that paper instead of creating a duplicate. |
| **Projects** | Detail pages for ALARMM, ROBOCONS (2026–2029), QUALMA (demo video) and FROGS/CAD2GraspMonitor, stored as Markdown in `src/content/projects/`. The home page's Key projects read from the same files. |
| **/now** | Refreshed 2026-10-04 (ALARMM, ROBOCONS, 2027 EU proposals for Cluster 4 and Cluster 5, two personal projects). |
| **CV** | `public/cv/Merwan_Birem_CV.pdf`: keep this name and replace the file to update it. The old CV link had been broken since launch. |
| **Milestones** | 14 career and academic milestones, 2010 → 2026. Dates have a `precision` field (year/month/day). |
| **Impossible List** | 17 placeholder goals with an "under construction" banner. Only "publish a paper" is done. |
| **Design** | Ecoriz blues. **Dark is the default**, and the toggle switches to light. Brittany Chiang-style home page (fixed left column, section nav, scrolling cards). Hovering an item lights it up with a spotlight while the rest dims. Clearer section titles with an accent bar. Accessibility scores 100. |
| **Placeholders** | `src/components/Placeholder.astro` ("Under construction · will be updated soon") wherever content from you is missing. |
| **Upkeep** | `site-health.yml` opens a **health report issue on the 1st of each month**. The README describes the upkeep routine. |

### Open issues

| # | What | Who |
|---|---|---|
| **#14** | **Next-session improvements** (details below) | Claude |
| **#13** | Content for the placeholders: profile photo, ALARMM results video and images, ROBOCONS prototype images, milestone photos, project details | **Merwan** |
| #10 | October health report: tick the Search Console checks; **submit `sitemap-index.xml`** if that hasn't been done | Merwan |
| #6 | Design system leftovers: self-hosted fonts, `DESIGN.md` | Claude |
| #4 | Travels backlog 2011 → today (2–3 trips a week through `inbox/travels/`) | Merwan |
| #3 | Reminders: personal and family milestones, replacing the placeholder Impossible List goals with your own, checking approximate dates | Merwan |
| #8 | Roadmap: conferences pipeline, email-to-inbox, translations (FR/NL/AR), custom domain | Later |

## Next session: plan

### 1. Improvements from #14 (agreed 2026-10-05)
1. **Maps back to the light style**: remove the dark filter on Leaflet tiles in `src/styles/global.css` (`:root[data-theme='dark'] .leaflet-tile`).
2. **Milestones timeline**: a horizontal, clickable timeline at the top of `/milestones`, with dots per milestone coloured by category.
3. **Impossible List "memento mori" side panel**: weeks lived and weeks left until 80, until 100 and until average life expectancy, plus a weeks grid. **Needs your birth date or year**, and whether it can be shown publicly. Verify the life-expectancy source.
4. **Travels visited-countries panel**: country flags joined in visit order, with years and trip counts, linking to each country's trips.

### 2. Quick checks at the start
- [ ] **Dependabot still listed 24 open alerts** on 2026-10-05, although Astro 7.3.5, sharp 0.35.5 and the other merged versions fix all of them. Check whether they closed after a rescan; if not, look at `gh api repos/Merwanski/merwan.birem/dependabot/alerts` and dismiss them as fixed, or bump whatever is still flagged.
- [ ] Delete the leftover folder `.claude/worktrees/agent-af79f44a3bd9cb2c5`. It's untracked, and was locked by the previous session.
- [ ] Read the latest health report issue (label `health`).

### 3. If Merwan has provided content (#13)
Swap the placeholders for the real files: put media in `public/projects/<id>/`, add them to `gallery` or `youtube`, and remove the matching `pending` entry in `src/content/projects/<id>.md`.

## Inputs needed from Merwan
- **Birth date or year** (for memento mori), and whether it may be public.
- **Profile photo**, ideally a 4:5 portrait.
- **ALARMM** results video and images; **ROBOCONS** prototype images.
- **Milestones**: personal and family moments, and photos.
- **Impossible List**: your own goals, each marked done or not done, and public or private.
- **Projects**: 1–2 sentences, years and tags for the projects still saying "Details to be added".

## Working notes for Claude
- Repo: `Merwanski/merwan.birem`, branch `main`. A push to `main` deploys, so check `gh run list -w deploy.yml`.
- **Check `git branch --show-current` before committing.** On 2026-10-05 a commit landed on a stale branch, and the output filter hid the push error.
- Shell quirk: long bash heredocs containing quotes can break. Write a script file with the Write tool and run it instead.
- Local preview: `npm run build && npx astro preview --port 4329`. If the Chrome extension's screenshots time out, the tab is hidden; use Lighthouse's `fullPageScreenshot` instead.
- Design tokens are in `src/styles/global.css` (`@theme`, overridden under `:root[data-theme='dark']`). Use semantic classes (`text-muted`, `bg-surface-2`, `chip`, `card`, `focus-list`, `heading-label`), never raw palette classes.
- Travel pages display `city` + `country`; the `title` field is never shown.
- Content style: write from the user's notes and sources only, and don't invent details. Keep `/now` short; details belong on the project pages.
