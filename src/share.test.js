import { describe, it, expect } from 'vitest';
import { decodeTab, encodeTab } from './share.js';
import { BAR } from './model.js';

const tab = { id: 'abc', title: 'Song', artist: 'Me', lines: [
  { id: 'l1', cols: [['5', '', '', '', '', ''], ['', '7', '', '', '', ''], Array(6).fill(BAR), ['', '', 'p', '', '', '']], note: 'x2' },
  { id: 'l2', cols: [['', '', '', '', '', '12']], note: '' },
] };

describe('share links', () => {
  it('round-trips a tab', () => {
    const d = decodeTab(encodeTab(tab));
    expect(d.id).toBe('abc'); expect(d.title).toBe('Song'); expect(d.artist).toBe('Me');
    expect(d.lines.map(l => l.cols)).toEqual(tab.lines.map(l => l.cols));
    expect(d.lines.map(l => l.note)).toEqual(['x2', '']);
    d.lines.forEach(l => expect(l.id).toBeTruthy());
  });
  it('is URL-safe and compact', () => {
    const s = encodeTab(tab);
    expect(s).toMatch(/^[A-Za-z0-9+\-$]+$/);
    expect(s.length).toBeLessThan(JSON.stringify(tab).length);
  });
  it('returns null on garbage', () => {
    for (const s of ['', 'nope', encodeTab({ id: 'x', title: '', artist: '', lines: [] })]) expect(decodeTab(s)).toBeNull();
  });
});
