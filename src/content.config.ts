import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const papers = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/papers' }),
  schema: z.object({
    title: z.string(),
    authors: z.array(z.string()),
    year: z.number(),
    venue: z.string().optional(),
    abstract: z.string(),
    pdf_url: z.string().nullable().optional(),
    doi: z.string().nullable().optional(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    citations: z.number().optional(),
    thumbnail: z.string().nullable().optional(),
    figure: z.string().nullable().optional(),
  }),
});

const milestones = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/milestones' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.enum(['professional', 'personal', 'academic', 'travel', 'family']),
    summary: z.string(),
    featured: z.boolean().default(false),
    // How precisely the date is known: shown as "2011", "Sep 2010" or "20 Jun 2026"
    precision: z.enum(['year', 'month', 'day']).default('day'),
  }),
});

const impossibleList = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/impossible-list' }),
  schema: z.object({
    title: z.string(),
    category: z.enum(['travel', 'learning', 'physical', 'professional', 'family', 'creative', 'social']),
    status: z.enum(['todo', 'in-progress', 'done']),
    visibility: z.enum(['public', 'private']).default('public'),
    date_achieved: z.coerce.date().optional(),
    summary: z.string().optional(),
  }),
});

const travels = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/travels' }),
  schema: z.object({
    title: z.string(),
    country: z.string(),
    flag: z.string(),
    city: z.string(),
    date: z.coerce.date(),
    lat: z.number(),
    lng: z.number(),
    highlights: z.string(),
    tags: z.array(z.string()).default([]),
    cover: z.string().nullable().optional(),
    photos: z.array(z.string()).default([]),
  }),
});

// Projects with a detail page. Projects without details stay in the list in
// src/pages/projects/index.astro.
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    name: z.string(),
    years: z.string(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false), // shown under "Key Projects" on the home page
    order: z.number().default(100), // home page order, lowest first
    role: z.string().optional(),
    facts: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
    links: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
    youtube: z.string().optional(), // video id
    gallery: z.array(z.object({ src: z.string(), caption: z.string() })).default([]),
    papers: z.array(z.string()).default([]), // paper slugs in src/content/papers
    // Media still to come: shown as "under construction" placeholders
    pending: z.array(z.object({ label: z.string(), kind: z.enum(['image', 'video', 'photo']).default('image') })).default([]),
  }),
});

export const collections = { papers, milestones, 'impossible-list': impossibleList, travels, projects };
