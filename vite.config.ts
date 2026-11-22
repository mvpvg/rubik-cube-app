import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the site from /<repo-name>/. Set BASE_PATH in CI; local dev uses "/".
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  worker: { format: 'es' },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Cube Coach',
        short_name: 'Cube Coach',
        description: 'Scan your cube, solve it, and learn how.',
        theme_color: '#1C1D22',
        background_color: '#1C1D22',
        display: 'standalone',
        orientation: 'portrait',
        icons: [{ src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
