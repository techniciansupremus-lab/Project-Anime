import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/anilist-proxy': {
        target: 'https://graphql.anilist.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/anilist-proxy/, ''),
      },
      // Forward /api requests to the local backend so mobile/LAN devices don't
      // need VITE_API_BASE — relative requests just work through the dev server.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
})
