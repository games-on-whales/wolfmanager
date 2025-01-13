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
  }
}) 