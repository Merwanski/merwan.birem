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
    country: z.string(),
    flag: z.string(),
    year: z.string(),
    cities: z.array(z.string()),
    highlights: z.string(),
    tags: z.array(z.string()).default([]),
    order: z.number().default(99),
  }),
});

export const collections = { papers, milestones, 'impossible-list': impossibleList, travels };
