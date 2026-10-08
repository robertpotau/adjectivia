# Adjectivia

**Describe it. Feel it. Win it!** A classroom game to learn English adjectives and feelings, designed for the whiteboard: 1 to 6 players take turns, with XP, ranks, trophies and a podium at the end of every game.

*Joc de pissarra per treballar els adjectius en anglès (1r–2n ESO): de 1 a 6 jugadors, 9 modes de joc, 387 adjectius, emocions amb cares i vocabulari amb ajuda en català.*

## Play
Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari). No installation, no server, no internet needed (a good internet connection only adds the Nunito font). Press the full-screen button for the whiteboard.

## The nine games
| Game | What you do |
|---|---|
| **Golden Ladder** | 15 questions from easy to very hard, safe steps at 5 and 10, five lifelines (50:50, Ask the class, Phone a friend, Swap, Double chance). Team relay or one by one. |
| **Memory** | Find pairs of synonyms, opposites or word + picture. |
| **Match-Up** | Connect words with the same meaning, or opposites. |
| **Emotion Faces** | Read the face and name the feeling, or find the face for a feeling. |
| **Sentence Gap** | Complete a sentence with the right adjective. |
| **Speed Round** | Beat the clock; one fast turn per player, with a +10 s power-up. |
| **Hot Seat** | Describe the word on screen without saying it while a classmate guesses. |
| **Balloon Pop** | Hangman with balloons, played letter by letter in turns. |
| **Word Bank** | Browse the 387 adjectives by topic and level, listen to them, practise with flashcards. |

Every question can be answered with the keyboard (A–D or 1–4). The **? català** button shows the Catalan translation for half the points.

## For the teacher
- **Profiles**: pick one of the 6 saved profiles (for example one per class) and rename it. Each profile remembers its players' names, avatars, XP, ranks, trophies and missed words in this browser, so Profile 1 is exactly as you left it next time.
- **Export / Import** (Profiles screen): save one profile or all of them in a file to back them up or move them to another computer.
- Choose the number of players (1–6) and type their names; every player keeps their own XP, rank and trophies, and each podium shows the XP they earned in that game.
- The class statistics (*Trophies & stats*) list the words that were missed most, and every podium shows "Words to review".
- **Settings**: sound, reading words aloud, "Final answer?" confirmation in the ladder, and data reset.

## Vocabulary
387 adjectives in 14 topics (happy / sad / angry / scared feelings, other feelings, body & health, personality, appearance, size & shape, opinions, senses, time & money, colours, weather), each with Catalan translation, English definition, example sentence, synonyms, opposites and a level (1–3). The selection was checked against the adjectives of the [Oxford 3000](https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000) (CEFR A1–B2) to cover the most common ones; the words, definitions and sentences are original. The list lives in `src/words.txt`; the 301 hand-checked gap sentences in `src/gaps.txt`.

## Building from source
`index.html` is generated. After editing anything in `src/`:

```
python tools/build.py
```

See [CLAUDE.md](CLAUDE.md) for the file layout, the quality rules for questions and the test procedure (`index.html?selftest`).

## Credits & licence
© 2026 Robert Potau Nuñez — all rights reserved (see [LICENSE](LICENSE) and the [terms of use](https://robertpotau.github.io/termes.html)). Developed with Claude Code (Anthropic) as a programming assistant.
Icons: [OpenMoji](https://openmoji.org), CC BY-SA 4.0. Font: Nunito (SIL OFL 1.1).
