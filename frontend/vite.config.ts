/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// A PWA da primeira versão é instalável mas exige ligação à Internet (D-07):
// o service worker não guarda dados do CRM, apenas os ficheiros da aplicação.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'CRM Valor Máximo',
        short_name: 'Valor Máximo',
        description: 'Valor Máximo — Soluções Imobiliárias',
        lang: 'pt-PT',
        theme_color: '#000b23',
        background_color: '#f5f7fa',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/marca/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/marca/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/marca/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//, /^\/admin\//],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_PROXY_API ?? 'http://localhost:8000',
      '/admin': process.env.VITE_PROXY_API ?? 'http://localhost:8000',
      '/static': process.env.VITE_PROXY_API ?? 'http://localhost:8000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
