# Cube Coach

A phone web app that scans a Rubik's cube with the camera, solves it, and teaches the beginner method.
It is only static files. There is no server. Camera pictures never leave the phone.

## Run it on your computer

```bash
npm install
npm run dev
```

Open the address it prints. To try it on your phone, both devices must be on the same Wi-Fi. Run `npm run dev -- --host` and open the "Network" address. (The camera needs HTTPS, so use the deployed site for camera tests on a phone.)

## Change some text

All the words a child sees live in `src/` next to each screen. Edit the text, save, and the dev page reloads.

## Put it online (GitHub Pages)

1. Create a GitHub repository and push this project to its `main` branch.
2. In the repository, open Settings, then Pages, and set "Source" to "GitHub Actions".
3. Every push to `main` now tests, builds, and publishes the site. The address is `https://<your-user>.github.io/<repo-name>/`.

## Checks

```bash
npm test        # unit tests
npm run e2e     # browser tests (first time: npx playwright install chromium)
npm run build   # production build
```
