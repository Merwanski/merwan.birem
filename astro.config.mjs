// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://merwanski.github.io',
  base: '/merwan.birem',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
