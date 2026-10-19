// Dead-simple playback: every column is one tick at `colsPerSec`; technique-only and bar-line columns
// take no time. Each fret is a plucked triangle wave on the standard-tuned open-string pitch. Section
// notes (x2 …) are ignored.
import { isBar, isFret, isTech } from './model.js';

const OPEN_MIDI = [64, 59, 55, 50, 45, 40];   // e B G D A E
const freq = m => 440 * Math.pow(2, (m - 69) / 12);
const silentCol = col => isBar(col) || (col.some(n => n) && col.every(n => !n || isTech(n)));

// [{ t, line, col, freqs }], duration — t in seconds from start.
export function events(tab, colsPerSec) {
  const out = []; let t = 0; const dt = 1 / colsPerSec;
  tab.lines.forEach((line, li) => line.cols.forEach((col, ci) => {
    if (silentCol(col)) return;
    out.push({ t, line: li, col: ci, freqs: col.map((n, si) => isFret(n) ? freq(OPEN_MIDI[si] + +n) : null).filter(Boolean) });
    t += dt;
  }));
  return { events: out, duration: t };
}

function pluck(ctx, out, f, at) {
  const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = f;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.25, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.8);
  osc.connect(g); g.connect(out); osc.start(at); osc.stop(at + 0.85);
}

// Starts playing; calls onPos({line, col}) as the playhead moves and onEnd() when done. Returns stop().
export function play(tab, colsPerSec, onPos, onEnd) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
  const { events: evs, duration } = events(tab, colsPerSec);
  const lead = 0.08, t0 = ctx.currentTime + lead;
  evs.forEach(ev => ev.freqs.forEach(f => pluck(ctx, master, f, t0 + ev.t)));
  const timers = evs.map(ev => setTimeout(() => onPos({ line: ev.line, col: ev.col }), (ev.t + lead) * 1000));
  const stop = () => { timers.forEach(clearTimeout); ctx.close().catch(() => {}); };
  timers.push(setTimeout(() => { stop(); onEnd(); }, (duration + lead + 0.9) * 1000));
  return stop;
}
