/* ============================================================
   Adjectivia — vocabulary model (WORDS_DATA is generated from src/words.txt by build.py)
   ============================================================ */
const CATS = {
  joy:     { label: 'Happy feelings',     ic: '1F604', macro: 'FEEL',    val: 1 },
  sad:     { label: 'Sad feelings',       ic: '1F622', macro: 'FEEL',    val: -1 },
  angry:   { label: 'Angry feelings',     ic: '1F620', macro: 'FEEL',    val: -1 },
  fear:    { label: 'Scared & worried',   ic: '1F628', macro: 'FEEL',    val: -1 },
  feel:    { label: 'Other feelings',     ic: '1F62E', macro: 'FEEL',    val: 0 },
  body:    { label: 'Body & health',      ic: '1F912', macro: 'BODY',    val: 0 },
  trait:   { label: 'Personality',        ic: '1F9B8', macro: 'TRAIT',   val: 0 },
  look:    { label: 'Appearance',         ic: '1F483', macro: 'LOOK',    val: 0 },
  size:    { label: 'Size & shape',       ic: '1F418', macro: 'SIZE',    val: 0 },
  quality: { label: 'Opinions & quality', ic: '2B50',  macro: 'QUAL',    val: 0 },
  sense:   { label: 'Senses & things',    ic: '1F443', macro: 'SENSE',   val: 0 },
  world:   { label: 'Time, speed & money', ic: '23F0', macro: 'WORLD',   val: 0 },
  colour:  { label: 'Colours',            ic: '1F308', macro: 'COLOUR',  val: 0 },
  weather: { label: 'Weather',            ic: '1F326', macro: 'WEATHER', val: 0 }
};
const CAT_ORDER = Object.keys(CATS);
/** macros whose words could be confused with each other: never mixed in an odd-one-out question */
const MACRO_ADJ = {
  FEEL: ['BODY', 'TRAIT', 'QUAL'], BODY: ['FEEL', 'QUAL', 'TRAIT'], TRAIT: ['FEEL', 'QUAL', 'LOOK'], LOOK: ['SIZE', 'TRAIT', 'COLOUR', 'QUAL'],
  SIZE: ['LOOK', 'SENSE', 'QUAL'], QUAL: ['TRAIT', 'SENSE', 'WORLD', 'FEEL'], SENSE: ['QUAL', 'SIZE', 'WORLD', 'WEATHER', 'COLOUR'],
  WORLD: ['QUAL', 'SENSE', 'LOOK'], COLOUR: ['LOOK', 'SENSE'], WEATHER: ['SENSE']
};
const LEVEL_SETS = { easy: [1], medium: [1, 2], hard: [2, 3], mixed: [1, 2, 3] };
const LEVEL_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard', mixed: 'Mixed' };

const WORDS = WORDS_DATA.map(r => ({
  w: r.w, ca: r.ca, cat: r.c, l: r.l, ic: r.i || '', face: !!r.f, syn: r.s, opp: r.o, def: r.d, ex: r.e,
  macro: CATS[r.c].macro
}));
const WMAP = new Map(WORDS.map(x => [x.w, x]));
const byWord = w => WMAP.get(w);
/** hand-written gap-fill sentences: GAPS.get(word) = { s: sentence with ___, h: [hard wrong answers], e: [easy wrong answers] } */
const GAPS = new Map(GAPS_DATA.filter(g => WMAP.has(g.w)).map(g => [g.w, g]));

/* symmetric relations, restricted to words that exist */
const SYN = new Map(), OPP = new Map();
WORDS.forEach(x => { SYN.set(x.w, new Set()); OPP.set(x.w, new Set()); });
WORDS.forEach(x => {
  x.syn.forEach(y => { if (WMAP.has(y) && y !== x.w) { SYN.get(x.w).add(y); SYN.get(y).add(x.w); } });
  x.opp.forEach(y => { if (WMAP.has(y) && y !== x.w) { OPP.get(x.w).add(y); OPP.get(y).add(x.w); } });
});
const synOf = w => Array.from(SYN.get(w) || []);
const oppOf = w => Array.from(OPP.get(w) || []);
const related = (a, b) => SYN.get(a).has(b) || OPP.get(a).has(b);

const NEAR_CACHE = new Map();
/** every word within two steps (synonym/opposite links): never offered as a wrong answer for `w` */
function near(w) {
  let s = NEAR_CACHE.get(w);
  if (s) return s;
  s = new Set([w]);
  let frontier = [w];
  for (let d = 0; d < 2; d++) {
    const nxt = [];
    frontier.forEach(a => [SYN.get(a), OPP.get(a)].forEach(set => set.forEach(b => { if (!s.has(b)) { s.add(b); nxt.push(b); } })));
    frontier = nxt;
  }
  NEAR_CACHE.set(w, s);
  return s;
}

/* ---------- per-word statistics (class-wide, saved in the browser) ---------- */
function noteResult(word, ok) {
  const s = ST.words[word] || (ST.words[word] = { ok: 0, ko: 0 });
  if (ok) s.ok++; else s.ko++;
  save();
}
function missedWords(limit) {
  return Object.keys(ST.words).filter(w => WMAP.has(w) && ST.words[w].ko > ST.words[w].ok)
    .sort((a, b) => (ST.words[b].ko - ST.words[b].ok) - (ST.words[a].ko - ST.words[a].ok))
    .slice(0, limit || 50).map(byWord);
}
