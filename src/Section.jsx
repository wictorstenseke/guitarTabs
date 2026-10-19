import { useState } from 'react';
import { STRINGS, colWidth, inRect } from './model.js';
import { chunkCols } from './print.js';
import GripIcon from './GripIcon.jsx';

export default function Section({ line, li, sel, selEnd, r, readOnly, dragLine, on, printBudget, playCol = -1 }) {
  const [drop, setDrop] = useState('');          // '', 'drop-above', 'drop-below'
  const widths = line.cols.map(colWidth);
  const isDragging = dragLine === li;
  // on screen one staff; when printing, split into rows that fit the page
  const noteCh = line.note ? line.note.length + 1 : 0;   // 1ch gap + the text, nothing for an empty note
  const chunks = printBudget ? chunkCols(widths, printBudget, noteCh) : [[0, line.cols.length]];

  const side = (e, el) => e.clientY > el.getBoundingClientRect().top + el.offsetHeight / 2 ? 'drop-below' : 'drop-above';

  return (
    <div
      className={'line' + (isDragging ? ' dragging' : '') + (drop ? ' ' + drop : '')}
      onDragOver={e => { if (dragLine === null) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDrop(side(e, e.currentTarget)); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDrop(''); }}
      onDrop={e => { if (dragLine === null) return; e.preventDefault(); const below = side(e, e.currentTarget) === 'drop-below'; setDrop(''); on.drop(li, below); }}
    >
      {chunks.map(([c0, c1], k) => (
      <div className="staff" key={k}>
      {STRINGS.map((name, si) => (
        <div className="row" key={name}>
          <span className="label">{name}</span><span className="bar">|</span>
          {line.cols.slice(c0, c1).map((col, i) => {
            const ci = c0 + i;
            const note = col[si], w = widths[ci];
            const style = { '--w': w };
            let cls = 'cell' + (note ? ' note' : '') + (note === '|' ? ' barline' : '') + (ci === playCol ? ' playing' : '');
            if (selEnd && inRect(r, li, si, ci)) {
              cls += ' range';
              const T = si === r.s0, B = si === r.s1, L = ci === r.c0, R = ci === r.c1, a = 'var(--accent)';
              const sh = [];
              if (T) sh.push(`inset 0 1px 0 ${a}`); if (B) sh.push(`inset 0 -1px 0 ${a}`);
              if (L) sh.push(`inset 1px 0 0 ${a}`); if (R) sh.push(`inset -1px 0 0 ${a}`);
              style.boxShadow = sh.join(',');
              style.borderRadius = `${T && L ? 3 : 0}px ${T && R ? 3 : 0}px ${B && R ? 3 : 0}px ${B && L ? 3 : 0}px`;
            } else if (li === sel.line && si === sel.string && ci === sel.col) cls += ' sel';
            return (
              <span key={ci} className={cls} style={style}
                onMouseDown={e => { e.preventDefault(); on.cellDown(li, si, ci, e.shiftKey); }}
                onMouseEnter={() => on.cellEnter(li, si, ci)}
              >{note || '-'.repeat(w)}</span>
            );
          })}
          <span className="bar">|</span>
        </div>
      ))}
      {k === 0 && <span className="repeat">
        <input
          placeholder="x2, chorus…" value={line.note || ''} readOnly={readOnly}
          title="Section note (repeat count, name, anything)"
          style={{ width: (line.note ? line.note.length + 1 : 12) + 'ch' }}
          onChange={e => on.note(li, e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); e.stopPropagation(); }}
        />
      </span>}
      {k === 0 && !readOnly && (
        <button className="grip" title="Drag to reorder" draggable
          onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(li)); on.dragStart(li); }}
          onDragEnd={() => on.dragEnd()}
        ><GripIcon /></button>
      )}
      </div>
      ))}
      {!readOnly && (
        <div className="linetools">
          <button onClick={() => on.duplicate(li)}>duplicate</button>
          <button onClick={() => on.remove(li)}>delete section</button>
        </div>
      )}
    </div>
  );
}
