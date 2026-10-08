/* Developer tool (not part of the game): renders the music tracks to .wav files so they can be listened to
   outside the game. Needs `python tools/upload_server.py` running and the game served over http.
   In the page console:  eval(await (await fetch('tools/music-preview.js')).text()); await renderPreviews();           */
function wavBytes(buf) {
  const d = buf.getChannelData(0), n = d.length, out = new DataView(new ArrayBuffer(44 + n * 2)), rate = buf.sampleRate;
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
  return out.buffer;
}
async function renderPreviews() {
  const jobs = [
    ['pirate-calm-to-epic', 'pirate', 48, t => Math.min(1, t / 40)],
    ['tense-calm-to-scary', 'tense', 48, t => Math.min(1, t / 40)],
    ['pirate-full', 'pirate', 24, 1], ['tense-full', 'tense', 24, 1], ['pirate-calm', 'pirate', 16, 0], ['tense-calm', 'tense', 16, 0]
  ];
  const report = {};
  for (const [name, track, secs, I] of jobs) {
    const buf = await Music.renderOffline(track, secs, I);
    const d = buf.getChannelData(0); let peak = 0, sum = 0, bad = 0;
    for (let i = 0; i < d.length; i++) { const v = d[i]; if (!isFinite(v)) bad++; peak = Math.max(peak, Math.abs(v)); sum += v * v; }
    report[name] = { secs, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), bad };
    const r = await fetch('http://127.0.0.1:8770/save/' + name + '.wav', { method: 'POST', body: wavBytes(buf) });
    report[name].saved = r.ok;
  }
  window.__previews = report; return report;
}
