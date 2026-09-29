/* Tela inicial: saudação, continuar de onde parou, metas, trilhas, termo do dia e revisão. */
(function () {
  const { h } = U;

  function greeting() {
    const hr = new Date().getHours();
    return hr < 5 ? 'Boa madrugada' : hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite';
  }

  /** Próximo módulo sugerido: continua o último; senão o próximo não concluído. */
  function nextUp() {
    const last = Store.state.lastPlayed;
    if (last) {
      const track = Game.getTrack(last.trackId);
      const mod = track && Game.getModule(last.trackId, last.moduleId);
      const unfinished = mod && (Store.checkpoint(track.id, mod.id) || !(Store.moduleProgress(track.id, mod.id) || {}).completed);
      if (unfinished) return { track, module: mod, resume: true };
      if (track) {
        const next = track.modules.find(m => !(Store.moduleProgress(track.id, m.id) || {}).completed);
        if (next) return { track, module: next, resume: false };
      }
    }
    for (const track of Game.getTracks()) {
      const next = track.modules.find(m => !(Store.moduleProgress(track.id, m.id) || {}).completed);
      if (next) return { track, module: next, resume: false };
    }
    return null;
  }

  /** Trilha do próximo módulo e, se houver checkpoint, quantas atividades já foram feitas. */
  function nextSub(next) {
    const cp = Store.checkpoint(next.track.id, next.module.id);
    return cp ? `${next.track.title} · ${cp.results.length} de ${cp.total} atividades feitas` : next.track.title;
  }

  function conceptsToReview() {
    const map = new Map();
    for (const { track, module } of Game.allModules()) {
      const p = Store.moduleProgress(track.id, module.id);
      if (!p || !p.reviews) continue;
      for (const r of p.reviews) {
        if (!r.concept) continue;
        const e = map.get(r.concept) || { concept: r.concept, count: 0, track, module };
        e.count++;
        map.set(r.concept, e);
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }

  /** Um termo do glossário ainda não visto (estável durante o dia). */
  function termOfTheDay() {
    const all = Game.getGlossary();
    if (!all.length) return null;
    const unseen = all.filter(t => !Store.termSeen(t.key));
    const pool = unseen.length ? unseen : all;
    const seed = [...Store.dayKey()].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
    return pool[Math.abs(seed) % pool.length];
  }

  function tile(icon, label, value, sub, extra) {
    return h('div', { class: 'stat-tile' },
      h('div', { class: 'stat-tile-icon' }, typeof icon === 'string' ? Icons.el(icon, { size: 18 }) : icon),
      h('div', { class: 'stat-tile-body' },
        h('div', { class: 'stat-tile-label' }, label),
        h('div', { class: 'stat-tile-value' }, value),
        sub ? h('div', { class: 'stat-tile-sub' }, sub) : null),
      extra || null);
  }

  Game.registerScreen('home', {
    render(root, params, App) {
      Shell.setTitle('Início');
      const cleanups = [];
      const tracks = Game.getTracks();
      const host = Game.getCharacter('lia');
      const hostView = CharacterView.create(host);
      const hostDialog = DialogBox.create(hostView);
      cleanups.push(() => { hostView.destroy(); hostDialog.destroy(); });

      const xp = Store.totalXp();
      const lv = Scoring.level(xp);
      const streak = Store.streak();
      const today = Store.todayActivity();
      const goal = Store.settings().dailyGoal || 10;
      const unlocked = Achievements.list.filter(a => Store.isUnlocked(a.id)).length;
      const totalModules = tracks.reduce((a, t) => a + t.modules.length, 0);
      const doneModules = Store.completedCount();
      const next = nextUp();
      const firstTime = doneModules === 0;

      // ── Hero ──
      const ask = AskPanel.create({
        key: 'home', place: 'home', dialog: hostDialog, charView: hostView,
        getFocus: () => ({ kind: 'home', next: next ? `${next.module.title} (${next.track.title})` : null }),
      });
      cleanups.push(() => ask.destroy());
      const actions = h('div', { class: 'hero-actions' },
        next ? h('button', { class: 'btn btn-primary btn-lg', onclick: () => App.go('play', { trackId: next.track.id, moduleId: next.module.id }) },
          Icons.el('play', { size: 16 }), next.resume ? 'Continuar' : firstTime ? 'Começar agora' : 'Próximo módulo') : null,
        h('button', { class: 'btn btn-lg', onclick: () => document.getElementById('home-tracks').scrollIntoView({ behavior: 'smooth' }) },
          Icons.el('map', { size: 16 }), 'Explorar trilhas'),
        h('button', { class: 'btn btn-lg', title: 'Perguntar à Lia (?)', onclick: () => ask.toggle() },
          Icons.el('chat', { size: 16 }), 'Perguntar à Lia'));
      const hero = h('section', { class: 'home-hero' },
        h('div', { class: 'hero-left' },
          h('div', { class: 'hero-kicker' }, `${greeting()}! 👋`),
          h('h1', { class: 'hero-title' }, firstTime ? 'Aprenda engenharia de software jogando' : 'Bora continuar aprendendo?'),
          h('p', { class: 'hero-sub' }, `${tracks.length} trilhas, ${totalModules} módulos — aulas curtas, código Python rodando de verdade e entrevistas simuladas.`),
          next ? h('div', { class: 'hero-next', style: { '--c': next.track.color } },
            h('span', { class: 'hero-next-label' }, next.resume ? 'Continue de onde parou' : 'Sugestão para agora'),
            h('span', { class: 'hero-next-title' }, `${next.track.icon} ${next.module.title}`),
            h('span', { class: 'hero-next-sub' }, nextSub(next))) : null,
          hostDialog.el,
          actions),
        h('div', { class: 'hero-char' }, hostView.el),
        // Painel "Perguntar à Lia": faixa própria abaixo do texto e da Lia (ela fica no lugar ao abrir).
        ask.el);

      // ── Estatísticas ──
      const days = Store.recentDays(7);
      const week = h('div', { class: 'week-dots' }, days.map(d => h('span', {
        class: `wd ${d.q > 0 ? 'on' : ''} ${d.key === Store.dayKey() ? 'today' : ''}`,
        title: `${d.date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}: ${d.q} questões`,
      }, d.date.toLocaleDateString('pt-BR', { weekday: 'narrow' }))));
      const stats = h('section', { class: 'home-stats' },
        tile(Widgets.ring(lv.progress, { size: 44, stroke: 4, center: h('strong', null, String(lv.level)) }), 'Nível', lv.title, `${xp} XP · ${lv.needed - lv.into} p/ o próximo`),
        tile(h('span', { class: `flame ${streak.studiedToday ? 'hot' : ''}` }, Icons.el('flame', { size: 22 })), 'Sequência',
          `${streak.current} dia${streak.current === 1 ? '' : 's'}`, streak.studiedToday ? `Recorde: ${streak.best}` : 'Estude hoje para manter!', week),
        tile(Widgets.ring(Math.min(1, today.q / goal), { size: 44, stroke: 4, color: 'var(--good)', center: h('span', { class: 'small' }, `${Math.min(today.q, goal)}`) }),
          'Meta de hoje', `${today.q}/${goal} questões`, today.q >= goal ? 'Meta batida! 🎉' : `Faltam ${goal - today.q}`),
        tile(h('span', { class: 'tile-emoji' }, '🏆'), 'Conquistas', `${unlocked}/${Achievements.list.length}`, `${doneModules}/${totalModules} módulos concluídos`));

      // ── Trilhas ──
      const grid = h('div', { class: 'track-grid' }, tracks.map(track => {
        const p = Shell.trackProgress(track);
        const units = (track.units || []).length;
        return h('article', {
          class: 'track-card', style: { '--c': track.color }, tabindex: 0,
          onclick: () => App.go('track', { trackId: track.id }),
          onkeydown: e => { if (e.key === 'Enter') App.go('track', { trackId: track.id }); },
        },
        h('div', { class: 'tc-top' },
          Widgets.trackIcon(track, 46),
          Widgets.ring(p.total ? p.done / p.total : 0, { size: 42, stroke: 3.5, color: track.color, center: h('span', { class: 'tc-pct' }, `${p.total ? Math.round(p.done / p.total * 100) : 0}%`) })),
        h('h3', null, track.title),
        h('p', { class: 'tc-desc' }, track.description),
        h('div', { class: 'tc-meta' },
          h('span', null, `${p.total} módulos`),
          units ? h('span', null, `${units} unidades`) : null,
          h('span', { class: 'tc-stars' }, Icons.el('starFill', { size: 13 }), `${p.stars}/${p.maxStars}`)),
        Widgets.progress(p.total ? p.done / p.total : 0, { color: track.color, thin: true }));
      }));

      // ── Lateral: termo do dia, revisão, conquistas ──
      const term = termOfTheDay();
      const review = conceptsToReview();
      const recentAch = Achievements.list.filter(a => Store.isUnlocked(a.id))
        .sort((a, b) => Store.state.achievements[b.id] - Store.state.achievements[a.id]).slice(0, 3);
      const aside = h('aside', { class: 'home-aside' },
        term ? h('div', { class: 'card side-card fact-card' },
          h('div', { class: 'side-kicker' }, Icons.el('bulb', { size: 15 }), 'Você sabia?'),
          h('h3', null, term.term),
          h('p', { html: MD.inline(term.definition) }),
          h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { Store.markTermSeen(term.key); App.go('glossary', { term: term.key }); } }, 'Ver no glossário', Icons.el('arrowRight', { size: 14 }))) : null,
        h('div', { class: 'card side-card' },
          h('div', { class: 'side-kicker' }, Icons.el('review', { size: 15 }), 'Para revisar'),
          review.length ? h('div', { class: 'review-mini' }, review.slice(0, 5).map(r => h('button', {
            class: 'review-mini-item', onclick: () => App.go('play', { trackId: r.track.id, moduleId: r.module.id }), title: `Refazer ${r.module.title}`,
          }, Widgets.concept(r.concept), h('span', { class: 'muted small' }, r.module.title))))
            : h('p', { class: 'muted small' }, 'Os conceitos em que você perder estrelas aparecem aqui, com atalho para refazer.'),
          review.length ? h('button', { class: 'btn btn-ghost btn-sm', onclick: () => App.go('review') }, 'Abrir revisão', Icons.el('arrowRight', { size: 14 })) : null),
        h('div', { class: 'card side-card' },
          h('div', { class: 'side-kicker' }, Icons.el('trophy', { size: 15 }), 'Conquistas recentes'),
          recentAch.length ? h('div', { class: 'ach-mini' }, recentAch.map(a => h('div', { class: 'ach-mini-item' }, h('span', { class: 'ach-mini-icon' }, a.icon), h('div', null, h('strong', null, a.title), h('span', { class: 'muted small' }, a.desc)))))
            : h('p', { class: 'muted small' }, 'Conclua módulos para ganhar medalhas.'),
          h('button', { class: 'btn btn-ghost btn-sm', onclick: () => App.go('achievements') }, 'Ver todas', Icons.el('arrowRight', { size: 14 }))));

      root.appendChild(h('div', { class: 'home page' },
        hero,
        stats,
        h('div', { class: 'home-grid' },
          h('section', { class: 'home-main', id: 'home-tracks' },
            h('div', { class: 'section-head' }, h('h2', null, 'Trilhas'), h('span', { class: 'muted small' }, 'Escolha por onde começar — todas estão liberadas.')),
            grid),
          aside)));

      hostDialog.say(firstTime ? [
        { text: `Oi! Eu sou a **${host.name}**. Vou te acompanhar nessa jornada.`, mood: 'happy' },
        'Cada trilha tem aulas curtas, atividades de fixação e entrevistas simuladas — com código `Python` e `SQL` rodando de verdade aqui no navegador.',
        { text: 'Passe o mouse nos termos **sublinhados** dos quadros para ver o significado. Vamos começar?', mood: 'happy' },
      ] : [
        { text: `Que bom te ver de novo! Você está no nível **${lv.level} — ${lv.title}**.`, mood: 'happy' },
        next && next.resume ? `Quer continuar **${next.module.title}**?` : review.length ? `Vi que **${review[0].concept}** apareceu nos seus reviews. Que tal revisar?` : 'Escolha uma trilha e vamos continuar!',
      ], { wait: false });

      return () => cleanups.forEach(fn => fn());
    },
  });
})();
