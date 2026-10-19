// Dead-simple playback: every column is one tick; the speed (columns per second) is read before each
// tick so the slider works while playing. Technique-only and bar-line columns take no time. Each fret is a plucked triangle wave on the standard-tuned open-string pitch. Section
// notes (x2 …) are ignored.
import { isBar, isFret, isTech } from './model.js';

const OPEN_MIDI = [64, 59, 55, 50, 45, 40];   // e B G D A E
const freq = m => 440 * Math.pow(2, (m - 69) / 12);
const silentCol = col => isBar(col) || (col.some(n => n) && col.every(n => !n || isTech(n)));

// The columns that take a tick, in order: [{ line, col, freqs }].
export function events(tab) {
  const out = [];
  tab.lines.forEach((line, li) => line.cols.forEach((col, ci) => {
    if (silentCol(col)) return;
    out.push({ line: li, col: ci, freqs: col.map((n, si) => isFret(n) ? freq(OPEN_MIDI[si] + +n) : null).filter(Boolean) });
  }));
  return out;
}

function pluck(ctx, out, f, at) {
  const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = f;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.25, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.8);
  osc.connect(g); g.connect(out); osc.start(at); osc.stop(at + 0.85);
}

// Starts playing; `colsPerSec()` is asked before every tick. Calls onPos({line, col}) as the playhead
// moves and onEnd() when done. Returns stop().
export function play(tab, colsPerSec, onPos, onEnd) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
  const evs = events(tab);
  let i = 0, timer = null;
  const stop = () => { clearTimeout(timer); ctx.close().catch(() => {}); };
  const tick = () => {
    if (i >= evs.length) { timer = setTimeout(() => { stop(); onEnd(); }, 900); return; }
    const ev = evs[i++], at = ctx.currentTime + 0.02;
    ev.freqs.forEach(f => pluck(ctx, master, f, at));
    onPos({ line: ev.line, col: ev.col });
    timer = setTimeout(tick, 1000 / colsPerSec());
  };
  timer = setTimeout(tick, 60);
  return stop;
}
