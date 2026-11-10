import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const page = (file: string) => fileURLToPath(new URL(file, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Two pages: the host remote (index.html) and the party page guests open on their phones (guest.html).
    rollupOptions: { input: { main: page('index.html'), guest: page('guest.html') } },
  },
  server: {
    // Forward API calls so the browser sees one origin (no CORS setup needed).
    // API_URL / GUEST_API_URL are set by docker compose; the defaults point at backends on the host.
    proxy: {
      '/api': process.env.API_URL ?? 'http://127.0.0.1:8000',
      '/guest-api': process.env.GUEST_API_URL ?? 'http://127.0.0.1:8002',
    },
  },
})
