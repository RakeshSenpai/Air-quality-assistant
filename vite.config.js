import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

const proxy = { '/api/v1': { target: 'http://127.0.0.1:5001', changeOrigin: true } }

function productionPolicy(mode) {
  const configured = (process.env.VITE_API_BASE_URL ?? loadEnv(mode, process.cwd()).VITE_API_BASE_URL ?? '').trim()
  let apiOrigin = ''
  if (configured) {
    const url = new URL(configured)
    if (url.protocol !== 'https:' || ![url.origin, url.origin + '/'].includes(configured))
      throw new Error('VITE_API_BASE_URL must be an HTTPS origin with no path, query, or credentials.')
    apiOrigin = ' ' + url.origin
  }
  const content = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://tile.openstreetmap.org",
    "font-src 'self'",
    "connect-src 'self' https://api.bigdatacloud.net" + apiOrigin,
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
  return {
    name: 'production-content-security-policy',
    transformIndexHtml: { order: 'pre', handler: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content }, injectTo: 'head-prepend' },
    ] },
  }
}

export default defineConfig(({ command, isPreview, mode }) => ({
  define: { __AQI_DEV_SERVER__: JSON.stringify(command === 'serve' && !isPreview) },
  server: { proxy },
  preview: { proxy },
  plugins: [react(), tailwind(), ...(command === 'build' ? [productionPolicy(mode)] : [])],
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
}))
