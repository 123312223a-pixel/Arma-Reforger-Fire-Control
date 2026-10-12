import { defineConfig } from 'vite';
export default defineConfig({
  root: 'src',
  base: './',
  publicDir: false,
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
  server: { host: '127.0.0.1', port: 1420, strictPort: true },
  clearScreen: false
});
