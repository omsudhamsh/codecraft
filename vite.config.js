import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// BASE_PATH lets the same build target Vercel ("/") and GitHub Pages ("/codecraft/").
export default defineConfig(({ mode }) => ({
  base: process.env.BASE_PATH ?? (mode === 'pages' ? '/codecraft/' : '/'),
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
}));
