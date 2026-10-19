// Fret hints: where else on the neck the note in a cell can be played. Standard tuning only.
import { isFret } from './model.js';
export const OPEN_MIDI = [64, 59, 55, 50, 45, 40];   // e B G D A E
export const MAX_FRET = 24;

// For the note on string `si` at `fret`, one array per string: [{ fret, oct }] with oct 0 meaning the
// same pitch, ±1/±2 the same note an octave (or two) away. Same pitch first, then nearest octaves.
// The source string gets an empty array.
export function fretHints(si, fret) {
  const midi = OPEN_MIDI[si] + +fret;
  return OPEN_MIDI.map((open, s) => {
    if (s === si) return [];
    const out = [];
    for (let oct = -2; oct <= 2; oct++) {
      const f = midi + oct * 12 - open;
      if (f >= 0 && f <= MAX_FRET) out.push({ fret: f, oct });
    }
    return out.sort((a, b) => Math.abs(a.oct) - Math.abs(b.oct) || a.oct - b.oct);
  });
}

// Hints for the cell on string `si` of column `col`, or null if that cell isn't a fret. Strings that
// already hold something in this column get no hints (there's nothing to type there).
export function colHints(col, si) {
  if (!isFret(col[si])) return null;
  return fretHints(si, col[si]).map((hs, s) => col[s] ? [] : hs);
}

export const hintText = hs => hs.map(h => h.fret).join(' ');
// Characters the column needs to show every string's hints.
export const hintWidth = hints => Math.max(0, ...hints.map(hs => hintText(hs).length));
