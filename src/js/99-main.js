/* ============================================================
   Adjectivia — splash, hub, boot and the built-in self test (?selftest)
   ============================================================ */
const MODES = [
  { id: 'ladder', name: 'Golden Ladder', ic: '1F3C6', desc: '15 questions, 5 lifelines and big prizes. Who will reach the top?', tag: '1-6 players', go: () => setupLadder(), hot: true },
  { id: 'memory', name: 'Memory', ic: '1F9E0', desc: 'Turn cards and find synonyms, opposites and pictures.', tag: '1-6 players', go: () => setupMemory() },
  { id: 'match', name: 'Match-Up', ic: '1F517', desc: 'Connect words with the same meaning or opposite meaning.', tag: '1-6 players', go: () => setupMatch() },
  { id: 'faces', name: 'Emotion Faces', ic: '1F60E', desc: 'How do they feel? Read the faces and learn the feelings.', tag: '1-6 players', go: () => setupFaces() },
  { id: 'gap', name: 'Sentence Gap', ic: '1F4DD', desc: 'Choose the adjective that completes the sentence.', tag: '1-6 players', go: () => setupGap() },
  { id: 'speed', name: 'Speed Round', ic: '26A1', desc: 'Beat the clock! One fast turn for every player.', tag: '1-6 players', go: () => setupSpeed() },
  { id: 'hotseat', name: 'Hot Seat', ic: '1F3A4', desc: 'Describe the word without saying it. Speaking practice!', tag: '2-6 players', go: () => setupHotSeat() },
  { id: 'hangman', name: 'Balloon Pop', ic: '1F388', desc: 'Guess the letters before the balloons pop.', tag: '1-6 players', go: () => setupHangman() },
  { id: 'wordbank', name: 'Word Bank', ic: '1F4DA', desc: 'Browse every adjective, listen to it and practise with flashcards.', tag: 'Study', go: () => showWordBank(), study: true }
];
const MODE_COLORS = ['#ffd23f', '#4cc9f0', '#3ddc97', '#f472b6', '#a78bfa', '#fb923c', '#ff6b6b', '#22d3ee', '#94a3b8'];

function showHub() {
  if (G) G.live = false;
  Music.stop(0.5);
  const wrap = h('div', { class: 'hub' });
  wrap.append(h('button', { class: 'profile-chip', onclick: () => showProfiles(), title: 'Change profile' }, ico('1F465'), ' Profile: ', h('b', null, profileLabel(ST.profiles[ST.cur], ST.cur)), h('small', null, ' · change')));
  const strip = h('div', { class: 'pstrip' });
  activePlayers().forEach(p => {
    const ri = rankInfo(p.id);
    strip.append(h('div', { class: 'pmini', style: '--pc:' + PCOLORS[p.id] }, avatar(p.id, 'md'),
      h('div', null, h('b', null, pname(p.id)), h('small', null, ico(ri.rank.ic, 'tiny'), ' ' + ri.rank.name + ' · ' + p.xp + ' XP'), h('div', { class: 'xpbar slim' }, h('i', { style: 'width:' + ri.pct + '%' })))));
  });
  wrap.append(strip);
  wrap.append(h('h2', { class: 'hub-title' }, 'Choose a game'));
  const grid = h('div', { class: 'mode-grid' });
  MODES.forEach((m, i) => {
    grid.append(h('button', { class: 'mode-card' + (m.hot ? ' hot' : '') + (m.study ? ' study' : ''), style: '--mc:' + MODE_COLORS[i], onclick: () => { sfx('click'); m.go(); } },
      ico(m.ic, 'xl'), h('b', null, m.name), h('span', { class: 'md' }, m.desc), h('small', { class: 'tag' }, m.tag)));
  });
  wrap.append(grid);
  wrap.append(h('div', { class: 'hub-actions' },
    h('button', { class: 'btn', onclick: () => showPlayers() }, ico('1F465'), ' Players'),
    h('button', { class: 'btn', onclick: () => showTrophies() }, ico('1F3C6'), ' Trophies & stats'),
    h('button', { class: 'btn', onclick: showSettings }, ico('2699'), ' Settings')));
  render(wrap, '');
}
function showSplash() {
  const first = LS.get('profiles', null) === null && LS.get('players', null) === null;
  const wrap = h('div', { class: 'splash' },
    h('div', { class: 'owl' }, ico('1F989', 'huge')),
    h('h1', null, 'Adjectivia'),
    h('p', { class: 'tagline' }, 'Describe it. Feel it. Win it!'),
    h('div', { class: 'splash-faces' }, ['1F604', '1F622', '1F620', '1F628', '1F92F', '1F60E', '1F973'].map(c => ico(c))),
    h('button', { class: 'btn primary huge', id: 'btn-play', onclick: () => { sfx('start'); if (first) { saveAll(); showProfiles(); } else showHub(); } }, ico('25B6'), ' Play'),
    h('p', { class: 'muted' }, 'English adjectives and feelings · 1 to 6 players · 9 games'));
  render(wrap, '');
  const b = $('#btn-play'); if (b) b.focus({ preventScroll: true });
}

function boot() {
  fxInit();
  $('#logo-ico').append(ico('1F989'));
  $('#btn-settings').append(ico('2699'));
  paintSound();
  $('#ver').textContent = 'v' + VERSION;
  $('#btn-home').addEventListener('click', () => {
    if (G && G.live) {
      openModal(h('div', null, h('h3', null, 'Leave this game?'), h('p', null, 'The current game will be lost.'),
        h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: closeModal }, 'Keep playing'), h('button', { class: 'btn primary', onclick: () => { closeModal(); showHub(); } }, 'Leave'))));
    } else showHub();
  });
  $('#btn-sound').addEventListener('click', () => { ST.settings.sound = !ST.settings.sound; save(); paintSound(); sfx('click'); });
  $('#btn-settings').addEventListener('click', showSettings);
  $('#btn-full').addEventListener('click', () => {
    try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { /* ignore */ }
  });
  if (/#hub\b/.test(location.hash)) showHub(); else showSplash();     // index.html#hub skips the title screen
  if (/[?&]selftest/.test(location.search)) runSelfTest();
}
/* ============================================================
   Self test: open index.html?selftest
   ============================================================ */
function runSelfTest() {
  const out = [], fails = [];
  const log = s => out.push(s);
  const fail = s => { fails.push(s); out.push('FAIL  ' + s); };
  const ok = (cond, s) => { if (!cond) fail(s); };
  const wordRe = w => new RegExp('(^|[^A-Za-z-])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z-])', 'i');

  /* ---- data ---- */
  log('Words: ' + WORDS.length + ' · categories: ' + CAT_ORDER.length);
  const seen = new Set(), defs = new Set();
  WORDS.forEach(x => {
    ok(!seen.has(x.w), 'duplicate word ' + x.w); seen.add(x.w);
    ok(x.ca && x.def && x.ex, 'missing field in ' + x.w);
    ok(CATS[x.cat], 'bad category in ' + x.w);
    ok(wordRe(x.w).test(x.ex), 'example lacks the word: ' + x.w);
    ok(!wordRe(x.w).test(x.def), 'definition contains the word: ' + x.w);
    ok(!defs.has(x.def), 'duplicate definition: ' + x.def); defs.add(x.def);
    ok(x.l >= 1 && x.l <= 3, 'bad level ' + x.w);
    if (x.ic) ok(ICONS[x.ic], 'missing icon ' + x.ic + ' for ' + x.w);
    if (x.face) ok(x.ic, 'face word without icon: ' + x.w);
    if (x.face) ok(['FEEL', 'BODY'].includes(x.macro), 'face word outside feelings: ' + x.w);
    SYN.get(x.w).forEach(y => ok(!OPP.get(x.w).has(y), 'both synonym and opposite: ' + x.w + '/' + y));
  });
  CAT_ORDER.forEach(c => { ok(ICONS[CATS[c].ic], 'category icon missing ' + c); log('  ' + c + ': ' + WORDS.filter(x => x.cat === c).length + ' words (lvl1 ' + WORDS.filter(x => x.cat === c && x.l === 1).length + ')'); });
  [].concat(AVATARS, RANKS.map(r => r.ic), TROPHIES.map(t => t.ic)).forEach(c => ok(ICONS[c], 'icon missing: ' + c));
  log('Faces: ' + WORDS.filter(x => x.face).length + ' · words with relations: syn ' + WORDS.filter(x => SYN.get(x.w).size).length + ', opp ' + WORDS.filter(x => OPP.get(x.w).size).length);

  /* ---- questions ---- */
  const N = 250, counts = {}, samples = {};
  const types = Object.keys(QT).concat(['ooo']);
  const sets = { easy: [1], medium: [1, 2], hard: [2, 3], l3: [3] };
  const savedTts = ST.settings.tts, savedV = VOICES; ST.settings.tts = true;
  const fakeVoice = { lang: 'en-GB', name: 'test' };
  VOICES = [fakeVoice];
  types.forEach(type => Object.keys(sets).forEach(lk => {
    const ctx = { levels: sets[lk], types: [type], used: new Set(), close: lk !== 'easy' };
    let made = 0, miss = 0;
    for (let n = 0; n < N; n++) {
      ctx.used.clear();
      const q = nextQuestion(ctx);
      if (!q) { miss++; continue; }
      made++;
      const labels = q.options.map(o => o.label);
      ok(q.options.length === 4, type + ': need 4 options (' + q.word + ')');
      ok(new Set(labels).size === 4, type + ': duplicate options (' + q.word + '): ' + labels);
      ok(q.answer >= 0 && q.answer < 4, type + ': bad answer index');
      ok(q.explain && q.hintCa && q.hintCa.length, type + ': missing explain/hint (' + q.word + ')');
      const right = q.options[q.answer], nr = near(q.word);
      if (type === 'syn') { ok(SYN.get(q.word).has(right.w), 'syn: answer not a synonym ' + q.word + '/' + right.w); q.options.forEach((o, i) => ok(i === q.answer || (!nr.has(o.w) && !moodClash(byWord(o.w), byWord(q.word), byWord(right.w))), 'syn: near word offered ' + q.word + '/' + o.w)); }
      if (type === 'opp') { ok(OPP.get(q.word).has(right.w), 'opp: answer not an opposite ' + q.word + '/' + right.w); q.options.forEach((o, i) => ok(i === q.answer || (!nr.has(o.w) && !moodClash(byWord(o.w), byWord(q.word), byWord(right.w))), 'opp: near word offered ' + q.word + '/' + o.w)); }
      if (type === 'def' || type === 'gap' || type === 'listen' || type === 'face' || type === 'faceRev') {
        ok(right.w === q.word, type + ': answer is not the target ' + q.word);
        if (type !== 'gap') q.options.forEach((o, i) => ok(i === q.answer || !nr.has(o.w), type + ': near word offered ' + q.word + '/' + o.w));
      }
      if (type === 'gap') {
        ok(q.sentence.includes('_____'), 'gap: no blank'); const g = GAPS.get(q.word);
        q.options.forEach((o, i) => { if (i !== q.answer) ok(g.h.includes(o.w) || g.e.includes(o.w), 'gap: wrong answer not from the bank: ' + q.word + '/' + o.w); });
      }
      if (type === 'face' || type === 'faceRev') {
        const ics = q.options.map(o => o.ic), cats = q.options.map(o => byWord(o.w).cat);
        ok(new Set(ics).size === 4 && new Set(cats).size === 4, type + ': faces/cats not distinct ' + labels);
        ics.forEach((a, i) => ics.forEach((b, j) => { if (i < j) ok(!clash(a, b), type + ': clashing faces ' + labels[i] + '/' + labels[j]); }));
      }
      if (type === 'ooo') {
        const others = q.options.filter((o, i) => i !== q.answer).map(o => byWord(o.w));
        const odd = byWord(q.word); ok(right.w === q.word, 'ooo: odd mismatch');
        others.forEach(o => ok(!related(o.w, odd.w), 'ooo: ambiguous ' + odd.w + '/' + o.w));
        ok(others.every(o => (o.macro === others[0].macro) || (['LOOK', 'SIZE'].includes(o.macro) && ['LOOK', 'SIZE'].includes(others[0].macro))), 'ooo: mixed base group');
      }
      if (n < 2 && lk === 'hard') (samples[type] = samples[type] || []).push(q);
    }
    counts[type + '/' + lk] = made + '/' + N;
    ok(made > N * 0.6, type + ' @' + lk + ': too few questions could be made (' + made + ')');
  }));
  ST.settings.tts = savedTts; VOICES = savedV;
  log('Questions generated (made/asked): ' + JSON.stringify(counts));

  /* ---- pairs ---- */
  ['syn', 'opp', 'pic', 'mixed'].forEach(kind => ['easy', 'medium', 'hard'].forEach(lk => {
    for (let n = 0; n < 40; n++) {
      const ps = buildPairs(kind, 10, LEVEL_SETS[lk]);
      ok(ps.length >= 6, 'memory pairs too few ' + kind + '/' + lk + ': ' + ps.length);
      const ws = [];
      ps.forEach(p => { ws.push(p.a.w); if (p.b) ws.push(p.b.w); });
      ok(new Set(ws).size === ws.length, 'memory duplicate word');
      ps.forEach((p, i) => ps.forEach((q2, j) => { if (i < j) [p.a, p.b].forEach(x => [q2.a, q2.b].forEach(y => { if (x && y) ok(!near(x.w).has(y.w), 'memory ambiguous ' + x.w + '/' + y.w); })); }));
    }
  }));
  ['syn', 'opp'].forEach(kind => ['easy', 'medium', 'hard'].forEach(lk => {
    let okc = 0;
    for (let n = 0; n < 40; n++) { const ps = buildMatchPairs(kind, 5, LEVEL_SETS[lk]); if (ps) { okc++; const ws = ps.flatMap(p => [p.a.w, p.b.w]); ok(new Set(ws).size === 10, 'match duplicate word'); } }
    ok(okc === 40, 'match pairs failed for ' + kind + '/' + lk + ' (' + okc + '/40)');
  }));
  log('Pairs checked.');

  /* ---- profiles: export / import ---- */
  const payload = exportPayload([0, 1, 2, 3, 4, 5]);
  const back = parseProfilesFile(JSON.stringify(payload));
  ok(JSON.stringify(back.profiles) === JSON.stringify(ST.profiles.map((p, i) => normaliseProfile(p, i))), 'profiles: export/import round trip changed the data');
  ['nope', '{}', '{"app":"other","profiles":[{}]}', '{"app":"adjectivia","profiles":[]}'].forEach(bad => { let thrown = false; try { parseProfilesFile(bad); } catch (e) { thrown = true; } ok(thrown, 'profiles: bad file accepted: ' + bad); });
  const evil = parseProfilesFile(JSON.stringify({ app: 'adjectivia', profiles: [{ name: 12, active: 99, players: [{ name: 'x'.repeat(50), xp: -5, avatar: 'zzz', trophies: 'no', games: 'many' }], words: { happy: { ok: 'a', ko: 2 } } }] })).profiles[0];
  ok(evil.active === 6 && evil.name === '' && evil.players[0].name.length === 14 && evil.players[0].xp === 0 && AVATARS.includes(evil.players[0].avatar) && Array.isArray(evil.players[0].trophies) && evil.players[0].games === 0 && evil.words.happy.ok === 0 && evil.words.happy.ko === 2 && evil.players.length === 6, 'profiles: import does not clean bad values');
  log('Profile export/import checked.');

  /* ---- report ---- */
  window.__selftest = { fails, out, samples: Object.fromEntries(Object.keys(samples).map(t => [t, samples[t].map(q => ({ lead: q.lead, big: q.big || q.sentence || q.bigIcon, options: q.options.map(o => o.label), answer: q.answer, explain: q.explain }))])) };
  const box = h('div', { class: 'selftest' }, h('h2', null, fails.length ? '❌ Self test: ' + fails.length + ' problem(s)' : '✅ Self test passed'),
    h('pre', null, out.join('\n')));
  render(box, 'Self test');
  log(fails.length ? 'FAILED' : 'PASSED');
  /* music: render every track offline at three intensities; it must be audible, finite and not clipping */
  window.__selftest.musicDone = false;
  (async () => {
    for (const name of Object.keys(Music.tracks)) for (const I of [0, 0.5, 1]) {
      const d = (await Music.renderOffline(name, 6, I)).getChannelData(0);
      let peak = 0, sum = 0, bad = 0;
      for (let i = 0; i < d.length; i++) { const v = d[i]; if (!isFinite(v)) bad++; peak = Math.max(peak, Math.abs(v)); sum += v * v; }
      const rms = Math.sqrt(sum / d.length);
      const good = bad === 0 && peak < 0.99 && peak > 0.02 && rms > 0.004;
      out.splice(out.length - 1, 0, 'Music ' + name + ' @' + I + ': peak ' + peak.toFixed(2) + ' rms ' + rms.toFixed(3) + (good ? '' : '  FAIL'));
      if (!good) fails.push('music ' + name + ' @' + I);
    }
    $('pre', box).textContent = out.join('\n');
    $('h2', box).textContent = fails.length ? '❌ Self test: ' + fails.length + ' problem(s)' : '✅ Self test passed';
    if (!fails.length) out[out.length - 1] = 'PASSED'; else out[out.length - 1] = 'FAILED';
    window.__selftest.musicDone = true;
  })();
}

boot();
