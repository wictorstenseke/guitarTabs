import { describe, it, expect } from 'vitest';
import { colHints, fretHints } from './hints.js';

// strings: 0 e, 1 B, 2 G, 3 D, 4 A, 5 E
const col = (...cells) => Array.from({ length: 6 }, (_, i) => cells[i] || '');

describe('fretHints', () => {
  it('B string fret 7: same pitch on the two neighbouring strings, nothing elsewhere', () => {
    expect(fretHints(1, 7)).toEqual([2, null, 11, null, null, null]);
  });
  it('high e: only the B string below', () => {
    expect(fretHints(0, 0)).toEqual([null, 5, null, null, null, null]);
  });
  it('drops a neighbour whose fret would be above 24 or below 0', () => {
    expect(fretHints(1, 22)).toEqual([17, null, null, null, null, null]);   // G would be 26
    expect(fretHints(0, 2)).toEqual([null, 7, null, null, null, null]);
    expect(fretHints(2, 1)).toEqual([null, null, null, 6, null, null]);     // B would be -3
  });
});

describe('colHints', () => {
  it('null unless the cell holds a fret', () => {
    expect(colHints(col('', 'x'), 1)).toBeNull();
    expect(colHints(col('', 'h'), 1)).toBeNull();
    expect(colHints(col(), 1)).toBeNull();
  });
  it('blanks a neighbour that already holds a note in that column', () => {
    expect(colHints(col('3', '7'), 1)).toEqual([null, null, 11, null, null, null]);
  });
});
