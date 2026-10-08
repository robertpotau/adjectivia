/* ============================================================
   Adjectivia — core helpers: DOM, storage, sound, speech, effects
   ============================================================ */
'use strict';
const VERSION = '0.1.2';

/* ---------- tiny DOM helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
/** OpenMoji icon element (inline SVG so it works offline). */
function ico(code, cls) {
  const s = ICONS[String(code).toUpperCase()];
  const el = h('span', { class: 'ico' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
  if (s) el.innerHTML = s;
  return el;
}
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const sample = (a, n) => shuffle(a).slice(0, n);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const sleep = ms => new Promise(r => Timers.set(r, ms));
function announce(msg) { const e = $('#sr-live'); if (e) e.textContent = msg; }

/* ---------- timers & key handlers, all cleared when the screen changes ---------- */
const Timers = {
  list: new Set(),
  set(fn, ms) { const id = setTimeout(() => { this.list.delete(id); fn(); }, ms); this.list.add(id); return id; },
  every(fn, ms) { const id = setInterval(fn, ms); this.list.add(id); return id; },
  stop(id) { clearTimeout(id); clearInterval(id); this.list.delete(id); },
  clear() { this.list.forEach(id => { clearTimeout(id); clearInterval(id); }); this.list.clear(); }
};
const Keys = {
  fns: [],
  on(fn) { this.fns.push(fn); },
  off(fn) { this.fns = this.fns.filter(f => f !== fn); },
  clear() { this.fns = []; }
};
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
  for (const fn of Keys.fns.slice()) { if (fn(e) === true) { e.preventDefault(); break; } }
});

/* ---------- storage (every access is guarded: private windows may throw) ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem('adjectivia_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('adjectivia_' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem('adjectivia_' + k); } catch (e) { /* ignore */ } }
};

/* ---------- global state ---------- */
const AVATARS = ['1F98A', '1F43C', '1F42F', '1F438', '1F984', '1F427', '1F436', '1F431', '1F435', '1F430', '1F419', '1F428'];
const PCOLORS = ['#22d3ee', '#ffd23f', '#f472b6', '#4ade80', '#a78bfa', '#fb923c'];
const MAX_PLAYERS = 6;
const defaultSettings = { sound: true, tts: true, readAnswers: true, confirm: true };

function newPlayer(i) {
  return { name: '', avatar: AVATARS[i % AVATARS.length], xp: 0, trophies: [], games: 0, correct: 0, wrong: 0, bestStreak: 0, modes: {}, cards: 0 };
}
function loadState() {
  const st = {
    settings: Object.assign({}, defaultSettings, LS.get('settings', {})),
    active: clamp(parseInt(LS.get('active', 3), 10) || 3, 1, MAX_PLAYERS),
    players: [],
    words: LS.get('words', {}),       // word -> {ok, ko}
    prefs: LS.get('prefs', {})        // last options chosen in each mode
  };
  const saved = LS.get('players', []);
  for (let i = 0; i < MAX_PLAYERS; i++) st.players.push(Object.assign(newPlayer(i), saved[i] || {}));
  return st;
}
const ST = loadState();
let saveTimer = 0;
function saveAll() {
  LS.set('settings', ST.settings); LS.set('active', ST.active);
  LS.set('players', ST.players); LS.set('words', ST.words); LS.set('prefs', ST.prefs);
}
/** debounce saves so a burst of answers does not hit storage every time */
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveAll, 250); }
window.addEventListener('pagehide', saveAll);
function activePlayers() { return ST.players.slice(0, ST.active).map((p, i) => Object.assign(p, { id: i })); }
const pname = i => (ST.players[i].name || '').trim() || 'Player ' + (i + 1);

/* ---------- sound effects (WebAudio, no files) ---------- */
let AC = null;
function audio() {
  if (!ST.settings.sound) return null;
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    return AC;
  } catch (e) { return null; }
}
function tone(freq, start, dur, type, vol) {
  const ac = audio(); if (!ac) return;
  try {
    const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + start;
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.05);
  } catch (e) { /* ignore */ }
}
const N = { C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, G5: 784, C6: 1047 };
const SFX = {
  click() { tone(520, 0, .06, 'triangle', .09); },
  flip() { tone(340, 0, .05, 'triangle', .1); tone(480, .04, .06, 'triangle', .08); },
  ok() { tone(N.C5, 0, .12, 'triangle', .16); tone(N.E5, .09, .12, 'triangle', .16); tone(N.G5, .18, .22, 'triangle', .16); },
  ko() { tone(220, 0, .18, 'sawtooth', .12); tone(165, .14, .3, 'sawtooth', .12); },
  match() { tone(N.E5, 0, .1, 'sine', .16); tone(N.C6, .09, .22, 'sine', .14); },
  tick() { tone(900, 0, .03, 'square', .05); },
  lifeline() { [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(f, i * .06, .1, 'triangle', .12)); },
  start() { [N.G4, N.C5, N.E5].forEach((f, i) => tone(f, i * .1, .18, 'triangle', .15)); },
  pop() { tone(180, 0, .09, 'square', .12); tone(90, .03, .12, 'square', .1); },
  levelup() { [N.C5, N.E5, N.G5, N.C6, N.G5, N.C6].forEach((f, i) => tone(f, i * .09, .16, 'triangle', .15)); },
  win() { [N.C5, N.C5, N.C5, N.G5, N.E5, N.G5, N.C6].forEach((f, i) => tone(f, i * .13, .22, 'triangle', .16)); },
  lose() { [N.E4, N.D4, N.C4].forEach((f, i) => tone(f, i * .2, .32, 'sine', .15)); }
};
function sfx(name) { try { if (SFX[name]) SFX[name](); } catch (e) { /* ignore */ } }

/* ---------- speech (browser voices, British English preferred) ---------- */
let VOICES = [];
function loadVoices() { try { VOICES = window.speechSynthesis ? speechSynthesis.getVoices() : []; } catch (e) { VOICES = []; } }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function ttsReady() { return ST.settings.tts && 'speechSynthesis' in window && VOICES.some(v => /^en/i.test(v.lang)); }
function bestVoice() {
  const en = VOICES.filter(v => /^en/i.test(v.lang));
  return en.find(v => /en[-_]GB/i.test(v.lang) && /google|natural|online/i.test(v.name)) ||
    en.find(v => /en[-_]GB/i.test(v.lang)) || en.find(v => /google/i.test(v.name)) || en[0] || null;
}
function speak(text) {
  if (!ttsReady() || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = bestVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
    u.rate = 0.9; speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}

/* ---------- confetti ---------- */
const FX = { parts: [], raf: 0, cv: null, ctx: null };
function fxInit() {
  FX.cv = $('#fx'); FX.ctx = FX.cv.getContext('2d');
  const fit = () => { FX.cv.width = innerWidth; FX.cv.height = innerHeight; };
  fit(); addEventListener('resize', fit);
}
function confetti(n, x, y, opts) {
  if (!FX.ctx) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) n = Math.min(n, 20);
  const cols = ['#ffd23f', '#ff6b6b', '#4cc9f0', '#3ddc97', '#a78bfa', '#fb923c', '#f472b6'];
  x = x == null ? innerWidth / 2 : x; y = y == null ? innerHeight * 0.4 : y;
  const spread = (opts && opts.spread) || 1;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = (3 + Math.random() * 9) * spread;
    FX.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6, g: 0.25 + Math.random() * 0.15, w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: pick(cols), life: 90 + rnd(70) });
  }
  if (!FX.raf) FX.raf = requestAnimationFrame(fxStep);
}
function fxStep() {
  const { ctx, cv, parts } = FX;
  ctx.clearRect(0, 0, cv.width, cv.height);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= .99; p.r += p.vr; p.life--;
    if (p.life <= 0 || p.y > cv.height + 30) { parts.splice(i, 1); continue; }
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.min(1, p.life / 30);
    ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
  }
  FX.raf = parts.length ? requestAnimationFrame(fxStep) : 0;
  if (!parts.length) ctx.clearRect(0, 0, cv.width, cv.height);
}
function confettiFrom(el, n) {
  if (!el) return confetti(n || 60);
  const r = el.getBoundingClientRect(); confetti(n || 60, r.left + r.width / 2, r.top + r.height / 2);
}

/* ---------- toasts & modal ---------- */
function toast(node, kind) {
  const box = $('#toasts');
  const t = h('div', { class: 'toast ' + (kind || '') }, node);
  box.append(t);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => t.classList.add('out'), 3400);
  setTimeout(() => t.remove(), 3900);
}
let modalEl = null, modalOnClose = null;
/** `silent` drops the dialog without running its onClose (used when the whole screen is being replaced) */
function closeModal(silent) {
  if (modalEl) { modalEl.remove(); modalEl = null; }
  const f = modalOnClose; modalOnClose = null; if (f && silent !== true) f();
}
/** shows a dialog. `onClose` runs when it is dismissed (by any means). */
function openModal(content, onClose, wide) {
  closeModal();
  modalOnClose = onClose || null;
  modalEl = h('div', { class: 'modal-back', onclick: e => { if (e.target === modalEl && !modalEl.dataset.lock) closeModal(); } },
    h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' }, content));
  document.body.append(modalEl);
  const first = $('button, input', modalEl); if (first) first.focus({ preventScroll: true });
  return modalEl;
}
