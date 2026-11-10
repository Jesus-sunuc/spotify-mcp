import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Forward /api to the FastAPI backend so the browser sees one origin (no CORS setup needed).
    // API_URL is set by docker compose to the api service; defaults to a backend on the host.
    proxy: { '/api': process.env.API_URL ?? 'http://127.0.0.1:8000' },
  },
})
