import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({

  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    port: 6173,
    strictPort: true,
  },
  build: {
    rollupOptions: {

      input: {
        index: new URL('./index.html', import.meta.url).pathname,
        clasificador: new URL('./clasificador.html', import.meta.url).pathname
      }
    }
  },
})
