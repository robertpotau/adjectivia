/* ============================================================
   Adjectivia — original procedural music (WebAudio, no audio files)
   Two tracks, both composed for this game:
     'tense'  — "Dungeon of Doom": drone, heartbeat, creeping chromatic ostinato, dissonant strings, clock ticks, risers.
     'pirate' — "Jolly Roger Rush": 6/8 sea-shanty march in D minor with bass, accordion-style stabs, drums and a fiddle tune.
   Intensity (0..1) adds layers and speeds the tempo up: the Golden Ladder raises it with every step.
   ============================================================ */
const Music = (() => {
  const mf = n => 440 * Math.pow(2, (n - 69) / 12);
  const LOOK = 0.25;
  let C = null, master = null, sess = null, iv = 0, duckTimer = 0;
  const baseVol = () => (ST.settings.musicVol == null ? 0.6 : ST.settings.musicVol) * 0.5;

  /* ---------- low-level synth helpers (all take the AudioContext explicitly so they also run offline) ---------- */
  function noiseBuffer(ac) {
    const len = ac.sampleRate, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    let s = 12345; for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
    return b;
  }
  /** a pitched note: o = { t, f, dur, v, a, r, types[], det[], lp, bp, q, vib:{rate,depth}, glide:{to,time} } */
  function voice(S, dest, o) {
    const ac = S.ac, t = o.t, a = o.a == null ? 0.005 : o.a, r = o.r == null ? 0.08 : o.r, v = o.v == null ? 0.2 : o.v;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.setValueAtTime(v, Math.max(t + a, t + o.dur)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur + r);
    let out = g;
    if (o.lp || o.bp) {
      const f = ac.createBiquadFilter(); f.type = o.lp ? 'lowpass' : 'bandpass'; f.frequency.value = o.lp || o.bp; f.Q.value = o.q || 0.7;
      f.connect(g); out = f;
    }
    const types = o.types || ['sine'], dets = o.det || [0], end = t + o.dur + r + 0.05, oscs = [];
    types.forEach((type, k) => {
      const os = ac.createOscillator(); os.type = type; os.frequency.setValueAtTime(o.f, t); os.detune.value = dets[k % dets.length];
      if (o.glide) os.frequency.exponentialRampToValueAtTime(o.glide.to, t + o.glide.time);
      os.connect(out); os.start(t); os.stop(end); oscs.push(os);
    });
    if (o.vib) {
      const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.vib.rate; lg.gain.value = o.vib.depth;
      l.connect(lg); oscs.forEach(os => lg.connect(os.detune)); l.start(t); l.stop(end);
    }
    g.connect(dest);
    return end;
  }
  /** filtered noise burst: o = { t, dur, type, f, f2, q, v } (f2 = sweep target) */
  function noise(S, dest, o) {
    const ac = S.ac, src = ac.createBufferSource(); src.buffer = S.noise;
    const f = ac.createBiquadFilter(); f.type = o.type || 'highpass'; f.frequency.setValueAtTime(o.f, o.t); f.Q.value = o.q || 0.7;
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, o.t + o.dur);
    const g = ac.createGain(), pk = o.peak == null ? 0.02 : o.peak;
    g.gain.setValueAtTime(0.0001, o.t); g.gain.linearRampToValueAtTime(o.v, o.t + pk); g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
    src.loop = true; src.connect(f); f.connect(g); g.connect(dest); src.start(o.t, Math.random() * 0.5); src.stop(o.t + o.dur + 0.05);
  }
  function kick(S, dest, t, v) {
    const ac = S.ac, o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(58, t + 0.12);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.32);
  }
  function tom(S, dest, t, f, v) {
    const ac = S.ac, o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.35);
  }
  function snare(S, dest, t, v) {
    noise(S, dest, { t, dur: 0.16, type: 'bandpass', f: 1900, q: 0.8, v: v * 0.9 });
    const ac = S.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.1);
    g.gain.setValueAtTime(v * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.2);
  }
  function thump(S, dest, t, v) {                       // heartbeat
    const ac = S.ac, o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(58, t + 0.16);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.34);
  }

  /* ---------- a session = one running track with its own mixing buses ---------- */
  function makeSession(ac, dest, track, I) {
    const S = { ac, track, I, layers: {}, nodes: [], idx: 0, nextT: 0, noise: noiseBuffer(ac) };
    S.bus = ac.createGain(); S.bus.gain.value = 1; S.bus.connect(dest);
    // a soft echo shared by the layers that ask for it
    S.echoIn = ac.createGain(); S.echoIn.gain.value = 1;
    const dl = ac.createDelay(1); dl.delayTime.value = track.echo || 0.3;
    const fb = ac.createGain(); fb.gain.value = 0.38; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    const eo = ac.createGain(); eo.gain.value = 0.5;
    S.echoIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(eo); eo.connect(S.bus);
    S.nodes.push(dl);
    (track.layers || []).forEach(([name, vol, send, start]) => {       // start = opening level (0 = layer comes in later)
      const g = ac.createGain(); g.gain.value = start == null ? vol : start * vol; g.connect(S.bus);
      if (send) { const s = ac.createGain(); s.gain.value = send; g.connect(s); s.connect(S.echoIn); }
      S.layers[name] = g; S.layers[name].base = vol;
    });
    S.gain = (name, v, t) => { const g = S.layers[name]; if (g) g.gain.setTargetAtTime(v * g.base, t, 0.25); };
    S.getI = t => typeof S.I === 'function' ? S.I(t) : S.I;
    if (track.init) track.init(S);
    return S;
  }
  function pump(S, until) {
    const T = S.track;
    while (S.nextT < until) {
      const I = clamp(S.getI(S.nextT), 0, 1);
      T.step(S, S.nextT, Math.floor(S.idx / T.steps), S.idx % T.steps, I);
      S.nextT += T.stepDur(I); S.idx++;
    }
  }

  /* ================== TRACK 1 — Dungeon of Doom (tense, scary) ================== */
  const OST = [[[0, 48], [3, 49], [6, 48], [8, 54], [11, 49], [14, 47]], [[0, 48], [3, 49], [6, 51], [8, 48], [10, 54], [13, 53]]];
  const TENSE = {
    name: 'Dungeon of Doom', steps: 16, echo: 0.36,
    layers: [['drone', 0.5], ['heart', 0.9], ['ost', 0.5, 0.25, 0], ['str', 0.4, 0.35, 0], ['tick', 0.5, 0, 0], ['fx', 0.6, 0.3]],
    stepDur: I => 60 / (84 + 28 * I) / 4,
    init(S) {
      const ac = S.ac, lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 5;
      const out = ac.createGain(); out.gain.value = 0.2; lp.connect(out); out.connect(S.layers.drone);
      [[65.41, 'sawtooth', 0], [65.41, 'sawtooth', 9], [98, 'sawtooth', -6], [32.7, 'sine', 0], [92.5, 'sawtooth', 0]].forEach(([f, type, det]) => {
        const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
        const g = ac.createGain(); g.gain.value = f === 92.5 ? 0.08 : f === 32.7 ? 0.5 : 0.3; o.connect(g); g.connect(lp); o.start(0); S.nodes.push(o);
      });
      const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 0.09; lg.gain.value = 220; l.connect(lg); lg.connect(lp.frequency); l.start(0); S.nodes.push(l);
      // a cave wind: filtered noise whose pitch drifts slowly, plus a thin dissonant pair far above the drone
      const ws = ac.createBufferSource(); ws.buffer = S.noise; ws.loop = true;
      const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 800; wf.Q.value = 5;
      const wg = ac.createGain(); wg.gain.value = 0.32; ws.connect(wf); wf.connect(wg); wg.connect(S.layers.drone); ws.start(0); S.nodes.push(ws);
      const wl = ac.createOscillator(), wlg = ac.createGain(); wl.frequency.value = 0.07; wlg.gain.value = 450; wl.connect(wlg); wlg.connect(wf.frequency); wl.start(0); S.nodes.push(wl);
      [[523.25, 0], [554.37, 7]].forEach(([f, det]) => {
        const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
        const g = ac.createGain(); g.gain.value = 0.045; o.connect(g); g.connect(S.layers.drone); o.start(0); S.nodes.push(o);
      });
    },
    step(S, t, bar, st, I) {
      const L = S.layers, sd = this.stepDur(I), barLen = sd * this.steps;
      if (st === 0) {                                       // once per bar: open and close the layers
        S.gain('ost', I < 0.12 ? 0 : 0.45 + 0.55 * I, t); S.gain('str', I < 0.25 ? 0 : 0.35 + 0.65 * I, t);
        S.gain('tick', I < 0.45 ? 0 : 0.4 + 0.6 * I, t); S.gain('heart', 0.7 + 0.3 * I, t);
      }
      if (I > 0.5 ? st % 4 === 0 : st % 8 === 0) {          // heartbeat: lub-dub, once per beat when it gets serious
        thump(S, L.heart, t, 0.6); thump(S, L.heart, t + 0.17, 0.38);
      }
      if (I >= 0.12) {                                      // creeping chromatic ostinato
        OST[bar % 2].forEach(([s, n]) => { if (s === st) voice(S, L.ost, { t, f: mf(n), dur: 0.12, v: 0.34, a: 0.004, r: 0.1, types: ['triangle', 'sawtooth'], det: [0, 4], lp: 1200, q: 2 }); });
      }
      if (st === 0 && bar % 2 === 0 && I >= 0.25) {         // dissonant tremolo strings: C + Db (+ F# and G# higher up)
        const chord = I > 0.6 ? [72, 73, 66, 78] : [72, 73];
        chord.forEach((n, k) => voice(S, L.str, { t, f: mf(n), dur: 2 * barLen - 0.3, v: 0.1, a: 1.0, r: 0.9, types: ['sawtooth', 'sawtooth'], det: [-9, 9], lp: 2600, vib: { rate: 5.2 + k * 0.3, depth: 14 } }));
      }
      if (I >= 0.45 && st % 4 === 2) noise(S, L.tick, { t, dur: 0.035, f: st % 8 === 2 ? 6500 : 4200, v: 0.45 });   // ticking clock
      if (bar % 4 === 3 && st === 0 && I >= 0.35) noise(S, L.fx, { t, dur: barLen, type: 'bandpass', f: 250, f2: 5200, q: 1.5, v: 0.28, peak: barLen * 0.9 });   // riser
      if (bar % 4 === 0 && st === 0 && bar > 0 && I >= 0.35) {                                             // timpani after the riser
        tom(S, L.fx, t, 52, 0.9); noise(S, L.fx, { t, dur: 0.5, type: 'lowpass', f: 400, v: 0.4 });
      }
      if (I >= 0.7 && bar % 6 === 5 && st === 6) voice(S, L.fx, { t, f: 1900, dur: 0.5, v: 0.05, a: 0.02, r: 0.2, types: ['sawtooth'], bp: 1400, q: 3, glide: { to: 820, time: 0.55 } });   // shriek
    }
  };

  /* ================== TRACK 2 — Jolly Roger Rush (pirate, epic, fun) ================== */
  // D minor sea shanty in 6/8: 12 sixteenth steps per bar (an eighth note = 2 steps); 8-bar loop
  const P_CH = [
    { b: [38, 45], c: [50, 53, 57] }, { b: [38, 45], c: [50, 53, 57] }, { b: [46, 41], c: [53, 58, 62] }, { b: [48, 43], c: [52, 55, 60] },
    { b: [38, 45], c: [50, 53, 57] }, { b: [43, 50], c: [55, 58, 62] }, { b: [45, 52], c: [52, 57, 61] }, { b: [38, 45], c: [50, 53, 57] }];
  // [eighth position in the bar, midi note, length in eighths]
  const P_MEL = [
    [[0, 69, 1], [1, 69, 1], [2, 74, 1], [3, 72, 2], [5, 69, 1]],
    [[0, 67, 1], [1, 67, 1], [2, 72, 1], [3, 70, 2], [5, 67, 1]],
    [[0, 65, 1], [1, 65, 1], [2, 70, 1], [3, 69, 2], [5, 65, 1]],
    [[0, 64, 2], [2, 67, 2], [4, 72, 2]],
    [[0, 74, 2], [2, 74, 1], [3, 76, 1], [4, 77, 2]],
    [[0, 77, 1], [1, 76, 1], [2, 74, 1], [3, 70, 2], [5, 74, 1]],
    [[0, 76, 1], [1, 76, 1], [2, 69, 1], [3, 73, 2], [5, 76, 1]],
    [[0, 74, 4], [4, 69, 1], [5, 69, 1]]];
  const THIRD = { 0: 4, 1: 3, 2: 3, 4: 3, 5: 4, 7: 3, 9: 3, 10: 4 };   // harmony note a third above, by pitch class
  const PIRATE = {
    name: 'Jolly Roger Rush', steps: 12, echo: 0.27,
    layers: [['bass', 0.7], ['chords', 0.55, 0.1], ['drums', 0.9], ['perc', 0.6], ['lead', 0.8, 0.28], ['harm', 0.7, 0.28, 0]],
    stepDur: I => 60 / ((116 + 18 * I) * 3) / 2,
    step(S, t, bar, st, I) {
      const L = S.layers, sd = this.stepDur(I), eighth = sd * 2, b8 = bar % 8, ch = P_CH[b8];
      if (st === 0) {
        S.gain('harm', I < 0.6 ? 0 : 0.8, t); S.gain('perc', I < 0.3 ? 0.35 : 1, t); S.gain('chords', 0.7 + 0.3 * I, t);
        if (b8 === 0 && I >= 0.2) noise(S, L.drums, { t, dur: 1.3, f: 4200, v: 0.16 });   // cymbal crash every 8 bars
        if (bar > 0 && b8 === 0) tom(S, L.drums, t, 60, 0.6);
      }
      // drums: BOOM . . CLAP . .
      if (st === 0) kick(S, L.drums, t, 0.62);
      if (st === 6) { snare(S, L.drums, t, I >= 0.15 ? 0.5 : 0.3); if (I >= 0.5) kick(S, L.drums, t, 0.4); }
      if (st % 2 === 0) noise(S, L.perc, { t, dur: 0.05, f: 7000, v: st === 0 || st === 6 ? 0.12 : 0.07 });                  // shaker
      else if (I >= 0.55) noise(S, L.perc, { t, dur: 0.035, f: 8000, v: 0.04 });
      if (I >= 0.3 && (st === 2 || st === 4 || st === 8 || st === 10)) noise(S, L.perc, { t, dur: 0.07, type: 'bandpass', f: 6200, q: 2, v: 0.09 });   // tambourine
      if (b8 === 7 && st >= 6 && I >= 0.35) {                                                                                  // tom fill into the next loop
        const fill = { 6: 200, 8: 170, 9: 150, 10: 125, 11: 100 }[st]; if (fill) tom(S, L.drums, t, fill, 0.55);
      }
      // bass: root on the first beat, fifth on the second
      if (st === 0 || st === 6) voice(S, L.bass, { t, f: mf(ch.b[st === 0 ? 0 : 1]), dur: eighth * 2.2, v: 0.2, a: 0.01, r: 0.1, types: ['triangle', 'sawtooth'], det: [0, 3], lp: 640 });
      // accordion-style stabs: oom - pah pah, oom - pah pah
      if (st === 2 || st === 4 || st === 8 || st === 10) ch.c.forEach(n => voice(S, L.chords, { t, f: mf(n), dur: eighth * 0.8, v: 0.085, a: 0.008, r: 0.06, types: ['sawtooth', 'square'], det: [-7, 7], lp: 2100 }));
      // fiddle tune
      if (st % 2 === 0) {
        P_MEL[b8].forEach(([pos, n, len]) => {
          if (pos * 2 !== st) return;
          const o = { t, f: mf(n), dur: len * eighth * 0.93, v: 0.17, a: 0.012, r: 0.12, types: ['sawtooth', 'square', 'sawtooth'], det: [-6, 0, 7], lp: 3600, q: 0.9, vib: len >= 2 ? { rate: 5.5, depth: 18 } : undefined };
          voice(S, L.lead, o);
          const th = THIRD[n % 12]; if (th) voice(S, L.harm, Object.assign({}, o, { f: mf(n + th), v: 0.1, types: ['sawtooth', 'square'], det: [-4, 4] }));
        });
      }
    }
  };
  const TRACKS = { tense: TENSE, pirate: PIRATE };

  /* ---------- real-time control ---------- */
  function ready() {
    if (!ST.settings.music) return false;
    const ac = audio(); if (!ac) return false;
    if (C !== ac) { C = ac; master = null; sess = null; }
    if (!master) {
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6; comp.attack.value = 0.005; comp.release.value = 0.2;
      master = ac.createGain(); master.gain.value = baseVol(); master.connect(comp); comp.connect(ac.destination);
    }
    return true;
  }
  function tick() {
    if (!sess || !C) return;
    if (sess.nextT < C.currentTime - 0.4) sess.nextT = C.currentTime + 0.05;       // after a long pause do not catch up
    pump(sess, C.currentTime + LOOK);
  }
  function dispose(S) {
    try { S.nodes.forEach(n => { try { n.stop && n.stop(); } catch (e) { /* already stopped */ } try { n.disconnect(); } catch (e) { /* ignore */ } }); S.bus.disconnect(); } catch (e) { /* ignore */ }
  }
  function fadeOut(S, secs) {
    if (!S) return;
    try { S.bus.gain.setTargetAtTime(0, S.ac.currentTime, secs / 3); } catch (e) { /* ignore */ }
    setTimeout(() => dispose(S), (secs + 0.6) * 1000);
  }
  const api = {
    tracks: { tense: TENSE.name, pirate: PIRATE.name },
    playing: () => !!sess,
    current: () => sess && sess.name,
    /** starts a track (or just changes the intensity when it already plays) */
    start(name, I) {
      if (!TRACKS[name] || !ready()) return;
      if (sess && sess.name === name) { sess.I = I; return; }
      fadeOut(sess, 0.7);
      sess = makeSession(C, master, TRACKS[name], I); sess.name = name; sess.nextT = C.currentTime + 0.12;
      sess.bus.gain.setValueAtTime(0.0001, C.currentTime); sess.bus.gain.linearRampToValueAtTime(1, C.currentTime + 1.2);
      if (!iv) iv = setInterval(tick, 40);
    },
    setIntensity(I) { if (sess) sess.I = I; },
    stop(secs) {
      if (!sess) return;
      fadeOut(sess, secs == null ? 0.6 : secs); sess = null;
      clearInterval(iv); iv = 0;
    },
    /** lowers the music for a moment (speech, fanfares) */
    duck(ms, level) {
      if (!master || !C || !sess) return;
      clearTimeout(duckTimer); master.gain.setTargetAtTime(baseVol() * (level == null ? 0.3 : level), C.currentTime, 0.05);
      duckTimer = setTimeout(() => { try { master.gain.setTargetAtTime(baseVol(), C.currentTime, 0.3); } catch (e) { /* ignore */ } }, ms);
    },
    refreshVolume() { if (master && C) master.gain.setTargetAtTime(baseVol(), C.currentTime, 0.1); },
    /** developer/self-test helper: renders `secs` seconds of a track to an AudioBuffer. `I` is a number or a function of time. */
    renderOffline(name, secs, I) {
      const rate = 22050, ac = new OfflineAudioContext(1, Math.round(secs * rate), rate);
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6; comp.connect(ac.destination);
      const m = ac.createGain(); m.gain.value = 0.3; m.connect(comp);
      const S = makeSession(ac, m, TRACKS[name], I == null ? 0.5 : I); S.nextT = 0;
      pump(S, secs);
      return ac.startRendering();
    }
  };
  document.addEventListener('visibilitychange', () => { if (!C) return; try { if (document.hidden) C.suspend(); else C.resume(); } catch (e) { /* ignore */ } });
  return api;
})();
