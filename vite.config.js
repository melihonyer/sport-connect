import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_TIME__: JSON.stringify(Date.now()),
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin.html',
      },
      output: {
        manualChunks: {
          react:    ['react', 'react-dom'],
          lucide:   ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'https://muuvlink.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
