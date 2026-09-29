/* Revisão: conceitos a revisar, módulos abaixo de 3★ e o caderno de resumos (takeaways). */
(function () {
  const { h } = U;

  Game.registerScreen('review', {
    render(root, params, App) {
      Shell.setTitle('Revisão');
      const done = Game.allModules().map(x => Object.assign(x, { p: Store.moduleProgress(x.track.id, x.module.id) })).filter(x => x.p && x.p.completed);

      // Conceitos a partir dos reviews salvos.
      const concepts = new Map();
      for (const x of done) {
        for (const r of x.p.reviews || []) {
          if (!r.concept) continue;
          const e = concepts.get(r.concept) || { concept: r.concept, items: [] };
          e.items.push({ text: r.text, track: x.track, module: x.module });
          concepts.set(r.concept, e);
        }
      }
      const conceptList = [...concepts.values()].sort((a, b) => b.items.length - a.items.length);
      const toImprove = done.filter(x => x.p.bestStars < 3).sort((a, b) => a.p.bestStars - b.p.bestStars);

      const tabs = [
        { id: 'conceitos', label: 'Conceitos', count: conceptList.length },
        { id: 'melhorar', label: 'Abaixo de 3★', count: toImprove.length },
        { id: 'caderno', label: 'Caderno', count: done.filter(x => x.module.takeaways.length).length },
      ];
      let current = conceptList.length ? 'conceitos' : 'caderno';
      const tabBar = h('div', { class: 'tabs', role: 'tablist' });
      const panel = h('div', { class: 'tab-panel' });

      function paintTabs() {
        tabBar.innerHTML = '';
        tabs.forEach(t => tabBar.appendChild(h('button', { class: `tab ${current === t.id ? 'active' : ''}`, role: 'tab', onclick: () => { current = t.id; paintTabs(); render(); } },
          t.label, h('span', { class: 'tab-count' }, String(t.count)))));
      }

      const empty = (msg) => h('div', { class: 'empty card' }, Icons.el('sparkles', { size: 22 }), h('p', null, msg));
      const replay = (x, label = 'Refazer') => h('button', { class: 'btn btn-sm', onclick: () => App.go('play', { trackId: x.track.id, moduleId: x.module.id }) }, Icons.el('review', { size: 14 }), label);

      function render() {
        panel.innerHTML = '';
        if (current === 'conceitos') {
          if (!conceptList.length) { panel.appendChild(empty('Nada para revisar — quando você perder estrelas, os conceitos aparecem aqui.')); return; }
          conceptList.forEach(c => panel.appendChild(h('div', { class: 'card review-card' },
            h('div', { class: 'review-card-head' }, Widgets.concept(c.concept), h('span', { class: 'muted small' }, `${c.items.length} ocorrência(s)`)),
            h('ul', { class: 'review-items' }, c.items.slice(0, 4).map(it => h('li', null,
              h('div', { class: 'md', html: MD.render(it.text) }),
              h('div', { class: 'review-item-foot' }, h('span', { class: 'muted small' }, `${it.track.icon} ${it.track.title} › ${it.module.title}`), replay(it))))))));
        } else if (current === 'melhorar') {
          if (!toImprove.length) { panel.appendChild(empty('Todos os módulos concluídos estão com 3 estrelas. 🌟')); return; }
          panel.appendChild(h('div', { class: 'improve-list' }, toImprove.map(x => h('div', { class: 'improve-item', style: { '--c': x.track.color } },
            Widgets.trackIcon(x.track, 36),
            h('div', { class: 'improve-text' }, h('strong', null, x.module.title), h('span', { class: 'muted small' }, x.track.title)),
            Widgets.stars(x.p.bestStars, { size: 'sm' }),
            replay(x, 'Tentar 3★')))));
        } else {
          const byTrack = new Map();
          done.filter(x => x.module.takeaways.length).forEach(x => {
            if (!byTrack.has(x.track.id)) byTrack.set(x.track.id, { track: x.track, items: [] });
            byTrack.get(x.track.id).items.push(x);
          });
          if (!byTrack.size) { panel.appendChild(empty('Conclua módulos para montar seu caderno com os principais pontos de cada aula.')); return; }
          for (const { track, items } of byTrack.values()) {
            const sec = h('section', { class: 'notebook-track', style: { '--c': track.color } },
              h('h2', { class: 'section-h' }, Widgets.trackIcon(track, 28), track.title),
              h('div', { class: 'notebook-grid' }, items.map(x => h('div', { class: 'card notebook-card' },
                h('h3', null, x.module.title),
                h('ul', { class: 'takeaways' }, x.module.takeaways.map(t => h('li', { html: MD.inline(t) })))))));
            Glossary.decorate(sec);
            panel.appendChild(sec);
          }
        }
      }

      root.appendChild(h('div', { class: 'review-screen page' },
        h('header', { class: 'page-head' },
          h('div', null, h('h1', null, 'Revisão'), h('p', { class: 'muted' }, 'Reforce o que ficou fraco e releia os principais pontos de cada aula.'))),
        tabBar, panel));
      paintTabs();
      render();
    },
  });
})();
