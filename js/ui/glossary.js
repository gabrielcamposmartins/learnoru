/*
 * Termos do glossário no texto: Glossary.decorate(elemento) sublinha a primeira
 * ocorrência de cada termo e mostra a definição num popover (hover, foco ou toque).
 * Não é aplicado em enunciados de questões ainda não respondidas (seria "cola").
 */
(function () {
  const { h } = U;
  const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const SKIP = 'code, pre, a, button, .term, h1, h2, .callout-label, .board-title, .q-result-head, .sql-table';

  let re = null;
  let byForm = new Map();
  let builtFor = -1;
  let pop = null;
  let hideTimer = null;

  function build() {
    const entries = Game.getGlossary();
    if (builtFor === entries.length) return;
    builtFor = entries.length;
    byForm = new Map();
    const forms = [];
    // Siglas curtas (GIL, CAP, SLO…) só casam com a grafia exata, para não marcar "cap" ou "sal" por engano.
    const isAcronym = f => f.length <= 5 && /[A-Z]/.test(f) && f === f.toUpperCase();
    for (const e of entries) {
      for (const v of [e.term, ...(e.aliases || [])]) {
        for (const form of new Set([v, strip(v)])) {
          const k = form.toLowerCase();
          if (k.length < 2 || byForm.has(k) || (k.length < 3 && !isAcronym(form))) continue;
          byForm.set(k, { entry: e, form, exact: isAcronym(form) || k.length <= 3 });
          forms.push(form);
        }
      }
    }
    forms.sort((a, b) => b.length - a.length);
    re = forms.length ? new RegExp(`(?<![\\p{L}\\p{N}_])(${forms.map(escapeRe).join('|')})(?![\\p{L}\\p{N}_])`, 'giu') : null;
  }

  function decorate(root) {
    if (!root) return root;
    build();
    if (!re) return root;
    const used = new Set();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => {
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p || p.closest(SKIP)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.nodeValue;
      re.lastIndex = 0;
      let m;
      let last = 0;
      let frag = null;
      while ((m = re.exec(text))) {
        const info = byForm.get(m[1].toLowerCase());
        if (!info || (info.exact && m[1] !== info.form)) continue;
        const entry = info.entry;
        if (used.has(entry.key)) continue;
        used.add(entry.key);
        frag = frag || document.createDocumentFragment();
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        frag.appendChild(h('span', { class: 'term', tabindex: 0, role: 'button', dataset: { term: entry.key } }, m[1]));
        last = m.index + m[1].length;
      }
      if (frag) {
        frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
      }
    }
    return root;
  }

  function where(entry) {
    if (!entry.moduleId) return null;
    const t = Game.getTrack(entry.trackId);
    const m = Game.getModule(entry.trackId, entry.moduleId);
    return t && m ? `${t.icon} ${t.title} › ${m.title}` : null;
  }

  function show(termEl) {
    clearTimeout(hideTimer);
    const entry = Game.getTerm(termEl.dataset.term);
    if (!entry) return;
    if (!pop) {
      pop = h('div', { class: 'term-pop', role: 'tooltip' });
      pop.addEventListener('mouseenter', () => clearTimeout(hideTimer));
      pop.addEventListener('mouseleave', () => hide(200));
      document.body.appendChild(pop);
    }
    const src = where(entry);
    pop.innerHTML = '';
    pop.appendChild(h('div', { class: 'term-pop-head' }, Icons.el('book', { size: 15 }), h('strong', null, entry.term)));
    pop.appendChild(h('div', { class: 'term-pop-body', html: MD.inline(entry.definition) }));
    if (src) pop.appendChild(h('div', { class: 'term-pop-src' }, 'Aprenda em: ', src));
    pop.classList.add('show');
    const r = termEl.getBoundingClientRect();
    const pw = Math.min(340, window.innerWidth - 24);
    pop.style.width = `${pw}px`;
    let left = Math.min(Math.max(12, r.left + r.width / 2 - pw / 2), window.innerWidth - pw - 12);
    pop.style.left = `${left + window.scrollX}px`;
    const below = r.bottom + 10;
    const ph = pop.offsetHeight;
    const top = below + ph > window.innerHeight - 8 ? r.top - ph - 10 : below;
    pop.style.top = `${top + window.scrollY}px`;
    if (Store.markTermSeen(entry.key)) Achievements.check();
  }

  function hide(delay = 120) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => pop && pop.classList.remove('show'), delay);
  }

  document.addEventListener('mouseover', e => {
    const t = e.target.closest && e.target.closest('.term');
    if (t) show(t);
  });
  document.addEventListener('mouseout', e => {
    const t = e.target.closest && e.target.closest('.term');
    if (t) hide(250);
  });
  document.addEventListener('focusin', e => { if (e.target.classList && e.target.classList.contains('term')) show(e.target); });
  document.addEventListener('focusout', e => { if (e.target.classList && e.target.classList.contains('term')) hide(); });
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('.term');
    if (t) { e.stopPropagation(); show(t); }
    else if (pop && !e.target.closest('.term-pop')) hide(0);
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(0); });
  window.addEventListener('scroll', () => hide(0), true);

  window.Glossary = { decorate, rebuild: () => { builtFor = -1; } };
})();
