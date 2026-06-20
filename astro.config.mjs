// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Update `site` with your GitHub username before deploying:
// e.g. 'https://merwanbirem.github.io'
export default defineConfig({
  site: 'https://merwanbirem.github.io',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
