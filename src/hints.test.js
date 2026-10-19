import { describe, it, expect } from 'vitest';
import { fretHints } from './hints.js';

// strings: 0 e, 1 B, 2 G, 3 D, 4 A, 5 E
describe('fretHints', () => {
  it('B string fret 7: same pitch on every other string, other octaves after, source string empty', () => {
    expect(fretHints(1, 7)).toEqual([
      [{ fret: 2, oct: 0 }, { fret: 14, oct: 1 }],     // e
      [],                                              // B (the note itself)
      [{ fret: 11, oct: 0 }, { fret: 23, oct: 1 }],    // G
      [{ fret: 16, oct: 0 }, { fret: 4, oct: -1 }],    // D
      [{ fret: 21, oct: 0 }, { fret: 9, oct: -1 }],    // A
      [{ fret: 14, oct: -1 }, { fret: 2, oct: -2 }],   // E: same pitch would be fret 26
    ]);
  });
  it('open low E: only octaves up exist', () => {
    expect(fretHints(5, 0)[4]).toEqual([{ fret: 7, oct: 1 }, { fret: 19, oct: 2 }]);   // A string
    expect(fretHints(5, 0)[0]).toEqual([{ fret: 0, oct: 2 }]);                         // high e: open, 24 above
  });
  it('never offers frets above 24', () => {
    fretHints(0, 24).flat().forEach(h => expect(h.fret).toBeLessThanOrEqual(24));
  });
});

import { colHints, hintWidth } from './hints.js';
const col = (...cells) => Array.from({ length: 6 }, (_, i) => cells[i] || '');

describe('colHints', () => {
  it('null unless the cell holds a fret', () => {
    expect(colHints(col('', 'x'), 1)).toBeNull();
    expect(colHints(col('', 'h'), 1)).toBeNull();
    expect(colHints(col(), 1)).toBeNull();
  });
  it('blanks strings that already hold a note in that column', () => {
    const hs = colHints(col('3', '7', '', '', 'x', ''), 1);
    expect(hs[0]).toEqual([]); expect(hs[4]).toEqual([]);
    expect(hs[2]).toEqual([{ fret: 11, oct: 0 }, { fret: 23, oct: 1 }]);
  });
});

describe('hintWidth', () => {
  it('is the widest string: frets joined by a space', () => {
    expect(hintWidth(colHints(col('', '7'), 1))).toBe(5);   // "16 4" is 4, "14 2" is 4, "11 23" is 5
    expect(hintWidth(colHints(col('', '7', '', '', '', '3'), 1))).toBe(5);
  });
});
