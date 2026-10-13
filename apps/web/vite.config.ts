import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Local-first PWA: everything, content included, is precached so a session survives a dropped connection.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Learning to Fly',
        short_name: 'Learning to Fly',
        description: 'A calm reading game: read your way from Home Island to the koalas of Australia.',
        theme_color: '#2f7fb0',
        background_color: '#f6f1e7',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The whole content bank is in the main script so it works offline; it must stay under this or it is not cached.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // Sign-in pages always go to the server, never the offline copy.
        navigateFallbackDenylist: [/^\/\.auth\//, /^\/not-invited\.html/],
      },
    }),
  ],
  // The whole content bank is bundled on purpose (offline, no fetches), so the main chunk is large.
  build: { chunkSizeWarningLimit: 6000 },
  server: { port: 5173 },
});
