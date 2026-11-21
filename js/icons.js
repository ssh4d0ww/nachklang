// Custom, simple line icons (24×24)
const S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
  play: '<path fill="currentColor" d="M8.2 5.3c0-.8.9-1.3 1.6-.9l9.4 5.9c.7.4.7 1.4 0 1.8l-9.4 5.9c-.7.4-1.6-.1-1.6-.9z"/>',
  pause: '<rect fill="currentColor" x="6.5" y="5" width="4" height="14" rx="1.2"/><rect fill="currentColor" x="13.5" y="5" width="4" height="14" rx="1.2"/>',
  next: '<path fill="currentColor" d="M5.5 6.6c0-.8.9-1.3 1.6-.8l7.6 5.4c.6.4.6 1.2 0 1.6l-7.6 5.4c-.7.5-1.6 0-1.6-.8z"/><rect fill="currentColor" x="16.3" y="5.5" width="2.4" height="13" rx="1.1"/>',
  prev: '<path fill="currentColor" d="M18.5 6.6c0-.8-.9-1.3-1.6-.8l-7.6 5.4c-.6.4-.6 1.2 0 1.6l7.6 5.4c.7.5 1.6 0 1.6-.8z"/><rect fill="currentColor" x="5.3" y="5.5" width="2.4" height="13" rx="1.1"/>',
  shuffle: `<g ${S}><path d="M4 7.5h2.8c1.8 0 3 .9 4 2.4l2.4 3.9c.9 1.5 2.2 2.4 4 2.4H20"/><path d="M4 16.2h2.8c1.3 0 2.3-.5 3.1-1.3"/><path d="M13.9 8.8c.8-.8 1.8-1.3 3.1-1.3H20"/><path d="m17.6 5 2.5 2.5-2.5 2.5"/><path d="m17.6 13.7 2.5 2.5-2.5 2.5"/></g>`,
  repeat: `<g ${S}><path d="M4.5 11.2V9.8a2.8 2.8 0 0 1 2.8-2.8H19"/><path d="m16.5 4.5 2.5 2.5-2.5 2.5"/><path d="M19.5 12.8v1.4a2.8 2.8 0 0 1-2.8 2.8H5"/><path d="m7.5 19.5-2.5-2.5 2.5-2.5"/></g>`,
  heart: `<path ${S} d="M12 19.5s-7.2-4.4-7.2-9.9A4.1 4.1 0 0 1 12 7a4.1 4.1 0 0 1 7.2 2.6c0 5.5-7.2 9.9-7.2 9.9z"/>`,
  heartFilled: '<path fill="currentColor" d="M12 19.5s-7.2-4.4-7.2-9.9A4.1 4.1 0 0 1 12 7a4.1 4.1 0 0 1 7.2 2.6c0 5.5-7.2 9.9-7.2 9.9z"/>',
  queue: `<g ${S}><path d="M4 6.5h12"/><path d="M4 11.5h12"/><path d="M4 16.5h7"/></g><path fill="currentColor" d="M15 14.4c0-.6.7-1 1.2-.7l3.9 2.4c.5.3.5 1 0 1.3l-3.9 2.4c-.5.3-1.2-.1-1.2-.7z"/>`,
  more: '<circle fill="currentColor" cx="6" cy="12" r="1.7"/><circle fill="currentColor" cx="12" cy="12" r="1.7"/><circle fill="currentColor" cx="18" cy="12" r="1.7"/>',
  close: `<g ${S}><path d="M6.5 6.5l11 11"/><path d="M17.5 6.5l-11 11"/></g>`,
  volume: `<g ${S}><path d="M4.5 9.6h2.8l4.2-3.7v12.2l-4.2-3.7H4.5z"/><path d="M15.3 9.2a4 4 0 0 1 0 5.6"/><path d="M17.9 6.6a7.6 7.6 0 0 1 0 10.8"/></g>`,
  phone: `<g ${S}><rect x="7" y="3" width="10" height="18" rx="2.6"/><path d="M11 17.6h2"/></g>`,
  computer: `<g ${S}><rect x="3.5" y="5" width="17" height="11" rx="2"/><path d="M9 20h6"/><path d="M12 16v4"/></g>`,
  speaker: `<g ${S}><rect x="6" y="3" width="12" height="18" rx="3"/><circle cx="12" cy="14" r="3"/><circle cx="12" cy="7.6" r=".6" fill="currentColor"/></g>`,
  tv: `<g ${S}><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 20h8"/></g>`,
  device: `<g ${S}><rect x="5" y="4" width="14" height="16" rx="3"/><circle cx="12" cy="13" r="3"/></g>`,
  library: `<g ${S}><rect x="4" y="4.5" width="3.2" height="15" rx="1"/><rect x="9.6" y="4.5" width="3.2" height="15" rx="1"/><path d="m15.4 5.6 3-.8 3.2 13.9-3 .8z"/></g>`,
  search: `<g ${S}><circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.6 15.6 4.4 4.4"/></g>`,
  back: `<path ${S} d="M14.5 5.5 8 12l6.5 6.5"/>`,
  chevron: `<path ${S} d="m9.5 6 6 6-6 6"/>`,
  plus: `<g ${S}><path d="M12 5.5v13"/><path d="M5.5 12h13"/></g>`,
  logo: '<circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.4" fill="currentColor"/><path d="M12 3.8a8.2 8.2 0 0 1 8.2 8.2" fill="none" stroke="#ff4d4d" stroke-width="1.8" stroke-linecap="round"/>',
};

export function icon(name, cls = "") {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

export function deviceIcon(type) {
  const t = String(type || "").toLowerCase();
  if (t === "smartphone" || t === "tablet") return icon("phone");
  if (t === "computer") return icon("computer");
  if (t === "speaker" || t === "castaudio" || t === "avr" || t === "stb") return icon("speaker");
  if (t === "tv" || t === "castvideo") return icon("tv");
  return icon("device");
}

// replace every <i data-icon="name"> in the document with an SVG
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll("i[data-icon]")) {
    el.outerHTML = icon(el.dataset.icon, el.className);
  }
}
