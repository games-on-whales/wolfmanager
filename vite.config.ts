import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 9971,
    host: true
  },
  preview: {
    port: 9971,
    host: true
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-mui': ['@mui/material', '@mui/icons-material'],
          'vendor-react': ['react', 'react-dom'],
          'vendor-utils': ['lodash']
        }
      }
    }
  }
}) 