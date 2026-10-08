# Changelog

## 0.3.0 — music for the Golden Ladder
- Two original tracks, synthesised in the browser (no audio files, no copyright issues): **Dungeon of Doom** (tense and scary: drone, heartbeat, creeping chromatic ostinato, dissonant strings, clock ticks, risers, cave wind) and **Jolly Roger Rush** (pirate sea-shanty in D minor, 6/8: bass, accordion-style stabs, drums, shaker and a fiddle tune with a harmony line).
- Both get more intense as the ladder is climbed (more layers, faster tempo). Choose *Pirates, then suspense* (default), *Pirates*, *Suspense* or *Off* when setting up a Golden Ladder game.
- Music button in the game, music on/off and volume in Settings; the music lowers itself when a word is spoken and when an answer is revealed.
- Self test renders both tracks offline; `tools/music-preview.js` + `tools/upload_server.py` export them as .wav files.

## 0.2.1 — export / import of profiles
- Profiles screen: **Export** (one profile or all six) saves a `.json` file; **Import** loads it back, into a chosen place for a single profile or replacing all profiles. Files are validated and cleaned on import.
- New word: fat (387 adjectives, 301 gap sentences).

## 0.2.0 — profiles, more vocabulary, more sentences
- **Profiles**: 6 saved profiles; each keeps its players' names, avatars, XP, trophies and missed words. The old single-group data is migrated into Profile 1.
- Podiums show the XP each player earned in the game.
- The -ed/-ing pairs (bored/boring…) are never offered as wrong answers for each other.
- 82 more adjectives after comparing with the Oxford 3000 (A1–B2): better/worse/best/worst, open/closed, near/far, usual/unusual, fair/unfair, -ed/-ing pairs (annoyed/annoying…), more personality and quality words. 386 in total.
- Sentence Gap bank grows from 157 to 300 hand-checked sentences.

## 0.1.2 — vocabulary review
- Removed doubtful synonym/opposite links that could make a question arguable (e.g. surprised/bored, jealous/generous, perfect/terrible, scruffy/smart, calm/patient, bright/colourful, funny/silly).
- Better Catalan for miserable, cute, quiet, soft, true, sure, moody, brilliant, amazing; a gentler sentence for "devastated".

## 0.1.1 — published on robertpotau.github.io (October 2026)
- Canonical, Open Graph and JSON-LD metadata for the website; `index.html#hub` skips the title screen.

## 0.1.0 — first version (October 2026)
- Nine game modes: Golden Ladder (relay or one by one, 5 lifelines), Memory, Match-Up, Emotion Faces, Sentence Gap, Speed Round, Hot Seat, Balloon Pop, Word Bank (list + flashcards).
- 1–6 players with editable names and avatars, persistent XP, ranks and 16 trophies, podium and "words to review" after each game, class statistics.
- 304 adjectives in 14 topics, 46 of them with a face for the Emotion Faces game; 157 hand-written gap sentences.
- OpenMoji icons embedded in the single `index.html`; synthesised sound effects; British English speech from the browser.
- Self test (`index.html?selftest`) and a playthrough harness (`tools/autoplay.js`).
