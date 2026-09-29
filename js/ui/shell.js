/*
 * Estrutura do app: barra lateral (navegação, trilhas, cartão do jogador) e barra superior.
 * Durante uma sessão o app entra em "modo foco" (sem barras) para dar espaço à aula.
 */
(function () {
  const { h } = U;
  let active = { name: 'home', trackId: null };

  const NAV = [
    { route: 'home', icon: 'home', label: 'Início' },
    { route: 'glossary', icon: 'book', label: 'Glossário' },
    { route: 'review', icon: 'review', label: 'Revisão' },
    { route: 'achievements', icon: 'trophy', label: 'Conquistas' },
  ];

  function trackProgress(track) {
    let done = 0;
    let stars = 0;
    for (const m of track.modules) {
      const p = Store.moduleProgress(track.id, m.id);
      if (p && p.completed) { done++; stars += p.bestStars; }
    }
    return { done, total: track.modules.length, stars, maxStars: track.modules.length * 3 };
  }

  function reviewCount() {
    const concepts = new Set();
    for (const m of Object.values(Store.state.modules)) (m.reviews || []).forEach(r => r.concept && concepts.add(r.concept));
    return concepts.size;
  }

  function renderSidebar() {
    const sb = document.getElementById('sidebar');
    if (!sb) return;
    const xp = Store.totalXp();
    const lv = Scoring.level(xp);
    const streak = Store.streak();
    const unlocked = Achievements.list.filter(a => Store.isUnlocked(a.id)).length;
    const counts = { glossary: Game.getGlossary().length, review: reviewCount(), achievements: `${unlocked}/${Achievements.list.length}` };

    sb.innerHTML = '';
    sb.appendChild(h('button', { class: 'sb-brand', onclick: () => App.go('home') },
      h('span', { class: 'sb-logo', html: Icons.html('sparkles', { size: 18 }) }),
      h('span', { class: 'sb-brand-text' }, h('strong', null, 'Code Interview'), h('span', null, 'Quest'))));

    sb.appendChild(h('nav', { class: 'sb-nav', 'aria-label': 'Navegação principal' }, NAV.map(n =>
      h('button', { class: `sb-link ${active.name === n.route ? 'active' : ''}`, onclick: () => App.go(n.route) },
        Icons.el(n.icon, { size: 18 }),
        h('span', { class: 'sb-label' }, n.label),
        counts[n.route] ? h('span', { class: 'sb-count' }, String(counts[n.route])) : null))));

    sb.appendChild(h('div', { class: 'sb-section' }, 'Trilhas'));
    sb.appendChild(h('nav', { class: 'sb-tracks', 'aria-label': 'Trilhas' }, Game.getTracks().map(t => {
      const p = trackProgress(t);
      return h('button', {
        class: `sb-track ${active.trackId === t.id ? 'active' : ''}`, style: { '--c': t.color },
        onclick: () => App.go('track', { trackId: t.id }), title: `${t.title} — ${p.done}/${p.total} módulos`,
      },
      h('span', { class: 'sb-track-icon' }, t.icon),
      h('span', { class: 'sb-label' }, t.title),
      Widgets.ring(p.total ? p.done / p.total : 0, { size: 20, stroke: 2.5, color: t.color }));
    })));

    const card = h('div', { class: 'sb-player' },
      h('div', { class: 'sb-player-top' },
        Widgets.ring(lv.progress, { size: 46, stroke: 3.5, color: 'var(--accent)', center: h('strong', null, String(lv.level)) }),
        h('div', { class: 'sb-player-info' },
          h('strong', null, lv.title),
          h('span', null, `${xp} XP · faltam ${lv.needed - lv.into}`))),
      h('div', { class: 'sb-player-stats' },
        h('span', { class: `sb-stat ${streak.studiedToday ? 'hot' : ''}`, title: `Sequência de dias estudando (recorde: ${streak.best})` }, Icons.el('flame', { size: 15 }), `${streak.current}`),
        h('span', { class: 'sb-stat gold', title: 'Estrelas' }, Icons.el('starFill', { size: 15 }), `${Store.totalStars()}`),
        h('span', { class: 'sb-stat', title: 'Módulos concluídos' }, Icons.el('check', { size: 15 }), `${Store.completedCount()}`)));
    sb.appendChild(card);
  }

  const Shell = {
    init() {
      document.getElementById('btn-menu').addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
      document.getElementById('sidebar-backdrop').addEventListener('click', () => document.body.classList.remove('sidebar-open'));
      document.getElementById('btn-search').addEventListener('click', () => Palette.show());
      Store.onChange(() => renderSidebar());
      renderSidebar();
    },
    refresh: renderSidebar,
    setActive(name, params = {}) {
      active = { name, trackId: params.trackId || null };
      document.body.classList.remove('sidebar-open');
      renderSidebar();
    },
    setTitle(title, sub) {
      const el = document.getElementById('topbar-title');
      el.innerHTML = '';
      el.appendChild(h('span', { class: 'tb-title' }, title || ''));
      if (sub) el.appendChild(h('span', { class: 'tb-sub' }, sub));
    },
    focus(on) {
      document.body.classList.toggle('focus-mode', !!on);
    },
    trackProgress,
  };

  window.Shell = Shell;
})();
