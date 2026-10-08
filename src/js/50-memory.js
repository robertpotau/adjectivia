/* ============================================================
   Mode 2 — Memory (synonym, opposite and word+picture pairs)
   ============================================================ */
const IC_COUNT = {};
WORDS.forEach(x => { if (x.ic) IC_COUNT[x.ic] = (IC_COUNT[x.ic] || 0) + 1; });
/** words whose picture is unique, so a word+picture pair has one right answer */
const PIC_WORDS = WORDS.filter(x => x.ic && IC_COUNT[x.ic] === 1);

function setupMemory() {
  const lv = [{ v: 'easy', label: 'Easy' }, { v: 'medium', label: 'Medium' }, { v: 'hard', label: 'Hard' }, { v: 'mixed', label: 'Mixed' }];
  setupScreen({
    id: 'memory', name: 'Memory', ic: '1F9E0',
    desc: 'Turn over two cards. Find pairs of adjectives that go together. A pair lets you play again!',
    options: [
      { key: 'kind', label: 'Which pairs?', def: 'mixed', choices: [{ v: 'syn', label: 'Synonyms', desc: 'happy – glad' }, { v: 'opp', label: 'Opposites', desc: 'big – small' },
        { v: 'pic', label: 'Word + picture', desc: 'tall – 🦒' }, { v: 'mixed', label: 'Mixed' }] },
      { key: 'size', label: 'How many cards?', def: 16, choices: [{ v: 12, label: '12 cards' }, { v: 16, label: '16 cards' }, { v: 20, label: '20 cards' }] },
      { key: 'level', label: 'Level', def: 'medium', choices: lv }
    ],
    rules: ['Find a pair → +10 points and you go again. Every extra pair in a row gives +2 more.', 'Miss → the next player takes over.'],
    onStart: startMemory
  });
}
function buildPairs(kind, n, levels) {
  const pairs = [], usedWords = [];
  const clear = w => { const nr = near(w); return usedWords.every(x => x !== w && !nr.has(x)); };
  let guard = 0;
  while (pairs.length < n && guard++ < 800) {
    const k = kind === 'mixed' ? pick(['syn', 'opp', 'pic']) : kind;
    const pool = WORDS.filter(x => levels.includes(x.l) && clear(x.w));
    if (!pool.length) break;
    if (k === 'pic') {
      const a = pick(pool.filter(x => PIC_WORDS.includes(x)));
      if (!a) continue;
      pairs.push({ k, a, bText: null, bIc: a.ic }); usedWords.push(a.w);
    } else {
      const a = pick(pool.filter(x => (k === 'syn' ? SYN : OPP).get(x.w).size > 0));
      if (!a) continue;
      const bs = Array.from((k === 'syn' ? SYN : OPP).get(a.w)).map(byWord).filter(b => b.l <= Math.max.apply(null, levels) + 1 && clear(b.w));
      if (!bs.length) continue;
      const b = pick(bs);
      pairs.push({ k, a, b }); usedWords.push(a.w, b.w);
    }
  }
  return pairs;
}
function startMemory(cfg, pids) {
  newGame('memory', pids);
  const pairs = buildPairs(cfg.kind, cfg.size / 2, LEVEL_SETS[cfg.level]);
  if (pairs.length < 4) { toast('Not enough words for this setting', 'bad'); return setupMemory(); }
  const cards = [];
  pairs.forEach((p, i) => {
    cards.push({ pair: i, text: p.a.w, ic: null, word: p.a });
    cards.push(p.k === 'pic' ? { pair: i, text: null, ic: p.bIc, word: p.a } : { pair: i, text: p.b.w, ic: null, word: p.b });
  });
  const deck = shuffle(cards);
  const M = { turn: 0, up: [], busy: false, found: 0, mistakes: 0, combo: 0, pairs: pairs.length };
  G.cur = pids[0];
  const bar = scoreBar(pids, G.scores); G.bar = bar;
  const banner = h('div', { class: 'who-banner slim' });
  const paintTurn = () => {
    const pid = pids[M.turn % pids.length]; G.cur = pid; bar.update(G.scores, pid);
    banner.style.setProperty('--pc', PCOLORS[pid]);
    banner.replaceChildren(avatar(pid, 'md'), h('div', null, h('b', null, pname(pid) + '’s turn'), h('small', null, 'Pairs found: ' + M.found + ' of ' + M.pairs + (M.combo > 1 ? ' · combo x' + M.combo : ''))));
  };
  const cols = cfg.size === 20 ? 5 : 4;
  const grid = h('div', { class: 'mgrid', style: '--cols:' + cols + ';--rows:' + Math.ceil(cfg.size / cols) });
  deck.forEach((c, idx) => {
    const front = c.ic ? h('span', { class: 'face front pic' }, ico(c.ic)) : h('span', { class: 'face front word' }, h('span', null, c.text));
    c.el = h('button', { class: 'mcard', 'aria-label': 'Card ' + (idx + 1), onclick: () => flip(c) },
      h('span', { class: 'face back' }, ico('2753')), front);
    grid.append(c.el);
  });
  render(h('div', { class: 'memory' }, bar, banner, grid), 'Memory');
  paintTurn();

  function flip(c) {
    if (M.busy || c.up || c.done) return;
    c.up = true; c.el.classList.add('up'); sfx('flip');
    if (c.text && !c.ic) speak(c.text);
    M.up.push(c);
    if (M.up.length < 2) return;
    M.busy = true;
    const [a, b] = M.up, pid = pids[M.turn % pids.length];
    if (a.pair === b.pair) {
      Timers.set(() => {
        a.done = b.done = true; a.el.classList.add('done'); b.el.classList.add('done');
        a.el.style.setProperty('--pc', PCOLORS[pid]); b.el.style.setProperty('--pc', PCOLORS[pid]);
        M.found++; M.combo++; M.up = [];
        sfx('match'); confettiFrom(a.el, 18);
        addScore(pid, 10 + 2 * (M.combo - 1));
        recordAnswer(pid, a.word.w, true, false);
        if (M.found === M.pairs) return Timers.set(endMemory, 900);
        M.busy = false; paintTurn();
      }, 500);
    } else {
      Timers.set(() => {
        a.up = b.up = false; a.el.classList.remove('up'); b.el.classList.remove('up'); M.up = [];
        M.mistakes++; M.combo = 0; recordAnswer(pid, null, false, false);
        M.turn++; M.busy = false; sfx('ko'); paintTurn();
      }, 1200);
    }
  }
  function endMemory() {
    if (M.mistakes === 0 && M.pairs >= 8) pids.forEach(id => award(id, 'memory'));
    const order = pids.slice().sort((x, y) => G.scores[y] - G.scores[x]);
    finishGame({ title: 'Memory finished!', subtitle: 'Mistakes in total: ' + M.mistakes, order, scoreText: id => G.scores[id] + ' pts', again: () => startMemory(cfg, pids) });
  }
}
