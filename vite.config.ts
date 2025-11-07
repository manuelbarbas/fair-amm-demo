import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  resolve: {
    alias: {
      // Polyfills for Node.js modules
      buffer: 'buffer',
      process: 'process',
    },
  },
  optimizeDeps: {
    include: [
      'buffer',
      'process/browser',
    ],
    // Force pre-bundling of problematic dependencies
    force: true,
  },
  server: {
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..'],
    },
  },
})
