// One small stroke-based icon set (16-grid, currentColor) so every button in the app reads the same way.
const P = {
  play:     <path d="M4.5 2.8v10.4L13 8z" className="f" />,
  stop:     <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" className="f" />,
  plus:     <path d="M8 3v10M3 8h10" />,
  pencil:   <path d="M11.3 2.5l2.2 2.2L5.2 13H3v-2.2zM9.8 4l2.2 2.2" />,
  check:    <path d="M3 8.5l3.2 3.2L13 5" />,
  share:    <path d="M8 2v8M5 5l3-3 3 3M3.5 8.5v4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-4" />,
  link:     <path d="M6.8 9.2a3 3 0 0 0 4.2 0l1.8-1.8a3 3 0 0 0-4.2-4.2l-.9.9M9.2 6.8a3 3 0 0 0-4.2 0L3.2 8.6a3 3 0 0 0 4.2 4.2l.9-.9" />,
  text:     <path d="M4 1.5h5l3.5 3.5v9.5h-8.5zM9 1.5V5h3.5M6 8.5h4M6 11h4" />,
  download: <path d="M8 2.5v8M5 7.5l3 3 3-3M3 13.5h10" />,
  upload:   <path d="M8 10.5v-8M5 5.5l3-3 3 3M3 13.5h10" />,
  printer:  <path d="M4.5 6V2.5h7V6M4.5 11.5h-2V6.5h11v5h-2M4.5 9.5h7v4h-7z" />,
  copy:     <path d="M5.5 5.5h8v8h-8zM3.5 10.5h-1v-8h8v1" />,
  trash:    <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.5 7v4M9.5 7v4" />,
  scissors: <><circle cx="4.5" cy="4.5" r="2" /><circle cx="4.5" cy="11.5" r="2" /><path d="M6 5.8L13.5 13M6 10.2L13.5 3" /></>,
  spacing:  <path d="M1.5 8h13M4.5 5l-3 3 3 3M11.5 5l3 3-3 3" />,
  left:     <path d="M10 3.5L5.5 8l4.5 4.5" />,
  right:    <path d="M6 3.5L10.5 8 6 12.5" />,
  bookmark: <path d="M4 2.5h8v11l-4-3-4 3z" />,
  x:        <path d="M4 4l8 8M12 4l-8 8" />,
  help:     <><circle cx="8" cy="8" r="6.5" /><path d="M6 6.3a2 2 0 1 1 2.8 1.8c-.6.3-.8.7-.8 1.4" /><circle cx="8" cy="11.8" r=".5" className="f" /></>,
  more:     <><circle cx="3.5" cy="8" r="1.2" className="f" /><circle cx="8" cy="8" r="1.2" className="f" /><circle cx="12.5" cy="8" r="1.2" className="f" /></>,
  rename:   <path d="M3 4h10M8 4v9M5.5 13h5" />,
  sidebar:  <path d="M2.5 3.5h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM6 3.5v9" />,
};

export default function Icon({ name }) {
  return <svg className="ico" viewBox="0 0 16 16" aria-hidden="true">{P[name]}</svg>;
}
