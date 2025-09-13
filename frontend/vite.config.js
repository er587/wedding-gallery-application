import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: [
      'localhost',         // allow local
      '127.0.0.1',         // allow 
      '*.replit.dev',
      '0e1efad5-cfaf-4762-bbde-543dc8094838-00-2yutrstchfwzz.spock.replit.dev',
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
})
