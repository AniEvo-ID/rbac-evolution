import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const apiPort = process.env.API_PORT ?? '4000'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // In dev, the SPA runs on Vite and forwards /api to the Express server.
    proxy: { '/api': `http://localhost:${apiPort}` },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
})
