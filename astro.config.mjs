// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://merwanski.github.io',
  base: '/merwan.birem',
  output: 'static',
  // Astro 7 changed the default to 'jsx' (React-style whitespace stripping),
  // which drops spaces between inline elements. Keep the v6 behaviour.
  compressHTML: true,
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
