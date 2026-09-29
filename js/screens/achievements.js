/* Conquistas e estatísticas: medalhas, mapa de atividade (12 semanas) e números gerais. */
(function () {
  const { h } = U;

  function heatmap() {
    const weeks = 12;
    const today = new Date();
    // Começa na segunda-feira de (weeks - 1) semanas atrás: cada coluna é uma semana.
    const start = new Date(today);
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (weeks - 1) * 7);
    const cells = [];
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const q = (Store.state.activity[Store.dayKey(d)] || {}).q || 0;
      const lvl = q === 0 ? 0 : q < 5 ? 1 : q < 10 ? 2 : q < 20 ? 3 : 4;
      cells.push(h('span', { class: `hm l${lvl} ${d > today ? 'future' : ''}`, title: `${d.toLocaleDateString('pt-BR')}: ${q} questões` }));
    }
    return h('div', { class: 'heatmap-wrap' },
      h('div', { class: 'heatmap', style: { gridTemplateColumns: `repeat(${weeks}, 1fr)`, gridTemplateRows: 'repeat(7, 1fr)', gridAutoFlow: 'column' } }, cells),
      h('div', { class: 'heatmap-legend' }, 'menos', [0, 1, 2, 3, 4].map(l => h('span', { class: `hm l${l}` })), 'mais'));
  }

  Game.registerScreen('achievements', {
    render(root) {
      Shell.setTitle('Conquistas');
      const s = Achievements.summary();
      const st = Store.state.stats;
      const streak = Store.streak();
      const daysActive = Object.values(Store.state.activity).filter(a => a.q > 0).length;
      const unlockedCount = Achievements.list.filter(a => Store.isUnlocked(a.id)).length;

      const num = (value, label, icon) => h('div', { class: 'num-tile' },
        icon ? h('span', { class: 'num-icon' }, Icons.el(icon, { size: 16 })) : null,
        h('div', { class: 'num-value' }, String(value)), h('div', { class: 'num-label' }, label));

      const grid = h('div', { class: 'ach-grid' }, Achievements.list.map(a => {
        const unlocked = Store.isUnlocked(a.id);
        const prog = unlocked ? null : Achievements.progress(a, s);
        return h('div', { class: `ach ${unlocked ? 'unlocked' : 'locked'}` },
          h('div', { class: 'ach-icon' }, a.icon),
          h('div', { class: 'ach-body' },
            h('strong', null, a.title),
            h('div', { class: 'muted small' }, a.desc),
            unlocked ? h('div', { class: 'ach-date' }, Icons.el('check', { size: 12 }), new Date(Store.state.achievements[a.id]).toLocaleDateString('pt-BR'))
              : prog ? h('div', { class: 'ach-prog' }, Widgets.progress(prog.cur / prog.target, { thin: true }), h('span', { class: 'small muted' }, `${prog.cur}/${prog.target}`)) : null));
      }));

      root.appendChild(h('div', { class: 'achievements-screen page' },
        h('header', { class: 'page-head' },
          h('div', null, h('h1', null, 'Conquistas'), h('p', { class: 'muted' }, 'Medalhas, sequência de estudos e seus números.')),
          h('div', { class: 'big-count' }, h('strong', null, `${unlockedCount}`), h('span', null, `/${Achievements.list.length}`))),
        h('section', { class: 'num-row' },
          num(st.answered, 'questões respondidas', 'target'),
          num(st.perfect, 'questões perfeitas', 'starFill'),
          num(Store.completedCount(), 'módulos concluídos', 'check'),
          num(streak.current, 'dias seguidos (atual)', 'flame'),
          num(streak.best, 'melhor sequência', 'zap'),
          num(Store.state.glossarySeen.length, 'termos consultados', 'book')),
        h('section', { class: 'card' },
          h('div', { class: 'section-head' }, h('h2', null, 'Atividade'), h('span', { class: 'muted small' }, `${daysActive} dia(s) de estudo`)),
          heatmap()),
        h('section', null, h('div', { class: 'section-head' }, h('h2', null, 'Medalhas')), grid)));
    },
  });
})();
