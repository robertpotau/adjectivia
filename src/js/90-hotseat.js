/* ============================================================
   Mode 8 — Hot Seat (describe the adjective; the player in the seat guesses)
   ============================================================ */
function setupHotSeat() {
  setupScreen({
    id: 'hotseat', name: 'Hot Seat', ic: '1F3A4', minPlayers: 2,
    desc: 'One player sits with their back to the board. The others describe the adjective on screen without saying it!',
    options: [
      { key: 'secs', label: 'Seconds per turn', def: 60, choices: [{ v: 45, label: '45 s' }, { v: 60, label: '60 s' }, { v: 90, label: '90 s' }, { v: 120, label: '2 min' }] },
      { key: 'skips', label: 'Skips per turn', def: 2, choices: [{ v: 0, label: 'None' }, { v: 2, label: '2' }, { v: 4, label: '4' }] },
      { key: 'level', label: 'Level', def: 'medium', choices: LEVEL_CHOICES }
    ],
    rules: ['Describers: use mime, examples, opposites, synonyms… but never say the word (in English or Catalan) or its translation.',
      'Guessed word: +2 points for the player in the seat and +1 for each describer.', 'The teacher or a describer taps “Guessed!” when the word is right.'],
    onStart: startHotSeat
  });
}
function startHotSeat(cfg, pids) {
  newGame('hotseat', pids);
  const levels = LEVEL_SETS[cfg.level];
  let pool = shuffle(WORDS.filter(x => levels.includes(x.l) && x.cat !== 'colour'));
  const bar = scoreBar(pids, G.scores); G.bar = bar;
  let turn = 0;
  const nextWord = () => { if (!pool.length) pool = shuffle(WORDS.filter(x => levels.includes(x.l))); return pool.pop(); };

  function intro() {
    const pid = pids[turn]; G.cur = pid;
    render(h('div', { class: 'intro' }, bar, h('div', { class: 'seat' }, avatar(pid, 'xxl'), ico('1FA91', 'seat-ico')),
      h('h2', null, pname(pid) + ' is in the hot seat!'),
      h('p', null, pname(pid) + ', turn your back to the board. Everyone else: get ready to describe!'),
      h('button', { class: 'btn primary big', onclick: countIn }, ico('1F3A4'), ' Start the turn')), 'Hot Seat');
    bar.update(G.scores, pid);
    sfx('start');
  }
  function countIn() {
    let n = 3;
    const big = h('div', { class: 'count-in' }, '3');
    render(h('div', { class: 'intro' }, big), 'Hot Seat'); sfx('tick');
    Timers.every(() => { n--; if (n <= 0) { run(); return; } big.textContent = String(n); sfx('tick'); }, 800);
  }
  function run() {
    const pid = pids[turn];
    let over = false, skips = cfg.skips, cur = null, cd = null, card = null, skipBtn = null, hintBox = null;
    const got = [], skipped = [];
    const describers = pids.filter(p => p !== pid);
    const show = () => {
      cur = nextWord();
      card.replaceChildren(ico(wordIcon(cur), 'xxl'), h('div', { class: 'hs-word' }, cur.w),
        h('div', { class: 'hs-meta' }, h('span', { class: 'chip' }, CATS[cur.cat].label), h('span', { class: 'chip' }, 'Not allowed: ' + cur.w + ', ' + cur.ca)));
      hintBox.replaceChildren(); hintBox.hidden = true;
      card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
    };
    const guessed = () => {
      if (over) return;
      got.push(cur); sfx('ok'); confettiFrom(card, 24);
      addScore(pid, 2); describers.forEach(d => addScore(d, 1));
      recordAnswer(pid, cur.w, true, false);
      if (got.length === 6) award(pid, 'hotseat');
      show();
    };
    const skip = () => {
      if (over || skips <= 0) return;
      skips--; skipped.push(cur); noteResult(cur.w, false); G.missed.add(cur.w); sfx('click');
      skipBtn.lastChild.textContent = ' Skip (' + skips + ')'; skipBtn.disabled = skips <= 0;
      show();
    };
    render(() => {
      cd = countdown(cfg.secs, endTurn, { big: true, tick: true });
      card = h('div', { class: 'hs-card' });
      hintBox = h('div', { class: 'hs-hint', hidden: true });
      skipBtn = h('button', { class: 'btn', disabled: skips <= 0, onclick: skip }, ico('23ED'), ' Skip (' + skips + ')');
      const sentenceBtn = h('button', { class: 'btn small', onclick: () => { hintBox.hidden = false; hintBox.textContent = blankOut(cur.ex, cur.w) || cur.ex; } }, ico('1F4A1'), ' Example sentence');
      const who = h('div', { class: 'who-banner slim', style: '--pc:' + PCOLORS[pid] }, avatar(pid, 'md'), h('div', null, h('b', null, pname(pid) + ' guesses'), h('small', null, 'Describers: ' + describers.map(pname).join(', '))));
      Keys.on(e => { if (e.key === 'Enter' || e.key === ' ') { guessed(); return true; } if (e.key.toLowerCase() === 's') { skip(); return true; } return false; });
      return h('div', { class: 'hotseat' }, bar, who, cd.el, card, hintBox,
        h('div', { class: 'actions' }, h('button', { class: 'btn primary big', onclick: guessed }, ico('2705'), ' Guessed!'), skipBtn, sentenceBtn));
    }, 'Hot Seat');
    bar.update(G.scores, pid);
    show();
    function endTurn() {
      over = true; sfx('lose');
      const last = turn >= pids.length - 1;
      render(h('div', { class: 'intro result' }, bar, avatar(pid, 'xxl'), h('h2', null, 'Time! ' + pname(pid) + ' guessed ' + got.length + (got.length === 1 ? ' word' : ' words')),
        got.length ? h('div', { class: 'chips' }, got.map(x => h('button', { class: 'chip big', onclick: () => speak(x.w) }, x.w, h('small', null, ' = ' + x.ca)))) : h('p', { class: 'muted' }, 'No words this time. Try again next round!'),
        h('button', { class: 'btn primary big', onclick: () => { if (last) endHot(); else { turn++; intro(); } } }, last ? 'See the podium' : 'Next: ' + pname(pids[turn + 1]) + ' →')), 'Hot Seat');
      bar.update(G.scores, pid);
      if (got.length >= 3) { sfx('win'); confetti(100); }
    }
  }
  function endHot() {
    const order = pids.slice().sort((a, b) => G.scores[b] - G.scores[a]);
    finishGame({ title: 'Hot Seat finished!', order, scoreText: id => G.scores[id] + ' pts', again: () => startHotSeat(cfg, pids) });
  }
  intro();
}
