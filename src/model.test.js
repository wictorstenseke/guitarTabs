import { describe, it, expect } from 'vitest';
import { BAR, STRINGS, cloneLine, emptyLine, ensureLineIds, fixSpacing, isBar, moveLine, setCell, toText, trimLines, validNote, START_COLS, TAIL } from './model.js';
import { chunkCols } from './print.js';

const col = (...cells) => STRINGS.map((_, i) => cells[i] || '');
const line = (...cols) => ({ id: 'l', cols, note: '' });
const e = () => col();

describe('validNote', () => {
  it('accepts frets 0–24, x, techniques and bar', () => {
    for (const v of ['0', '7', '24', 'x', 'h', 'p', '/', '\\', 'b', '~', '|']) expect(validNote(v)).toBe(true);
  });
  it('rejects 25, letters, empty, multi-char techniques', () => {
    for (const v of ['25', 'a', '', 'hp', '5h', '-']) expect(validNote(v)).toBe(false);
  });
});

describe('setCell / bar lines', () => {
  it('a bar fills the whole column', () => {
    const l = line(e(), e()); setCell(l, 1, 3, BAR);
    expect(l.cols[1]).toEqual(Array(6).fill(BAR)); expect(isBar(l.cols[1])).toBe(true);
  });
  it('writing a fret into a bar column clears the bar first', () => {
    const l = line(e()); setCell(l, 0, 0, BAR); setCell(l, 0, 2, '7');
    expect(l.cols[0]).toEqual(col('', '', '7'));
  });
  it('clearing one bar cell clears the column', () => {
    const l = line(e()); setCell(l, 0, 0, BAR); setCell(l, 0, 5, '');
    expect(l.cols[0]).toEqual(e());
  });
});

describe('fixSpacing', () => {
  it('inserts a gap between touching notes', () => {
    const l = line(col('5'), col('7'), e());
    expect(fixSpacing([l])).toBe(1);
    expect(l.cols.map(c => c[0])).toEqual(['5', '', '7', '']);
  });
  it('never pads around technique or bar columns', () => {
    const l = line(col('12'), col('p'), col('14'), col(BAR, BAR, BAR, BAR, BAR, BAR), col('3'));
    expect(fixSpacing([l])).toBe(0);
  });
  it('is idempotent', () => {
    const l = line(col('5'), col('7'), col('', '8'));
    fixSpacing([l]); expect(fixSpacing([l])).toBe(0);
  });
});

describe('trimLines', () => {
  it('keeps TAIL empties after the last note, at least START_COLS', () => {
    const l = line(...Array.from({ length: 30 }, (_, i) => i === 10 ? col('5') : e()));
    trimLines([l]); expect(l.cols.length).toBe(10 + 1 + TAIL);
    const empty = line(e()); trimLines([empty]); expect(empty.cols.length).toBe(START_COLS);
  });
});

describe('moveLine', () => {
  const mk = () => ['a', 'b', 'c', 'd'];
  it('moves down', () => { const l = mk(); expect(moveLine(l, 0, 3)).toBe(2); expect(l).toEqual(['b', 'c', 'a', 'd']); });
  it('moves up', () => { const l = mk(); expect(moveLine(l, 3, 1)).toBe(1); expect(l).toEqual(['a', 'd', 'b', 'c']); });
  it('no-ops when dropped onto itself', () => { const l = mk(); expect(moveLine(l, 1, 1)).toBe(-1); expect(moveLine(l, 1, 2)).toBe(-1); expect(l).toEqual(mk()); });
});

describe('line ids', () => {
  it('emptyLine and cloneLine get fresh ids; ensureLineIds fills missing', () => {
    const a = emptyLine(), b = cloneLine(a);
    expect(a.id).toBeTruthy(); expect(b.id).not.toBe(a.id); expect(b.cols).toEqual(a.cols);
    const t = ensureLineIds({ lines: [{ cols: [] }, { id: 'keep', cols: [] }] });
    expect(t.lines[0].id).toBeTruthy(); expect(t.lines[1].id).toBe('keep');
  });
});

describe('toText', () => {
  it('pads multi-digit columns and prints bars and notes', () => {
    const t = { title: 'T', artist: 'A', lines: [{ cols: [col('12'), col('', '7'), col(BAR, BAR, BAR, BAR, BAR, BAR)], note: 'x2' }] };
    const txt = toText(t).split('\n');
    expect(txt[0]).toBe('T — A');
    expect(txt[2]).toBe('e|12-||');
    expect(txt[3]).toBe('B|--7||');
    expect(txt[5]).toBe('D|---|| x2');
  });
});

describe('chunkCols', () => {
  it('splits by summed width and reserves note space on the first row', () => {
    expect(chunkCols([1, 1, 1, 1, 1], 2)).toEqual([[0, 2], [2, 4], [4, 5]]);
    expect(chunkCols([1, 1, 1, 1], 3, 1)).toEqual([[0, 2], [2, 4]]);
    expect(chunkCols([5, 5], 3)).toEqual([[0, 1], [1, 2]]);   // a cell wider than the budget still gets its own row
  });
});
