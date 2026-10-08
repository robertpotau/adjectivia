/* ============================================================
   Adjectivia — question generator
   A question is:
   { type, word, lead, big, bigIcon, sentence, speakText, options:[{label,ic,w}], iconOptions,
     answer, hintCa:[[en,ca]], explain }
   Wrong answers never come from near(word): words linked by two synonym/opposite steps.
   ============================================================ */
const adjacent = (a, b) => a === b || (MACRO_ADJ[a] || []).includes(b) || (MACRO_ADJ[b] || []).includes(a);
const RECENT = [];
function remember(w) { RECENT.push(w); if (RECENT.length > 70) RECENT.shift(); }

/* faces that look too alike to be offered together (icon codes) */
const FACE_CLASH = [['1F922', '1F92E'], ['1F644', '1F611'], ['1F612', '1F611'], ['1F615', '1F61F'], ['1F641', '1F61F'], ['1F97A', '1F61F'],
  ['1F625', '1F61F'], ['1F62E', '1F632'], ['1F62E', '1F92F'], ['1F631', '1F628'], ['1F631', '1F632'], ['1F630', '1F625'], ['1F62B', '1F971'],
  ['1F62B', '1F629'], ['1F634', '1F971'], ['1F615', '1F914'], ['1F633', '1F62C'], ['1F611', '1F971'], ['1F620', '1F612'], ['1F612', '1F644']];
const clash = (a, b) => a === b || FACE_CLASH.some(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));
/* easy-to-tell-apart faces, used as wrong answers on Easy/Medium */
const CORE_FACES = new Set(['happy', 'sad', 'angry', 'scared', 'surprised', 'tired', 'sick', 'excited', 'bored', 'worried', 'confused']);

function blankOut(ex, word) {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(^|[^A-Za-z-])' + esc + '(?![A-Za-z-])', 'i');
  if (!re.test(ex)) return null;
  return ex.replace(re, (all, pre) => pre + '_____');
}
const maxLevel = c => Math.max.apply(null, c.levels);

/** `n` wrong answers for target `t`, none of them near(t); `filter` narrows further. */
function distract(t, n, filter, c, extraNo) {
  const nr = near(t.w), no = new Set(extraNo || []);
  let pool = WORDS.filter(x => x.w !== t.w && !nr.has(x.w) && !no.has(x.w) && (!filter || filter(x)));
  const lv = pool.filter(x => c.levels.includes(x.l));
  if (lv.length >= n + 4) pool = lv;
  if (c.close) {
    const same = pool.filter(x => x.macro === t.macro);
    if (same.length >= n) pool = same;
  }
  if (pool.length < n) return null;
  return sample(pool, n);
}
function mkOptions(right, wrongs) {
  const all = shuffle([right].concat(wrongs));
  return { options: all.map(x => ({ label: x.w, ic: x.ic, w: x.w })), answer: all.indexOf(right) };
}
const caPairs = list => list.map(x => [x.w, x.ca]);
const friendly = (cands, c) => {
  const ok = cands.filter(x => x.l <= maxLevel(c) + 1);
  return pick(ok.length ? ok : cands);
};

/* Feeling groups are dense: a chain like heartbroken - devastated ... delighted - pleased - glad can reach far.
   So in a synonym/opposite question no wrong answer may belong to the mood group of the question word or of its answer. */
const MOOD_CATS = new Set(['joy', 'sad', 'angry', 'fear']);
const moodClash = (x, t, right) => MOOD_CATS.has(x.cat) && (x.cat === t.cat || x.cat === right.cat);

const QT = {
  syn(t, c) {
    const cands = synOf(t.w).map(byWord);
    if (!cands.length) return null;
    const right = friendly(cands, c);
    const wr = distract(t, 3, x => !moodClash(x, t, right), c, [right.w]); if (!wr) return null;
    const o = mkOptions(right, wr);
    return Object.assign({ type: 'syn', word: t.w, lead: 'Which word means almost the SAME as', big: t.w, speakText: t.w,
      hintCa: [[t.w, t.ca]], explain: t.w + ' ≈ ' + right.w + '  (' + t.ca + ' ≈ ' + right.ca + ')' }, o);
  },
  opp(t, c) {
    const cands = oppOf(t.w).map(byWord);
    if (!cands.length) return null;
    const right = friendly(cands, c);
    const wr = distract(t, 3, x => !moodClash(x, t, right), c, [right.w]); if (!wr) return null;
    const o = mkOptions(right, wr);
    return Object.assign({ type: 'opp', word: t.w, lead: 'Which word is the OPPOSITE of', big: t.w, speakText: t.w,
      hintCa: [[t.w, t.ca]], explain: t.w + ' ↔ ' + right.w + '  (' + t.ca + ' ↔ ' + right.ca + ')' }, o);
  },
  def(t, c) {
    const wr = distract(t, 3, null, c); if (!wr) return null;
    const o = mkOptions(t, wr);
    return Object.assign({ type: 'def', word: t.w, lead: 'Which adjective means', big: '“' + cap(t.def) + '”', speakText: '',
      hintCa: caPairs([t].concat(wr)), explain: t.w + ' = ' + t.def + '  (' + t.ca + ')' }, o);
  },
  /* sentence from the hand-written bank: Easy = 3 easy wrongs, Medium = 1 hard + 2 easy, Hard = 2 hard + 1 easy */
  gap(t, c) {
    const g = GAPS.get(t.w); if (!g) return null;
    const lvl = maxLevel(c), nHard = lvl >= 3 ? 2 : lvl === 2 ? 1 : 0;
    const hard = sample(g.h.filter(w => WMAP.has(w)), nHard);
    const easy = sample(g.e.filter(w => WMAP.has(w)), 3 - hard.length);
    if (hard.length + easy.length < 3) return null;
    const wrongs = hard.concat(easy).map(byWord);
    const o = mkOptions(t, wrongs);
    const sentence = g.s.replace('___', '_____');
    return Object.assign({ type: 'gap', word: t.w, lead: 'Choose the best word to complete the sentence', sentence, speakText: '',
      hintCa: caPairs([t].concat(wrongs)), explain: g.s.replace('___', t.w) + '  (' + t.w + ' = ' + t.ca + ')' }, o);
  },
  face(t, c) {
    if (!t.face) return null;
    const fp = pickFaces(t, 3, c); if (!fp) return null;
    const o = mkOptions(t, fp);
    return Object.assign({ type: 'face', word: t.w, lead: 'How does this person feel?', bigIcon: t.ic, speakText: '',
      hintCa: caPairs([t].concat(fp)), explain: t.w + ' = ' + t.ca }, o);
  },
  faceRev(t, c) {
    if (!t.face) return null;
    const fp = pickFaces(t, 3, c); if (!fp) return null;
    const o = mkOptions(t, fp);
    return Object.assign({ type: 'faceRev', word: t.w, lead: 'Which face shows', big: t.w, speakText: t.w, iconOptions: true,
      hintCa: [[t.w, t.ca]], explain: t.w + ' = ' + t.ca }, o);
  },
  listen(t, c) {
    const wr = distract(t, 3, x => Math.abs(x.w.length - t.w.length) < 6, c); if (!wr) return null;
    const o = mkOptions(t, wr);
    return Object.assign({ type: 'listen', word: t.w, lead: 'Listen, then choose the word you hear', speakText: t.w, listenBtn: true,
      hintCa: caPairs([t].concat(wr)), explain: t.w + ' = ' + t.ca }, o);
  }
};
/* wrong faces: different mood group, distinct pictures, not easily confused with the target's face */
function pickFaces(t, n, c) {
  const nr = near(t.w);
  const easy = maxLevel(c) < 3;
  let pool = WORDS.filter(x => x.face && x.cat !== t.cat && !nr.has(x.w) && !clash(x.ic, t.ic) && (!easy || CORE_FACES.has(x.w)));
  if (pool.length < n + 2) pool = WORDS.filter(x => x.face && x.cat !== t.cat && !nr.has(x.w) && !clash(x.ic, t.ic));
  const out = [];
  for (const x of shuffle(pool)) {
    if (out.length === n) break;
    if (out.some(y => y.cat === x.cat || clash(y.ic, x.ic))) continue;
    out.push(x);
  }
  return out.length === n ? out : null;
}

/* odd one out: three words of one group and one that clearly does not belong */
/* Words that cannot also describe a feeling or a personality (so "the odd one" is never arguable):
   plain shapes, most weather words and a few colours. */
const OOO_SHAPES = ['round', 'square', 'wide', 'long', 'narrow'];
const OOO_WEATHER = ['rainy', 'windy', 'snowy', 'cloudy'];
const OOO_COLOURS = ['orange', 'pink', 'purple', 'brown', 'grey', 'white', 'black'];
const OOO_SPECS = [
  { base: ['FEEL'], odd: x => OOO_SHAPES.includes(x.w) || OOO_WEATHER.includes(x.w) },
  { base: ['TRAIT'], odd: x => OOO_SHAPES.includes(x.w) || OOO_WEATHER.includes(x.w) || OOO_COLOURS.includes(x.w) },
  { base: ['LOOK', 'SIZE'], odd: x => x.macro === 'FEEL' || x.macro === 'TRAIT' },
  { base: ['COLOUR'], odd: x => ['FEEL', 'TRAIT', 'WEATHER'].includes(x.macro) || OOO_SHAPES.includes(x.w) },
  { base: ['WEATHER'], odd: x => ['FEEL', 'TRAIT', 'COLOUR'].includes(x.macro) || OOO_SHAPES.includes(x.w) }
];
function oddOneOut(c) {
  for (let tries = 0; tries < 20; tries++) {
    const spec = pick(OOO_SPECS), base = spec.base;
    const baseWords = WORDS.filter(x => base.includes(x.macro) && c.levels.includes(x.l));
    if (baseWords.length < 3) continue;
    const odds = WORDS.filter(x => !base.includes(x.macro) && spec.odd(x) && x.l <= maxLevel(c) && !c.used.has(x.w));
    if (!odds.length) continue;
    const odd = pick(odds);
    const three = [];
    for (const x of shuffle(baseWords)) {
      if (three.length === 3) break;
      if (x.w === odd.w || related(x.w, odd.w) || three.some(y => y.w === x.w)) continue;
      three.push(x);
    }
    if (three.length < 3) continue;
    const o = mkOptions(odd, three);
    const grp = { FEEL: 'feelings', TRAIT: 'personality words', LOOK: 'words about appearance', COLOUR: 'colours', WEATHER: 'weather words' }[base[0]];
    return Object.assign({ type: 'ooo', word: odd.w, lead: 'Which word does NOT belong with the others?', speakText: '',
      hintCa: caPairs([odd].concat(three)), explain: odd.w + ' is the odd one out: the others are ' + grp + '.' }, o);
  }
  return null;
}

/* ---------- target selection ---------- */
const TARGET_OK = {
  syn: x => SYN.get(x.w).size > 0, opp: x => OPP.get(x.w).size > 0, def: () => true,
  gap: x => GAPS.has(x.w), face: x => x.face, faceRev: x => x.face, listen: () => true, ooo: () => true
};
/**
 * ctx = { levels:[1..3], types:[...], used:Set, close:bool }
 * Returns a question or null when nothing fits.
 */
function nextQuestion(ctx) {
  ctx.used = ctx.used || new Set();
  const tried = new Set();       // targets that could not make a question this time: never retry them in this call
  for (let attempt = 0; attempt < 80; attempt++) {
    if (attempt === 40) ctx.used.clear();
    const type = pick(ctx.types);
    if (type === 'listen' && !ttsReady()) continue;
    let q = null;
    if (type === 'ooo') q = oddOneOut(ctx);
    else {
      let pool = WORDS.filter(x => ctx.levels.includes(x.l) && TARGET_OK[type](x) && !ctx.used.has(x.w) && !tried.has(type + x.w));
      if (!pool.length) continue;
      const fresh = pool.filter(x => !RECENT.includes(x.w));
      if (fresh.length >= 4) pool = fresh;
      const missed = missedWords(40).filter(x => pool.includes(x));
      const t = missed.length && Math.random() < 0.2 ? pick(missed) : pick(pool);
      q = QT[type](t, ctx);
      if (!q) tried.add(type + t.w);
    }
    if (q) { ctx.used.add(q.word); remember(q.word); return q; }
  }
  return null;
}
/** build `n` questions in one go (used by round-based modes) */
function questionSet(n, ctx) {
  const out = [];
  for (let i = 0; i < n; i++) { const q = nextQuestion(ctx); if (q) out.push(q); }
  return out;
}
