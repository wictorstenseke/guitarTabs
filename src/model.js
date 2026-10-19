// Pure data helpers. A tab is { id, title, artist, lines:[{ cols:[[6 strings]], note }], updatedAt, example? }
export const STRINGS = ['e', 'B', 'G', 'D', 'A', 'E'];
export const START_COLS = 8;   // new section starts this wide, grows as you type
export const TAIL = 3;         // empty cols kept after last note when trimming

export const uid = () => Math.random().toString(36).slice(2, 10);
export const emptyCol = () => Array(STRINGS.length).fill('');
export const emptyLine = () => ({ cols: Array.from({ length: START_COLS }, emptyCol), note: '' });
export const newTab = () => ({ id: uid(), title: '', artist: '', lines: [emptyLine()], updatedAt: Date.now() });
export const clone = x => JSON.parse(JSON.stringify(x));
export const hasNote = c => c.some(n => n);
export const colWidth = col => Math.max(1, ...col.map(n => n.length));

// Cell notation: a cell holds a fret (0–24), "x" (mute), or a single technique character that links the
// frets either side of it — h hammer-on, p pull-off, / slide up, \ slide down, b bend, ~ vibrato —
// so "12p14" is three cells: 12 · p · 14.
export const TECH = 'hp/\\b~';
export const isTech = v => v.length === 1 && TECH.includes(v);
export const BAR = '|';                                                        // bar line: always fills a whole column
export const isBar = col => col[0] === BAR;
export const validNote = v => v === 'x' || v === BAR || isTech(v) || (/^\d{1,2}$/.test(v) && +v <= 24);
const techCol = col => col.some(n => n) && col.every(n => !n || isTech(n));   // column of only technique chars
export const isFret = v => /^\d{1,2}$/.test(v);

// Set one cell. A bar line fills its whole column; writing anything else into a bar column clears the bar first.
export function setCell(line, col, string, v) {
  const c = line.cols[col];
  if (v === BAR) { c.fill(BAR); return; }
  if (isBar(c)) c.fill('');
  c[string] = v;
}

export const duplicateTab = t => ({
  ...clone(t), id: uid(), example: false,
  title: t.title ? t.title + ' (copy)' : '', updatedAt: Date.now(),
});

export function rect(sel, selEnd) {
  const e = selEnd || { string: sel.string, col: sel.col };
  return {
    line: sel.line,
    s0: Math.min(sel.string, e.string), s1: Math.max(sel.string, e.string),
    c0: Math.min(sel.col, e.col), c1: Math.max(sel.col, e.col),
  };
}
export const inRect = (r, li, si, ci) => li === r.line && si >= r.s0 && si <= r.s1 && ci >= r.c0 && ci <= r.c1;

export function ensureRunway(line, col) { while (line.cols.length - 1 - col < 2) line.cols.push(emptyCol()); }

// Trim: only removes trailing empties, never touches timing.
export function trimLines(lines) {
  lines.forEach(line => {
    let last = -1; line.cols.forEach((c, i) => { if (hasNote(c)) last = i; });
    line.cols.length = Math.max(START_COLS, last + 1 + TAIL);
    for (let i = 0; i < line.cols.length; i++) if (!line.cols[i]) line.cols[i] = emptyCol();
  });
}

// Fix spacing: only ever spaces OUT. Where notes sit in adjacent columns (on any strings), insert
// empty columns so there are at least `minGap` between them. Returns number of columns inserted.
export function fixSpacing(lines, minGap = 1) {
  let inserted = 0;
  lines.forEach(line => {
    let last = -Infinity;
    for (let ci = 0; ci < line.cols.length; ci++) {
      if (!hasNote(line.cols[ci])) continue;
      // technique cells (h, p, /…) glue to their neighbours — never pad around them
      const glued = techCol(line.cols[ci]) || isBar(line.cols[ci]) || (last >= 0 && (techCol(line.cols[last]) || isBar(line.cols[last])));
      const need = glued ? 0 : minGap - (ci - last - 1);
      if (need > 0) { line.cols.splice(ci, 0, ...Array.from({ length: need }, emptyCol)); inserted += need; ci += need; }
      last = ci;
    }
  });
  return inserted;
}

// Move line `from` so it lands before pre-removal index `to`. Returns the new index or -1 if no-op.
export function moveLine(lines, from, to) {
  if (to === from || to === from + 1) return -1;
  const [line] = lines.splice(from, 1);
  const dest = to > from ? to - 1 : to;
  lines.splice(dest, 0, line);
  return dest;
}

export function toText(tab) {
  const head = [tab.title, tab.artist].filter(Boolean).join(' — ');
  const body = tab.lines.map(line => {
    const widths = line.cols.map(colWidth);
    return STRINGS.map((name, si) =>
      name + '|' + line.cols.map((c, ci) => c[si] ? c[si].padEnd(widths[ci], '-') : '-'.repeat(widths[ci])).join('') + '|'
      + (si === 3 && line.note ? ' ' + line.note : '')
    ).join('\n');
  }).join('\n\n');
  return head ? head + '\n\n' + body : body;
}

export function copyText(txt) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(txt).catch(() => {});
  const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove();
}
