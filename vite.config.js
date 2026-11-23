import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwind()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) return 'react'
          if (id.includes('/node_modules/recharts/') || id.includes('/node_modules/d3-') || id.includes('/node_modules/victory-vendor/')) return 'charts'
        },
      },
    },
  },
})
