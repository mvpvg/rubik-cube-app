import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

// cubejs is old CommonJS that wraps each file in `(function(){...}).call(this)` and reads `this.Cube`.
// Bundled as ES modules, `this` is undefined there and the solver crashes in the browser.
// Pointing it at globalThis keeps the library unchanged otherwise.
function cubejsThisFix(): Plugin {
  return {
    name: 'cubejs-this-fix',
    enforce: 'pre',
    transform(code, id) {
      if (!/node_modules[\\/]cubejs[\\/]lib[\\/]/.test(id)) return null;
      return { code: code.replace(/\}\)\.call\(this\);/g, '}).call(globalThis);'), map: null };
    },
  };
}

// GitHub Pages serves the site from /<repo-name>/. Set BASE_PATH in CI; local dev uses "/".
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  worker: { format: 'es', plugins: () => [cubejsThisFix()] },
  plugins: [
    cubejsThisFix(),
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
