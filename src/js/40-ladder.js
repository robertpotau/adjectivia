/* ============================================================
   Mode 1 — Golden Ladder (15 questions, safe steps, 5 lifelines)
   ============================================================ */
const PRIZES = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000];
const SAFE_AT = [4, 9];                       // indexes of the safe steps
const fmtPts = n => n.toLocaleString('en-GB');
const LIFELINES = [
  { id: 'fifty', ic: null, label: 'Half', tip: '50:50 — removes two wrong answers.' },
  { id: 'audience', ic: '1F465', label: 'Ask the class', tip: 'The class votes by raising hands.' },
  { id: 'phone', ic: '1F4DE', label: 'Phone a friend', tip: 'A classmate helps you for 30 seconds.' },
  { id: 'swap', ic: '1F500', label: 'Swap', tip: 'Change this question for a new one.' },
  { id: 'double', ic: '1F340', label: 'Double chance', tip: 'If your first answer is wrong, try again.' }
];
let L = null;      // ladder state

function setupLadder() {
  setupScreen({
    id: 'ladder', name: 'Golden Ladder', ic: '1F3C6',
    desc: 'Climb 15 steps from easy to very hard adjective questions. Use your lifelines wisely!',
    options: [
      { key: 'style', label: 'How do we play?', def: 'relay', choices: [
        { v: 'relay', label: 'Team relay', desc: 'One ladder for everybody. Players answer in turns and share the lifelines.' },
        { v: 'solo', label: 'One by one', desc: 'Every player climbs their own ladder with their own lifelines.' }] },
      { key: 'timer', label: 'Time per question', def: 0, choices: [{ v: 0, label: 'No limit' }, { v: 60, label: '60 s' }, { v: 30, label: '30 s' }] },
      { key: 'music', label: 'Music', def: 'mixed', choices: [
        { v: 'mixed', label: 'Pirates, then suspense', desc: 'Fun pirate music for steps 1–10, scary suspense for the last five.' },
        { v: 'pirate', label: 'Pirates', desc: 'Epic and fun all the way.' },
        { v: 'tense', label: 'Suspense', desc: 'Dark, tense and a bit scary; it gets faster as you climb.' },
        { v: 'off', label: 'Off' }] }
    ],
    rules: ['Steps 5 and 10 are safe: if you fall, you keep those points.', 'You can walk away at any moment and keep what you have.',
      'Use A-D or 1-4 on the keyboard to answer; Enter confirms.'],
    onStart: startLadder
  });
}
function startLadder(cfg, pids) {
  newGame('ladder', pids);
  L = { cfg, pids, style: pids.length === 1 ? 'solo' : cfg.style, qi: 0, runIdx: 0, turn: 0, results: [], used: new Set(), life: null, team: 0 };
  G.cur = null;
  beginRun();
}
/** which track and how intense, for the current step of the ladder */
function ladderMusic() {
  const m = L.cfg.music || 'mixed', q = L.qi;
  if (m === 'off' || !ST.settings.music) { Music.stop(0.4); return; }
  if (m === 'pirate') Music.start('pirate', q / 14);
  else if (m === 'tense') Music.start('tense', 0.15 + 0.85 * q / 14);
  else if (q < 10) Music.start('pirate', q / 9);
  else Music.start('tense', 0.4 + 0.6 * (q - 10) / 4);
}
function curPid() { return L.style === 'solo' ? L.pids[L.runIdx] : L.pids[L.turn % L.pids.length]; }
function freshLife() { return { fifty: true, audience: true, phone: true, swap: true, double: true }; }
function beginRun() {
  L.qi = 0; L.turn = 0; L.life = freshLife(); L.used = new Set(); L.team = 0;
  if (L.style === 'solo') {
    const pid = L.pids[L.runIdx];
    const w = h('div', { class: 'intro' }, avatar(pid, 'xxl'), h('h2', null, pname(pid) + ', it’s your turn!'),
      h('p', null, 'Climb the Golden Ladder. 15 questions, 5 lifelines.'),
      h('button', { class: 'btn primary big', onclick: () => { sfx('start'); askQuestion(); } }, ico('25B6'), ' Start climbing'));
    render(w, 'Golden Ladder');
    sfx('start');
  } else askQuestion();
}
function levelsFor(qi) {
  const r = Math.random();
  if (qi < 5) return r < 0.25 && qi > 2 ? [1, 2] : [1];
  if (qi < 10) return r < 0.3 ? [1, 2] : [2];
  return r < 0.3 ? [2, 3] : [3];
}
function typesFor(qi) {
  if (qi < 2) return ['syn', 'opp', 'def', 'face', 'faceRev', 'listen'];
  if (qi < 5) return ['syn', 'opp', 'def', 'face', 'faceRev', 'gap', 'listen'];
  if (qi < 10) return ['syn', 'opp', 'def', 'gap', 'gap', 'ooo', 'face', 'listen'];
  return ['syn', 'opp', 'def', 'gap', 'gap', 'ooo', 'face'];
}
function makeLadderQuestion() {
  const ctx = { levels: levelsFor(L.qi), types: typesFor(L.qi), used: L.used, close: L.qi >= 10 };
  return nextQuestion(ctx) || nextQuestion({ levels: [1, 2, 3], types: ['def', 'syn'], used: new Set() });
}
function safePrize(qi) { return qi > SAFE_AT[1] ? PRIZES[SAFE_AT[1]] : qi > SAFE_AT[0] ? PRIZES[SAFE_AT[0]] : 0; }
function walkPrize(qi) { return qi > 0 ? PRIZES[qi - 1] : 0; }

function askQuestion() {
  const q = makeLadderQuestion();
  ladderMusic();
  if (!q) { toast('Could not make a question', 'bad'); return endRun('win'); }
  const pid = curPid();
  G.cur = pid;
  const S = { q, locked: false, double: false, usedSecond: false, hint: false, pending: -1, qv: null, timer: null };
  let confirmBar;
  const build = () => {
  const fmt = L.style === 'solo' ? fmtPts : null;
  const bar = scoreBar(L.pids, G.scores, fmt);
  G.bar = bar; bar.update(G.scores, pid);

  const who = h('div', { class: 'who-banner', style: '--pc:' + PCOLORS[pid] }, avatar(pid, 'md'),
    h('div', null, h('b', null, pname(pid)), h('small', null, 'Question ' + (L.qi + 1) + ' of 15 · for ' + fmtPts(PRIZES[L.qi]) + ' points')));
  const main = h('div', { class: 'ladder-main' });
  main.append(who);
  if (L.cfg.timer) {
    S.timer = countdown(L.cfg.timer, () => { if (!S.locked) lockIn(-1); }, { tick: true });
    main.append(S.timer.el);
  }
  S.qv = qView(q, i => onPick(i));
  main.append(S.qv.el);
  confirmBar = h('div', { class: 'confirm-bar', hidden: true });
  const hintBtn = hintButton(() => { S.hint = true; S.qv.showHint(); });
  const walk = h('button', { class: 'btn small', onclick: () => walkAway() }, ico('1F6D1'), ' Take ' + fmtPts(walkPrize(L.qi)) + ' & stop');
  const musicBtn = h('button', { class: 'btn small' + (ST.settings.music && L.cfg.music !== 'off' ? ' on' : ''), title: 'Music on/off', onclick: () => {
    ST.settings.music = !ST.settings.music; save(); musicBtn.classList.toggle('on', ST.settings.music && L.cfg.music !== 'off'); if (ST.settings.music) ladderMusic(); else Music.stop(0.3);
  } }, ico('1F3B5'), ' Music');
  main.append(confirmBar, h('div', { class: 'under-q' }, hintBtn, walk, musicBtn));

  // side column
  const life = h('div', { class: 'lifelines' });
  LIFELINES.forEach(ll => {
    const b = h('button', { class: 'life', disabled: !L.life[ll.id], title: ll.tip, 'aria-label': ll.label + '. ' + ll.tip, onclick: () => useLife(ll.id, S, b) },
      ll.ic ? ico(ll.ic) : h('span', { class: 'fifty' }, '50:50'), h('small', null, ll.label));
    life.append(b);
  });
  const ladder = h('ol', { class: 'prizes' });
  for (let i = 14; i >= 0; i--) {
    ladder.append(h('li', { class: (i === L.qi ? 'now ' : '') + (i < L.qi ? 'done ' : '') + (SAFE_AT.includes(i) ? 'safe' : '') },
      h('span', { class: 'n' }, i + 1), h('span', { class: 'v' }, fmtPts(PRIZES[i])), SAFE_AT.includes(i) ? ico('1F6E1', 'tiny') : null));
  }
  const side = h('aside', { class: 'ladder-side' }, life, ladder);
  const wrap = h('div', { class: 'ladder-wrap' }, bar, h('div', { class: 'ladder' }, main, side));
  Keys.on(confirmKeys);
  return wrap;
  };
  render(build, 'Golden Ladder');
  announce('Question ' + (L.qi + 1));
  if (q.speakText && q.type !== 'listen') Timers.set(() => speak(q.speakText), 400);

  function onPick(i) {
    if (S.locked) return;
    sfx('click');
    if (!ST.settings.confirm) return lockIn(i);
    S.pending = i; S.qv.select(i);
    confirmBar.hidden = false;
    confirmBar.replaceChildren(h('b', null, 'Final answer: ' + LETTERS[i] + ' — ' + (q.iconOptions ? '' : q.options[i].label) + '?'),
      h('button', { class: 'btn primary', onclick: () => lockIn(S.pending) }, 'Yes, lock it in'),
      h('button', { class: 'btn', onclick: () => { S.pending = -1; S.qv.select(-1); confirmBar.hidden = true; } }, 'No'));
  }
  function confirmKeys(e) {
    if (S.locked || S.pending < 0) return false;
    if (e.key === 'Enter' || e.key.toLowerCase() === 'y') { lockIn(S.pending); return true; }
    if (e.key.toLowerCase() === 'n') { S.pending = -1; S.qv.select(-1); confirmBar.hidden = true; return true; }
    return false;
  }

  function lockIn(i) {
    if (S.locked) return;
    S.locked = true; confirmBar.hidden = true;
    if (S.timer) S.timer.stop();
    S.qv.disable(true); S.qv.select(i);
    sfx('tick');
    Timers.set(() => verdict(i), i < 0 ? 100 : 1100);
  }
  function verdict(i) {
    const ok = i === q.answer;
    if (!ok && S.double && !S.usedSecond && i >= 0) {               // double chance: one more try
      S.usedSecond = true; S.locked = false; S.pending = -1; sfx('ko');
      S.qv.markWrong(i); S.qv.select(-1);
      S.qv.btns.forEach((b, j) => { if (!b.classList.contains('wrong') && !b.classList.contains('gone')) b.disabled = false; });
      toast('Double chance! Try once more.', 'gold');
      if (S.timer) S.timer.stop();
      return;
    }
    S.qv.reveal(i);
    Music.duck(ok ? 1500 : 2800, 0.25);
    S.qv.showExplain(ok);
    afterAnswerSpeak(q);
    recordAnswer(pid, q.word, ok, S.hint);
    if (ok) {
      sfx('ok'); confettiFrom(S.qv.btns[q.answer], 30);
      if (L.style === 'solo') addScore(pid, PRIZES[L.qi] - G.scores[pid]);
      else { addScore(pid, Math.round(100 * (L.qi + 1) * (S.hint ? 0.5 : 1))); L.team = PRIZES[L.qi]; }
      const victims = L.style === 'solo' ? [pid] : L.pids;
      if (L.qi === 4) victims.forEach(v => { award(v, 'ladder5'); giveXP(v, 20); });
      if (L.qi === 9) victims.forEach(v => { award(v, 'ladder10'); giveXP(v, 40); });
      if (L.qi === 14) victims.forEach(v => { award(v, 'ladder15'); giveXP(v, 100); });
      if (SAFE_AT.includes(L.qi)) { sfx('levelup'); confetti(70); toast('Safe step reached: ' + fmtPts(PRIZES[L.qi]) + ' points!', 'gold'); }
      Timers.set(() => {
        if (L.qi === 14) return endRun('win');
        L.qi++; L.turn++; askQuestion();
      }, 2200);
    } else {
      sfx('ko'); document.body.classList.add('shake'); Timers.set(() => document.body.classList.remove('shake'), 500);
      Timers.set(() => endRun(i < 0 ? 'time' : 'wrong'), 3200);
    }
  }
  function walkAway() {
    if (S.locked) return;
    openModal(h('div', null, h('h3', null, 'Take the points and stop?'), h('p', null, 'You will keep ' + fmtPts(walkPrize(L.qi)) + ' points.'),
      h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: closeModal }, 'Keep playing'),
        h('button', { class: 'btn primary', onclick: () => { closeModal(); S.locked = true; if (S.timer) S.timer.stop(); endRun('walk'); } }, 'Take them'))));
  }
}

/* ---------- lifelines ---------- */
function useLife(id, S, btn) {
  if (S.locked || !L.life[id]) return;
  const q = S.q;
  sfx('lifeline');
  if (id === 'fifty') {
    L.life.fifty = false; btn.disabled = true;
    const wrongs = [0, 1, 2, 3].filter(i => i !== q.answer && !S.qv.btns[i].classList.contains('gone'));
    sample(wrongs, 2).forEach(i => S.qv.eliminate(i));
    if (S.pending >= 0 && S.qv.btns[S.pending].classList.contains('gone')) S.pending = -1;
  } else if (id === 'double') {
    L.life.double = false; btn.disabled = true; S.double = true;
    $('.who-banner').append(h('span', { class: 'badge' }, ico('1F340'), ' Double chance on'));
    toast('Double chance: you may answer twice.', 'gold');
  } else if (id === 'swap') {
    L.life.swap = false; btn.disabled = true;
    S.locked = true; if (S.timer) S.timer.stop();
    toast('New question!', 'gold'); Timers.set(() => askQuestion(), 400);
  } else if (id === 'audience') {
    L.life.audience = false; btn.disabled = true;
    if (S.timer) S.timer.pause();                       // the question timer waits while the class votes
    audienceModal(q, () => { if (S.timer) S.timer.resume(); });
  } else if (id === 'phone') {
    L.life.phone = false; btn.disabled = true;
    if (S.timer) S.timer.pause();
    phoneModal(q, () => { if (S.timer) S.timer.resume(); });
  }
}
function qSummary(q) {
  const box = h('div', { class: 'q-sum' }, h('div', { class: 'q-lead' }, q.lead));
  if (q.sentence) box.append(h('div', { class: 'q-big small' }, q.sentence.replace('_____', '______')));
  else if (q.big) box.append(h('div', { class: 'q-big small' }, q.big));
  else if (q.bigIcon) box.append(h('div', { class: 'q-big face small' }, ico(q.bigIcon)));
  box.append(h('div', { class: 'sum-opts' }, q.options.map((o, i) => h('span', { class: 'sum-o' }, h('b', null, LETTERS[i]), q.iconOptions ? ico(o.ic) : ' ' + o.label))));
  return box;
}
function audienceModal(q, onDone) {
  const votes = [0, 0, 0, 0];
  const rows = h('div', { class: 'vote-rows' });
  const els = [0, 1, 2, 3].map(i => {
    const n = h('b', { class: 'vote-n' }, '0'), bar = h('i');
    const row = h('div', { class: 'vote-row c' + i }, h('span', { class: 'letter' }, LETTERS[i]), h('span', { class: 'vl' }, q.iconOptions ? ico(q.options[i].ic) : q.options[i].label),
      h('div', { class: 'vbar' }, bar), n,
      h('button', { class: 'btn round small', onclick: () => { votes[i] = Math.max(0, votes[i] - 1); paint(); }, 'aria-label': 'Remove vote' }, '−'),
      h('button', { class: 'btn round small', onclick: () => { votes[i]++; sfx('click'); paint(); }, 'aria-label': 'Add vote' }, '+'));
    rows.append(row); return { n, bar };
  });
  const paint = () => {
    const tot = votes.reduce((a, b) => a + b, 0);
    els.forEach((e, i) => { e.n.textContent = tot ? Math.round(100 * votes[i] / tot) + '%' : '0'; e.bar.style.width = tot ? (100 * votes[i] / tot) + '%' : '0%'; });
  };
  const cd = countdown(30, () => { sfx('ko'); }, { big: true, tick: true });
  openModal(h('div', null, h('h3', null, ico('1F465'), ' Ask the class'), qSummary(q),
    h('p', { class: 'muted' }, 'Everybody raises a hand for A, B, C or D. Tap + for each hand.'), cd.el, rows,
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: closeModal }, 'Done'))), () => { cd.stop(); if (onDone) onDone(); }, true);
}
function phoneModal(q, onDone) {
  const pid = curPid();
  const friends = L.pids.filter(p => p !== pid);
  let calling = false;
  const showCall = name => {
    calling = true;
    const cd = countdown(30, () => sfx('ko'), { big: true, tick: true });
    openModal(h('div', null, h('h3', null, ico('1F4DE'), ' Calling ' + name + '…'), qSummary(q),
      h('p', { class: 'muted' }, name + ', read the question aloud and help for 30 seconds!'), cd.el,
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: closeModal }, 'Hang up'))), () => { cd.stop(); if (onDone) onDone(); }, true);
  };
  const list = h('div', { class: 'friend-list' },
    friends.map(f => h('button', { class: 'btn friend', style: '--pc:' + PCOLORS[f], onclick: () => showCall(pname(f)) }, avatar(f, 'sm'), pname(f))),
    h('button', { class: 'btn friend', onclick: () => showCall('a classmate') }, ico('1F9D1'), 'A classmate'));
  /* when this first dialog is replaced by the call dialog, its onClose must not resume the timer */
  openModal(h('div', null, h('h3', null, ico('1F4DE'), ' Phone a friend'), h('p', null, 'Who do you want to call?'), list,
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: closeModal }, 'Cancel'))), () => { if (!calling && onDone) onDone(); });
}

/* ---------- end of a climb ---------- */
function endRun(kind) {
  Music.stop(0.5);
  const pid = curPid();
  const reached = kind === 'win' ? 15 : L.qi;               // steps answered correctly
  const prize = kind === 'win' ? PRIZES[14] : kind === 'walk' ? walkPrize(L.qi) : safePrize(L.qi);
  if (L.style === 'solo') {
    G.scores[pid] = prize;
    L.results.push({ pid, prize, reached });
    const msg = { win: 'You climbed all 15 steps!', walk: 'You decided to stop.', wrong: 'Oh no, that was not the right answer.', time: 'Time is up!' }[kind];
    const last = L.runIdx >= L.pids.length - 1;
    const w = h('div', { class: 'intro result' }, avatar(pid, 'xxl'), h('h2', null, msg),
      h('div', { class: 'prize-big' }, ico('1FA99'), fmtPts(prize), h('small', null, ' points')),
      h('p', null, 'Steps answered correctly: ' + reached + ' of 15'),
      h('button', { class: 'btn primary big', onclick: () => { if (last) finishLadder(); else { L.runIdx++; beginRun(); } } },
        last ? 'See the podium' : 'Next: ' + pname(L.pids[L.runIdx + 1]) + ' →'));
    render(w, 'Golden Ladder');
    if (kind === 'win') { sfx('win'); confetti(200); } else if (kind === 'wrong' || kind === 'time') sfx('lose'); else sfx('ok');
  } else {
    L.teamPrize = prize; L.teamReached = reached; L.teamKind = kind;
    finishLadder();
  }
}
function finishLadder() {
  if (L.style === 'solo') {
    const order = L.pids.slice().sort((a, b) => G.scores[b] - G.scores[a] || (L.results.find(r => r.pid === b).reached - L.results.find(r => r.pid === a).reached));
    finishGame({ title: 'Golden Ladder results', order, scoreText: id => fmtPts(G.scores[id]) + ' pts', again: () => startLadder(L.cfg, L.pids) });
  } else {
    const order = L.pids.slice().sort((a, b) => G.scores[b] - G.scores[a]);
    const kind = L.teamKind;
    const note = h('div', { class: 'team-prize' }, ico('1F3C6'), h('div', null, h('b', null, 'Team prize: ' + fmtPts(L.teamPrize) + ' points'),
      h('small', null, kind === 'win' ? 'The team climbed all 15 steps!' : 'Steps answered correctly: ' + L.teamReached + ' of 15')));
    finishGame({ title: kind === 'win' ? 'You did it!' : 'Golden Ladder results', subtitle: 'Points show how much each player contributed.', order, note,
      scoreText: id => fmtPts(G.scores[id]) + ' pts', again: () => startLadder(L.cfg, L.pids) });
  }
}
