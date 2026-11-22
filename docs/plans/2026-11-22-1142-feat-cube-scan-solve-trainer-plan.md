---
title: Cube Scan, Solve and Trainer - Plan
type: feat
date: 2026-11-22
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Cube Scan, Solve and Trainer - Plan

## Goal Capsule

- **Objective:** A child can point any phone browser at a scrambled 3x3 Rubik's cube, get it read in about two minutes, and either follow a short solution or learn the beginner method stage by stage on their own real cube, then practice each stage on an on-screen cube with hints until they can do it alone.
- **Means:** A static, client-only web app (KTD1) with a guided camera scan (KTD2, KTD3), a fast Kociemba solver (KTD4), a beginner-method stage solver for teaching (KTD5), and a button-driven practice cube with stage hints (KTD9, KTD10, KTD11).
- **Authority:** Product Contract Requirements win on behavior. KTDs win on mechanism. Units cite, never override.
- **Execution profile:** One PR on the existing feature branch; the practice and help units build on the scan, solve, and learn screens already there. Built and checked by `ce-work`; the owner (a parent) reviews and pushes.
- **Stop conditions:** Stop and ask if the chosen solver libraries cannot run in iOS Safari, or if camera scanning cannot reach R6's accuracy bar after the U4 tuning pass. Do not add a server to work around either.

---

## Product Contract

### Summary

Build one mobile-first web page, hosted free as static files. It scans the cube with the phone camera, lets the child fix any wrong color, then offers two paths: "Solve it" shows a short move list on an animated 3D cube, and "Learn it" walks through the beginner layer-by-layer method using the child's own cube state. Everything runs in the browser; no photos leave the phone. A Practice screen adds an on-screen cube the child turns with big move buttons, a Hint that greys out everything except the next piece to move, and practice for one stage at a time. Color entry gets smart fill and clearer error help, and a Moves screen explains the move letters.

### Problem Frame

The owner's son has a Rubik's cube and wants to solve it. Store apps that scan cubes exist, but most are iPhone-only or Android-only, many push in-app purchases, and few teach a method; they just print moves. Free web tools exist too (the Ruwix scanner), but they cannot be shaped into a trainer for one child. The owner wants something that works on whatever phone is at hand, that teaches rather than only solves, and that costs nothing and needs no care to keep running.

A review of rubikscu.be, a free browser cube site, showed what the first version still lacks as a trainer. A child learning the method needs to practice one stage many times and needs a nudge when stuck, and the real cube alone gives neither: once it is scrambled, the child cannot set up "just stage 4" again. The site also shows that typing colors goes faster when the app fills in squares that can only be one color, and that error messages help more when they say what to check. The site has no camera scan, so the scan stays this app's own strength.

### Requirements

**Scanning**
- R1. The app opens in iOS Safari and Android Chrome from a link, with no install, and asks for camera access only when the child starts a scan.
- R2. A guided scan captures all six faces, one at a time, with on-screen instructions that tell the child which face to show and how to turn the cube next.
- R3. After scanning, the child sees a flat map of all 54 stickers and can tap any sticker to change its color.
- R4. The child can also fill in the colors by hand with no camera, using the same flat map.
- R5. The app rejects an impossible cube with a plain-language message and points to the likely wrong stickers.
- R6. In normal indoor light, a scan of a standard-color cube needs no more than three manual fixes in typical use.

**Solving**
- R7. "Solve it" produces a solution of about 20 moves or fewer for any valid cube.
- R8. The solution plays on a 3D cube that starts from the scanned state, one move at a time, with forward, back, and play controls and the move name shown in kid-friendly words as well as notation.

**Learning**
- R9. "Learn it" splits the solve into the seven beginner-method stages, in order: white cross, white corners, middle layer, yellow cross, yellow edges, yellow corner placement, yellow corner twist.
- R10. Each stage shows its goal in one sentence, highlights the pieces that matter, and gives the moves for this child's cube for that stage only, one move at a time with a "Next move" button.
- R11. The app remembers which stages the child has finished on this device.

**Running and hosting**
- R12. The app is static files only; deploying a change is a git push, and hosting is free.
- R13. After the first visit the app works offline and can be added to the home screen.
- R14. Camera images are processed on the device and never uploaded.

**Practicing**
- R15. A Practice screen shows a 3D cube the child turns with big on-screen move buttons (each side both ways, each labeled with its letter and words), plus Scramble, Undo, and Reset. It says "Solved!" when every side is one color.
- R16. A Hint button finds the first unfinished beginner stage of the on-screen cube, greys out every piece except the one to move next, says what to do in one sentence, and offers "Do it for me", which plays that step's moves slowly on the cube.
- R17. Each Learn stage has a "Practice this stage" button. It opens Practice on a fresh random cube with every earlier stage already done, and says so when the child finishes that stage.

**Help**
- R18. When the child types in or fixes colors, a square that can only be one color is filled in automatically and marked, so the child can check it.
- R19. Every "impossible cube" message also says what to check, in one plain sentence.
- R20. A Moves screen lists each move letter with its words and plays the move on a small 3D cube when tapped.
- R21. A "More help" link opens an outside beginner tutorial (rubikscu.be) in a new tab, labeled as another website.

### Key Decisions

- **Learn mode gives the moves one at a time, rather than asking the child to try the recipe first.** Easier for a beginner to follow. Governs R10. (session-settled: user-directed — chosen over try-first-then-show: owner preferred the simpler step-by-step flow.)
- **Add the full trainer set from the rubikscu.be review: practice cube, hints, stage practice, smart fill, error help, Moves screen, and a More help link; the timer waits.** It turns the app from a solver into a trainer. Governs R15, R16, R17, R18, R19, R20, R21. (session-settled: user-directed — chosen over a small set without an on-screen practice cube: owner picked the full trainer set.)

### Success Criteria

- From opening the link to seeing the first solution move takes under two minutes for a first-time child user, including any color fixes.
- Every "Solve it" and every "Learn it" sequence, applied to the scanned state, ends in a solved cube (checked by test over many random cubes, not by eye).
- Pressing Hint then "Do it for me" again and again solves any valid on-screen cube, and every stage-practice cube starts with exactly the earlier stages done (both checked over many random cubes).
- The owner can ship a text change by editing one file and pushing, with no other step.

### Scope Boundaries

- Standard 3x3 cube with the standard color scheme only (white opposite yellow, green opposite blue, red opposite orange).
- One child, one device; no accounts, login, sync, or leaderboards.
- No app-store app and no native wrapper.
- Considered and not built: an AI vision service to read colors from a photo. It needs a server to hold an API key, which breaks R12, and the tap-to-fix map (R3) covers misreads cheaply. Revisit if R6 cannot be met in testing.
- Ideas only from rubikscu.be: no code, text, images, or look copied. Its terms of use forbid copying its code or text; every feature here is written in this app's own words and its cube-plastic design.
- Considered and not built: turning the on-screen cube by dragging a sticker, as rubikscu.be does. `cubing.js` offers tap-to-turn input but not swipe turning, so this means building touch gesture handling on the 3D view; labeled move buttons are clearer for a beginner and teach the letters. Revisit if the child finds the buttons slow.
- Considered and not built: live AR arrows drawn on the real cube. Tracking a turning cube in the browser is fragile and costly; the 3D player (R8) gives the same guidance.

#### Deferred to Follow-Up Work

- Smart cube support over Bluetooth (GAN, GoCube, MoYu) via `smartcube-web-bluetooth`. It only works in Chrome on Android and desktop, not on iPhone.
- A speed-cubing timer with inspection time, averages of 5 and 12, and personal bests.
- Typing in the moves of a scramble to set up a cube.
- Letters on the 3D cube's stickers, move sounds, a speed setting, and a share-this-cube link.
- Faster methods after beginner (CFOP lessons).
- 2x2 support.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Static site with Vite and TypeScript, no UI framework, deployed to GitHub Pages by a GitHub Actions workflow.** Five screens do not need React; plain TypeScript modules keep the dependency list short, which is what keeps maintenance low. GitHub Pages gives free HTTPS, which the camera API requires. Cloudflare Pages is an equal swap if the owner prefers it.
- KTD2. **Guided live-camera scan with a 3x3 grid overlay, not a single photo.** One photo sees at most three faces, so six guided captures are required anyway. The grid tells the child where to place the face, which makes sticker positions known without corner detection. Each sticker's color is the median of the inner part of its grid cell, which ignores the black plastic edges and glare spots.
- KTD3. **Classify colors against this cube's own six centers in CIELAB space, with a nine-per-color rule.** Centers never move, so each face's center is the reference color for that face, captured under the same light. CIELAB distance tracks how people see color better than raw RGB and cuts lighting effects. Forcing exactly nine stickers per color fixes most red/orange mix-ups, the main failure in camera cube scanners. Stickers that barely won their color get a visible "check me" mark on the map.
- KTD4. **Fast solve with `cubejs` (Kociemba two-phase, MIT) in a Web Worker; 3D playback with `cubing.js` `<twisty-player>` (MPL).** `cubejs` solves any state in 22 moves or fewer; its one-time table build takes a few seconds, so it runs in a worker started at app load so the page never freezes. `twisty-player` renders the cube from a setup sequence plus a solution, with built-in step controls and piece highlighting. If `cubejs` fails in iOS Safari, `torjusti/cube-solver` is the fallback.
- KTD5. **Teach with a home-built beginner-method stage solver, not with the Kociemba solution.** Kociemba output is short but cannot be explained to a child. The stage solver reaches each R9 stage goal in turn using the standard beginner algorithms (for example `R U R' U'` for corners) plus a small depth-limited search for the cross and for placing pieces before an algorithm. Its moves are longer (about 100 to 150) but every chunk maps to a named stage the child can understand. The beginner method changes how the cube is held (white cross on top, then white flipped to the bottom for every later stage), so the stage solver emits whole-cube turns (x, y, z) as their own "Flip your cube over" or "Turn the whole cube" sub-steps.
- KTD6. **One internal cube format: the 54-character facelet string in Kociemba face order (U, R, F, D, L, B).** `cubejs` reads it directly, and it converts to a move sequence for `twisty-player`. Every module passes this string, so there is one owner of "what the cube looks like". The frame is fixed: U is the white center and F is the green center. The scan hold table (U3), the 3D player, and the move words all use this frame, so "R" always means the side on the child's right while white is on top and green faces them.
- KTD7. **Offline and home-screen support through a web app manifest and a service worker generated at build time (`vite-plugin-pwa`).** It caches the app and solver files so the app works with no signal after the first visit (R13).

- KTD8. **Visual design: "Cube plastic" (Option A).** Dark cube-plastic ground (#1C1D22, panels #2A2C33), the six sticker colors as the only bright colors, yellow (#FFD500) primary buttons with dark text, Lexend type, large rounded touch targets (44 px or more). Every sticker shows its color letter. Mockups: https://claude.ai/artifact/MBNPgpGtk2JApyHbGRVSi7 (the Option A row). (session-settled: user-directed — chosen over Option B "Coach's notebook" light graph-paper style: owner preferred it.)
- KTD9. **The practice cube is this app's own sticker string plus big move buttons; the 3D player only draws it.** Each button applies one move to the KTD6 string with the existing move code and redraws the player from the move history as its setup sequence, so the screen and the logic can never disagree. Undo drops the last move. Reset returns to the cube's start (solved in free practice, the stage-practice cube in stage mode). Scramble, Reset, and New cube each remember the cube they replaced, so Undo can bring it back after a mis-tap. Whole-cube turns (turn left, turn right, flip over) are moves too, so the string always matches what the child sees. The player's tap-to-turn input stays off, because two ways to turn the cube would confuse a beginner; dragging to look around stays on, and a small back view shows the hidden sides so D, L, and B moves are visible.
- KTD10. **Hint follows one stored beginner plan, re-solving only when the cube leaves it, and shows the pieces in play with a mask.** Re-solving on every tap goes in circles: checked against the real solver, only 6 of 300 cubes reached solved that way, because the corner-twist stage breaks lower layers on purpose and ties between equally cheap pieces flip back and forth. So `hint.ts` keeps the last `solveBeginner` plan and the cube after each of its sub-steps. If the cube matches the state after sub-step k, the hint is sub-step k+1, and "Stage N of 7" comes from that plan. Only a cube off the plan (other moves, Undo, a new cube) is solved again. The solver needs white on top and green in front while the cross is unfinished, so an off-frame cube first gets a whole-cube-turn hint, "Hold your cube with white on top and green facing you". Each sub-step names its `pieces` (colors of the pieces it moves). Yellow cross and yellow edges sub-steps name the top-layer pieces they change, and whole-cube-turn sub-steps name none and show the full cube. `player.ts` maps piece colors to `cubing.js` piece order and greys every other piece with mask letter `I` (grey), in the same mask format Learn uses with `D` for dimming. "Do it for me" plays the moves at a slower tempo.
- KTD11. **A stage-practice cube is a random scramble followed by the solver's moves for every earlier stage.** That guarantees the earlier stages are done. If the target stage happens to be done already, draw again. The setup sequence is the scramble plus those moves, so showing the cube needs no extra solve.
- KTD12. **Smart fill fills only forced squares and never overrides the child.** After each color pick, look at every corner and edge with exactly one empty square. If exactly one color makes it a real piece not already on the cube, without going over nine of that color, fill it and mark it "auto". Repeat until nothing changes. When the child changes any square, all "auto" squares are cleared and worked out again, so a fill never outlives the pick it came from. A filled square the child taps is theirs.
- KTD13. **Each validity failure carries its own "what to check" line.** The failed result gains a `help` field next to `message`, so the wording for each failure has one owner in `validate.ts`.

### High-Level Technical Design

Data flow from camera to answer. Everything in this diagram runs on the phone.

```mermaid
flowchart TB
  CAM[Camera video] --> GRID[Grid overlay capture x6 faces]
  GRID --> SAMPLE[Sample 54 sticker colors]
  SAMPLE --> CLASS[Classify vs centers, 9 per color]
  MANUAL[Manual paint] --> NET
  CLASS --> NET[Flat map review and fix]
  NET --> VALID{Valid cube?}
  VALID -->|no| NET
  VALID -->|yes| STATE[Facelet string]
  STATE --> FAST[Fast solver worker]
  STATE --> LEARN[Beginner stage solver]
  FAST --> PLAYER[3D twisty player]
  LEARN --> STAGES[Stage cards] --> PLAYER
```

Practice and hint flow. All of it runs on the phone and reuses the Learn solver.

```mermaid
flowchart TB
  HOME[Home: Practice] --> PRACTICE[Practice cube: string plus move history]
  LEARN[Learn stage: Practice this stage] --> MAKE[Random scramble plus earlier stages' moves] --> PRACTICE
  PRACTICE -->|move button| PRACTICE
  PRACTICE -->|Hint| ONPLAN{On the stored plan?}
  ONPLAN -->|yes| STEP
  ONPLAN -->|no| RESOLVE[Hold check, then solve again and store plan] --> STEP[Stored plan's next sub-step: note, moves, pieces]
  STEP --> MASK[Grey every piece not in play]
  MASK -->|Do it for me| PRACTICE
  PRACTICE -->|stage goal met| CHEER[Stage done or Solved]
```

Scan sequence the child follows. The expected next-face center is shown on screen, so a wrong turn is caught at once, not at the end.

```mermaid
stateDiagram-v2
  [*] --> Permission
  Permission --> FaceGreen: camera allowed, hold white on top and green facing camera
  Permission --> ManualEntry: camera denied
  FaceGreen --> FaceRed: captured, turn cube left
  FaceRed --> FaceBlue: captured, turn cube left
  FaceBlue --> FaceOrange: captured, turn cube left
  FaceOrange --> FaceWhite: captured, turn left back to green, then tip top toward you
  FaceWhite --> FaceYellow: captured, tip back to green, then tip bottom toward you
  FaceYellow --> Review: captured
  FaceGreen --> FaceGreen: center wrong, retake
  FaceRed --> FaceRed: center wrong, retake
  FaceBlue --> FaceBlue: center wrong, retake
  FaceOrange --> FaceOrange: center wrong, retake
  FaceWhite --> FaceWhite: center wrong, retake
  FaceYellow --> FaceYellow: center wrong, retake
  Review --> [*]
  ManualEntry --> Review
```

### Output Structure

```text
index.html
package.json
vite.config.ts
.github/workflows/deploy.yml
public/icons/
src/main.ts
src/app/router.ts
src/app/storage.ts
src/cube/facelets.ts
src/cube/validate.ts
src/scan/camera.ts
src/scan/scan-flow.ts
src/scan/sample.ts
src/scan/classify.ts
src/review/net-editor.ts
src/solve/solver.worker.ts
src/solve/fast-solve.ts
src/learn/beginner-solver.ts
src/learn/stages.ts
src/learn/learn-screen.ts
src/ui/player.ts
src/ui/move-words.ts
src/practice/practice-state.ts
src/practice/practice-screen.ts
src/practice/stage-practice.ts
src/practice/practice.css
src/learn/hint.ts
src/review/smart-fill.ts
src/help/moves-screen.ts
src/help/help.css
src/styles.css
tests/
```

---

## Implementation Units

### U1. App shell, hosting, and offline support

- **Goal:** A deployed, installable, empty app with a home screen and simple screen switching.
- **Requirements:** R1, R12, R13; KTD1, KTD7.
- **Dependencies:** none.
- **Files:** `package.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/app/router.ts`, `src/app/storage.ts`, `src/styles.css`, `public/icons/`, `.github/workflows/deploy.yml`, `README.md`, `tests/smoke.spec.ts`.
- **Approach:**
  1. Vite + TypeScript project with Vitest for unit tests and Playwright for one browser smoke test.
  2. Hash-based router with screens: Home, Scan, Review, Solve, Learn.
  3. `storage.ts` wraps `localStorage` in try/catch so private browsing never breaks the app.
  4. Workflow builds on push to `main` and publishes to GitHub Pages; Vite `base` set to the repo path.
  5. README states the three owner tasks: run locally, change text, push to deploy.
- **Execution note:** Mostly setup; prove it with a deploy and a load on a real phone rather than unit tests.
- **Test scenarios:**
  - Smoke: loading the built site shows the Home screen with "Scan my cube" and "Enter colors by hand" buttons.
  - Smoke: navigating to `#/learn` and back works with the browser back button.
  - Edge: with `localStorage` throwing, the app still loads.
- **Verification:** The Pages URL opens on an iPhone and an Android phone, can be added to the home screen, and loads in airplane mode after one visit.

### U2. Cube state model and validity check

- **Goal:** One trusted representation of a cube and a check that rejects impossible cubes with a useful reason.
- **Requirements:** R5; KTD6.
- **Dependencies:** U1.
- **Files:** `src/cube/facelets.ts`, `src/cube/validate.ts`, `tests/cube/facelets.test.ts`, `tests/cube/validate.test.ts`.
- **Approach:** Facelet string helpers (from a face-by-face color grid, to a string, apply a move sequence including whole-cube turns x, y, z, is-solved). Validation checks, in this order so the message is most useful: nine of each color, six distinct centers, every edge and corner is a real piece, corner twist sum, edge flip sum, permutation parity. Each failure returns a kid-level message and the sticker indices to highlight.
- **Test scenarios:**
  - Happy: the solved string is valid; applying a scramble then its inverse returns the solved string.
  - Error: ten white stickers returns "too many white" and highlights white stickers.
  - Error: a single twisted corner returns the twist message and highlights that corner's three stickers.
  - Error: two swapped edge stickers (a flipped edge) returns the flip message.
  - Error: two swapped corners only returns the parity message.
  - Edge: a cube built from 1,000 random scrambles is always valid.
- **Verification:** All checks pass; every message has been read aloud and is understandable by a child.

### U3. Guided camera scan

- **Goal:** The child captures all six faces in a fixed, guided order and the app gets 54 raw color samples.
- **Requirements:** R1, R2, R14; KTD2.
- **Dependencies:** U1.
- **Files:** `src/scan/camera.ts`, `src/scan/scan-flow.ts`, `src/scan/sample.ts`, `tests/scan/sample.test.ts`, `tests/scan/scan-flow.test.ts`, `tests/scan/scan.e2e.spec.ts`.
- **Approach:**
  1. Back camera via `getUserMedia`, with the video set to inline and muted so iOS Safari plays it in-page. Request camera only on the Scan screen.
  2. Square overlay with a 3x3 grid; each step shows a cube picture with the face to show, the color that must be at the top edge of the image, and an arrow for how to turn next (state diagram above).
  3. Fixed hold table (KTD6 frame): start with white on top and green facing the camera. Green, red, blue, and orange are captured with white at the top edge of the image. White is captured by tipping the top toward you from the green view, so green is at the bottom edge. Yellow is captured by tipping the bottom toward you from the green view, so green is at the top edge. `scan-flow.ts` holds one 9-cell-to-facelet-index map per step, built from this table.
  4. Capture draws the current frame to a canvas; `sample.ts` takes the median color of the inner 50% of each cell.
  5. After each capture, check the center sample is near the expected center color; if not, name the expected face ("Show the red-center side") and retake.
  6. A live preview tints each grid cell with its sampled color so the child sees what the app sees before tapping capture.
  7. Camera denied or missing routes to manual entry (R4) with a short note.
- **Test scenarios:**
  - Happy: sampling a synthetic 300x300 image of nine solid colors returns those nine colors.
  - Edge: a cell with a white glare spot and black borders still returns the sticker's color.
  - Happy: scan flow moves green, red, blue, orange, white, yellow in order and ends on Review.
  - Error: a capture whose center does not match the expected face stays on that step and names the expected face.
  - Happy: six synthetic face images captured with the hold table's orientations produce the correct 54-character facelet string for a known scramble.
  - Integration (Playwright, Chromium fake camera fed a recorded cube video): a full scan reaches Review with 54 samples.
- **Verification:** On a real iPhone and Android phone, a full scan takes under a minute and no network request carries image data.

### U4. Color classification and review map

- **Goal:** Turn 54 samples into a color for each sticker, let the child fix mistakes, and support fully manual entry.
- **Requirements:** R3, R4, R5, R6; KTD3.
- **Dependencies:** U2, U3.
- **Files:** `src/scan/classify.ts`, `src/review/net-editor.ts`, `tests/scan/classify.test.ts`, `tests/review/net-editor.test.ts`, `tests/fixtures/scans/`.
- **Approach:**
  1. Convert samples to CIELAB; the six center samples are the references.
  2. Assign every sticker to a center color with each color capped at nine, filling the most confident matches first.
  3. Flag stickers whose best and second-best distances are close as "check me".
  4. The review map is the standard cross-shaped net. Tapping a side zooms it to a large 3x3; tapping a sticker there opens a six-color picker. Centers are locked. Every sticker and picker swatch shows its color letter (W, Y, R, O, G, B), and the "check me" mark is a dashed ring, so color is never the only cue (KTD8).
  5. The Review screen has two buttons, "Solve it" (to the Solve screen) and "Learn it" (to the Learn screen). Both stay disabled until U2 validation passes; validation errors highlight stickers on the map.
  6. Manual entry opens the same map pre-filled with centers only.
- **Execution note:** Collect a small fixture set of real scans (room light, lamp light, window light, at least two cube brands) before tuning; tune against those fixtures, not by eye.
- **Test scenarios:**
  - Happy: a fixture scan in room light classifies with zero errors.
  - Edge: red and orange samples that sit close in color still split nine and nine.
  - Edge: a warm lamp fixture classifies with three or fewer errors (R6).
  - Happy: tapping a sticker and choosing blue updates the map and re-runs validation.
  - Error: an invalid map keeps both "Solve it" and "Learn it" disabled and shows the U2 message.
  - Happy: manual entry with all 48 stickers painted and valid enables both buttons.
- **Verification:** Across the fixture set, the average number of fixes needed is three or fewer.

### U5. Fast solve with 3D player

- **Goal:** "Solve it" shows a short solution on an animated 3D cube that matches the child's cube.
- **Requirements:** R7, R8; KTD4, KTD6.
- **Dependencies:** U2, U4.
- **Files:** `src/solve/solver.worker.ts`, `src/solve/fast-solve.ts`, `src/ui/player.ts`, `src/ui/move-words.ts`, `tests/solve/fast-solve.test.ts`, `tests/ui/move-words.test.ts`.
- **Approach:**
  1. Start the worker at app load so the solver tables build while the child scans.
  2. Send the facelet string; receive the move list.
  3. `player.ts` wraps `<twisty-player>`, setting the setup to the inverse of the solution so the 3D cube starts at the scanned state, shown in the KTD6 frame. Before move 1, a "Hold your cube with white on top and green facing you" picture appears.
  4. Big buttons for back, next, and play; a counter "Move 4 of 19".
  5. `move-words.ts` turns notation into words: `R` becomes "Right side, turn away from you", `U'` becomes "Top, turn to the right".
- **Test scenarios:**
  - Happy: for 1,000 random valid cubes, applying the solution gives the solved cube and the length is 22 or fewer.
  - Edge: an already-solved cube returns an empty solution and a "Already solved!" message.
  - Happy: every one of the 18 face moves and the whole-cube turns (x, y, z and their primes and doubles) has a word description.
  - Integration: the player's starting state equals the scanned facelet string.
- **Verification:** On a phone, solving a real scrambled cube by following the player works start to finish.

### U6. Beginner-method stage solver

- **Goal:** For any valid cube, produce seven ordered stage chunks of moves that follow the beginner method.
- **Requirements:** R9, R10; KTD5, KTD6.
- **Dependencies:** U2.
- **Files:** `src/learn/beginner-solver.ts`, `src/learn/stages.ts`, `tests/learn/beginner-solver.test.ts`.
- **Approach:**
  1. `stages.ts` owns, per stage: a goal check on the facelet string, the beginner algorithms, and the child-facing text.
  2. White cross: small depth-limited search per edge, solving edges one at a time, so each edge is its own teachable chunk.
  3. White corners, middle layer: bring the piece above its slot with top-layer turns, then apply the matching beginner algorithm.
  4. Yellow stages: recognize the case (dot, line, L, cross; then edge, corner placement, corner twist) and apply the standard beginner algorithm, repeating as the method says.
  5. Return each stage with its moves split into sub-steps the child can follow, each with a short note ("Bring the white-red edge to the top").
- **Execution note:** Implement test-first; the per-stage goal checks are the test oracle.
- **Test scenarios:**
  - Happy: for 1,000 random cubes, after each stage's moves that stage's goal check and all earlier ones are true, and the final cube is solved.
  - Edge: a cube whose white cross is already done returns an empty cross stage with "Already done, nice!".
  - Edge: each yellow-cross case (dot, line, L) is recognized from a fixed fixture.
  - Edge: the corner-twist stage handles the case where only two corners need twisting.
  - Happy: total length stays under 200 moves for all 1,000 cubes.
- **Verification:** All 1,000-cube runs pass and no stage ever loops without progress.

### U7. Learn mode screen

- **Goal:** The child works through the seven stages on their own cube with clear goals, highlights, and saved progress.
- **Requirements:** R9, R10, R11, R8; KTD4, KTD5.
- **Dependencies:** U5, U6.
- **Files:** `src/learn/learn-screen.ts`, `tests/learn/learn-screen.test.ts`.
- **Approach:**
  1. Stage list with a progress bar; each stage card shows the one-sentence goal and a picture of the finished stage.
  2. A stage screen shows, top to bottom: the goal sentence and a "hold your cube like this" picture, the shared player, then the current sub-step note with its move words and Back / Next buttons that step one sub-step at a time. The player highlights the pieces in play (cubing.js stickering) and dims the rest. "I did it!" appears after the last sub-step.
  3. "I did it!" opens the next stage, starting the player from the end state of the previous stage.
  4. Progress belongs to the current cube: `storage.ts` keeps the last scanned facelet string and the current stage and sub-step. On reopening, the stage list marks a stage done when its U6 goal check passes on the cube state reached so far.
  5. A "Rescan" button is always there, for when the real cube and the screen drift apart. After a rescan from Learn, run the U6 goal checks on the new cube, mark the passing stages done, and reopen at the first failing stage with moves recomputed from the new state.
- **Test scenarios:**
  - Happy: finishing stage 1 and reloading the page reopens at stage 2 of the same cube.
  - Happy: stage 3 starts from the state after stages 1 and 2.
  - Happy: Back and Next step through one stage's sub-steps, and "I did it!" shows only after the last one.
  - Happy: rescanning a cube whose white cross is done but corners are not reopens Learn at stage 2.
  - Happy: a fresh scan of a new scramble replaces the saved cube and its progress.
  - Edge: storage unavailable means progress is not kept but the screen works.
  - Happy: "Rescan" returns to the Scan screen.
- **Verification:** A child who has not solved a cube before reaches a solved cube using only Learn mode, with an adult nearby only for reading help.

### U8. Practice cube with move buttons

- **Goal:** The child can scramble and turn an on-screen cube with big labeled buttons, undo, reset, and see "Solved!".
- **Requirements:** R15; KTD6, KTD9.
- **Dependencies:** U2, U5.
- **Files:** `src/practice/practice-state.ts`, `src/practice/practice-screen.ts`, `src/practice/practice.css`, `src/main.ts`, `src/app/home.ts`, `src/ui/player.ts`, `tests/practice/practice-state.test.ts`, `tests/practice/practice-screen.test.ts`, `tests/practice.spec.ts`.
- **Approach:**
  1. `practice-state.ts` holds the start setup, the move history, and the current string; it applies, undoes, and resets moves and reports solved.
  2. Screen layout: the move counter (or the hint card, U9) and the 3D player stay pinned at the top, about 40% of the screen height, and the controls scroll beneath them, so the cube never leaves view. Controls: a 3 by 4 grid of move buttons (U, D, R, L, F, B, each both ways) showing the letter large with a short label of at most three words; a row with turn left, turn right, and flip over; then Scramble, Undo, Hint, and Reset, with Reset set apart. A "Moves" link sits in the header.
  3. Home gets a third entry, "Practice", under "Scan my cube".
  4. `player.ts` gains a way to show a cube from a plain setup sequence with no moves pending, and a slower tempo option for "Do it for me".
- **Patterns to follow:** `src/solve/solve-screen.ts` for screen structure and cleanup; `src/ui/move-words.ts` for button labels.
- **Test scenarios:**
  - Happy: R then R' returns to the solved string and the counter shows 2.
  - Happy: Scramble gives an unsolved cube; Reset returns it to solved.
  - Happy: Undo after three moves equals the state after two.
  - Happy: Undo right after Scramble or Reset brings back the cube that was replaced.
  - Happy: a turn-left button changes which center is in front but keeps the cube solved.
  - Integration (Playwright, build and dev): open Practice from Home, tap Scramble, tap a move button, see the counter change.
- **Verification:** On a phone, every button turns the 3D cube the way its words say, and buttons stay 44 px or larger.

### U9. Hint and "Do it for me"

- **Goal:** One tap tells the child which stage they are on, what to do next, and which piece; a second tap can do it for them.
- **Requirements:** R16; KTD10.
- **Dependencies:** U6, U8.
- **Files:** `src/learn/beginner-solver.ts`, `src/learn/hint.ts`, `src/ui/player.ts`, `src/practice/practice-screen.ts`, `tests/learn/hint.test.ts`, `tests/learn/beginner-solver.test.ts`, `tests/ui/piece-mask.test.ts`.
- **Approach:**
  1. Each solver sub-step names its `pieces`: one piece for cross edges, white corners, middle edges, and yellow corners being placed or twisted; the top-layer pieces it changes for yellow cross and yellow edges; none for whole-cube turns.
  2. `hint.ts` follows the stored plan per KTD10 and returns the stage title, the sub-step note, its moves, and its pieces, or "Already solved".
  3. `player.ts` builds a mask from piece colors: those pieces show, all others grey; no pieces means the full cube.
  4. The hint card replaces the move counter above the player and shows "Stage N of 7: title", the note, the moves as chips with words, and "Do it for me".
  5. While "Do it for me" plays, the move buttons, Undo, Scramble, and Reset are disabled and the card says "Playing". Each played move joins the history on its own, so Undo steps back one move. When it ends, the mask clears and the card says "Done! Tap Hint for the next step". Any move button closes the hint and clears the mask.
- **Execution note:** Implement test-first; the stage goal checks are the oracle.
- **Test scenarios:**
  - Happy: for 1,000 random cubes, repeating hint then applying its moves reaches solved within 60 hints.
  - Happy: the same holds when each cube first gets a random whole-cube turn; the first hint is then the hold-your-cube step.
  - Happy: from a cube in the middle of the corner-twist stage, reached by following hints, the next hint is still a twist sub-step.
  - Happy: after the child makes an unrelated move, the next hint solves again from the new cube.
  - Happy: a cube with only the white cross done gets a white corners hint.
  - Edge: a solved cube gets "Already solved".
  - Happy: the mask for the white-green edge leaves exactly one edge shown and every other piece grey.
  - Happy: each of the 20 corner and edge pieces maps to a different mask position.
- **Verification:** On a phone, Hint greys the cube except the named piece, and "Do it for me" plays the step slowly.

### U10. Practice one stage

- **Goal:** From any Learn stage, the child can practice just that stage on fresh cubes.
- **Requirements:** R17; KTD11.
- **Dependencies:** U8, U9.
- **Files:** `src/practice/stage-practice.ts`, `src/practice/practice-screen.ts`, `src/learn/learn-screen.ts`, `tests/practice/stage-practice.test.ts`, `tests/practice/practice-screen.test.ts`.
- **Approach:**
  1. `stage-practice.ts` makes a practice cube for a stage per KTD11.
  2. The Practice route takes an optional stage (`#/practice/<stage>`). In stage mode the goal sentence and the stage's hold picture sit above the player, Reset returns to the stage-practice cube, and "New cube" makes another. When the stage's goal check passes, "Stage done!" shows with "New cube", "Next stage", and "Back to Learn"; it goes away if a later move breaks the stage again.
  3. Each Learn stage card gets a "Practice this stage" button.
- **Test scenarios:**
  - Happy: for every stage and 200 cubes each, all earlier stages are done and the target stage is not.
  - Happy: white cross practice is a plain scramble whose cross is not done.
  - Happy: applying the hint moves until the stage goal holds shows "Stage done!".
  - Happy: "Practice this stage" on the white corners card opens Practice in white corners mode.
  - Happy: Reset in stage mode returns to the stage-practice cube, not a solved cube.
- **Verification:** On a phone, practicing yellow cross starts with the first two layers solved.

### U11. Smart fill and error help

- **Goal:** Typing in or fixing colors takes fewer taps, and every error says what to check.
- **Requirements:** R18, R19; KTD12, KTD13.
- **Dependencies:** U2, U4.
- **Files:** `src/review/smart-fill.ts`, `src/review/net-editor.ts`, `src/review/review.css`, `src/cube/validate.ts`, `tests/review/smart-fill.test.ts`, `tests/review/net-editor.test.ts`, `tests/cube/validate.test.ts`.
- **Approach:**
  1. `smart-fill.ts` takes the 54 slots (some empty) and returns newly forced squares per KTD12.
  2. The flat map runs it after every pick in the existing tap-a-square, pick-a-color flow; auto squares get a small "auto" dot, distinct in shape from the dashed "check me" ring, and a one-line legend under the map says what the dot means.
  3. `validate.ts` adds a `help` line to every failure; the review message shows it under the main message.
- **Test scenarios:**
  - Happy: blanking one square of a valid cube, then smart fill, restores that square.
  - Edge: blanking two squares of the same corner fills nothing.
  - Edge: smart fill never changes a square the child set.
  - Edge: changing an earlier pick clears and recomputes the "auto" squares that depended on it.
  - Happy: with 20 random squares blanked, everything smart fill sets matches the true cube.
  - Happy: every validity failure in the existing tests also has a non-empty `help`.
  - Integration: in typing mode, picking the last unknown color of a piece fills the forced neighbor and shows the "auto" mark.
- **Verification:** Typing in a full cube by hand takes noticeably fewer taps than 48.

### U12. Moves screen and More help link

- **Goal:** The child can look up any move letter, and the parent can open a fuller outside tutorial.
- **Requirements:** R20, R21.
- **Dependencies:** U5.
- **Files:** `src/help/moves-screen.ts`, `src/help/help.css`, `src/main.ts`, `src/app/home.ts`, `src/learn/learn-screen.ts`, `tests/help/moves-screen.test.ts`, `tests/smoke.spec.ts`.
- **Approach:**
  1. The Moves screen pins one small 3D cube at the top and scrolls a grouped list beneath it: face moves, then whole-cube turns, each with prime and double forms, its words, and a tap target that plays it on that cube.
  2. Home, Learn, and Practice get a "Moves" link. Learn's "You solved it!" screen and the Home footer get "More help (another website)", opening `https://rubikscu.be/how-to-solve/` in a new tab with no referrer.
- **Test scenarios:**
  - Happy: the Moves screen lists all 18 face moves and 9 whole-cube turns with words.
  - Happy: tapping R loads R on the player.
  - Happy (Playwright): the More help link has the right address, opens in a new tab, and says it is another website.
- **Verification:** On a phone, tapping a move plays it, and the outside link opens without leaving the app tab.

---

## Verification Contract

| Gate | What it proves | When |
|---|---|---|
| `npm run test` (Vitest) | State model, validation, sampling, classification, both solvers | Every change |
| `npm run e2e` (Playwright, Chromium with fake camera; against both the build and the dev server) | Home, scan camera, solve, practice, and the More help link work | Every change, and in the deploy workflow |
| `npm run build` | Static bundle and service worker build | Every change, and in the deploy workflow |
| Manual phone check | Camera, 3D player, practice buttons, hint greying, offline, add-to-home-screen on iOS Safari and Android Chrome | Before calling U3, U5, U7, U8, U9 done |

---

## Definition of Done

- All requirements R1 to R21 are met and shown on a real iPhone and a real Android phone.
- All test gates above pass; the 1,000-cube tests in U5, U6, and U9 and the stage-practice test in U10 pass.
- The app is live on GitHub Pages from the workflow, with no server and no paid service.
- The README tells the owner how to run, change, and deploy the app.
- No dead-end or experimental code from abandoned approaches is left in the diff.

---

## Risks and Dependencies

| Risk | Mitigation |
|---|---|
| Red and orange look alike under warm light | KTD3 centers-as-reference and nine-per-color rule; "check me" marks; tap-to-fix map (R3) |
| Child scans faces in the wrong order or orientation | Center check after each capture (U3 step 5); validation errors point at stickers (R5) |
| `cubing.js` experimental attributes change before its 1.0 | Pin the exact version; keep all `twisty-player` use inside `src/ui/player.ts` |
| iOS Safari camera quirks (inline video, HTTPS only) | Inline and muted video; HTTPS from Pages; manual entry fallback |
| Solver table build is slow on old phones | Run in a worker started at app load (KTD4); show a friendly "warming up" note if still building |
| Beginner solver bug leaves a stage unsolved | 1,000-cube test with per-stage goal checks (U6) |
| `cubing.js` mask letters or piece order change in an update | All mask code stays in `src/ui/player.ts`; a test checks each piece maps to one position; pin the version |
| The More help site carries ads and cookies | The link says it is another website and opens a new tab; the parent can remove it by deleting the link on Learn's finish screen and in the Home footer |
| First hint is slow on old phones | The beginner solver builds small white-cross tables on first use (measured about 0.2 s on a desktop, likely 0.6 to 1.2 s on a phone); call it once when Practice opens, before the first Hint tap |

---

## Sources and Research

**Libraries this plan uses**
- `cubejs` (ldez/cubejs, MIT): Kociemba two-phase solver, 22 moves or fewer, one-time init of about 4 to 5 seconds, Web Worker friendly. https://github.com/ldez/cubejs
- `cubing.js` `<twisty-player>` (MPL): 3D/2D cube player with setup sequence and stickering highlights; experimental attributes may change. https://js.cubing.net/cubing/twisty
- `vite-plugin-pwa`: manifest and service worker for offline use.

**Prior art to read while building**
- dejwi/rubiks-app: Next.js + three.js solver with camera scan; small project, useful as a reference for scanning UI. https://repos.ecosyste.ms/hosts/GitHub/repositories/dejwi%2Frubiks-app
- kkoomen/qbr: Python webcam scanner using CIEDE2000 color distance and a calibrate mode; source of the CIELAB approach in KTD3. https://github.com/kkoomen/qbr
- torjusti/cube-solver: JS solver collection (Kociemba and others), a fallback if `cubejs` gives trouble. https://github.com/torjusti/cube-solver
- poliva/smartcube-web-bluetooth and afedotov/gan-web-bluetooth: smart cube support for the deferred Bluetooth follow-up. https://github.com/poliva/smartcube-web-bluetooth

**Reviewed with Playwright on 2026-11-22: rubikscu.be** (https://rubikscu.be/)
- Free browser cube site: playable 3D cube (drag to turn), Hint that greys out all but one piece with a one-sentence tip and "Do these moves for me", a solver where colors are painted by hand (no camera), fast and "teach me" modes, per-step practice in its tutorial, smart fill, an error-message guide, a notation page, and a timer.
- Ideas taken into R15 to R21. Its terms of use say not to copy its code or text, so nothing is copied (see Scope Boundaries).

**Existing services the family can use today**
- Ruwix web scanner: free browser camera scan and solve, with manual fix. https://ruwix.com/cube-solver/scan/
- Store apps such as "3D Cube Solver - Solve & Play" (iPhone, free, offline). Most others carry in-app purchases.


---

## Deferred / Open Questions

These are review items left for the author. They do not block implementation.

### From 2026-11-22 review

- **Smart fill can never run when fixing a scanned cube** — R18, the smart fill requirement (P3, feasibility, confidence 75)

  After a scan every square already has a color, so smart fill (which only fills an empty square and never overrides a choice) has nothing to fill while the child fixes colors; it only helps when typing colors in. As written, the requirement promises it for fixing too.
  Change: reword R18 to "When the child types in colors, a square that can only be one color is filled in automatically and marked, so the child can check it."
