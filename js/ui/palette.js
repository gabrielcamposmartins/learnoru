/* Busca global (Ctrl+K): módulos, trilhas, termos do glossário e páginas. */
(function () {
  const { h, normalize } = U;
  let open = null;

  function items() {
    const list = [
      { kind: 'page', icon: 'home', title: 'Início', sub: 'Painel, metas e trilhas', go: () => App.go('home') },
      { kind: 'page', icon: 'book', title: 'Glossário', sub: 'Todos os termos e definições', go: () => App.go('glossary') },
      { kind: 'page', icon: 'trophy', title: 'Conquistas', sub: 'Medalhas e estatísticas', go: () => App.go('achievements') },
      { kind: 'page', icon: 'review', title: 'Revisão', sub: 'Conceitos para revisar e caderno de resumos', go: () => App.go('review') },
    ];
    for (const t of Game.getTracks()) {
      list.push({ kind: 'track', emoji: t.icon, color: t.color, title: t.title, sub: t.description, go: () => App.go('track', { trackId: t.id }) });
      for (const m of t.modules) {
        list.push({
          kind: 'module', emoji: t.icon, color: t.color, title: m.title, sub: `${t.title} · ${m.summary || ''}`,
          extra: (m.concepts || []).join(' '), go: () => App.go('track', { trackId: t.id, focus: m.id }),
        });
      }
    }
    for (const g of Game.getGlossary()) {
      list.push({ kind: 'term', icon: 'book', title: g.term, sub: g.definition.replace(/[`*]/g, ''), extra: (g.aliases || []).join(' '), go: () => App.go('glossary', { term: g.key }) });
    }
    return list;
  }

  const KIND_LABEL = { page: 'Página', track: 'Trilha', module: 'Módulo', term: 'Termo' };
  const KIND_WEIGHT = { page: 3, track: 2.5, module: 2, term: 1 };

  function score(item, q) {
    if (!q) return item.kind === 'page' || item.kind === 'track' ? KIND_WEIGHT[item.kind] : 0;
    const title = normalize(item.title);
    const rest = normalize(`${item.sub || ''} ${item.extra || ''}`);
    let s = 0;
    if (title === q) s = 100;
    else if (title.startsWith(q)) s = 60;
    else if (title.split(/\s+/).some(w => w.startsWith(q))) s = 45;
    else if (title.includes(q)) s = 30;
    else if (rest.includes(q)) s = 10;
    else {
      // todas as palavras da busca aparecem em algum lugar
      const words = q.split(/\s+/).filter(Boolean);
      if (words.length > 1 && words.every(w => title.includes(w) || rest.includes(w))) s = 8;
    }
    return s ? s + KIND_WEIGHT[item.kind] : 0;
  }

  function show() {
    if (open) return;
    const all = items();
    const input = h('input', { class: 'palette-input', placeholder: 'Buscar módulos, termos, trilhas…', 'aria-label': 'Buscar' });
    const list = h('div', { class: 'palette-list', role: 'listbox' });
    const box = h('div', { class: 'palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Busca' },
      h('div', { class: 'palette-head' }, Icons.el('search', { size: 18 }), input, h('kbd', null, 'Esc')),
      list,
      h('div', { class: 'palette-foot' }, h('span', null, h('kbd', null, '↑'), h('kbd', null, '↓'), ' navegar'), h('span', null, h('kbd', null, 'Enter'), ' abrir')));
    const backdrop = h('div', { class: 'palette-backdrop', onclick: e => { if (e.target === backdrop) close(); } }, box);
    document.body.appendChild(backdrop);
    let results = [];
    let active = 0;

    function render() {
      const q = normalize(input.value);
      results = all.map(it => ({ it, s: score(it, q) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 40).map(x => x.it);
      active = Math.min(active, Math.max(0, results.length - 1));
      list.innerHTML = '';
      if (!results.length) { list.appendChild(h('div', { class: 'palette-empty' }, 'Nada encontrado.')); return; }
      results.forEach((it, i) => {
        const row = h('button', { class: `palette-item ${i === active ? 'active' : ''}`, role: 'option', onclick: () => pick(i), onmousemove: () => { if (active !== i) { active = i; paint(); } } },
          h('span', { class: 'palette-icon', style: it.color ? { '--c': it.color } : null }, it.emoji ? it.emoji : Icons.el(it.icon, { size: 16 })),
          h('span', { class: 'palette-text' }, h('span', { class: 'palette-title' }, it.title), it.sub ? h('span', { class: 'palette-sub' }, it.sub) : null),
          h('span', { class: 'palette-kind' }, KIND_LABEL[it.kind]));
        list.appendChild(row);
      });
    }
    function paint() {
      [...list.children].forEach((el, i) => el.classList.toggle('active', i === active));
      const el = list.children[active];
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }
    function pick(i) {
      const it = results[i];
      if (!it) return;
      close();
      it.go();
    }
    function close() {
      backdrop.remove();
      document.removeEventListener('keydown', onKey, true);
      open = null;
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(results.length - 1, active + 1); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paint(); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(active); }
    }
    input.addEventListener('input', () => { active = 0; render(); });
    document.addEventListener('keydown', onKey, true);
    render();
    setTimeout(() => input.focus(), 10);
    open = { close };
  }

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      if (document.body.classList.contains('focus-mode')) return; // não interrompe uma sessão
      e.preventDefault();
      show();
    }
  });

  window.Palette = { show };
})();
