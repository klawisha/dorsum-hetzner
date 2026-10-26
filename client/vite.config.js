import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: { host: '127.0.0.1', proxy: { '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') } } },
  plugins: [
    react(),
    tailwindcss(),
  ],
})