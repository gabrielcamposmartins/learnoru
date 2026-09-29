/* Tela da trilha: banner, personagem e módulos agrupados por unidade (capítulos). */
(function () {
  const { h } = U;

  function moduleCard(track, m, index, App, focus) {
    const p = Store.moduleProgress(track.id, m.id);
    const cp = Store.checkpoint(track.id, m.id);
    const scored = m.steps.filter(s => Game.isScoredStep(s));
    const done = p && p.completed;
    const types = [...new Set(scored.map(s => s.type))];
    const TYPE_LABEL = { mcq: 'quiz', open: 'dissertativa', code: 'código', sql: 'SQL', pytest: 'pytest', tdd: 'TDD', order: 'ordenar', match: 'associar' };
    const play = () => App.go('play', { trackId: track.id, moduleId: m.id });
    return h('li', { class: `module-node ${done ? 'done' : ''} ${cp ? 'in-progress' : ''} ${p && p.bestStars === 3 ? 'perfect' : ''} kind-${m.kind} ${focus === m.id ? 'focused' : ''}`, id: `mod-${m.id}` },
      h('div', { class: 'mn-index' }, done ? Icons.el('check', { size: 16 }) : String(index)),
      h('div', { class: 'mn-card', tabindex: 0, onclick: play, onkeydown: e => { if (e.key === 'Enter') play(); } },
        h('div', { class: 'mn-top' },
          Widgets.kindBadge(m.kind),
          Widgets.levelDots(m.level),
          cp ? h('span', { class: 'mn-progress', title: 'Checkpoint salvo: as atividades concluídas não precisam ser refeitas' },
            Icons.el('clock', { size: 12 }), `Em andamento · ${cp.results.length}/${cp.total}`) : null,
          h('span', { class: 'spacer' }),
          Widgets.stars(p ? p.bestStars : 0, { size: 'sm' })),
        h('h3', null, m.title),
        m.summary ? h('p', { class: 'mn-summary' }, m.summary) : null,
        h('div', { class: 'mn-foot' },
          h('div', { class: 'mn-concepts' }, (m.concepts || []).slice(0, 4).map(c => h('span', { class: 'tag' }, c))),
          h('span', { class: 'mn-meta' }, `${scored.length} questões · ${types.map(t => TYPE_LABEL[t] || t).join(', ')}`),
          h('button', { class: `btn btn-sm ${done && !cp ? '' : 'btn-primary'}`, onclick: e => { e.stopPropagation(); play(); } },
            done && !cp ? Icons.el('review', { size: 14 }) : Icons.el('play', { size: 14 }),
            cp ? 'Continuar' : done ? 'Refazer' : 'Jogar'))));
  }

  Game.registerScreen('track', {
    render(root, { trackId, focus }, App) {
      const track = Game.getTrack(trackId);
      if (!track) { App.go('home'); return; }
      Shell.setTitle(track.title, 'Trilha');
      const ch = Game.castFor(track);
      const view = CharacterView.create(ch);
      const dialog = DialogBox.create(view);
      const st = Shell.trackProgress(track);
      const groups = Game.modulesByUnit(track);
      const lessons = track.modules.filter(m => m.kind === 'lesson').length;
      const terms = Game.getGlossary().filter(g => g.trackId === track.id).length;

      let n = 0;
      const unitsEl = h('div', { class: 'units' }, groups.map(({ unit, modules }) => {
        const doneInUnit = modules.filter(m => (Store.moduleProgress(track.id, m.id) || {}).completed).length;
        return h('section', { class: 'unit' },
          h('header', { class: 'unit-head' },
            h('div', null,
              h('h2', null, unit.title),
              unit.description ? h('p', { class: 'muted' }, unit.description) : null),
            h('div', { class: 'unit-progress' },
              h('span', { class: 'small muted' }, `${doneInUnit}/${modules.length}`),
              Widgets.progress(modules.length ? doneInUnit / modules.length : 0, { color: track.color, thin: true }))),
          h('ol', { class: 'module-path' }, modules.map(m => moduleCard(track, m, ++n, App, focus))));
      }));

      root.appendChild(h('div', { class: 'track-screen page', style: { '--c': track.color, '--track-color': track.color } },
        h('section', { class: 'track-banner' },
          h('button', { class: 'btn btn-ghost btn-sm back-btn', onclick: () => App.go('home') }, Icons.el('arrowLeft', { size: 15 }), 'Início'),
          h('div', { class: 'tb-main' },
            Widgets.trackIcon(track, 64),
            h('div', { class: 'tb-text' },
              h('h1', null, track.title),
              h('p', null, track.description),
              h('div', { class: 'tb-chips' },
                h('span', { class: 'chip' }, Icons.el('layers', { size: 14 }), `${track.modules.length} módulos`),
                h('span', { class: 'chip' }, Icons.el('book', { size: 14 }), `${lessons} aulas · ${track.modules.length - lessons} entrevistas/desafios`),
                terms ? h('button', { class: 'chip chip-btn', onclick: () => App.go('glossary', {}) }, Icons.el('bulb', { size: 14 }), `${terms} termos no glossário`) : null,
                h('span', { class: 'chip gold' }, Icons.el('starFill', { size: 14 }), `${st.stars}/${st.maxStars}`))),
            Widgets.ring(st.total ? st.done / st.total : 0, { size: 84, stroke: 6, color: track.color,
              center: h('div', { class: 'tb-ring' }, h('strong', null, `${st.total ? Math.round(st.done / st.total * 100) : 0}%`), h('span', null, `${st.done}/${st.total}`)) }))),
        h('div', { class: 'track-body' },
          unitsEl,
          h('aside', { class: 'track-host' },
            h('div', { class: 'th-char' }, view.el),
            h('div', { class: 'char-plate' }, h('strong', null, ch.name), h('span', null, ch.role)),
            dialog.el))));

      const next = track.modules.find(m => !(Store.moduleProgress(track.id, m.id) || {}).completed);
      const intro = track.intro || [`Bem-vindo(a) à trilha de **${track.title}**!`];
      dialog.say([
        ...(Array.isArray(intro) ? intro : [intro]),
        next ? { text: `Sugiro começar por **${next.title}**. Mas fique à vontade para escolher!`, mood: 'happy' }
          : { text: 'Você concluiu todos os módulos! Refaça os que ainda não têm 3 estrelas.', mood: 'cheer' },
      ], { wait: false });

      if (focus) {
        setTimeout(() => {
          const el = document.getElementById(`mod-${focus}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 60);
      }

      return () => { view.destroy(); dialog.destroy(); };
    },
  });
})();
