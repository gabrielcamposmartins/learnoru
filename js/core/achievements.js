/*
 * Conquistas (achievements). Cada uma tem uma condição calculada a partir do
 * progresso salvo; `progress` (opcional) devolve [atual, alvo] para a barra.
 * Achievements.check() desbloqueia o que for novo e devolve a lista.
 */
(function () {
  function summary() {
    const s = Store.state;
    const tracks = Game.getTracks();
    const done = Object.entries(s.modules).filter(([, m]) => m.completed);
    const tracksTouched = new Set(done.map(([k]) => k.split('/')[0]));
    const fullTracks = tracks.filter(t => t.modules.length && t.modules.every(m => (Store.moduleProgress(t.id, m.id) || {}).completed));
    const interviews = done.filter(([k]) => {
      const [tid, mid] = k.split('/');
      const mod = Game.getModule(tid, mid);
      return mod && mod.kind === 'interview';
    });
    return {
      completed: done.length,
      perfectModules: done.filter(([, m]) => m.bestStars === 3).length,
      stars: Store.totalStars(),
      tracksTouched: tracksTouched.size,
      totalTracks: tracks.length,
      fullTracks: fullTracks.length,
      interviews: interviews.length,
      perfectInterviews: interviews.filter(([, m]) => m.bestStars === 3).length,
      flags: s.stats.flags || {},
      streakBest: Store.streak().best,
      glossary: s.glossarySeen.length,
      bestDay: Math.max(0, ...Object.values(s.activity).map(a => a.q || 0)),
      level: Scoring.level(Store.totalXp()).level,
      answered: s.stats.answered,
    };
  }

  const flag = (s, name) => s.flags[name] || 0;

  const LIST = [
    { id: 'primeiro-passo', icon: '🚀', title: 'Primeiro passo', desc: 'Conclua seu primeiro módulo.', check: s => s.completed >= 1 },
    { id: 'perfeccionista', icon: '⭐', title: 'Perfeccionista', desc: 'Conclua um módulo com 3 estrelas.', check: s => s.perfectModules >= 1 },
    { id: 'dez-modulos', icon: '📚', title: 'Estudante dedicado(a)', desc: 'Conclua 10 módulos.', check: s => s.completed >= 10, progress: s => [s.completed, 10] },
    { id: 'constelacao', icon: '🌌', title: 'Constelação', desc: 'Junte 50 estrelas.', check: s => s.stars >= 50, progress: s => [s.stars, 50] },
    { id: 'galaxia', icon: '🪐', title: 'Galáxia', desc: 'Junte 200 estrelas.', check: s => s.stars >= 200, progress: s => [s.stars, 200] },
    { id: 'explorador', icon: '🧭', title: 'Explorador(a)', desc: 'Conclua módulos em 4 trilhas diferentes.', check: s => s.tracksTouched >= 4, progress: s => [s.tracksTouched, 4] },
    { id: 'polimata', icon: '🧠', title: 'Polímata', desc: 'Conclua ao menos um módulo em todas as trilhas.', check: s => s.tracksTouched >= s.totalTracks && s.totalTracks > 0, progress: s => [s.tracksTouched, s.totalTracks] },
    { id: 'mestre-trilha', icon: '🏆', title: 'Mestre de trilha', desc: 'Conclua todos os módulos de uma trilha.', check: s => s.fullTracks >= 1 },
    { id: 'entrevistado', icon: '🎤', title: 'Entrevistado(a)', desc: 'Conclua uma entrevista.', check: s => s.interviews >= 1 },
    { id: 'contratado', icon: '🤝', title: 'Contratado(a)!', desc: 'Tire 3 estrelas numa entrevista.', check: s => s.perfectInterviews >= 1 },
    { id: 'cacador-bugs', icon: '🐞', title: 'Caçador(a) de bugs', desc: 'Pegue todos os bugs plantados numa questão de testes.', check: s => flag(s, 'mutants-all') >= 1 },
    { id: 'red-green', icon: '🚦', title: 'Red, Green, Refactor', desc: 'Complete um ciclo de TDD com 3 estrelas.', check: s => flag(s, 'tdd-perfect') >= 1 },
    { id: 'otimizador', icon: '⚡', title: 'Otimizador(a)', desc: 'Passe nos testes de desempenho de primeira.', check: s => flag(s, 'perf-first') >= 1 },
    { id: 'fala-sql', icon: '🗄️', title: 'Fala SQL', desc: 'Resolva 5 desafios de SQL.', check: s => flag(s, 'sql-solved') >= 5, progress: s => [flag(s, 'sql-solved'), 5] },
    { id: 'sem-rodinhas', icon: '🧗', title: 'Sem rodinhas', desc: 'Conclua um módulo com 3 estrelas sem usar dicas.', check: s => flag(s, 'module-perfect-no-hints') >= 1 },
    { id: 'aquecendo', icon: '🔥', title: 'Aquecendo', desc: 'Estude 3 dias seguidos.', check: s => s.streakBest >= 3, progress: s => [s.streakBest, 3] },
    { id: 'imparavel', icon: '☄️', title: 'Imparável', desc: 'Estude 7 dias seguidos.', check: s => s.streakBest >= 7, progress: s => [s.streakBest, 7] },
    { id: 'maratona', icon: '🏃', title: 'Maratona', desc: 'Responda 30 questões num único dia.', check: s => s.bestDay >= 30, progress: s => [s.bestDay, 30] },
    { id: 'enciclopedia', icon: '📖', title: 'Enciclopédia', desc: 'Consulte 25 termos do glossário.', check: s => s.glossary >= 25, progress: s => [s.glossary, 25] },
    { id: 'centena', icon: '💯', title: 'Centena', desc: 'Responda 100 questões.', check: s => s.answered >= 100, progress: s => [s.answered, 100] },
    { id: 'pleno', icon: '🎖️', title: 'Pleno de verdade', desc: 'Alcance o nível 5.', check: s => s.level >= 5, progress: s => [s.level, 5] },
  ];

  const Achievements = {
    list: LIST,
    summary,

    /** Desbloqueia o que for novo. `notify` mostra um toast para cada conquista. */
    check({ notify = true } = {}) {
      const s = summary();
      const unlocked = [];
      for (const a of LIST) {
        if (!Store.isUnlocked(a.id) && a.check(s) && Store.unlock(a.id)) unlocked.push(a);
      }
      if (notify) unlocked.forEach((a, i) => setTimeout(() => Achievements.toast(a), 600 + i * 900));
      return unlocked;
    },

    toast(a) {
      Sound.fanfare();
      U.toast(U.h('div', { class: 'ach-toast' },
        U.h('span', { class: 'ach-toast-icon' }, a.icon),
        U.h('div', null, U.h('div', { class: 'ach-toast-kicker' }, 'Conquista desbloqueada'), U.h('strong', null, a.title))), 'achievement', 4200);
    },

    progress(a, s = summary()) {
      if (!a.progress) return null;
      const [cur, target] = a.progress(s);
      return { cur: Math.min(cur, target), target };
    },
  };

  window.Achievements = Achievements;
})();
