# Adjectivia — context for Claude Code

> Read this first when working on this project from any computer. Decisions below were made by Robert Potau Nuñez; do not undo them without asking.

## What this is
**Adjectivia** is a classroom game to learn English adjectives and feelings (target: 1r–2n ESO, A2–B1). It is played on the **whiteboard by 1 to 6 players** who take turns. Nine game modes, one self-contained `index.html` (HTML + CSS + JS + inline OpenMoji SVG, no server, works offline).

- Public GitHub repository: `robertpotau/adjectivia` (public on purpose; all rights reserved, see `LICENSE`).
- Local folder: `G:\La meva unitat\Projectes\english-adjectives` (the folder name differs from the game name).
- **Not yet on Robert's website.** When he asks, add it to `robertpotau.github.io` as a game marked **"En Construcció"** but reachable from its button, like his *EuroExplora* game. Do not do it before he asks.

## Decisions
- **No student names anywhere in the code, docs or repo** (the repo is public). Default players are `Player 1…Player 6`; the teacher types the real names in the game (saved in the browser's localStorage). Never add real names as defaults.
- 1–6 players, names/avatars editable, each of the 6 places keeps its own XP, rank and trophies (`adjectivia_players`).
- Interface in **English**; a "? català" button shows Catalan translations and halves the points (ladder: halves XP).
- Teacher-facing choices in the setup screen of each mode; "Golden Ladder" can be played as a **team relay** or **one by one**.
- Graphics: **OpenMoji** icons (CC BY-SA 4.0, credited in the footer and `LICENSE`) + own SVG (balloons, podium, UI). Sound effects are synthesised with WebAudio; speech uses the browser's English voice (`speechSynthesis`).
- Rights layer (Robert's rule for all his games): copyright block and metas in `<head>`, footer link to https://robertpotau.github.io/termes.html, `LICENSE`, version bump on every change (`VERSION` in `src/js/00-core.js`). Contact only `robertpotau@gmail.com`.

## Layout
```
src/words.txt        vocabulary (304 adjectives) — the file to edit to add/change words
src/gaps.txt         hand-written Sentence Gap bank (157 sentences with checked wrong answers)
src/js/*.js          game code, concatenated in file-name order
src/style.css        styles
src/template.html    page skeleton (rights layer)
src/icons/*.svg      OpenMoji SVGs (downloaded by tools/fetch_icons.py, cached)
tools/build.py       src/ -> index.html   (validates words and gaps)
tools/fetch_icons.py downloads the OpenMoji icons used by words.txt and the code
tools/autoplay.js    developer test harness (plays whole games automatically in the browser)
index.html           GENERATED single-file game — never edit it by hand
```
Edit `src/`, then run `python tools/build.py`. (On Robert's school PC the `python` on PATH is the Microsoft Store stub: use `%LOCALAPPDATA%\Programs\Python\Python313\python.exe`.)

## Vocabulary file format
`word|ca|cat|level|icon|synonyms|opposites|definition|example` — see the header of `src/words.txt`. Icon = OpenMoji hex code, trailing `*` marks a face usable in *Emotion Faces*. Synonym/opposite links are made symmetric by the code. Run `build.py`; then `index.html?selftest` in a browser and make sure it says *Self test passed*.

## Question quality rules (hard-won, keep them)
- Wrong answers are never within two synonym/opposite steps of the right one (`near()` in `src/js/10-data.js`).
- **Sentence Gap uses only `src/gaps.txt`**: each sentence has 2 "hard" wrong answers (ruled out by the sentence) and 3 "easy" ones. Never generate gap distractors automatically — a machine pick like "relaxed" for "felt lonely" is arguably correct. No "a/an" right before the gap (it gives the answer away). `build.py` checks this.
- *Odd one out* only mixes groups that cannot overlap (`OOO_SPECS`).
- Emotion faces: wrong answers come from other mood groups and never from `FACE_CLASH` pairs.

## Testing
1. `python tools/build.py` must print no errors.
2. Serve the folder over HTTP (`python -m http.server 8765`) and open `index.html?selftest`: checks data, ~8,000 generated questions, memory/match pair builders.
3. Full playthroughs: in the console `eval(await (await fetch('tools/autoplay.js')).text()); runAll();` then read `window.__out` / `window.__errs`.
4. The browser pane cannot script `file://` pages, hence the local server.

## Code notes
- Everything is global (one classic script). `render(build, crumb)` replaces the screen and **clears timers/keys first**: if a screen creates a countdown or key handler while being built, pass a *function* to `render`, otherwise the new timer is cleared by mistake.
- `Timers.set/every` and `Keys.on` are cleared on every screen change; never use raw `setTimeout` for game logic.
- Progress is saved in localStorage under `adjectivia_*` (settings, players, per-word statistics, last options per mode).

## Pending / ideas
- Publish on Robert's website ("En Construcció") — only when he asks.
- Possible later: an APK like his other games, a printable word list, more gap sentences (add lines to `src/gaps.txt`).
