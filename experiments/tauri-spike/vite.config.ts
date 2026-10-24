import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const spikeDir = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

export default defineConfig({
  root: spikeDir,
  resolve: {
    alias: {
      '@renderer': fileURLToPath(new URL('../../src/renderer/src', import.meta.url))
    }
  },
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    fs: { allow: [repoRoot] }
  },
  build: { outDir: 'dist', emptyOutDir: true }
})
