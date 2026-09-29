/* Ícones SVG (traço 24×24, herdam a cor do texto). Uso: Icons.el('home') ou Icons.html('home'). */
(function () {
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5.5h4V20"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    map: '<path d="M9 4 3 6.2v13.8l6-2.2 6 2.2 6-2.2V4l-6 2.2z"/><path d="M9 4v13.8M15 6.2V20"/>',
    book: '<path d="M2.5 5.5C4.5 4.4 7.5 4.3 12 6c4.5-1.7 7.5-1.6 9.5-.5V19c-2-1.1-5-1.2-9.5.5-4.5-1.7-7.5-1.6-9.5-.5z"/><path d="M12 6v13.5"/>',
    trophy: '<path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H4.5v1a3 3 0 0 0 3 3M16.5 6h3v1a3 3 0 0 1-3 3"/><path d="M12 13.5V17M8.5 20.5h7M10 17h4v3.5h-4z"/>',
    review: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5"/><path d="M12 8v4.5l3 1.8"/>',
    notebook: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M12 8h4M12 12h4"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    settings: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
    menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    lock: '<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    star: '<path d="m12 3.2 2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.6l6-.9z"/>',
    starFill: '<path d="m12 3.2 2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.6l6-.9z" fill="currentColor"/>',
    flame: '<path d="M12 3c.9 3.4 5 5.4 5 10.2A5 5 0 0 1 7 13.5c0-2.1 1-3.6 2-4.6.3 1.8 1.2 2.8 2.3 3.1C10.7 9.1 11 6 12 3z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    zap: '<path d="M13 2.5 4.5 14h7l-1 7.5L19 10h-7z"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    chevronLeft: '<path d="m15 6-6 6 6 6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    forward: '<path d="m4.5 6.5 7 5.5-7 5.5zM12.5 6.5l7 5.5-7 5.5z"/>',
    chat: '<path d="M4.5 5h15A1.5 1.5 0 0 1 21 6.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17h-1A1.5 1.5 0 0 1 3 15.5v-9A1.5 1.5 0 0 1 4.5 5z"/><path d="M7.5 9.5h9M7.5 12.5h6"/>',
    send: '<path d="M4 11.5 20 4l-6.5 16-2.8-6.7z"/><path d="M10.7 13.3 20 4"/>',
    sparkles: '<path d="M11 3.5 12.7 8l4.5 1.7-4.5 1.7L11 16l-1.7-4.6-4.5-1.7L9.3 8z"/><path d="m18.5 14.5.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    code: '<path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15"/>',
    terminal: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="m7 9.5 3 2.5-3 2.5M12.5 15h4.5"/>',
    bulb: '<path d="M9 17.5h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.1h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z"/>',
    volume: '<path d="M11 5 6.5 9H3.5v6h3L11 19z"/><path d="M15.5 8.8a4.5 4.5 0 0 1 0 6.4M18.3 6a8.5 8.5 0 0 1 0 12"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="M8.6 14 7 21.5l5-2.8 5 2.8-1.6-7.5"/>',
    layers: '<path d="M12 3 2.5 8 12 13l9.5-5z"/><path d="m2.5 12.5 9.5 5 9.5-5M2.5 16.8l9.5 5 9.5-5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    python: '<path d="M11.8 3c-4.6 0-4.3 2-4.3 2v2.1h4.4v.6H5.8S3 7.4 3 11.9c0 4.6 2.5 4.4 2.5 4.4H7v-2.1s-.1-2.5 2.4-2.5h4.2s2.4 0 2.4-2.3V5.4S16.4 3 11.8 3z"/><path d="M12.2 21c4.6 0 4.3-2 4.3-2v-2.1h-4.4v-.6h6.1S21 16.6 21 12.1c0-4.6-2.5-4.4-2.5-4.4H17v2.1s.1 2.5-2.4 2.5h-4.2s-2.4 0-2.4 2.3v3.9S7.6 21 12.2 21z"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7.5 14h9"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V7.5A1.5 1.5 0 0 1 5.5 6H10"/>',
  };

  const Icons = {
    has: name => !!P[name],
    html(name, { size = 18, cls = '' } = {}) {
      const inner = P[name] || P.info;
      return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
    },
    el(name, opts) {
      const span = document.createElement('span');
      span.className = 'icon-wrap';
      span.innerHTML = Icons.html(name, opts);
      return span.firstChild;
    },
  };

  window.Icons = Icons;
})();
