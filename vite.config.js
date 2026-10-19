import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',   // relative asset paths: works at the root locally and under /guitarTabs/ on GitHub Pages
  plugins: [react()],
});
