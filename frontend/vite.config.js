import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/chat': {
        target: 'http://127.0.0.1:10000',
        changeOrigin: true,
      },
      '/api/groups': {
        target: 'http://127.0.0.1:10000',
        changeOrigin: true,
        ws: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:10000',
        changeOrigin: true,
        ws: true,
      },
      '/auth': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      }
    }
  }
})
