import { EXAMPLE_ID, exampleTab } from './seed.js';
import { ensureLineIds } from './model.js';

const LS_TABS = 'guitartabs:tabs', LS_CUR = 'guitartabs:current', LS_SIDE = 'guitartabs:sidebar', LS_ORIENT = 'guitartabs:orient', LS_HINTS = 'guitartabs:hints';

// localStorage can throw (data: URLs, private mode, blocked storage) — fall back to in-memory
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export function loadTabs() {
  let tabs = [];
  try { tabs = JSON.parse(lsGet(LS_TABS)) || []; } catch { tabs = []; }
  // migrate old numeric repeat -> free-text note
  tabs.forEach(t => { t.lines.forEach(l => { if (l.note === undefined) { l.note = l.repeat > 1 ? 'x' + l.repeat : ''; delete l.repeat; } }); ensureLineIds(t); });
  // the example is always present and always pristine
  tabs = [exampleTab(), ...tabs.filter(t => t.id !== EXAMPLE_ID)];
  const cur = lsGet(LS_CUR);
  const current = tabs.find(t => t.id === cur) || tabs[0];
  return { tabs, currentId: current.id };
}

export function saveTabs(tabs, currentId) {
  lsSet(LS_TABS, JSON.stringify(tabs.filter(t => !t.example)));
  lsSet(LS_CUR, currentId);
}

// view-mode page orientation preference
export const loadOrient = () => (lsGet(LS_ORIENT) === 'landscape' ? 'landscape' : 'portrait');
export const saveOrient = o => lsSet(LS_ORIENT, o);

// fret hints while editing (on unless switched off)
export const loadHints = () => lsGet(LS_HINTS) !== 'off';
export const saveHints = on => lsSet(LS_HINTS, on ? 'on' : 'off');

// sidebar open/collapsed preference
export const loadSideOpen = () => lsGet(LS_SIDE) !== 'closed';
export const saveSideOpen = open => lsSet(LS_SIDE, open ? 'open' : 'closed');

// ---------- backup: export / import as JSON ----------
// `name` (optional) names the file; otherwise it's a dated full backup.
export function exportJson(tabs, name) {
  const data = JSON.stringify({ app: 'guitartabs', version: 1, exportedAt: new Date().toISOString(), tabs: tabs.map(t => ({ ...t, example: false })) }, null, 1);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const slug = (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  a.download = (slug || `guitar-tabs-${new Date().toISOString().slice(0, 10)}`) + '.json';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Tabs in an export file (or a bare array of tabs). Throws a readable message on anything else.
export function parseImport(text) {
  let data; try { data = JSON.parse(text); } catch { throw new Error('Not a JSON file.'); }
  const tabs = Array.isArray(data) ? data : data?.tabs;
  if (!Array.isArray(tabs)) throw new Error('No tabs found in this file.');
  const ok = tabs.filter(t => t && typeof t.id === 'string' && t.id !== EXAMPLE_ID && Array.isArray(t.lines) && t.lines.every(l => Array.isArray(l?.cols)));
  if (!ok.length) throw new Error('No valid tabs found in this file.');
  return ok.map(t => ({
    ...t, title: t.title || '', artist: t.artist || '', example: false, updatedAt: t.updatedAt || Date.now(),
    lines: t.lines.map(l => ({ id: l.id, cols: l.cols, note: l.note ?? '' })),
  })).map(ensureLineIds);
}

// Merge: an imported tab replaces the existing one with the same id, the rest are appended.
export function mergeTabs(existing, imported) {
  const ids = new Set(imported.map(t => t.id));
  return [...existing.filter(t => t.example || !ids.has(t.id)), ...imported];
}
