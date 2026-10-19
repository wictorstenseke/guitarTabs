// Share links: the whole tab, compacted and lz-compressed into the URL hash (#t=…). No server involved.
// Compact form: every column is its six cells joined by ',' — cells never contain ',' or ';'.
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { STRINGS, ensureLineIds, uid } from './model.js';

const KEY = 't';

export function encodeTab(tab) {
  const data = { v: 1, id: tab.id, t: tab.title, a: tab.artist, l: tab.lines.map(l => ({ n: l.note || '', c: l.cols.map(c => c.join(',')).join(';') })) };
  return compressToEncodedURIComponent(JSON.stringify(data));
}

// Returns a tab or null if the string isn't a share payload. Never throws.
export function decodeTab(str) {
  try {
    const d = JSON.parse(decompressFromEncodedURIComponent(str));
    if (!d || d.v !== 1 || !Array.isArray(d.l)) return null;
    const lines = d.l.map(l => ({
      note: typeof l.n === 'string' ? l.n : '',
      cols: String(l.c).split(';').map(c => { const cells = c.split(','); return STRINGS.map((_, i) => cells[i] || ''); }),
    }));
    if (!lines.length) return null;
    return ensureLineIds({ id: typeof d.id === 'string' ? d.id : uid(), title: d.t || '', artist: d.a || '', lines, updatedAt: Date.now() });
  } catch { return null; }
}

export const shareUrl = tab => `${location.origin}${location.pathname}#${KEY}=${encodeTab(tab)}`;

// The tab in the current URL hash, or null.
export function tabFromHash(hash = location.hash) {
  const m = /^#t=(.+)$/.exec(hash);
  return m ? decodeTab(m[1]) : null;
}
export function clearHash() { if (location.hash) history.replaceState(null, '', location.pathname + location.search); }
