import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          uppy: ['@uppy/core', '@uppy/dashboard', '@uppy/react', '@uppy/aws-s3'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: [
      'localhost',         // allow local
      '127.0.0.1',         // allow localhost IP
      '.replit.dev'        // allow all replit.dev subdomains
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
    },
    hmr: {
      clientPort: 443,
      port: 24678
    }
  },
})
