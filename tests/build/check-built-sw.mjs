// Post-build check, run after `npm run build`: node tests/build/check-built-sw.mjs
// A new service worker must wait for a fresh start, so an open app keeps working on its cached files.
// Workbox still writes skipWaiting inside a SKIP_WAITING message listener; that one is expected.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const sw = readFileSync(new URL('../../dist/sw.js', import.meta.url), 'utf8');
assert.ok(sw.includes('SKIP_WAITING'), 'dist/sw.js should only skip waiting when asked with a SKIP_WAITING message');
assert.ok(!sw.includes('clientsClaim'), 'dist/sw.js should not take over open pages at load (clientsClaim)');
console.log('dist/sw.js waits for a fresh start');
