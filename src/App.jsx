import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { pageBudgetCh, printAs, resetMeasure, sheetWidthPx } from './print.js';
import { BAR, STRINGS, clone, cloneLine, colWidth, copyText, duplicateTab, emptyCol, emptyLine, ensureRunway, fixSpacing, hasNote, isTech, moveLine, newTab, rect, setCell, toText, trimLines, validNote } from './model.js';
import { exportJson, loadSideOpen, loadTabs, mergeTabs, parseImport, saveSideOpen, saveTabs } from './storage.js';
import { play } from './audio.js';
import { clearHash, shareUrl, tabFromHash } from './share.js';
import Section from './Section.jsx';

const initial = loadTabs();

export default function App() {
  const [tabs, setTabs] = useState(initial.tabs);
  const [currentId, setCurrentId] = useState(initial.currentId);
  const [sideOpen, setSideOpen] = useState(loadSideOpen);
  useEffect(() => { saveSideOpen(sideOpen); }, [sideOpen]);
  const [shared, setShared] = useState(() => tabFromHash());        // tab opened from a share link, shown read-only until saved
  const [editing, setEditing] = useState(false);                    // tabs open in a clean practice view; Edit switches to editing
  const [sel, setSel] = useState({ line: 0, string: 0, col: 0 });   // cursor / selection anchor
  const [selEnd, setSelEnd] = useState(null);                       // {string, col} on same line, or null
  const [dragLine, setDragLine] = useState(null);                   // section index being dragged
  const [confirm, setConfirm] = useState(null);                     // { title, text, label, danger, run }
  const [menuFor, setMenuFor] = useState(null);                     // tab id with its ⋯ menu open
  const [renaming, setRenaming] = useState(null);                   // tab id being renamed inline
  const [helpOpen, setHelpOpen] = useState(false);
  const [printBudget, setPrintBudget] = useState(() => pageBudgetCh());   // cells per staff row (page width), used on screen and in print
  const [printOpen, setPrintOpen] = useState(false);
  const printDlg = useRef(null);
  const fileRef = useRef(null);                                     // hidden file input for import
  const [playPos, setPlayPos] = useState(null);                     // { line, col } under the playhead, null when stopped
  const [tempo, setTempo] = useState(6);                            // columns per second
  const stopRef = useRef(null);                                     // stop() of the current playback
  const sheetWidth = sheetWidthPx(pageBudgetCh('portrait'));   // screen always lays out as portrait
  const helpDlg = useRef(null);
  const dragging = useRef(false);   // mouse-drag cell selection in progress
  const lastTyped = useRef(null);   // cell key of last digit typed (two-digit join)
  const clip = useRef(null);        // internal clipboard: array[rows][cols]
  const history = useRef({});       // tabId -> { undo: [snapshots], redo: [snapshots] }
  const dlg = useRef(null);
  const titleRef = useRef(null);

  const tab = shared || tabs.find(t => t.id === currentId) || tabs[0];
  const locked = !!tab.example || !!shared;                          // can never be edited in place
  const readOnly = locked || !editing;
  const sharedExists = !!shared && tabs.some(t => t.id === shared.id);   // saving would replace this device's copy
  const r = rect(sel, selEnd);

  useEffect(() => { saveTabs(tabs, currentId); }, [tabs, currentId]);
  useEffect(() => { document.title = (tab.title || 'Untitled') + ' · Tab'; }, [tab.title]);
  useEffect(() => { const up = () => { dragging.current = false; }; document.addEventListener('mouseup', up); return () => document.removeEventListener('mouseup', up); }, []);
  useEffect(() => { if (confirm) dlg.current?.showModal(); else dlg.current?.close(); }, [confirm]);
  useEffect(() => { if (helpOpen) helpDlg.current?.showModal(); else helpDlg.current?.close(); }, [helpOpen]);
  useEffect(() => { if (printOpen) printDlg.current?.showModal(); else printDlg.current?.close(); }, [printOpen]);
  const doPrint = orientation => { setPrintOpen(false); printAs(orientation, tab, b => flushSync(() => setPrintBudget(b))); };
  const stopPlay = () => { stopRef.current?.(); stopRef.current = null; setPlayPos(null); };
  const togglePlay = () => {
    if (stopRef.current) { stopPlay(); return; }
    stopRef.current = play(tab, tempo, setPlayPos, () => { stopRef.current = null; setPlayPos(null); });
  };
  useEffect(() => stopPlay, [currentId, shared]);
  useEffect(() => {  // a share link pasted into an already-open app
    const h = () => { const t = tabFromHash(); if (t) { setShared(t); resetSel(); } };
    window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h);
  }, []);   // switching tabs (or unmount) stops playback
  const importFile = async file => {
    if (!file) return;
    try {
      const imp = parseImport(await file.text());
      setTabs(ts => mergeTabs(ts, imp)); switchTab(imp[0].id);
      setConfirm({ title: 'Imported', text: `${imp.length} tab${imp.length === 1 ? '' : 's'} imported.`, label: 'OK', run: () => {} });
    } catch (err) { setConfirm({ title: 'Import failed', text: err.message, label: 'OK', run: () => {} }); }
  };
  useEffect(() => {  // re-measure once web fonts are in, so the row budget matches the real glyph width
    document.fonts?.ready.then(() => { resetMeasure(); setPrintBudget(pageBudgetCh()); });
  }, []);
  useEffect(() => {  // close ⋯ menu on outside click / Escape
    if (!menuFor) return;
    const close = e => { if (e.type === 'keydown' && e.key !== 'Escape') return; if (e.type === 'mousedown' && e.target.closest('.menu, .more')) return; setMenuFor(null); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [menuFor]);

  // ---------- mutation helper: clone current tab, apply fn, store ----------
  const HISTORY_MAX = 200;
  const stack = id => (history.current[id] ||= { undo: [], redo: [] });
  const mutate = (fn, touch = true) => {
    if (readOnly) return;
    if (touch) { const h = stack(currentId); h.undo.push(clone(tab)); if (h.undo.length > HISTORY_MAX) h.undo.shift(); h.redo = []; }
    setTabs(ts => ts.map(t => {
      if (t.id !== currentId) return t;
      const c = clone(t); fn(c); if (touch) c.updatedAt = Date.now(); return c;
    }));
  };
  const restore = snap => { setTabs(ts => ts.map(t => t.id === snap.id ? snap : t)); setSelEnd(null); lastTyped.current = null; };
  const undo = () => { const h = stack(currentId); const snap = h.undo.pop(); if (!snap) return; h.redo.push(clone(tab)); restore(snap); };
  const redo = () => { const h = stack(currentId); const snap = h.redo.pop(); if (!snap) return; h.undo.push(clone(tab)); restore(snap); };
  const resetSel = () => { setSel({ line: 0, string: 0, col: 0 }); setSelEnd(null); lastTyped.current = null; };
  const placeAt = (line, string = 0, col = 0) => { setSel({ line, string, col }); setSelEnd(null); };

  // ---------- tabs ----------
  const switchTab = (id, edit = false) => { setCurrentId(id); resetSel(); setEditing(edit); if (shared) { setShared(null); clearHash(); } };
  const saveShared = () => {
    const t = { ...shared, updatedAt: Date.now() };
    setTabs(ts => mergeTabs(ts, [t])); setShared(null); clearHash(); setCurrentId(t.id); resetSel();
  };
  const askSaveShared = () => sharedExists
    ? setConfirm({ title: 'Replace your copy?', text: `You already have “${shared.title || 'Untitled'}”. Saving replaces it with this shared version.`, label: 'Replace', run: saveShared })
    : saveShared();
  const share = () => {
    const url = shareUrl(tab); copyText(url);
    setConfirm({ title: 'Link copied', text: `Anyone who opens it sees this tab and can save it to their own tabs. The whole tab lives in the link (${url.length.toLocaleString()} characters), so it keeps working forever.`, label: 'OK', run: () => {} });
  };
  const addTab = () => { const t = newTab(); setTabs(ts => [...ts, t]); switchTab(t.id, true); setTimeout(() => titleRef.current?.focus(), 0); };
  const updateTab = (id, fn) => setTabs(ts => ts.map(t => { if (t.id !== id || t.example) return t; const c = clone(t); fn(c); c.updatedAt = Date.now(); return c; }));
  const dupTab = (src = tab) => { const t = duplicateTab(src); setTabs(ts => [...ts, t]); switchTab(t.id, true); };
  const deleteTab = id => {
    setTabs(ts => { const rest = ts.filter(t => t.id !== id); return rest; });
    if (currentId === id) { setCurrentId(tabs.find(t => t.id !== id).id); resetSel(); }
  };

  // ---------- sections ----------
  const addLineAfter = li => { mutate(t => t.lines.splice(li + 1, 0, emptyLine())); placeAt(li + 1); };
  const deleteLine = li => {
    const n = tab.lines.length;
    mutate(t => { t.lines.splice(li, 1); if (!t.lines.length) t.lines.push(emptyLine()); });
    placeAt(Math.min(li, Math.max(0, n - 2)));
  };
  const duplicateLine = li => { mutate(t => t.lines.splice(li + 1, 0, cloneLine(t.lines[li]))); placeAt(li + 1); };
  const dropLine = (li, below) => {
    const from = dragLine; setDragLine(null);
    if (from === null) return;
    const to = li + (below ? 1 : 0);
    const dest = moveLine(tab.lines.slice(), from, to);
    if (dest < 0) return;
    mutate(t => moveLine(t.lines, from, to)); placeAt(dest);
  };

  // ---------- editing ----------
  const setNote = v => mutate(t => { setCell(t.lines[sel.line], sel.col, sel.string, v); ensureRunway(t.lines[sel.line], sel.col); });
  const clearSelection = () => mutate(t => {
    const line = t.lines[r.line];
    for (let c = r.c0; c <= r.c1; c++) for (let s = r.s0; s <= r.s1; s++) setCell(line, c, s, '');
  });
  const move = (dl, ds, dc, extend = false) => {
    if (extend) {
      const e = { ...(selEnd || { string: sel.string, col: sel.col }) };
      e.string = Math.max(0, Math.min(STRINGS.length - 1, e.string + ds));
      e.col = Math.max(0, e.col + dc);
      if (e.col >= tab.lines[sel.line].cols.length) mutate(t => t.lines[sel.line].cols.push(emptyCol()), false);
      setSelEnd((e.string === sel.string && e.col === sel.col) ? null : e);
      return;
    }
    let { line: l, string: s, col: c } = sel;
    c += dc; s += ds; l += dl;
    if (dl === 0 && c >= tab.lines[l].cols.length) { if (readOnly) c = tab.lines[l].cols.length - 1; else mutate(t => t.lines[l].cols.push(emptyCol()), false); }
    l = Math.max(0, Math.min(tab.lines.length - 1, l));
    s = Math.max(0, Math.min(STRINGS.length - 1, s));
    c = Math.max(0, Math.min(tab.lines[l].cols.length - 1 + (dl === 0 && !readOnly ? 1 : 0), c));
    setSel({ line: l, string: s, col: c }); setSelEnd(null); lastTyped.current = null;
  };
  const insertCol = () => { mutate(t => t.lines[sel.line].cols.splice(sel.col, 0, emptyCol())); setSelEnd(null); };
  const removeCol = () => {
    const n = tab.lines[sel.line].cols.length;
    mutate(t => { const cols = t.lines[sel.line].cols; if (cols.length > 1) cols.splice(sel.col, 1); });
    if (sel.col >= n - 1) setSel({ ...sel, col: Math.max(0, n - 2) });
    setSelEnd(null);
  };
  // Full-height column selection: shift everything from the selection onward by inserting / removing
  // a blank column just before it. Never touches notes, only blank space.
  const fullCols = !!selEnd && r.s0 === 0 && r.s1 === STRINGS.length - 1;
  const canShiftLeft = fullCols && r.c0 > 0 && !hasNote(tab.lines[r.line].cols[r.c0 - 1]);
  const shiftSel = d => { setSel(s => ({ ...s, col: s.col + d })); setSelEnd(e => e && ({ ...e, col: e.col + d })); };
  const shiftRight = () => { mutate(t => t.lines[r.line].cols.splice(r.c0, 0, emptyCol())); shiftSel(1); };
  const shiftLeft = () => { if (!canShiftLeft) return; mutate(t => t.lines[r.line].cols.splice(r.c0 - 1, 1)); shiftSel(-1); };
  const trimEnds = () => {
    mutate(t => trimLines(t.lines));
    setSelEnd(null);
  };
  const askFixSpacing = () => {
    const n = fixSpacing(clone(tab.lines));
    if (!n) { setConfirm({ title: 'Spacing looks fine', text: 'No notes are touching — nothing to change.', label: 'OK', run: () => {} }); return; }
    setConfirm({
      title: 'Fix spacing?',
      text: `Inserts ${n} empty column${n === 1 ? '' : 's'} where notes sit in adjacent columns. This only spaces out, never compresses — but it shifts timing after each insert. Undo with ⌘Z.`,
      label: 'Fix spacing', run: () => { mutate(t => fixSpacing(t.lines)); setSelEnd(null); },
    });
  };
  const askDeleteTab = t => setConfirm({
    title: 'Delete tab?', text: `“${t.title || 'Untitled'}” will be removed permanently.`, label: 'Delete', danger: true, run: () => deleteTab(t.id),
  });
  useEffect(() => {  // keep cursor inside the line after trims / external shrink
    const cols = tab.lines[sel.line]?.cols;
    if (!cols) { placeAt(0); return; }
    if (sel.col >= cols.length) setSel(s => ({ ...s, col: cols.length - 1 }));
  }, [tab, sel.line, sel.col]);

  // ---------- clipboard ----------
  const copySel = () => {
    const cols = tab.lines[r.line].cols;
    const rows = [];
    for (let s = r.s0; s <= r.s1; s++) { const row = []; for (let c = r.c0; c <= r.c1; c++) row.push(cols[c][s]); rows.push(row); }
    clip.current = rows;
    const widths = []; for (let c = r.c0; c <= r.c1; c++) widths.push(colWidth(cols[c]));
    copyText(rows.map(row => row.map((n, i) => n ? n.padEnd(widths[i], '-') : '-'.repeat(widths[i])).join('')).join('\n'));
  };
  const pasteClip = () => {
    const rows = clip.current; if (!rows || readOnly) return;
    mutate(t => {
      const line = t.lines[sel.line];
      rows.forEach((row, i) => {
        const s = sel.string + i; if (s >= STRINGS.length) return;
        row.forEach((n, j) => { const c = sel.col + j; while (c >= line.cols.length) line.cols.push(emptyCol()); setCell(line, c, s, n); });
      });
      ensureRunway(line, sel.col + rows[0].length - 1);
    });
    const end = { string: Math.min(STRINGS.length - 1, sel.string + rows.length - 1), col: sel.col + rows[0].length - 1 };
    setSelEnd(end.string === sel.string && end.col === sel.col ? null : end);
  };

  // ---------- keyboard ----------
  const handlers = useRef(null);
  handlers.current = e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || confirm || helpOpen || printOpen || menuFor) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod) {
      const k = e.key.toLowerCase();
      if (k === 'z') { if (e.shiftKey) redo(); else undo(); e.preventDefault(); }
      else if (k === 'y') { redo(); e.preventDefault(); }
      else if (k === 'c') { copySel(); e.preventDefault(); }
      else if (k === 'x') { copySel(); clearSelection(); e.preventDefault(); }
      else if (k === 'v') { pasteClip(); e.preventDefault(); }
      return;
    }
    const key = `${currentId}:${sel.line}:${sel.string}:${sel.col}`;
    // digits: a fret, two digits typed in a row join (≤ 24). x: muted string.
    if (/^[0-9x]$/.test(e.key)) {
      e.preventDefault();
      if (readOnly) return;
      setSelEnd(null);
      const old = tab.lines[sel.line].cols[sel.col][sel.string];
      const joined = old + e.key;
      const v = (lastTyped.current === key && validNote(joined)) ? joined : e.key;
      lastTyped.current = key;
      setNote(v);
      return;
    }
    // bar line: fills the whole column at the cursor, cursor moves past it
    if (e.key === BAR) {
      e.preventDefault();
      if (readOnly) return;
      setSelEnd(null);
      mutate(t => { const line = t.lines[sel.line]; setCell(line, sel.col, sel.string, BAR); ensureRunway(line, sel.col + 1); });
      setSel({ ...sel, col: sel.col + 1 }); lastTyped.current = null;
      return;
    }
    // technique chars (h p / \ b ~) get a cell of their own: placed after the fret you just typed, cursor moves past it
    if (isTech(e.key)) {
      e.preventDefault();
      if (readOnly) return;
      setSelEnd(null);
      const here = tab.lines[sel.line].cols[sel.col][sel.string];
      const at = here && !isTech(here) ? sel.col + 1 : sel.col;   // after a fret → next column; on an empty cell → this one
      mutate(t => { const line = t.lines[sel.line]; while (at >= line.cols.length) line.cols.push(emptyCol()); line.cols[at][sel.string] = e.key; ensureRunway(line, at + 1); });
      setSel({ ...sel, col: at + 1 }); lastTyped.current = null;
      return;
    }
    if (e.key === 'Backspace' && lastTyped.current === key && !readOnly) {   // mid-entry: erase last character
      e.preventDefault();
      const old = tab.lines[sel.line].cols[sel.col][sel.string];
      if (old.length > 1) { const v = old.slice(0, -1); setNote(validNote(v) ? v : v.replace(/[hp\/\\b~]$/, '')); return; }
    }
    const sh = e.shiftKey;
    const map = {
      ArrowLeft: () => move(0, 0, -1, sh), ArrowRight: () => move(0, 0, 1, sh),
      ArrowUp: () => move(0, -1, 0, sh), ArrowDown: () => move(0, 1, 0, sh),
      '[': () => fullCols && shiftLeft(), ']': () => fullCols && shiftRight(),
      ' ': () => move(0, 0, 1),
      Enter: () => addLineAfter(sel.line),
      Escape: () => setSelEnd(null),
      Backspace: () => clearSelection(), Delete: () => sh ? removeCol() : clearSelection(),
      Insert: () => insertCol(),
      PageDown: () => move(1, 0, 0), PageUp: () => move(-1, 0, 0),
    };
    if (map[e.key]) { map[e.key](); e.preventDefault(); }
  };
  useEffect(() => { const h = e => handlers.current(e); document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, []);

  // ---------- cell mouse ----------
  const on = {
    cellDown: (li, si, ci, shift) => {
      if (shift && sel.line === li) setSelEnd({ string: si, col: ci });
      else { setSel({ line: li, string: si, col: ci }); setSelEnd(null); dragging.current = true; }
      lastTyped.current = null;
    },
    cellEnter: (li, si, ci) => {
      if (!dragging.current || li !== sel.line) return;
      setSelEnd((si === sel.string && ci === sel.col) ? null : { string: si, col: ci });
    },
    note: (li, v) => mutate(t => { t.lines[li].note = v; }),
    duplicate: duplicateLine, remove: deleteLine,
    dragStart: li => setDragLine(li), dragEnd: () => setDragLine(null), drop: dropLine,
  };

  const sorted = [...tabs].sort((a, b) => (a.example ? 1 : b.example ? -1 : (b.updatedAt || 0) - (a.updatedAt || 0)));

  return (
    <div className={'layout' + (sideOpen ? '' : ' collapsed')}>
      <aside className="side">
        <div className="sidehead">
          <div className="brand">Tab<i>.</i></div>
          <button className="collapse" title={sideOpen ? 'Collapse sidebar' : 'Expand sidebar'} aria-label={sideOpen ? 'Collapse sidebar' : 'Expand sidebar'} aria-expanded={sideOpen} onClick={() => setSideOpen(o => !o)}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="13" rx="2.5" /><line x1="8" y1="3.5" x2="8" y2="16.5" /></svg>
          </button>
        </div>
        <div className="sidebody" {...(sideOpen ? {} : { inert: '' })}>
        <button className="new" onClick={addTab}>+ New tab</button>
        <div className="section">Tabs</div>
        <div className="tablist">
          {sorted.map(t => (
            <div key={t.id} className={'tabitem' + (!shared && t.id === tab.id ? ' active' : '') + (menuFor === t.id ? ' open' : '')}
              onClick={() => { if (renaming !== t.id) switchTab(t.id); }}>
              {renaming === t.id ? (
                <input className="rename" autoFocus defaultValue={t.title} placeholder="Untitled"
                  onClick={e => e.stopPropagation()}
                  onBlur={e => { updateTab(t.id, c => { c.title = e.target.value; }); setRenaming(null); }}
                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = t.title; e.currentTarget.blur(); } }} />
              ) : (
                <span className={'name' + (t.title ? '' : ' untitled')}>
                  {t.title || 'Untitled'}
                  {t.artist && <span className="artist">{t.artist}</span>}
                </span>
              )}
              {t.example && <span className="tag">example</span>}
              <button className="more" title="More" onClick={e => { e.stopPropagation(); setMenuFor(m => m === t.id ? null : t.id); }}>⋯</button>
              {menuFor === t.id && (
                <div className="menu" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setMenuFor(null); dupTab(t); }}>{t.example ? 'Duplicate to edit' : 'Duplicate'}</button>
                  {!t.example && <button onClick={() => { setMenuFor(null); switchTab(t.id, true); }}>Edit</button>}
                  {!t.example && <button onClick={() => { setMenuFor(null); setRenaming(t.id); }}>Rename</button>}
                  {!t.example && <button className="danger" onClick={() => { setMenuFor(null); askDeleteTab(t); }}>Delete</button>}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="io">
          <button onClick={() => exportJson(tabs)} title="Download all your tabs as a JSON backup">Export</button>
          <button onClick={() => fileRef.current?.click()} title="Import tabs from a JSON backup">Import</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => { importFile(e.target.files[0]); e.target.value = ''; }} />
        </div>
        <button className="help-btn" onClick={() => setHelpOpen(true)}>Help &amp; shortcuts</button>
        </div>
      </aside>

      <div className="main">
        <div className="toolbar" style={{ width: sheetWidth }}>
          {shared ? (
            <>
              <span className="badge">Shared with you</span>
              <button className="primary" onClick={askSaveShared}>{sharedExists ? 'Replace my copy' : 'Save to my tabs'}</button>
              <button onClick={() => switchTab(currentId)}>Dismiss</button>
            </>
          ) : tab.example ? (
            <>
              <span className="badge">Example · read-only</span>
              <button className="primary" onClick={() => dupTab()}>Duplicate to edit</button>
            </>
          ) : !editing ? (
            <button className="primary" onClick={() => { setEditing(true); resetSel(); }}>Edit</button>
          ) : (
            <>
              <button className="save" onClick={() => { setEditing(false); setSelEnd(null); }} title="Back to the practice view (changes are saved as you type)">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" /></svg>Save
              </button>
              <button onClick={() => addLineAfter(tab.lines.length - 1)}>+ New section</button>
              <button onClick={trimEnds} title="Remove trailing dashes (never changes timing)">Trim ends</button>
              <button onClick={askFixSpacing} title="Insert a dash between touching notes (may shift timing)">Fix spacing</button>
              {fullCols && (
                <span className="ctx">
                  <button onClick={shiftLeft} disabled={!canShiftLeft} title="Remove one blank column before the selection">◀ Pull in</button>
                  <button onClick={shiftRight} title="Insert one blank column before the selection">Push out ▶</button>
                </span>
              )}
            </>
          )}
          <span className="spacer" />
          <span className="play">
            <button onClick={togglePlay} title="Play the tab (technique and bar-line columns take no time)">{playPos ? '■ Stop' : '▶ Play'}</button>
            <input type="range" min="2" max="14" step="1" value={tempo} title="Speed: columns per second"
              onChange={e => { setTempo(+e.target.value); }} />
            <span className="tempo">{tempo}/s</span>
          </span>
          <button onClick={() => copyText(toText(tab))}>Copy text</button>
          <button onClick={share} title="Copy a link that contains this whole tab">Share</button>
          <button className="primary" onClick={() => setPrintOpen(true)}>Print</button>
        </div>

        <div className={'sheet' + (readOnly ? ' readonly' : '')} style={{ width: sheetWidth }}>
          <div className="meta">
            <input ref={titleRef} type="text" id="title" placeholder="Untitled" value={tab.title} readOnly={readOnly}
              onChange={e => mutate(t => { t.title = e.target.value; })} />
            <div className="artist-wrap">
              <input type="text" id="artist" placeholder="Artist" value={tab.artist} readOnly={readOnly}
                onChange={e => mutate(t => { t.artist = e.target.value; })} />
            </div>
          </div>
          <div id="editor">
            {tab.lines.map((line, li) => (
              <Section key={line.id} line={line} li={li} sel={sel} selEnd={selEnd} r={r} readOnly={readOnly} dragLine={dragLine} on={on} printBudget={printBudget} playCol={playPos?.line === li ? playPos.col : -1} />
            ))}
          </div>
          <div className="pagenote">Laid out as A4 portrait · sections wrap where they will on paper</div>
        </div>

      </div>

      <dialog className="help" ref={helpDlg} onClose={() => setHelpOpen(false)}>
        <h3>Help &amp; shortcuts</h3>
        <dl>
          <h4>Editing</h4>
          <dt>Click a dash, type <kbd>0</kbd>–<kbd>24</kbd></dt><dd>Set a fret. Two digits typed in a row join into one note.</dd>
          <dt><kbd>h</kbd> <kbd>p</kbd> <kbd>/</kbd> <kbd>\</kbd> <kbd>b</kbd> <kbd>~</kbd></dt><dd>Techniques: type one right after a fret and it lands in the next column with the cursor moved past it, so 12 <kbd>p</kbd> 14 gives 12p14. h hammer-on, p pull-off, / \ slides, b bend, ~ vibrato.</dd>
          <dt><kbd>x</kbd></dt><dd>Muted string.</dd>
          <dt><kbd>|</kbd></dt><dd>Bar line — fills the whole column. Clearing any of its cells removes it.</dd>
          <dt><kbd>Backspace</kbd> while typing</dt><dd>Erases the last character of the note you're entering.</dd>
          <dt><kbd>Space</kbd></dt><dd>Move to the next column.</dd>
          <dt><kbd>Backspace</kbd></dt><dd>Clear the selected cell(s).</dd>
          <dt><kbd>Insert</kbd> / <kbd>Shift</kbd>+<kbd>Del</kbd></dt><dd>Insert / remove a column at the cursor.</dd>
          <dt><kbd>Enter</kbd></dt><dd>New section below the current one.</dd>
          <dt><kbd>⌘Z</kbd> / <kbd>⌘⇧Z</kbd></dt><dd>Undo / redo.</dd>
          <h4>Selecting</h4>
          <dt>Drag, or <kbd>Shift</kbd>+arrows / click</dt><dd>Select a block of cells.</dd>
          <dt><kbd>⌘C</kbd> <kbd>⌘X</kbd> <kbd>⌘V</kbd></dt><dd>Copy / cut / paste the block at the cursor.</dd>
          <dt><kbd>[</kbd> / <kbd>]</kbd></dt><dd>With a full-height column selected: pull in / push out a blank column before it.</dd>
          <dt><kbd>Esc</kbd></dt><dd>Clear the selection.</dd>
          <h4>Sections</h4>
          <dt>Hover a section</dt><dd>Shows duplicate / delete, the note field (x2, chorus…), and the drag handle for reordering.</dd>
          <dt><kbd>PgUp</kbd> / <kbd>PgDn</kbd></dt><dd>Jump between sections.</dd>
          <h4>Tabs</h4>
          <dt><kbd>⋯</kbd> in the sidebar</dt><dd>Rename, duplicate or delete a tab. The example tab is read-only — duplicate it to edit.</dd>
          <dt>Edit / Save</dt><dd>Tabs open in a clean practice view. Edit switches to editing, Save goes back (everything is saved as you type anyway). New and duplicated tabs open in edit mode.</dd>
          <dt>Autosave</dt><dd>Everything is saved in this browser automatically.</dd>
          <dt>Share</dt><dd>Copies a link with the whole tab packed inside. Whoever opens it can save it to their own tabs.</dd>
          <dt>Export / Import</dt><dd>Back up all tabs to a JSON file, or restore from one. Imported tabs with the same id replace the existing ones.</dd>
          <h4>Playback</h4>
          <dt><kbd>▶ Play</kbd></dt><dd>Plays the tab: every column is one beat at the chosen speed. Technique and bar-line columns take no time; section repeats are ignored.</dd>
        </dl>
        <div className="actions"><button onClick={() => setHelpOpen(false)}>Close</button></div>
      </dialog>

      <dialog className="printdlg" ref={printDlg} onClose={() => setPrintOpen(false)}>
        <h3>Print</h3>
        <p>The staff is scaled up to fill the page you pick, and rows re-wrap if a section still doesn't fit. The editor itself stays in portrait.</p>
        <div className="orient">
          <button onClick={() => doPrint('portrait')}><span className="page portrait" />Portrait</button>
          <button onClick={() => doPrint('landscape')}><span className="page landscape" />Landscape</button>
        </div>
        <div className="actions"><button onClick={() => setPrintOpen(false)}>Cancel</button></div>
      </dialog>

      <dialog ref={dlg} onClose={() => setConfirm(null)}>
        <h3>{confirm?.title}</h3>
        <p>{confirm?.text}</p>
        <div className="actions">
          {confirm?.run && confirm.label !== 'OK' && <button onClick={() => setConfirm(null)}>Cancel</button>}
          <button className={confirm?.danger ? 'danger' : 'primary'} onClick={() => { const c = confirm; setConfirm(null); c?.run(); }}>{confirm?.label}</button>
        </div>
      </dialog>
    </div>
  );
}
