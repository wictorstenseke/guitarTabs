// Page layout: how many tab columns fit on one printed staff row. The editor renders with the same
// budget (at a larger screen font), so what you see on screen is exactly how it prints.
// Assumes A4 (narrowest common paper) with the @page margin from styles.css; Letter is wider, so this is safe for both.
const A4_MM = { portrait: 210, landscape: 297 }, PAGE_MARGIN_MM = 16;   // margin: keep in sync with @page in styles.css
const printablePx = o => (A4_MM[o] - 2 * PAGE_MARGIN_MM) * 96 / 25.4;   // CSS px at print resolution

export const PRINT_FONT_PX = 10;      // smallest staff font on paper; the layout budget on screen assumes this
export const PRINT_FONT_MAX = 13.5;   // largest font we'll scale up to when the tab fits the page with room to spare
export const SCREEN_FONT_PX = 13.5;   // staff font on screen — keep in sync with .line in styles.css
export const SHEET_PAD_PX = 48;       // .sheet horizontal padding on screen
export const VIEW_PAD_PX = 24;        // tighter padding used in view mode when the sheet has to shrink to fit
const FRAME_CH = 3;                   // label "e|" + closing "|"

let chPerPx = null;                   // width of one monospace glyph per 1px of font-size
export function resetMeasure() { chPerPx = null; }   // call after web fonts load
function glyphRatio() {
  if (chPerPx) return chPerPx;
  const probe = document.createElement('span');
  probe.className = 'line'; probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;padding:0;margin:0;font-size:100px';
  probe.textContent = '-'.repeat(50);
  document.body.appendChild(probe); chPerPx = probe.getBoundingClientRect().width / 50 / 100; probe.remove();
  return chPerPx || 0.6;
}

// Cells per staff row that fit the printable width at the given font, minus the frame.
export function pageBudgetCh(orientation = 'portrait', fontPx = PRINT_FONT_PX) { return Math.floor(printablePx(orientation) / (glyphRatio() * fontPx)) - FRAME_CH; }

// Widest row any section needs, in ch (cells + frame + its note).
const neededCh = tab => Math.max(...tab.lines.map(l => l.cols.reduce((n, c) => n + Math.max(1, ...c.map(x => x.length)), 0) + FRAME_CH + (l.note ? l.note.length + 1 : 0)));

// Fit to page: the largest font (in ¼px steps, within [PRINT_FONT_PX, PRINT_FONT_MAX]) at which the widest
// section still fits on one row. If it can't fit even at the minimum, the minimum is used and rows wrap.
export function fitFontPx(orientation, tab) {
  const px = printablePx(orientation) / (glyphRatio() * neededCh(tab));
  return Math.max(PRINT_FONT_PX, Math.min(PRINT_FONT_MAX, Math.floor(px * 4) / 4));
}

// Print with the given orientation: the staff font is scaled to fit the page and rows are re-wrapped for
// that page width, only for the duration of the print (via `setBudget`, reset to null after); @page size is set so the
// browser's dialog preselects the orientation.
export function printAs(orientation, tab, setBudget) {
  const font = fitFontPx(orientation, tab);
  const style = document.createElement('style');
  style.textContent = `@page { size: A4 ${orientation}; } @media print { .line { font-size: ${font}px; } }`;
  document.head.appendChild(style);
  setBudget(pageBudgetCh(orientation, font));
  const done = () => { style.remove(); setBudget(null); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}

// Screen sheet width that holds exactly one full row (plus padding) at the given screen font.
export function sheetWidthPx(budget, fontPx = SCREEN_FONT_PX, pad = SHEET_PAD_PX) { return Math.ceil((budget + FRAME_CH) * glyphRatio() * fontPx) + 2 * pad; }

// Largest screen font (≤ SCREEN_FONT_PX, ¼px steps) at which a full row plus padding fits in `availPx`.
export function fitScreenFontPx(budget, availPx, pad = SHEET_PAD_PX) {
  const px = (availPx - 2 * pad) / (glyphRatio() * (budget + FRAME_CH));
  return Math.max(7, Math.min(SCREEN_FONT_PX, Math.floor(px * 4) / 4));
}

// Split columns into runs whose summed widths fit the budget. The first run also gives up `noteCh`
// for the section note shown beside it (only as wide as the text actually entered).
// Returns [[startIdx, endIdxExclusive], ...].
export function chunkCols(widths, budget, noteCh = 0) {
  const chunks = []; let start = 0, used = 0, cap = Math.max(1, budget - noteCh);
  for (let i = 0; i < widths.length; i++) {
    if (used + widths[i] > cap && i > start) { chunks.push([start, i]); start = i; used = 0; cap = Math.max(1, budget); }
    used += widths[i];
  }
  chunks.push([start, widths.length]);
  return chunks;
}
