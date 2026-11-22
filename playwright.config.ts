import { defineConfig, devices } from '@playwright/test';

// Every browser test runs against the production build. The home and solve tests also run against
// the dev server, because dev mode bundles libraries differently and can break on its own.
export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.ts',
  use: devices['Pixel 7'],
  projects: [
    { name: 'build', use: { baseURL: 'http://localhost:4173' } },
    { name: 'dev', use: { baseURL: 'http://localhost:5174' }, testMatch: /(smoke|solve)\.spec\.ts/ },
  ],
  webServer: [
    { command: 'npm run build && npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true, timeout: 120000 },
    { command: 'npx vite --port 5174 --strictPort', port: 5174, reuseExistingServer: true, timeout: 120000 },
  ],
});
