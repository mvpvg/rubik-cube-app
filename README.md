# Cube Coach

A phone web app that scans a Rubik's cube with the camera, solves it, and teaches the beginner method.
**Live site: https://mvpvg.github.io/rubik-cube-app/**

It is only static files. There is no server. Camera pictures never leave the phone.

## Saved work

The app saves each step on the phone: each side scanned, each color fixed, and each move on Solve and Learn. A refresh or a closed app comes back to the same step, and Home offers "Keep going". Saved work is thrown away 7 days after it was last used. It stays in this browser on this phone and is never sent anywhere. Only the sampled colors are kept, never the camera pictures.

To install it, open the site and use the "Add to home screen" strip on Home. On iPhone, tap Share, then "Add to Home Screen".

## Run it on your computer

```bash
npm install
npm run dev
```

Open the address it prints. To try it on your phone, both devices must be on the same Wi-Fi. Run `npm run dev -- --host` and open the "Network" address. (The camera needs HTTPS, so use the deployed site for camera tests on a phone.)

## Change some text

All the words a child sees live in `src/` next to each screen. Edit the text, save, and the dev page reloads.

## Put it online (GitHub Pages)

1. Push this project to the `main` branch of a GitHub repository.
2. Turn on Pages once. Without this, the deploy step fails with `404 Not Found`:
   ```bash
   gh api -X POST repos/<your-user>/<repo-name>/pages -f build_type=workflow
   ```
   Or open Settings, then Pages, and set "Source" to "GitHub Actions".
3. Every push to `main` now tests, builds, and publishes the site. This repo's address is https://mvpvg.github.io/rubik-cube-app/.

## Checks

```bash
npm test        # unit tests
npm run e2e     # browser tests (first time: npx playwright install chromium)
npm run build   # production build
```
