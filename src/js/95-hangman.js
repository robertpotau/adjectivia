/* ============================================================
   Mode 9 — Balloon Pop (hangman with balloons)
   ============================================================ */
const BALLOON_COLORS = ['#ff6b6b', '#ffd23f', '#4cc9f0', '#3ddc97', '#a78bfa', '#fb923c', '#f472b6'];
function balloonsSVG(lives) {
  let s = '<svg viewBox="0 0 320 230" role="img" aria-label="' + lives + ' balloons left">';
  for (let i = 0; i < 7; i++) {
    const x = 36 + i * 41, y = 62 + (i % 2 ? 22 : 0) + Math.abs(3 - i) * 5;
    const pop = i >= lives;
    s += '<g class="bl' + (pop ? ' popped' : '') + '">' +
      '<path d="M' + x + ' ' + (y + 40) + ' Q' + (x + (160 - x) * .4) + ' ' + 150 + ' 160 196" stroke="#cfd8ff" stroke-width="1.6" fill="none"/>' +
      '<ellipse cx="' + x + '" cy="' + y + '" rx="25" ry="31" fill="' + BALLOON_COLORS[i] + '" stroke="rgba(0,0,0,.25)" stroke-width="2"/>' +
      '<path d="M' + (x - 14) + ' ' + (y - 14) + ' Q' + (x - 10) + ' ' + (y - 24) + ' ' + (x) + ' ' + (y - 26) + '" stroke="rgba(255,255,255,.7)" stroke-width="4" stroke-linecap="round" fill="none"/>' +
      '<path d="M' + (x - 4) + ' ' + (y + 31) + ' L' + x + ' ' + (y + 38) + ' L' + (x + 4) + ' ' + (y + 31) + 'Z" fill="' + BALLOON_COLORS[i] + '"/></g>';
  }
  s += '<g><rect x="132" y="192" width="56" height="30" rx="7" fill="#c98b4a" stroke="#7a4b1d" stroke-width="3"/>' +
    '<path d="M132 203 H188 M132 212 H188" stroke="#7a4b1d" stroke-width="2"/>' +
    '<circle cx="160" cy="190" r="9" fill="#ffe0b3" stroke="#7a4b1d" stroke-width="2"/></g></svg>';
  return s;
}
function setupHangman() {
  setupScreen({
    id: 'hangman', name: 'Balloon Pop', ic: '1F388',
    desc: 'Guess the hidden adjective letter by letter. Every wrong letter pops a balloon – keep the basket in the air!',
    options: [
      { key: 'per', label: 'Words per player', def: 1, choices: [{ v: 1, label: '1' }, { v: 2, label: '2' }, { v: 3, label: '3' }] },
      { key: 'level', label: 'Level', def: 'medium', choices: LEVEL_CHOICES }
    ],
    rules: ['Right letter: 10 points for each time it appears, and you play again.', 'Wrong letter: a balloon pops and the next player goes.',
      'Complete the word: +30 bonus. The ? button gives the Catalan translation (bonus halved).'],
    onStart: startHangman
  });
}
function startHangman(cfg, pids) {
  newGame('hangman', pids);
  const levels = LEVEL_SETS[cfg.level];
  const total = cfg.per * pids.length;
  const words = sample(WORDS.filter(x => levels.includes(x.l) && /^[a-z -]+$/.test(x.w) && x.w.length >= 3 && x.w.length <= 12), total);
  const bar = scoreBar(pids, G.scores); G.bar = bar;
  let k = 0;

  function playWord() {
    if (k >= total) return end();
    const t = words[k], letters = new Set(t.w.replace(/[^a-z]/g, '').split(''));
    let lives = 7, turn = k % pids.length, hint = false, finished = false, wrongCount = 0;
    const guessed = new Set();
    const balloons = h('div', { class: 'balloons' });
    const wordEl = h('div', { class: 'hm-word' });
    const hintEl = h('div', { class: 'q-hint' });
    const banner = h('div', { class: 'who-banner slim' });
    const kb = h('div', { class: 'kb' });
    const keyBtns = {};
    'qwertyuiopasdfghjklzxcvbnm'.split('').forEach(c => {
      const b = h('button', { class: 'key', onclick: () => guess(c) }, c.toUpperCase());
      keyBtns[c] = b;
    });
    ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].forEach(row => kb.append(h('div', { class: 'kb-row' }, row.split('').map(c => keyBtns[c]))));
    const paint = () => {
      balloons.innerHTML = balloonsSVG(lives);
      wordEl.replaceChildren(...t.w.split('').map(c => /[a-z]/.test(c) ? h('span', { class: 'hl' + (guessed.has(c) || finished ? ' on' : '') }, guessed.has(c) || finished ? c.toUpperCase() : ' ') : h('span', { class: 'hl sep' }, c === ' ' ? ' ' : c)));
      const pid = pids[turn % pids.length]; G.cur = pid; bar.update(G.scores, pid);
      banner.style.setProperty('--pc', PCOLORS[pid]);
      banner.replaceChildren(avatar(pid, 'md'), h('div', null, h('b', null, pname(pid) + (finished ? '' : '’s letter')), h('small', null, 'Word ' + (k + 1) + ' of ' + total + ' · ' + lives + ' balloons left')));
    };
    function guess(c) {
      if (finished || guessed.has(c)) return;
      guessed.add(c);
      const pid = pids[turn % pids.length], b = keyBtns[c];
      b.disabled = true;
      if (letters.has(c)) {
        b.classList.add('ok'); sfx('match');
        const n = t.w.split('').filter(x => x === c).length;
        addScore(pid, 10 * n);
        if ([...letters].every(l => guessed.has(l))) return solved(pid);
      } else {
        b.classList.add('bad'); lives--; wrongCount++; sfx('pop'); turn++;
        if (lives <= 0) return failed(pid);
      }
      paint();
    }
    function solved(pid) {
      finished = true; paint();
      addScore(pid, hint ? 15 : 30);
      recordAnswer(pid, t.w, true, hint);
      if (wrongCount === 0) award(pid, 'hangman');
      sfx('ok'); confetti(90);
      after('Well done, ' + pname(pid) + '!', true);
    }
    function failed(pid) {
      finished = true; paint();
      noteResult(t.w, false); G.missed.add(t.w);
      recordAnswer(pid, null, false, false);
      sfx('lose');
      after('All the balloons popped!', false);
    }
    function after(msg, ok) {
      $$('.key', kb).forEach(b => { b.disabled = true; });
      const last = k >= total - 1;
      hintEl.classList.add('on', ok ? 'okx' : 'kox');
      hintEl.replaceChildren(h('b', null, msg + ' '), h('span', null, t.w + ' = ' + t.ca + '. ' + t.ex));
      speak(t.w);
      nextWrap.replaceChildren(h('button', { class: 'btn primary big', onclick: () => { k++; playWord(); } }, last ? 'See the podium' : 'Next word →'));
    }
    const nextWrap = h('div', { class: 'actions' });
    const catChip = h('span', { class: 'chip big' }, ico(CATS[t.cat].ic, 'tiny'), ' ' + CATS[t.cat].label);
    const hintBtn = hintButton(() => { hint = true; hintEl.classList.add('on'); hintEl.replaceChildren(h('b', null, 'En català: '), h('span', { class: 'chip' }, t.ca)); });
    render(() => {
      Keys.on(e => { const c = e.key.toLowerCase(); if (c.length === 1 && c >= 'a' && c <= 'z') { guess(c); return true; } return false; });
      return h('div', { class: 'hangman' }, bar, banner, h('div', { class: 'hm-main' }, balloons, h('div', { class: 'hm-side' }, h('div', { class: 'hm-cat' }, catChip, h('small', null, t.w.replace(/[^a-z]/g, '').length + ' letters')), wordEl, hintEl, h('div', { class: 'under-q' }, hintBtn))), kb, nextWrap);
    }, 'Balloon Pop');
    paint();
  }
  function end() {
    const order = pids.slice().sort((a, b) => G.scores[b] - G.scores[a]);
    finishGame({ title: 'Balloon Pop finished!', order, scoreText: id => G.scores[id] + ' pts', again: () => startHangman(cfg, pids) });
  }
  playWord();
}
