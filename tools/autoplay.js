/* Developer test harness (not part of the game).
   Load it in the page console (served over http://):  eval(await (await fetch('tools/autoplay.js')).text())
   Then:  runAll()  -> results appear in window.__out (poll it), errors in window.__errs.
   It speeds every game timer up 25x and plays whole games with random (or, with {smart:true}, correct) answers. */
window.__errs = [];
window.addEventListener('error', e => window.__errs.push(String(e.message) + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
window.addEventListener('unhandledrejection', e => window.__errs.push('rej ' + e.reason));
if (!Timers.__fast) {
  const s = Timers.set.bind(Timers), ev = Timers.every.bind(Timers);
  Timers.set = (fn, ms) => s(fn, ms / 25); Timers.every = (fn, ms) => ev(fn, ms / 25); Timers.__fast = true;
  const _nq = nextQuestion; nextQuestion = function (ctx) { const q = _nq(ctx); window.__lastQ = q; return q; };
}
window.autoplay = function (opts) {
  opts = opts || {};
  return new Promise(resolve => {
    const t0 = Date.now();
    const finish = o => { clearInterval(iv); resolve(o); };
    const tick = () => {
      if (Date.now() - t0 > (opts.max || 60000)) return finish({ done: false, screen: document.querySelector('#app').firstElementChild?.className, errs: window.__errs.slice() });
      const root = document.querySelector('#app').firstElementChild; if (!root) return;
      if (root.classList.contains('podium-screen')) return finish({ done: true, errs: window.__errs.slice(), title: root.querySelector('h2')?.textContent, n: root.querySelectorAll('.p-score, .pod-rest .sc').length });
      const modal = document.querySelector('.modal');
      if (modal) {
        const fr = modal.querySelector('.friend'); if (fr) { fr.click(); return; }
        const b = [...modal.querySelectorAll('button')].find(b => /Done|Hang up|Next|podium|Take them|Close|Yes/i.test(b.textContent) && !b.disabled) || modal.querySelector('.btn.primary');
        if (b) b.click(); return;
      }
      const cb = document.querySelector('.confirm-bar:not([hidden]) .btn.primary'); if (cb) { cb.click(); return; }
      const cls = root.className;
      if (opts.smart && window.__lastQ && root.querySelector('.opt')) {
        const o2 = [...root.querySelectorAll('.opt')];
        if (!o2.some(b => b.classList.contains('right') || b.classList.contains('wrong')) && !o2.every(b => b.disabled)) { const t = o2[window.__lastQ.answer]; if (t && !t.disabled) t.click(); return; }
        else if (o2.some(b => b.classList.contains('right') || b.classList.contains('wrong'))) return;
      }
      if (cls.includes('memory')) {
        const cs = [...root.querySelectorAll('.mcard:not(.done):not(.up)')];
        if (cs.length >= 2 && !window.__memBusy) { window.__memBusy = 1; cs[rnd(cs.length)].click(); const rest = [...root.querySelectorAll('.mcard:not(.done):not(.up)')]; rest[rnd(rest.length)].click(); setTimeout(() => { window.__memBusy = 0; }, 300); }
        return;
      }
      if (cls.includes('matchup')) { const l = [...root.querySelectorAll('.mw.l:not(.done)')], r = [...root.querySelectorAll('.mw.r:not(.done)')]; if (l.length) { l[0].click(); r[rnd(r.length)].click(); } return; }
      if (cls.includes('hangman')) {
        const nb = [...root.querySelectorAll('.actions .btn')].find(b => /Next|podium/.test(b.textContent)); if (nb) { nb.click(); return; }
        const ks = [...root.querySelectorAll('.key:not(:disabled)')]; if (ks.length) ks[rnd(ks.length)].click(); return;
      }
      if (cls.includes('hotseat')) { const g = root.querySelector('.btn.primary'); if (g) g.click(); return; }
      const o = [...root.querySelectorAll('.opt:not(:disabled)')]; if (o.length) { o[rnd(o.length)].click(); return; }
      const nb = [...root.querySelectorAll('.btn.primary')].find(b => !b.disabled && !b.hidden); if (nb) nb.click();
    };
    const iv = setInterval(tick, 40);
  });
};
window.runAll = async function () {
  const out = window.__out = { progress: [] };
  for (const [label, pids] of [['one', [0]], ['six', [0, 1, 2, 3, 4, 5]], ['three', [0, 1, 2]]]) {
    out[label] = {};
    const steps = [
      ['ladderRelay', () => startLadder({ style: 'relay', timer: 0 }, pids), { smart: true, max: 120000 }],
      ['ladderSolo', () => startLadder({ style: 'solo', timer: 30 }, pids), { max: 120000 }],
      ['memory', () => startMemory({ kind: 'mixed', size: 12, level: 'easy' }, pids), { max: 60000 }],
      ['match', () => startMatch({ kind: 'mixed', rounds: 1, level: 'hard' }, pids), { max: 60000 }],
      ['faces', () => startFaces({ dir: 'mixed', per: 3, level: 'easy', timer: 0 }, pids), { max: 60000 }],
      ['gap', () => startGap({ per: 3, level: 'hard', timer: 30 }, pids), { max: 60000 }],
      ['speed', () => startSpeed({ secs: 30, level: 'easy' }, pids), { max: 90000 }],
      ['hangman', () => startHangman({ per: 1, level: 'hard' }, pids), { max: 90000 }]
    ];
    if (pids.length > 1) steps.push(['hotseat', () => startHotSeat({ secs: 45, skips: 4, level: 'mixed' }, pids), { max: 120000 }]);
    for (const [name, start, opts] of steps) { start(); out[label][name] = await autoplay(opts); out.progress.push(label + '/' + name); }
  }
  out.errs = window.__errs.slice(); out.finished = true;
};
