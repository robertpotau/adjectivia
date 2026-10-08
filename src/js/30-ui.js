/* ============================================================
   Adjectivia — shared UI: screens, players, XP & trophies, scoreboard, podium, question view
   ============================================================ */
const app = $('#app');
let leaveFns = [];
function onLeave(fn) { leaveFns.push(fn); }
/**
 * Replaces the whole screen. Everything that belongs to the old screen (timers, keys, speech) is stopped first.
 * `build` is a node, or a function returning one: use a function whenever the screen creates timers or key
 * handlers while it is being built, so they are registered AFTER the old ones were cleared.
 */
function render(build, crumb) {
  Timers.clear(); Keys.clear();
  leaveFns.forEach(f => { try { f(); } catch (e) { /* ignore */ } }); leaveFns = [];
  closeModal(true);
  try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  const node = typeof build === 'function' ? build() : build;
  app.replaceChildren(node);
  $('#crumb').textContent = crumb || '';
  window.scrollTo(0, 0);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalEl && !modalEl.dataset.lock) closeModal(); });

/* ---------- ranks & XP ---------- */
const RANKS = [
  { xp: 0, name: 'Beginner', ic: '1F331' }, { xp: 100, name: 'Word Explorer', ic: '1F9ED' },
  { xp: 300, name: 'Adjective Apprentice', ic: '1F4DD' }, { xp: 700, name: 'Describer', ic: '1F3A8' },
  { xp: 1500, name: 'Wordsmith', ic: '1F528' }, { xp: 3000, name: 'Adjective Hero', ic: '1F9B8' },
  { xp: 6000, name: 'Adjective Master', ic: '1F451' }
];
function rankIdx(xp) { let r = 0; RANKS.forEach((x, i) => { if (xp >= x.xp) r = i; }); return r; }
function rankInfo(pid) {
  const p = ST.players[pid], i = rankIdx(p.xp), cur = RANKS[i], nxt = RANKS[i + 1];
  return { rank: cur, next: nxt, pct: nxt ? Math.round(100 * (p.xp - cur.xp) / (nxt.xp - cur.xp)) : 100 };
}
function giveXP(pid, n) {
  n = Math.round(n); if (!(n > 0)) return;
  const p = ST.players[pid], before = rankIdx(p.xp);
  p.xp += n;
  if (G && G.xpGain) G.xpGain[pid] = (G.xpGain[pid] || 0) + n;
  const after = rankIdx(p.xp);
  if (after > before) {
    sfx("levelup"); confetti(50);
    toast(h('div', { class: 'tt' }, ico(RANKS[after].ic), h('div', null, h('b', null, pname(pid) + ' is now a'), h('div', { class: 'tt-big' }, RANKS[after].name))), 'gold');
  }
  if (p.xp >= 1000) award(pid, 'xp1000');
  save();
}

/* ---------- trophies ---------- */
const TROPHIES = [
  { id: 'first', ic: '1F3C1', name: 'First steps', desc: 'Finish any game.' },
  { id: 'winner', ic: '1F947', name: 'On top!', desc: 'Win a game against other players.' },
  { id: 'streak5', ic: '1F525', name: 'On fire', desc: 'Answer 5 questions in a row correctly.' },
  { id: 'streak10', ic: '1F680', name: 'Unstoppable', desc: 'Answer 10 questions in a row correctly.' },
  { id: 'ladder5', ic: '1F4B0', name: 'Safe and sound', desc: 'Reach the first safe step of the Golden Ladder.' },
  { id: 'ladder10', ic: '1F48E', name: 'Diamond step', desc: 'Reach the second safe step of the Golden Ladder.' },
  { id: 'ladder15', ic: '1F451', name: 'Golden champion', desc: 'Climb all 15 steps of the Golden Ladder.' },
  { id: 'memory', ic: '1F9E0', name: 'Elephant memory', desc: 'Finish a Memory game without a single mistake.' },
  { id: 'match', ic: '1F517', name: 'Perfect match', desc: 'Match a whole round without a mistake.' },
  { id: 'speed15', ic: '26A1', name: 'Lightning', desc: 'Get 15 correct answers in one Speed Round.' },
  { id: 'faces', ic: '1F60E', name: 'Face reader', desc: 'Get every question right in an Emotion Faces game (5 or more).' },
  { id: 'hotseat', ic: '1F3A4', name: 'Star describer', desc: 'Guess 6 words in one Hot Seat turn.' },
  { id: 'hangman', ic: '1F388', name: 'Balloon keeper', desc: 'Solve a Balloon Pop word without losing any balloon.' },
  { id: 'bookworm', ic: '1F4DA', name: 'Bookworm', desc: 'Look at 50 flashcards in the Word Bank.' },
  { id: 'allModes', ic: '1F3AE', name: 'Explorer', desc: 'Play all 8 game modes.' },
  { id: 'xp1000', ic: '1F31F', name: 'Super star', desc: 'Earn 1,000 XP.' }
];
const TROPHY = Object.fromEntries(TROPHIES.map(t => [t.id, t]));
function award(pid, id) {
  const p = ST.players[pid];
  if (!TROPHY[id] || p.trophies.includes(id)) return false;
  p.trophies.push(id); save();
  sfx('levelup');
  toast(h('div', { class: 'tt' }, ico(TROPHY[id].ic), h('div', null, h('b', null, pname(pid) + ' won a trophy!'), h('div', { class: 'tt-big' }, TROPHY[id].name))), 'gold');
  return true;
}

/* ---------- game session ---------- */
let G = null;
const PLAY_MODES = ['ladder', 'memory', 'match', 'faces', 'gap', 'speed', 'hotseat', 'hangman'];
function newGame(mode, pids) {
  Music.stop(0.4);
  G = { mode, pids: pids.slice(), scores: {}, correct: {}, wrong: {}, streak: {}, best: {}, missed: new Set(), extra: {}, xpGain: {}, live: true };
  pids.forEach(id => { G.scores[id] = 0; G.correct[id] = 0; G.wrong[id] = 0; G.streak[id] = 0; G.best[id] = 0; });
  return G;
}
/** records one answer. Returns the XP given. `hint` halves the reward. */
function recordAnswer(pid, word, ok, hint) {
  if (word) noteResult(word, ok);
  const p = ST.players[pid];
  if (ok) {
    G.correct[pid]++; G.streak[pid]++; p.correct++;
    if (G.streak[pid] > G.best[pid]) G.best[pid] = G.streak[pid];
    if (G.streak[pid] > p.bestStreak) p.bestStreak = G.streak[pid];
    if (G.streak[pid] >= 5) award(pid, 'streak5');
    if (G.streak[pid] >= 10) award(pid, 'streak10');
    const xp = (hint ? 4 : 8) + Math.min(G.streak[pid], 5);
    giveXP(pid, xp); return xp;
  }
  G.wrong[pid]++; G.streak[pid] = 0; p.wrong++;
  if (word) G.missed.add(word);
  save(); return 0;
}
function addScore(pid, n) { G.scores[pid] = Math.max(0, (G.scores[pid] || 0) + n); if (G.bar) G.bar.update(G.scores, G.cur); }

/* ---------- avatars & scoreboard ---------- */
function avatar(pid, size) {
  return h('span', { class: 'avatar ' + (size || ''), style: '--pc:' + PCOLORS[pid] }, ico(ST.players[pid].avatar));
}
function scoreBar(pids, scores, fmt) {
  const bar = h('div', { class: 'scorebar' });
  const els = {}, last = {};
  pids.forEach(id => {
    const v = h('b', { class: 'sc-v' }, fmt ? fmt(scores[id] || 0) : (scores[id] || 0));
    els[id] = h('div', { class: 'sc', style: '--pc:' + PCOLORS[id] }, avatar(id, 'sm'), h('span', { class: 'sc-n' }, pname(id)), v);
    els[id].v = v; last[id] = scores[id] || 0;
    bar.append(els[id]);
  });
  bar.update = (sc, cur) => {
    pids.forEach(id => {
      const nv = sc[id] || 0;
      els[id].v.textContent = fmt ? fmt(nv) : nv;
      if (nv > last[id]) { els[id].classList.remove('pop'); void els[id].offsetWidth; els[id].classList.add('pop'); }
      last[id] = nv;
      els[id].classList.toggle('cur', id === cur);
    });
  };
  bar.update(scores, null);
  return bar;
}

/* ---------- countdown ---------- */
function countdown(secs, onEnd, opts) {
  opts = opts || {};
  let left = secs, total = secs, stopped = false, paused = false;
  const fill = h('i'), num = h('b', null, Math.ceil(left));
  const el = h('div', { class: 'cd' + (opts.big ? ' big' : '') }, h('div', { class: 'cd-bar' }, fill), num);
  const paint = () => {
    num.textContent = Math.max(0, Math.ceil(left));
    fill.style.width = clamp(100 * left / total, 0, 100) + '%';
    el.classList.toggle('low', left <= 5);
  };
  paint();
  const id = Timers.every(() => {
    if (stopped || paused) return;
    left -= 0.1; paint();
    if (opts.tick && left <= 5 && Math.abs(left - Math.round(left)) < 0.05) sfx('tick');
    if (left <= 0) { stopped = true; Timers.stop(id); onEnd && onEnd(); }
  }, 100);
  return { el, stop() { stopped = true; Timers.stop(id); }, pause() { paused = true; }, resume() { paused = false; }, add(n) { left += n; total = Math.max(total, left); paint(); }, left: () => left };
}

/* ---------- question view ---------- */
const LETTERS = ['A', 'B', 'C', 'D'];
/**
 * Renders a question. `onPick(i)` is called when an option is chosen (click or key A-D / 1-4).
 * Returns helpers to mark the result.
 */
function qView(q, onPick) {
  const wrap = h('div', { class: 'qv t-' + q.type });
  wrap.append(h('div', { class: 'q-lead' }, q.lead));
  const bigBox = h('div', { class: 'q-big' });
  if (q.sentence) {
    const parts = q.sentence.split('_____');
    bigBox.classList.add('sentence');
    bigBox.append(parts[0], h('span', { class: 'blank' }, '      '), parts.slice(1).join('_____'));
  } else if (q.bigIcon) {
    bigBox.classList.add('face'); bigBox.append(ico(q.bigIcon));
  } else if (q.listenBtn) {
    bigBox.classList.add('listen');
    bigBox.append(h('button', { class: 'btn-listen', onclick: () => speak(q.speakText), 'aria-label': 'Listen again' }, ico('1F50A'), ' Listen again'));
  } else if (q.big) {
    bigBox.append(q.big);
    if (q.speakText) bigBox.append(h('button', { class: 'say', title: 'Listen', 'aria-label': 'Listen', onclick: () => speak(q.speakText) }, ico('1F50A')));
  }
  wrap.append(bigBox);
  const opts = h('div', { class: 'q-opts' + (q.iconOptions ? ' icons' : '') });
  const btns = q.options.map((o, i) => {
    const b = h('button', { class: 'opt c' + i, 'data-i': i, onclick: () => { if (!b.disabled) onPick(i); } },
      h('span', { class: 'letter' }, LETTERS[i]),
      q.iconOptions ? ico(o.ic) : h('span', { class: 'olabel' }, o.label));
    return b;
  });
  btns.forEach(b => opts.append(b));
  wrap.append(opts);
  const hint = h('div', { class: 'q-hint' });
  wrap.append(hint);
  const keyFn = e => {
    const k = e.key.toLowerCase();
    let i = ['a', 'b', 'c', 'd'].indexOf(k); if (i < 0) i = ['1', '2', '3', '4'].indexOf(k);
    if (i >= 0 && btns[i] && !btns[i].disabled) { onPick(i); return true; }
    return false;
  };
  Keys.on(keyFn);
  const api = {
    el: wrap, btns,
    destroy() { Keys.off(keyFn); },
    select(i) { btns.forEach((b, j) => b.classList.toggle('sel', j === i)); },
    disable(on) { btns.forEach(b => { b.disabled = on; }); },
    eliminate(i) { btns[i].classList.add('gone'); btns[i].disabled = true; },
    markWrong(i) { btns[i].classList.add('wrong'); btns[i].disabled = true; },
    /** shows the verdict. `chosen` may be -1 (time up) */
    reveal(chosen) {
      api.disable(true);
      btns.forEach((b, j) => { b.classList.remove('sel'); if (j === q.answer) b.classList.add('right'); else if (j === chosen) b.classList.add('wrong'); });
      if (q.sentence) {
        const bl = $('.blank', wrap);
        if (bl) { bl.textContent = q.options[q.answer].label; bl.classList.add('filled'); }
      }
    },
    showHint() {
      hint.replaceChildren(h('b', null, 'En català: '), q.hintCa.map(p => h('span', { class: 'chip' }, p[0] + ' = ' + p[1])));
      hint.classList.add('on');
    },
    showExplain(ok) {
      hint.classList.add('on', ok ? 'okx' : 'kox');
      hint.replaceChildren(h('span', null, q.explain));
    }
  };
  if (q.listenBtn) Timers.set(() => speak(q.speakText), 350);
  return api;
}
function hintButton(onClick) {
  const b = h('button', { class: 'btn-hint', title: 'Show the Catalan translation (half points)', onclick: () => { b.disabled = true; sfx('click'); onClick(); } }, '?', h('small', null, ' català'));
  return b;
}
function afterAnswerSpeak(q) {
  if (ST.settings.readAnswers && !q.iconOptions && q.type !== 'listen') speak(q.options[q.answer].label);
}

/* ---------- finishing a game: XP, trophies, podium ---------- */
function finishGame(opts) {
  // opts: { title, subtitle, order:[pid sorted best first], scoreText:(pid)=>string, again:fn, note:Node, mvpLabel }
  const pids = G.pids, multi = pids.length > 1;
  const order = opts.order || pids.slice().sort((a, b) => G.scores[b] - G.scores[a]);
  pids.forEach(id => {
    const p = ST.players[id];
    p.games++; p.modes[G.mode] = (p.modes[G.mode] || 0) + 1;
    award(id, 'first');
    giveXP(id, 20);
    if (PLAY_MODES.every(m => p.modes[m])) award(id, 'allModes');
  });
  let winners = [];
  if (multi) {
    const top = opts.scoreOf ? opts.scoreOf(order[0]) : G.scores[order[0]];
    winners = order.filter(id => (opts.scoreOf ? opts.scoreOf(id) : G.scores[id]) === top);
    if (top > 0 && winners.length < pids.length) winners.forEach(id => { award(id, 'winner'); giveXP(id, 30); });
  }
  save();
  showPodium(Object.assign({}, opts, { order, winners }));
}
function showPodium(o) {
  G.live = false; Music.stop(0.5);
  const order = o.order, wrap = h('div', { class: 'podium-screen' });
  wrap.append(h('h2', { class: 'pod-title' }, o.title || 'Game over!'));
  if (o.subtitle) wrap.append(h('p', { class: 'pod-sub' }, o.subtitle));
  const top3 = order.slice(0, 3);
  const arrangement = top3.length === 3 ? [1, 0, 2] : top3.length === 2 ? [1, 0] : [0];
  const steps = h('div', { class: 'podium' });
  arrangement.forEach(rank => {
    const id = top3[rank];
    const st = h('div', { class: 'pstep r' + (rank + 1) + (o.winners && o.winners.includes(id) ? ' win' : ''), style: '--pc:' + PCOLORS[id] },
      h('div', { class: 'p-medal' }, ico(['1F947', '1F948', '1F949'][rank])),
      avatar(id, 'xl'), h('div', { class: 'p-name' }, pname(id)),
      h('div', { class: 'p-score' }, o.scoreText ? o.scoreText(id) : G.scores[id] + ' pts'),
      h('div', { class: 'p-block' }, String(rank + 1)));
    steps.append(st);
  });
  wrap.append(steps);
  if (order.length > 3) {
    wrap.append(h('div', { class: 'pod-rest' }, order.slice(3).map((id, i) => h('div', { class: 'sc', style: '--pc:' + PCOLORS[id] },
      h('b', null, (i + 4) + '.'), avatar(id, 'sm'), h('span', { class: 'sc-n' }, pname(id)), h('b', { class: 'sc-v' }, o.scoreText ? o.scoreText(id) : G.scores[id])))));
  }
  if (G.pids.length > 1) {
    const best = G.pids.slice().sort((a, b) => G.correct[b] - G.correct[a])[0];
    if (G.correct[best] > 0) wrap.append(h('p', { class: 'mvp' }, ico('2B50'), ' Most correct answers: ', h('b', null, pname(best)), ' (' + G.correct[best] + ')'));
  }
  if (o.note) wrap.append(o.note);
  if (G.xpGain && G.pids.some(id => G.xpGain[id])) {          // experience of every player in this game
    wrap.append(h('div', { class: 'xp-panel' }, h('h3', null, ico('2B50'), ' Experience earned'), G.pids.map(id => {
      const ri = rankInfo(id), p = ST.players[id];
      return h('div', { class: 'xp-row', style: '--pc:' + PCOLORS[id] }, avatar(id, 'sm'), h('b', null, pname(id)),
        h('span', { class: 'xp-gain' }, '+' + Math.round(G.xpGain[id] || 0) + ' XP'),
        h('span', { class: 'xp-rank' }, ico(ri.rank.ic, 'tiny'), ' ' + ri.rank.name),
        h('div', { class: 'xpbar' }, h('i', { style: 'width:' + ri.pct + '%' })),
        h('small', null, p.xp + ' XP' + (ri.next ? ' · next rank at ' + ri.next.xp : ' · top rank!')));
    })));
  }
  const missed = Array.from(G.missed).map(byWord).filter(Boolean);
  if (missed.length) {
    wrap.append(h('div', { class: 'review' }, h('h3', null, ico('1F4DA'), ' Words to review'),
      h('div', { class: 'chips' }, missed.slice(0, 14).map(w => h('button', { class: 'chip big', onclick: () => speak(w.w), title: 'Listen' }, w.w, h('small', null, ' = ' + w.ca))))));
  }
  const acts = h('div', { class: 'actions' });
  if (o.again) acts.append(h('button', { class: 'btn primary', onclick: o.again }, ico('1F501'), ' Play again'));
  acts.append(h('button', { class: 'btn', onclick: () => showHub() }, ico('1F3E0'), ' Home'));
  wrap.append(acts);
  render(wrap, o.title || 'Results');
  sfx("win"); confetti(110, innerWidth / 2, innerHeight * 0.3);
  Timers.set(() => confetti(50, innerWidth * 0.2, innerHeight * 0.35), 500);
  Timers.set(() => confetti(50, innerWidth * 0.8, innerHeight * 0.35), 800);
}

/* ---------- generic setup screen ---------- */
function chipRow(opt, cfg, save2) {
  const row = h('div', { class: 'chip-row' });
  opt.choices.forEach(ch => {
    const b = h('button', { class: 'choice' + (cfg[opt.key] === ch.v ? ' on' : ''), onclick: () => {
      cfg[opt.key] = ch.v; sfx('click');
      $$('.choice', row).forEach(x => x.classList.remove('on')); b.classList.add('on');
      save2();
    } }, h('b', null, ch.label), ch.desc ? h('small', null, ch.desc) : null);
    row.append(b);
  });
  return row;
}
/**
 * def: { id, name, ic, desc, rules:[], options:[{key,label,choices:[{v,label,desc}], def}], minPlayers, onStart(cfg, pids) }
 */
function setupScreen(def) {
  const saved = ST.prefs[def.id] || {}, cfg = {};
  const opts = def.options.slice();
  if (ST.active > 1 && !def.noOrder) opts.push({ key: 'order', label: 'Who starts?', choices: [{ v: 'list', label: 'In order' }, { v: 'random', label: 'Random' }], def: 'list' });
  opts.forEach(o => { cfg[o.key] = o.choices.some(c => c.v === saved[o.key]) ? saved[o.key] : o.def; });
  const wrap = h('div', { class: 'setup' });
  wrap.append(h('div', { class: 'setup-head' }, ico(def.ic, 'xl'), h('div', null, h('h2', null, def.name), h('p', null, def.desc))));
  const body = h('div', { class: 'setup-body' });
  opts.forEach(o => body.append(h('div', { class: 'opt-group' }, h('h4', null, o.label), chipRow(o, cfg, () => { ST.prefs[def.id] = Object.assign({}, cfg); save(); }))));
  wrap.append(body);
  if (def.rules && def.rules.length) wrap.append(h('ul', { class: 'rules' }, def.rules.map(r => h('li', null, r))));
  const pids = activePlayers().map(p => p.id);
  const need = def.minPlayers || 1;
  const row = h('div', { class: 'who-row' }, h('span', null, 'Players: '), pids.map(id => h('span', { class: 'who', style: '--pc:' + PCOLORS[id] }, avatar(id, 'sm'), pname(id))),
    h('button', { class: 'btn small', onclick: () => showPlayers(() => setupScreen(def)) }, 'Change'));
  wrap.append(row);
  const acts = h('div', { class: 'actions' },
    h('button', { class: 'btn', onclick: () => showHub() }, '← Back'),
    h('button', { class: 'btn primary big', id: 'btn-go', disabled: pids.length < need, onclick: () => {
      ST.prefs[def.id] = Object.assign({}, cfg); save(); sfx('start');
      let order = pids.slice(); if (cfg.order === 'random') order = shuffle(order);
      def.onStart(cfg, order);
    } }, ico('25B6'), ' Start'));
  if (pids.length < need) wrap.append(h('p', { class: 'warn' }, 'This mode needs at least ' + need + ' players.'));
  wrap.append(acts);
  render(wrap, def.name);
}

/* ---------- players screen ---------- */
function showPlayers(back) {
  const wrap = h('div', { class: 'players-screen' });
  const grid = h('div', { class: 'pgrid' });
  const draw = () => {
    grid.replaceChildren();
    count.textContent = ST.active;
    for (let i = 0; i < ST.active; i++) {
      const p = ST.players[i], ri = rankInfo(i);
      const nameIn = h('input', { type: 'text', maxlength: 14, value: p.name, placeholder: 'Player ' + (i + 1), 'aria-label': 'Name of player ' + (i + 1),
        oninput: () => { p.name = nameIn.value; save(); } });
      grid.append(h('div', { class: 'pcard', style: '--pc:' + PCOLORS[i] },
        h('button', { class: 'avatar-btn', title: 'Change avatar', onclick: () => pickAvatar(i, draw) }, avatar(i, 'xl')),
        nameIn,
        h('div', { class: 'p-rank' }, ico(ri.rank.ic), ' ', ri.rank.name),
        h('div', { class: 'xpbar' }, h('i', { style: 'width:' + ri.pct + '%' })),
        h('div', { class: 'p-xp' }, p.xp + ' XP' + (ri.next ? ' · next: ' + ri.next.xp : '')),
        h('button', { class: 'link', onclick: () => resetPlayer(i, draw) }, 'Reset player')));
    }
  };
  const count = h('b', { class: 'big-num' });
  const step = d => { ST.active = clamp(ST.active + d, 1, MAX_PLAYERS); sfx('click'); save(); draw(); };
  wrap.append(h('h2', null, 'Who is playing?'),
    h('p', { class: 'muted' }, 'Profile: ', h('b', null, profileLabel(ST.profiles[ST.cur], ST.cur)), ' · ', h('button', { class: 'link', onclick: () => showProfiles() }, 'change profile')),
    h('div', { class: 'stepper' }, h('button', { class: 'btn round', onclick: () => step(-1), 'aria-label': 'Fewer players' }, '−'), h('div', null, count, h('small', null, ' players')),
      h('button', { class: 'btn round', onclick: () => step(1), 'aria-label': 'More players' }, '+')),
    grid, h('p', { class: 'muted' }, 'Names and points are saved in this browser. Each of the 6 places keeps its own XP and trophies.'),
    h('div', { class: 'actions' }, h('button', { class: 'btn primary big', onclick: () => { saveAll(); sfx('start'); (back || showHub)(); } }, ico('25B6'), ' Let’s play!')));
  draw();
  render(wrap, 'Players');
}
/* ---------- profiles: saved groups of players ---------- */
function showProfiles() {
  const wrap = h('div', { class: 'profiles-screen' }, h('h2', null, 'Choose a profile'),
    h('p', { class: 'muted' }, 'A profile remembers the player names, avatars, XP, trophies and missed words of a group (for example one class). Click a name to rename the profile.'));
  const grid = h('div', { class: 'prgrid' });
  ST.profiles.forEach((pr, i) => {
    const used = pr.players.some(p => p.xp > 0 || (p.name || '').trim() || p.games > 0);
    const nameIn = h('input', { type: 'text', maxlength: 24, value: pr.name, placeholder: 'Profile ' + (i + 1), 'aria-label': 'Name of profile ' + (i + 1),
      oninput: () => { pr.name = nameIn.value; save(); } });
    const who = h('div', { class: 'pr-who' }, pr.players.slice(0, pr.active).map((p, k) =>
      h('span', { class: 'pr-p', style: '--pc:' + PCOLORS[k] }, ico(p.avatar), ' ' + ((p.name || '').trim() || 'Player ' + (k + 1)))));
    const totalXP = pr.players.slice(0, pr.active).reduce((a, p) => a + p.xp, 0);
    grid.append(h('div', { class: 'prcard' + (i === ST.cur ? ' cur' : '') }, nameIn, who,
      h('div', { class: 'p-xp' }, used ? totalXP + ' XP in total' : 'Empty profile'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', onclick: () => { ST.cur = i; saveAll(); sfx('start'); showHub(); } }, i === ST.cur ? 'Continue' : 'Use this profile'),
        used ? h('button', { class: 'link', onclick: () => exportProfiles([i]) }, 'Export') : null,
        used ? h('button', { class: 'link', onclick: () => resetWholeProfile(i) }, 'Reset') : null)));
  });
  const fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': 'Choose a profiles file',
    onchange: () => { const f = fileIn.files[0]; fileIn.value = ''; if (f) readImportFile(f); } });
  wrap.append(grid,
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onclick: () => exportProfiles([0, 1, 2, 3, 4, 5]), title: 'Save all profiles in a file' }, ico('1F4BE'), ' Export all'),
      h('button', { class: 'btn', onclick: () => fileIn.click(), title: 'Load profiles from a file' }, ico('1F4C2'), ' Import…'), fileIn),
    h('p', { class: 'muted small' }, 'Use Export and Import to back up your profiles or move them to another computer.'),
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => showHub() }, '← Back')));
  render(wrap, 'Profiles');
}

/* ---------- export / import of profiles (a plain .json file) ---------- */
function exportPayload(indices) {
  return { app: 'adjectivia', format: 1, version: VERSION, exported: new Date().toISOString(),
    profiles: indices.map(i => JSON.parse(JSON.stringify(ST.profiles[i]))) };
}
/** Reads the text of an exported file. Returns the list of cleaned profiles, or throws an Error with a readable message. */
function parseProfilesFile(text) {
  let o; try { o = JSON.parse(text); } catch (e) { throw new Error('This file is not a valid Adjectivia profiles file.'); }
  if (!o || o.app !== 'adjectivia' || !Array.isArray(o.profiles) || !o.profiles.length) throw new Error('This file does not contain Adjectivia profiles.');
  if (o.profiles.length > MAX_PROFILES) throw new Error('The file has too many profiles.');
  return { exported: o.exported || '', profiles: o.profiles.map((p, i) => normaliseProfile(p, i)) };
}
function exportProfiles(indices) {
  const data = exportPayload(indices);
  const day = new Date().toISOString().slice(0, 10);
  const one = indices.length === 1 ? profileLabel(ST.profiles[indices[0]], indices[0]).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') : 'all-profiles';
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: 'adjectivia-' + (one || 'profile') + '-' + day + '.json' });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Saved ' + indices.length + (indices.length === 1 ? ' profile' : ' profiles') + ' to a file', 'good');
}
function readImportFile(file) {
  if (file.size > 5e6) return toast('That file is too big', 'bad');
  const rd = new FileReader();
  rd.onload = () => {
    let res; try { res = parseProfilesFile(String(rd.result)); } catch (e) { return toast(e.message, 'bad'); }
    confirmImport(res.profiles);
  };
  rd.onerror = () => toast('Could not read the file', 'bad');
  rd.readAsText(file);
}
function confirmImport(profiles) {
  const summary = list => h('ul', { class: 'imp-list' }, list.map((pr, i) => h('li', null, h('b', null, profileLabel(pr, i)), ' — ',
    pr.players.slice(0, pr.active).map(p => (p.name || 'Player') + ' (' + p.xp + ' XP)').join(', '))));
  const done = () => { closeModal(); saveAll(); toast('Profiles imported', 'good'); showProfiles(); };
  if (profiles.length === 1) {
    const sel = h('select', { 'aria-label': 'Where to put the profile' }, ST.profiles.map((pr, i) => h('option', { value: i, selected: i === ST.cur }, (i + 1) + '. ' + profileLabel(pr, i) + (i === ST.cur ? ' (current)' : ''))));
    openModal(h('div', null, h('h3', null, ico('1F4C2'), ' Import a profile'), summary(profiles),
      h('p', null, 'Put it in this place (what is there now will be replaced):'), sel,
      h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: closeModal }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: () => { ST.profiles[parseInt(sel.value, 10)] = profiles[0]; done(); } }, 'Import'))));
  } else {
    openModal(h('div', null, h('h3', null, ico('1F4C2'), ' Import ' + profiles.length + ' profiles'), summary(profiles),
      h('p', { class: 'warn' }, 'All your current profiles will be replaced by these ones.'),
      h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: closeModal }, 'Cancel'),
        h('button', { class: 'btn danger', onclick: () => { for (let i = 0; i < MAX_PROFILES; i++) ST.profiles[i] = profiles[i] || normaliseProfile(null, i); ST.cur = clamp(ST.cur, 0, MAX_PROFILES - 1); done(); } }, 'Replace all'))), null, true);
  }
}
function resetWholeProfile(i) {
  const label = profileLabel(ST.profiles[i], i);
  openModal(h('div', null, h('h3', null, 'Reset ' + label + '?'), h('p', null, 'Names, avatars, XP, trophies and statistics of this whole profile will be erased.'),
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: closeModal }, 'Cancel'),
      h('button', { class: 'btn danger', onclick: () => { ST.profiles[i] = normaliseProfile(null, i); saveAll(); closeModal(); showProfiles(); } }, 'Reset'))));
}
function pickAvatar(i, done) {
  const used = new Set(ST.players.slice(0, ST.active).map((p, j) => j === i ? null : p.avatar));
  const grid = h('div', { class: 'av-grid' }, AVATARS.map(a => h('button', { class: 'av' + (ST.players[i].avatar === a ? ' on' : ''), disabled: used.has(a),
    onclick: () => { ST.players[i].avatar = a; save(); closeModal(); done(); } }, ico(a))));
  openModal(h('div', null, h('h3', null, 'Choose an avatar'), grid, h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: closeModal }, 'Close'))));
}
function resetPlayer(i, done) {
  openModal(h('div', null, h('h3', null, 'Reset ' + pname(i) + '’s progress?'), h('p', null, 'XP, rank, trophies and statistics of this place will be erased. The name stays.'),
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: closeModal }, 'Cancel'),
      h('button', { class: 'btn danger', onclick: () => { const p = ST.players[i]; Object.assign(p, newPlayer(i), { name: p.name, avatar: p.avatar }); save(); closeModal(); done(); } }, 'Reset'))));
}

/* ---------- settings & trophies ---------- */
function showSettings() {
  const row = (key, label, desc) => {
    const b = h('button', { class: 'toggle' + (ST.settings[key] ? ' on' : ''), role: 'switch', 'aria-checked': String(!!ST.settings[key]), onclick: () => {
      ST.settings[key] = !ST.settings[key]; b.classList.toggle('on', ST.settings[key]); b.setAttribute('aria-checked', String(ST.settings[key])); save(); paintSound(); sfx('click');
    } }, h('i'));
    return h('div', { class: 'srow' }, h('div', null, h('b', null, label), h('small', null, desc)), b);
  };
  openModal(h('div', null, h('h3', null, ico('2699'), ' Settings'),
    row('sound', 'Sound effects', 'Short beeps and fanfares.'),
    row('music', 'Music in the Golden Ladder', 'Original pirate and suspense tracks.'),
    h('div', { class: 'srow' }, h('div', null, h('b', null, 'Music volume')),
      h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: ST.settings.musicVol, 'aria-label': 'Music volume',
        oninput: e => { ST.settings.musicVol = parseFloat(e.target.value); Music.refreshVolume(); save(); } })),
    row('tts', 'Read words aloud', ttsReady() ? 'Uses this device’s English voice.' : 'No English voice was found on this device.'),
    row('readAnswers', 'Read the right answer after each question', 'Helps pronunciation.'),
    row('confirm', 'Ask “Final answer?” in the Golden Ladder', 'A pause before locking in an answer.'),
    h('div', { class: 'srow' }, h('div', null, h('b', null, 'Class statistics'), h('small', null, 'Forget which words were missed.')),
      h('button', { class: 'btn small', onclick: () => { ST.words = {}; save(); toast('Statistics cleared'); } }, 'Clear')),
    h('div', { class: 'srow' }, h('div', null, h('b', null, 'Erase everything'), h('small', null, 'Names, XP, trophies and settings.')),
      h('button', { class: 'btn small danger', onclick: () => { if (confirm('Erase ALL saved data of Adjectivia in this browser?')) { ['settings', 'profiles', 'profile', 'prefs', 'active', 'players', 'words'].forEach(LS.del); location.reload(); } } }, 'Erase')),
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: closeModal }, 'Done'))));
}
function paintSound() {
  const b = $('#btn-sound'); b.replaceChildren(ico(ST.settings.sound ? '1F50A' : '1F507'));
  b.setAttribute('aria-pressed', String(!ST.settings.sound));
}
function showTrophies() {
  const wrap = h('div', { class: 'trophy-screen' });
  wrap.append(h('h2', null, ico('1F3C6'), ' Trophies & statistics'));
  const pl = activePlayers();
  const grid = h('div', { class: 'tgrid' });
  TROPHIES.forEach(t => {
    const cell = h('div', { class: 'tcell' }, ico(t.ic), h('b', null, t.name), h('small', null, t.desc),
      h('div', { class: 'tw' }, pl.map(p => h('span', { class: 'tw-p' + (p.trophies.includes(t.id) ? ' got' : ''), style: '--pc:' + PCOLORS[p.id], title: pname(p.id) }, ico(p.avatar)))));
    grid.append(cell);
  });
  wrap.append(h('p', { class: 'muted' }, 'Coloured faces have won the trophy.'), grid);
  const miss = missedWords(12);
  wrap.append(h('h3', null, ico('1F50E'), ' Class: words to practise'));
  wrap.append(miss.length ? h('div', { class: 'chips' }, miss.map(w => h('button', { class: 'chip big', onclick: () => speak(w.w) }, w.w, h('small', null, ' = ' + w.ca + ' · ✗' + ST.words[w.w].ko)))) :
    h('p', { class: 'muted' }, 'Nothing yet. Words that are answered wrongly will appear here.'));
  const tbl = h('table', { class: 'stats' }, h('thead', null, h('tr', null, ['Player', 'Rank', 'XP', 'Games', 'Correct', 'Wrong', 'Best streak'].map(x => h('th', null, x)))),
    h('tbody', null, pl.map(p => h('tr', null, h('td', null, pname(p.id)), h('td', null, rankInfo(p.id).rank.name), h('td', null, p.xp), h('td', null, p.games), h('td', null, p.correct), h('td', null, p.wrong), h('td', null, p.bestStreak)))));
  wrap.append(h('h3', null, ico('1F4CA'), ' Players'), h('div', { class: 'tbl-wrap' }, tbl));
  wrap.append(h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => showHub() }, '← Back')));
  render(wrap, 'Trophies');
}
