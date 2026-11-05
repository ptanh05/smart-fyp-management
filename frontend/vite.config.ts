import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  let apiUrl = env.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL || ''
  if (apiUrl.includes('smart-fyp-backend.onrender.com')) {
    apiUrl = apiUrl.replace('smart-fyp-backend.onrender.com', 'smart-fyp-management.onrender.com')
  }
  if (apiUrl.includes('smart-fyp-main-backend.onrender.com')) {
    apiUrl = apiUrl.replace('smart-fyp-main-backend.onrender.com', 'smart-fyp-management.onrender.com')
  }

  let wsUrl = env.VITE_WS_URL || process.env.VITE_WS_URL || ''
  if (wsUrl.includes('smart-fyp-backend.onrender.com')) {
    wsUrl = wsUrl.replace('smart-fyp-backend.onrender.com', 'smart-fyp-management.onrender.com')
  }
  if (wsUrl.includes('smart-fyp-main-backend.onrender.com')) {
    wsUrl = wsUrl.replace('smart-fyp-main-backend.onrender.com', 'smart-fyp-management.onrender.com')
  }

  return {
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiUrl || 'https://smart-fyp-management.onrender.com/app'),
      'import.meta.env.VITE_WS_URL': JSON.stringify(wsUrl || 'wss://smart-fyp-management.onrender.com/ws'),
    },
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
    },
    server: {
      port: 3000,
      proxy: {
        '/app': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/documents': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/media': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/doc_templates': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/ws': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
