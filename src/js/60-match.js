/* ============================================================
   Mode 3 — Match-Up (connect synonyms or opposites)
   ============================================================ */
function setupMatch() {
  const lv = [{ v: 'easy', label: 'Easy' }, { v: 'medium', label: 'Medium' }, { v: 'hard', label: 'Hard' }, { v: 'mixed', label: 'Mixed' }];
  setupScreen({
    id: 'match', name: 'Match-Up', ic: '1F517',
    desc: 'Connect each word on the left with its partner on the right: words with the same meaning, or opposites.',
    options: [
      { key: 'kind', label: 'What do we match?', def: 'mixed', choices: [{ v: 'syn', label: 'Same meaning' }, { v: 'opp', label: 'Opposites' }, { v: 'mixed', label: 'Both (one each round)' }] },
      { key: 'rounds', label: 'Rounds per player', def: 1, choices: [{ v: 1, label: '1' }, { v: 2, label: '2' }, { v: 3, label: '3' }] },
      { key: 'level', label: 'Level', def: 'medium', choices: lv }
    ],
    rules: ['Tap a word on the left, then its partner on the right.', 'Right at the first try = 10 points; after a mistake = 4 points.'],
    onStart: startMatch
  });
}
function buildMatchPairs(kind, n, levels) {
  const map = kind === 'syn' ? SYN : OPP;
  for (const strict of [true, false]) {
    const pairs = [], used = [];
    const clear = w => { if (used.includes(w)) return false; if (!strict) return used.every(x => !related(w, x)); const nr = near(w); return used.every(x => !nr.has(x)); };
    let guard = 0;
    while (pairs.length < n && guard++ < 600) {
      const cands = WORDS.filter(x => levels.includes(x.l) && map.get(x.w).size > 0 && clear(x.w));
      if (!cands.length) break;
      const a = pick(cands);
      const bs = Array.from(map.get(a.w)).map(byWord).filter(b => b.l <= Math.max.apply(null, levels) + 1 && clear(b.w));
      if (!bs.length) continue;
      const b = pick(bs);
      pairs.push({ a, b }); used.push(a.w, b.w);
    }
    if (pairs.length === n) return pairs;
  }
  return null;
}
function startMatch(cfg, pids) {
  newGame('match', pids);
  const totalRounds = cfg.rounds * pids.length;
  let round = 0;
  const levels = LEVEL_SETS[cfg.level];
  const perfect = new Set();
  const bar = scoreBar(pids, G.scores); G.bar = bar;

  function playRound() {
    const pid = pids[round % pids.length]; G.cur = pid; bar.update(G.scores, pid);
    const kind = cfg.kind === 'mixed' ? (round % 2 === 0 ? 'syn' : 'opp') : cfg.kind;
    const pairs = buildMatchPairs(kind, 5, levels);
    if (!pairs) { toast('Not enough words for this setting', 'bad'); return setupMatch(); }
    let mistakes = 0, found = 0, selected = null;
    const tries = new Map();
    const left = shuffle(pairs.map((p, i) => ({ text: p.a.w, i }))), right = shuffle(pairs.map((p, i) => ({ text: p.b.w, i })));
    const mk = (item, side) => {
      const b = h('button', { class: 'mw ' + side, onclick: () => click(item, side, b) }, h('span', { class: 'mw-n' }), h('span', null, item.text));
      item.el = b; return b;
    };
    const lcol = h('div', { class: 'mcol' }, left.map(it => mk(it, 'l'))), rcol = h('div', { class: 'mcol' }, right.map(it => mk(it, 'r')));
    const title = kind === 'syn' ? 'Same meaning' : 'Opposites';
    const banner = h('div', { class: 'who-banner slim', style: '--pc:' + PCOLORS[pid] }, avatar(pid, 'md'),
      h('div', null, h('b', null, pname(pid) + ' – ' + title), h('small', null, 'Round ' + (round + 1) + ' of ' + totalRounds + ' · tap a word on the left, then its partner')));
    const mid = h('div', { class: 'mmid' }, kind === 'syn' ? '=' : '↔');
    render(h('div', { class: 'matchup' }, bar, banner, h('div', { class: 'mboard ' + kind }, lcol, mid, rcol)), 'Match-Up');
    bar.update(G.scores, pid);

    function click(item, side, el) {
      if (item.done) return;
      sfx('click');
      speak(item.text);
      if (side === 'l') {
        if (selected) selected.el.classList.remove('sel');
        selected = item; el.classList.add('sel'); return;
      }
      if (!selected) { toast('Pick a word on the left first', ''); return; }
      const l = selected;
      tries.set(l.i, (tries.get(l.i) || 0));
      if (l.i === item.i) {
        const first = tries.get(l.i) === 0;
        l.done = item.done = true; found++;
        [l.el, item.el].forEach(e => { e.classList.remove('sel'); e.classList.add('done'); e.style.setProperty('--pc', PCOLORS[pid]); e.firstChild.textContent = String(found); });
        sfx('match'); confettiFrom(el, 16);
        addScore(pid, first ? 10 : 4);
        recordAnswer(pid, pairs[l.i].a.w, true, false);
        selected = null;
        if (found === 5) Timers.set(roundDone, 900);
      } else {
        tries.set(l.i, tries.get(l.i) + 1); mistakes++;
        sfx('ko'); [l.el, el].forEach(e => { e.classList.add('bad'); Timers.set(() => e.classList.remove('bad'), 500); });
        l.el.classList.remove('sel'); selected = null;
        recordAnswer(pid, pairs[l.i].a.w, false, false); noteResult(pairs[l.i].b.w, false);
      }
    }
    function roundDone() {
      if (mistakes === 0) { perfect.add(pid); award(pid, 'match'); }
      round++;
      sfx('levelup'); confetti(60);
      const last = round >= totalRounds;
      openModal(h('div', { class: 'center' }, h('h3', null, mistakes === 0 ? 'Perfect round!' : 'Round complete'),
        h('p', null, mistakes === 0 ? 'No mistakes at all.' : 'Mistakes: ' + mistakes),
        h('div', { class: 'actions' }, h('button', { class: 'btn primary big', onclick: () => { closeModal(); } }, last ? 'See the podium' : 'Next: ' + pname(pids[round % pids.length])))),
      () => { if (last) endMatch(); else playRound(); });
    }
  }
  function endMatch() {
    const order = pids.slice().sort((x, y) => G.scores[y] - G.scores[x]);
    finishGame({ title: 'Match-Up finished!', order, scoreText: id => G.scores[id] + ' pts', again: () => startMatch(cfg, pids) });
  }
  playRound();
}
