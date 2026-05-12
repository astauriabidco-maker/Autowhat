import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const plugins = [
  react(),
  tailwindcss(),
]

if (process.env.VITE_ENABLE_PWA !== 'false') {
  plugins.push(
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'WhatsPoint - Gestion RH WhatsApp',
        short_name: 'WhatsPoint',
        description: 'Dashboard de gestion des présences, congés et notes de frais via WhatsApp',
        theme_color: '#3b82f6',
        background_color: '#F9FAFB',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000,
        // Cache strategies
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  )
}

// https://vite.dev/config/
export default defineConfig({
  plugins,
  server: {
    port: 5180,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
      '/superadmin': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        bypass: (req: any) => {
          if (req.headers.accept?.includes('text/html')) {
            return req.url; // Allows React Router to handle page loads like /superadmin/login
          }
        }
      },
      '/uploads': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
    },
  },
})
