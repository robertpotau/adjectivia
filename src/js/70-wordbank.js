/* ============================================================
   Mode 4 — Word Bank: vocabulary list, word details and flashcards
   ============================================================ */
const WB = { cat: 'all', lvl: 0, q: '', ca: true, missed: false };

function noteViewed(word) {
  const v = ST.prefs.viewed || (ST.prefs.viewed = []);
  if (!v.includes(word)) { v.push(word); save(); if (v.length >= 50) activePlayers().forEach(p => award(p.id, 'bookworm')); }
}
function wbList() {
  const q = WB.q.trim().toLowerCase();
  return WORDS.filter(x => (WB.cat === 'all' || x.cat === WB.cat) && (!WB.lvl || x.l === WB.lvl) &&
    (!q || x.w.includes(q) || x.ca.toLowerCase().includes(q)) && (!WB.missed || missedWords(200).includes(x)));
}
const wordIcon = x => x.ic || CATS[x.cat].ic;

function showWordBank() {
  const wrap = h('div', { class: 'wordbank' });
  const grid = h('div', { class: 'wgrid' });
  const count = h('span', { class: 'muted' });
  const search = h('input', { type: 'search', placeholder: 'Search a word…', value: WB.q, 'aria-label': 'Search', oninput: () => { WB.q = search.value; draw(); } });
  const catRow = h('div', { class: 'chip-row tight' });
  const catBtn = (id, label, ic) => {
    const b = h('button', { class: 'choice sm' + (WB.cat === id ? ' on' : ''), onclick: () => { WB.cat = id; sfx('click'); $$('.choice', catRow).forEach(x => x.classList.remove('on')); b.classList.add('on'); draw(); } }, ic ? ico(ic, 'tiny') : null, ' ', label);
    return b;
  };
  catRow.append(catBtn('all', 'All', null));
  CAT_ORDER.forEach(c => catRow.append(catBtn(c, CATS[c].label, CATS[c].ic)));
  const lvlRow = h('div', { class: 'chip-row tight' });
  [[0, 'All levels'], [1, 'Level 1'], [2, 'Level 2'], [3, 'Level 3']].forEach(([v, label]) => {
    const b = h('button', { class: 'choice sm' + (WB.lvl === v ? ' on' : ''), onclick: () => { WB.lvl = v; sfx('click'); $$('.choice', lvlRow).forEach(x => x.classList.remove('on')); b.classList.add('on'); draw(); } }, label);
    lvlRow.append(b);
  });
  const caBtn = h('button', { class: 'choice sm' + (WB.ca ? ' on' : ''), onclick: () => { WB.ca = !WB.ca; caBtn.classList.toggle('on', WB.ca); draw(); } }, 'Show Catalan');
  const missBtn = h('button', { class: 'choice sm' + (WB.missed ? ' on' : ''), onclick: () => { WB.missed = !WB.missed; missBtn.classList.toggle('on', WB.missed); draw(); } }, ico('1F50E', 'tiny'), ' Missed words');
  const flashBtn = h('button', { class: 'btn primary', onclick: () => { const l = wbList(); if (!l.length) return toast('No words in this list', 'bad'); startFlash(shuffle(l)); } }, ico('1F4D6'), ' Flashcards');

  function draw() {
    const list = wbList();
    count.textContent = list.length + ' words';
    grid.replaceChildren(...list.map(x => h('button', { class: 'wcard cat-' + x.cat, onclick: () => { noteViewed(x.w); showWord(x, list); } },
      ico(wordIcon(x)), h('b', null, x.w), WB.ca ? h('small', null, x.ca) : null)));
    if (!list.length) grid.append(h('p', { class: 'muted' }, WB.missed ? 'No missed words yet. Play some games first!' : 'No words found.'));
  }
  wrap.append(h('h2', null, ico('1F4DA'), ' Word Bank'),
    h('div', { class: 'wb-tools' }, search, caBtn, missBtn, flashBtn, count), catRow, lvlRow, grid,
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => showHub() }, '← Back')));
  render(wrap, 'Word Bank');
  draw();
}
function showWord(x, list) {
  const rel = (label, arr) => arr.length ? h('div', { class: 'wd-rel' }, h('b', null, label), arr.map(w => h('button', { class: 'chip big', onclick: () => { noteViewed(w); showWord(byWord(w), list); } }, w))) : null;
  const idx = list ? list.indexOf(x) : -1;
  const nav = (d) => { const n = list[(idx + d + list.length) % list.length]; noteViewed(n.w); showWord(n, list); };
  openModal(h('div', { class: 'wd' },
    h('div', { class: 'wd-top' }, ico(wordIcon(x), 'xl'), h('div', null, h('h2', null, x.w, h('button', { class: 'say', 'aria-label': 'Listen', onclick: () => speak(x.w) }, ico('1F50A'))),
      h('div', { class: 'wd-ca' }, x.ca), h('small', { class: 'muted' }, CATS[x.cat].label + ' · level ' + x.l))),
    h('p', { class: 'wd-def' }, h('b', null, 'Meaning: '), cap(x.def) + '.'),
    h('p', { class: 'wd-ex' }, h('b', null, 'Example: '), x.ex, h('button', { class: 'say sm', 'aria-label': 'Listen to the sentence', onclick: () => speak(x.ex) }, ico('1F50A'))),
    rel('Similar:', synOf(x.w)), rel('Opposite:', oppOf(x.w)),
    h('div', { class: 'actions' }, idx >= 0 && list.length > 1 ? h('button', { class: 'btn', onclick: () => nav(-1) }, '←') : null,
      h('button', { class: 'btn primary', onclick: closeModal }, 'Close'), idx >= 0 && list.length > 1 ? h('button', { class: 'btn', onclick: () => nav(1) }, '→') : null)), null, true);
  speak(x.w);
}

/* ---------- flashcards ---------- */
function startFlash(deck0) {
  let deck = deck0.slice(), total = deck.length, known = 0, again = [];
  function next() {
    if (!deck.length) {
      if (again.length) {
        const w = h('div', { class: 'intro' }, h('h2', null, 'Round finished'), h('p', null, 'You marked ' + again.length + ' cards to practise again.'),
          h('div', { class: 'actions' }, h('button', { class: 'btn primary big', onclick: () => { deck = shuffle(again); again = []; next(); } }, 'Practise them'),
            h('button', { class: 'btn', onclick: showWordBank }, 'Word Bank')));
        render(w, 'Flashcards'); return;
      }
      sfx('win'); confetti(120);
      render(h('div', { class: 'intro' }, h('h2', null, ico('1F389'), ' All cards done!'), h('p', null, total + ' words reviewed.'),
        h('div', { class: 'actions' }, h('button', { class: 'btn primary big', onclick: showWordBank }, 'Back to the Word Bank'))), 'Flashcards');
      return;
    }
    const x = deck[0]; let flipped = false;
    noteViewed(x.w);
    const front = h('div', { class: 'fc-face front' }, ico(wordIcon(x), 'xxl'), h('div', { class: 'fc-word' }, x.w), h('small', null, 'Tap to see the meaning'));
    const back = h('div', { class: 'fc-face back' }, h('div', { class: 'fc-word sm' }, x.w), h('div', { class: 'wd-ca' }, x.ca),
      h('p', null, cap(x.def) + '.'), h('p', { class: 'wd-ex' }, x.ex));
    const card = h('div', { class: 'fcard', role: 'button', tabindex: 0, 'aria-label': 'Flip card', onclick: flip }, front, back);
    const prog = h('div', { class: 'fc-prog' }, h('i', { style: 'width:' + (100 * known / total) + '%' }));
    const btns = h('div', { class: 'actions fc-actions' },
      h('button', { class: 'btn danger', onclick: () => { again.push(deck.shift()); sfx('ko'); next(); } }, '✗ Again'),
      h('button', { class: 'btn', onclick: () => speak(x.w) }, ico('1F50A'), ' Listen'),
      h('button', { class: 'btn primary', onclick: () => { deck.shift(); known++; sfx('ok'); next(); } }, '✓ I know it'));
    function flip() { flipped = !flipped; card.classList.toggle('flipped', flipped); sfx('flip'); if (flipped) speak(x.ex); }
    render(h('div', { class: 'flash' }, h('div', { class: 'muted' }, 'Card ' + (known + again.length + 1) + ' of ' + total), prog, card, btns,
      h('div', { class: 'actions' }, h('button', { class: 'btn small', onclick: showWordBank }, '← Word Bank'))), 'Flashcards');
    Keys.on(e => { if (e.key === ' ' || e.key === 'Enter') { flip(); return true; } if (e.key === 'ArrowRight') { deck.shift(); known++; sfx('ok'); next(); return true; } if (e.key === 'ArrowLeft') { again.push(deck.shift()); next(); return true; } return false; });
    Timers.set(() => speak(x.w), 300);
  }
  next();
}
