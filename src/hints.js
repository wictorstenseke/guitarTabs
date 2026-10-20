// Fret hints: where the note in a cell can also be played on the neighbouring strings. Standard tuning only.
import { isFret } from './model.js';

export const OPEN_MIDI = [64, 59, 55, 50, 45, 40];   // e B G D A E
export const MAX_FRET = 24;

// For the note on string `si` at `fret`, one entry per string: the fret that plays the same pitch on
// the string directly above and below, null everywhere else (and where it would fall off the neck).
export function fretHints(si, fret) {
  const midi = OPEN_MIDI[si] + +fret;
  return OPEN_MIDI.map((open, s) => {
    if (Math.abs(s - si) !== 1) return null;
    const f = midi - open;
    return f >= 0 && f <= MAX_FRET ? f : null;
  });
}

// Hints for the cell on string `si` of column `col`, or null if that cell isn't a fret. A neighbour that
// already holds something in this column gets none (there's nothing to type there).
export function colHints(col, si) {
  if (!isFret(col[si])) return null;
  return fretHints(si, col[si]).map((f, s) => (col[s] ? null : f));
}
