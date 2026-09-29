/* Glossário: todos os termos das trilhas, com busca, filtro por trilha e índice A–Z. */
(function () {
  const { h, normalize } = U;

  Game.registerScreen('glossary', {
    render(root, { term: focusKey }, App) {
      Shell.setTitle('Glossário');
      const all = Game.getGlossary();
      const tracks = Game.getTracks().filter(t => all.some(g => g.trackId === t.id));
      let filterTrack = null;
      let query = '';

      const search = h('input', { class: 'input search-input', type: 'search', placeholder: `Buscar entre ${all.length} termos…`, 'aria-label': 'Buscar termo' });
      const chips = h('div', { class: 'chip-row' });
      const index = h('div', { class: 'az-index' });
      const list = h('div', { class: 'glossary-list' });
      const counter = h('span', { class: 'muted small' });

      function paintChips() {
        chips.innerHTML = '';
        const mk = (label, id, color) => h('button', {
          class: `chip chip-btn ${filterTrack === id ? 'active' : ''}`, style: color ? { '--c': color } : null,
          onclick: () => { filterTrack = id; paintChips(); render(); },
        }, label);
        chips.appendChild(mk('Todas', null));
        tracks.forEach(t => chips.appendChild(mk(`${t.icon} ${t.title}`, t.id, t.color)));
      }

      function card(g) {
        const seen = Store.termSeen(g.key);
        const src = g.moduleId ? { track: Game.getTrack(g.trackId), module: Game.getModule(g.trackId, g.moduleId) } : null;
        const also = (g.alsoIn || []).map(a => ({ track: Game.getTrack(a.trackId), module: Game.getModule(a.trackId, a.moduleId) })).filter(x => x.track && x.module);
        const el = h('article', { class: `term-card ${seen ? 'seen' : ''}`, id: `term-${g.key.replace(/[^a-z0-9]+/g, '-')}`, tabindex: 0,
          onclick: () => { if (Store.markTermSeen(g.key)) { el.classList.add('seen'); Achievements.check(); } } },
        h('div', { class: 'term-card-head' },
          h('h3', null, g.term),
          seen ? h('span', { class: 'seen-badge', title: 'Você já consultou este termo' }, Icons.el('check', { size: 13 })) : h('span', { class: 'new-dot', title: 'Ainda não consultado' })),
        g.aliases.length ? h('div', { class: 'term-aliases' }, g.aliases.slice(0, 5).join(' · ')) : null,
        h('p', { class: 'term-def', html: MD.inline(g.definition) }),
        src && src.track && src.module ? h('div', { class: 'term-links' },
          h('button', { class: 'link-btn', style: { '--c': src.track.color }, onclick: e => { e.stopPropagation(); App.go('track', { trackId: src.track.id, focus: src.module.id }); } },
            h('span', null, src.track.icon), `Aprenda em: ${src.module.title}`),
          also.slice(0, 3).map(a => h('button', { class: 'link-btn subtle', style: { '--c': a.track.color }, onclick: e => { e.stopPropagation(); App.go('track', { trackId: a.track.id, focus: a.module.id }); } },
            h('span', null, a.track.icon), a.module.title))) : null);
        return el;
      }

      function render() {
        const q = normalize(query);
        const items = all.filter(g => (!filterTrack || g.trackId === filterTrack || (g.alsoIn || []).some(a => a.trackId === filterTrack))
          && (!q || normalize(`${g.term} ${g.aliases.join(' ')} ${g.definition}`).includes(q)));
        counter.textContent = `${items.length} termo(s) · ${Store.state.glossarySeen.length} consultados`;
        const groups = new Map();
        for (const g of items) {
          const letter = normalize(g.term).charAt(0).toUpperCase();
          const key = /[A-Z]/.test(letter) ? letter : '#';
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(g);
        }
        index.innerHTML = '';
        list.innerHTML = '';
        if (!items.length) { list.appendChild(h('div', { class: 'empty' }, all.length ? 'Nenhum termo encontrado.' : 'O glossário aparece conforme os módulos declaram termos.')); return; }
        for (const [letter, gs] of groups) {
          index.appendChild(h('button', { class: 'az', onclick: () => document.getElementById(`letter-${letter}`).scrollIntoView({ behavior: 'smooth', block: 'start' }) }, letter));
          list.appendChild(h('section', { class: 'letter-group', id: `letter-${letter}` },
            h('div', { class: 'letter' }, letter),
            h('div', { class: 'term-grid' }, gs.map(card))));
        }
      }

      search.addEventListener('input', () => { query = search.value; render(); });

      root.appendChild(h('div', { class: 'glossary-screen page' },
        h('header', { class: 'page-head' },
          h('div', null,
            h('h1', null, 'Glossário'),
            h('p', { class: 'muted' }, 'Todos os termos das trilhas — inclusive os que quase ninguém conhece. Nos quadros das aulas, eles aparecem sublinhados.')),
          counter),
        h('div', { class: 'toolbar' }, search),
        chips,
        index,
        list));
      paintChips();
      render();

      if (focusKey) {
        const g = Game.getTerm(focusKey);
        if (g) {
          if (Store.markTermSeen(g.key)) Achievements.check();
          setTimeout(() => {
            const el = document.getElementById(`term-${g.key.replace(/[^a-z0-9]+/g, '-')}`);
            if (el) { el.classList.add('highlight', 'seen'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
          }, 60);
        }
      } else {
        setTimeout(() => search.focus(), 50);
      }
    },
  });
})();
