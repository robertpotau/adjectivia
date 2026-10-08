/* ============================================================
   Modes 5-7 — Emotion Faces, Sentence Gap (rotating questions) and Speed Round (timed turns)
   ============================================================ */
const LEVEL_CHOICES = [{ v: 'easy', label: 'Easy' }, { v: 'medium', label: 'Medium' }, { v: 'hard', label: 'Hard' }, { v: 'mixed', label: 'Mixed' }];
const PER_CHOICES = [{ v: 3, label: '3 each' }, { v: 5, label: '5 each' }, { v: 8, label: '8 each' }];
const TIMER_CHOICES = [{ v: 0, label: 'No limit' }, { v: 30, label: '30 s' }, { v: 15, label: '15 s' }];

function setupFaces() {
  setupScreen({
    id: 'faces', name: 'Emotion Faces', ic: '1F60E',
    desc: 'Read the faces! Say how the person feels, or find the face that matches a feeling.',
    options: [
      { key: 'dir', label: 'What do we guess?', def: 'mixed', choices: [{ v: 'word', label: 'Face → feeling' }, { v: 'face', label: 'Feeling → face' }, { v: 'mixed', label: 'Both' }] },
      { key: 'per', label: 'Questions per player', def: 5, choices: PER_CHOICES },
      { key: 'level', label: 'Level', def: 'medium', choices: LEVEL_CHOICES },
      { key: 'timer', label: 'Time per question', def: 0, choices: TIMER_CHOICES }
    ],
    rules: ['Right answer: 10 points, plus a streak bonus.', 'The ? button shows the Catalan words but halves the points.'],
    onStart: startFaces
  });
}
function startFaces(cfg, pids) {
  startRounds({ mode: 'faces', title: 'Emotion Faces', cfg, pids, restart: startFaces,
    types: cfg.dir === 'word' ? ['face'] : cfg.dir === 'face' ? ['faceRev'] : ['face', 'faceRev'] });
}
function setupGap() {
  setupScreen({
    id: 'gap', name: 'Sentence Gap', ic: '1F4DD',
    desc: 'Complete the sentence with the best adjective. Read the clues carefully!',
    options: [
      { key: 'per', label: 'Questions per player', def: 5, choices: PER_CHOICES },
      { key: 'level', label: 'Level', def: 'medium', choices: LEVEL_CHOICES },
      { key: 'timer', label: 'Time per question', def: 0, choices: TIMER_CHOICES }
    ],
    rules: ['Right answer: 10 points, plus a streak bonus.', 'With a timer, answering faster gives up to 5 extra points.'],
    onStart: startGap
  });
}
function startGap(cfg, pids) { startRounds({ mode: 'gap', title: 'Sentence Gap', cfg, pids, types: ['gap'], restart: startGap }); }

function startRounds(spec) {
  const { cfg, pids } = spec;
  newGame(spec.mode, pids);
  const total = cfg.per * pids.length;
  const ctx = { levels: LEVEL_SETS[cfg.level], types: spec.types, used: new Set(), close: cfg.level === 'hard' };
  const bar = scoreBar(pids, G.scores); G.bar = bar;
  let i = 0;
  const perfect = Object.fromEntries(pids.map(id => [id, true]));

  function ask() {
    if (i >= total) return end();
    const q = nextQuestion(ctx);
    if (!q) { toast('Not enough words for this setting', 'bad'); return end(); }
    const pid = pids[i % pids.length]; G.cur = pid;
    let done = false, moved = false, hint = false, timer = null, qv = null;
    const nextBtn = h('button', { class: 'btn primary', hidden: true, onclick: go }, 'Next →');
    const hintBtn = hintButton(() => { hint = true; qv.showHint(); });
    render(() => {
      const banner = h('div', { class: 'who-banner slim', style: '--pc:' + PCOLORS[pid] }, avatar(pid, 'md'),
        h('div', null, h('b', null, pname(pid)), h('small', null, 'Question ' + (i + 1) + ' of ' + total)));
      qv = qView(q, pick1);
      const parts = [bar, banner];
      if (cfg.timer) { timer = countdown(cfg.timer, () => pick1(-1), { tick: true }); parts.push(timer.el); }
      parts.push(qv.el, h('div', { class: 'under-q' }, hintBtn, nextBtn));
      Keys.on(e => { if (done && (e.key === 'Enter' || e.key === ' ')) { go(); return true; } return false; });
      return h('div', { class: 'rounds' }, parts);
    }, spec.title);
    bar.update(G.scores, pid);
    if (q.speakText && q.type !== 'listen') Timers.set(() => speak(q.speakText), 350);

    function pick1(idx) {
      if (done) return;
      done = true; sfx('click');
      const frac = timer ? Math.max(0, timer.left() / cfg.timer) : null;
      if (timer) timer.stop();
      qv.reveal(idx);
      const ok = idx === q.answer;
      recordAnswer(pid, q.word, ok, hint);
      if (ok) {
        let pts = 10 + Math.min(G.streak[pid] - 1, 5) * 2;
        if (frac != null) pts += Math.round(5 * frac);
        if (hint) pts = Math.round(pts / 2);
        addScore(pid, pts); sfx('ok'); confettiFrom(qv.btns[q.answer], 24);
        toast('+' + pts + ' points', 'good');
      } else { perfect[pid] = false; sfx('ko'); }
      qv.showExplain(ok); afterAnswerSpeak(q);
      nextBtn.hidden = false; hintBtn.disabled = true;
      Timers.set(go, ok ? 2600 : 3800);
    }
    function go() { if (!done || moved) return; moved = true; i++; ask(); }
  }
  function end() {
    if (spec.mode === 'faces' && cfg.per >= 5) pids.forEach(id => { if (perfect[id]) award(id, 'faces'); });
    const order = pids.slice().sort((a, b) => G.scores[b] - G.scores[a]);
    finishGame({ title: spec.title + ' finished!', order, scoreText: id => G.scores[id] + ' pts (' + G.correct[id] + ' ✓)', again: () => spec.restart(cfg, pids) });
  }
  ask();
}

/* ---------- Speed Round ---------- */
function setupSpeed() {
  setupScreen({
    id: 'speed', name: 'Speed Round', ic: '26A1',
    desc: 'Answer as many questions as you can before the clock runs out. Each player has one turn.',
    options: [
      { key: 'secs', label: 'Seconds per turn', def: 45, choices: [{ v: 30, label: '30 s' }, { v: 45, label: '45 s' }, { v: 60, label: '60 s' }, { v: 90, label: '90 s' }] },
      { key: 'level', label: 'Level', def: 'medium', choices: LEVEL_CHOICES }
    ],
    rules: ['Right: 10 points + combo bonus. Wrong: your combo is lost and you lose 3 seconds.', 'Every player has a +10 s power-up, once per turn.'],
    onStart: startSpeed
  });
}
function startSpeed(cfg, pids) {
  newGame('speed', pids);
  const ctx = { levels: LEVEL_SETS[cfg.level], types: ['syn', 'opp', 'def', 'face', 'faceRev'], used: new Set(), close: cfg.level === 'hard' };
  const bar = scoreBar(pids, G.scores); G.bar = bar;
  let turn = 0;
  function intro() {
    const pid = pids[turn]; G.cur = pid;
    render(h('div', { class: 'intro' }, bar, avatar(pid, 'xxl'), h('h2', null, pname(pid) + ', get ready!'),
      h('p', null, cfg.secs + ' seconds. Go as fast as you can!'),
      h('button', { class: 'btn primary big', onclick: () => countIn(pid) }, ico('26A1'), ' Go!')), 'Speed Round');
    bar.update(G.scores, pid);
  }
  function countIn(pid) {
    let n = 3;
    const big = h('div', { class: 'count-in' }, String(n));
    render(h('div', { class: 'intro' }, big), 'Speed Round');
    sfx('tick');
    Timers.every(() => { n--; if (n <= 0) { run(pid); return; } big.textContent = String(n); sfx('tick'); }, 800);
  }
  function run(pid) {
    let over = false, power = true, answered = 0, wrongs = 0, locked = false, cd = null, stat = null, area = null, current = null;
    const startCorrect = G.correct[pid];
    const paintStat = () => { stat.replaceChildren(h('span', null, ico('2705', 'tiny'), ' ' + (G.correct[pid] - startCorrect) + ' correct'), h('span', null, ico('1F525', 'tiny'), ' combo x' + G.streak[pid])); };
    render(() => {
      stat = h('div', { class: 'speed-stat' });
      area = h('div', { class: 'speed-area' });
      cd = countdown(cfg.secs, () => { over = true; locked = true; if (current) current.disable(true); sfx('lose'); toast('Time is up!', 'gold'); Timers.set(finishTurn, 1400); }, { big: true, tick: true });
      const pwr = h('button', { class: 'btn small', onclick: () => { if (!power || over) return; power = false; pwr.disabled = true; cd.add(10); sfx('lifeline'); toast('+10 seconds!', 'gold'); } }, ico('23F3'), ' +10 s');
      return h('div', { class: 'rounds speed' }, bar, h('div', { class: 'who-banner slim', style: '--pc:' + PCOLORS[pid] }, avatar(pid, 'md'), h('div', null, h('b', null, pname(pid)), h('small', null, 'Speed Round'))),
        cd.el, stat, area, h('div', { class: 'under-q' }, pwr));
    }, 'Speed Round');
    bar.update(G.scores, pid);
    function nextQ() {
      if (over) return;
      const q = nextQuestion(ctx); if (!q) { over = true; return finishTurn(); }
      locked = false;
      const qv = qView(q, idx => {
        if (locked || over) return;
        locked = true; answered++;
        qv.reveal(idx);
        const ok = idx === q.answer;
        recordAnswer(pid, q.word, ok, false);
        if (ok) { addScore(pid, 10 + Math.min(G.streak[pid] - 1, 5) * 2); sfx('ok'); }
        else { wrongs++; cd.add(-3); sfx('ko'); }
        paintStat();
        Timers.set(() => { qv.destroy(); nextQ(); }, ok ? 450 : 900);
      });
      current = qv;
      area.replaceChildren(qv.el);
      if (q.speakText && q.type !== 'listen') speak(q.speakText);
    }
    function finishTurn() {
      const got = G.correct[pid] - startCorrect;
      G.extra[pid] = Math.max(G.extra[pid] || 0, got);
      if (got >= 15) award(pid, 'speed15');
      const last = turn >= pids.length - 1;
      render(h('div', { class: 'intro result' }, bar, avatar(pid, 'xxl'), h('h2', null, pname(pid) + ': ' + got + ' correct!'),
        h('p', null, answered + ' answered · ' + wrongs + ' wrong'),
        h('button', { class: 'btn primary big', onclick: () => { if (last) endSpeed(); else { turn++; intro(); } } }, last ? 'See the podium' : 'Next: ' + pname(pids[turn + 1]) + ' →')), 'Speed Round');
      bar.update(G.scores, pid);
      sfx(got >= 8 ? 'win' : 'ok'); if (got >= 8) confetti(100);
    }
    paintStat(); nextQ();
  }
  function endSpeed() {
    const order = pids.slice().sort((a, b) => G.scores[b] - G.scores[a]);
    finishGame({ title: 'Speed Round finished!', order, scoreText: id => G.scores[id] + ' pts (' + (G.extra[id] || 0) + ' ✓)', again: () => startSpeed(cfg, pids) });
  }
  intro();
}
