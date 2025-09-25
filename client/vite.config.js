import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: resolve(__dirname, 'src'),
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, '../public/dashboard'),
    emptyOutDir: true,
    manifest: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: resolve(__dirname, 'src/main.jsx')
    }
  }
});
