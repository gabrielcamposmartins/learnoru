/* Tela de resultados: estrelas, XP, conquistas, principais pontos e review por questão. */
(function () {
  const { h } = U;

  function countUp(el, to, ms = 900) {
    const start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / ms);
      el.textContent = `+${Math.round(to * (1 - Math.pow(1 - t, 3)))}`;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  Game.registerScreen('results', {
    render(root, { trackId, moduleId, summary }, App) {
      const track = Game.getTrack(trackId);
      const mod = Game.getModule(trackId, moduleId);
      if (!track || !mod || !summary) { App.go('track', { trackId }); return; }
      Shell.setTitle('Resultado', `${track.title} · ${mod.title}`);
      const ch = Game.castFor(track, mod);
      const view = CharacterView.create(ch);
      const dialog = DialogBox.create(view);
      const idx = track.modules.indexOf(mod);
      const nextMod = track.modules[idx + 1];

      const s = summary;
      const perfect = s.results.filter(r => r.stars === 3).length;
      const xpEl = h('span', null, '+0');

      const questionList = h('div', { class: 'result-list' }, s.results.map(r => h('div', { class: `result-item r${r.stars}` },
        h('div', { class: 'ri-head' },
          Widgets.stars(r.stars, { size: 'sm' }),
          h('span', { class: 'ri-title' }, r.title),
          h('span', { class: 'spacer' }),
          h('span', { class: 'muted small mono' }, `${r.xp}/${r.maxXp} XP`)),
        r.reviews.length ? h('ul', { class: 'ri-reviews' }, r.reviews.map(rv => h('li', null,
          h('div', { class: 'md', html: MD.render(rv.text) }),
          rv.concept ? h('div', { class: 'ri-concept' }, h('span', { class: 'muted small' }, 'Conceito para estudar:'), Widgets.concept(rv.concept)) : null)))
          : h('div', { class: 'ri-ok small' }, r.stars === 3 ? '✓ Nada a melhorar aqui.' : ''))));

      const concepts = [...new Set(s.reviews.map(r => r.concept).filter(Boolean))];
      const takeaways = mod.takeaways || [];
      const title = s.stars === 3 ? 'Excelente!' : s.stars === 2 ? 'Muito bem!' : s.stars === 1 ? 'Concluído!' : 'Continue praticando!';

      const stat = (value, label, sub) => h('div', { class: 'r-stat' },
        h('div', { class: 'r-stat-value' }, value), h('div', { class: 'r-stat-label' }, label), sub ? h('div', { class: 'r-stat-sub' }, sub) : null);

      const hero = h('div', { class: 'card results-hero' },
        h('div', { class: 'rh-kicker' }, Widgets.trackIcon(track, 26), `${track.title} · ${mod.title}`),
        h('h1', null, title),
        Widgets.stars(s.stars, { size: 'xl', animate: true }),
        s.levelUp ? h('div', { class: 'level-up' }, Icons.el('sparkles', { size: 18 }), `Subiu para o nível ${s.levelUp} — ${Scoring.level(Store.totalXp()).title}!`) : null,
        h('div', { class: 'results-stats' },
          stat(xpEl, 'XP ganho', s.newRecord && s.previousBest.plays ? '🏆 novo recorde' : s.xpGained === 0 && s.previousBest.plays ? 'sem superar o recorde' : ''),
          stat(`${s.xp}/${s.maxXp}`, 'pontuação'),
          stat(`${perfect}/${s.results.length}`, 'questões perfeitas'),
          stat(U.formatTime(s.elapsed), 'tempo')),
        Widgets.progress(s.maxXp ? s.xp / s.maxXp : 0, { color: track.color }),
        h('div', { class: 'q-actions center' },
          h('button', { class: 'btn', onclick: () => App.go('track', { trackId }) }, Icons.el('map', { size: 15 }), 'Trilha'),
          h('button', { class: 'btn', onclick: () => App.go('play', { trackId, moduleId }) }, Icons.el('review', { size: 15 }), 'Refazer'),
          nextMod ? h('button', { class: 'btn btn-primary', onclick: () => App.go('play', { trackId, moduleId: nextMod.id }) }, `Próximo: ${nextMod.title}`, Icons.el('arrowRight', { size: 15 })) : null));

      const cards = [hero];
      if ((s.unlocked || []).length) {
        cards.push(h('div', { class: 'card unlocked-card' },
          h('h2', { class: 'section-h' }, Icons.el('trophy', { size: 18 }), 'Conquistas desbloqueadas'),
          h('div', { class: 'ach-grid compact' }, s.unlocked.map(a => h('div', { class: 'ach unlocked pop-in' },
            h('div', { class: 'ach-icon' }, a.icon), h('div', null, h('strong', null, a.title), h('div', { class: 'muted small' }, a.desc)))))));
      }
      if (takeaways.length) {
        const tk = h('div', { class: 'card takeaways-card' },
          h('h2', { class: 'section-h' }, Icons.el('notebook', { size: 18 }), 'Principais pontos'),
          h('ul', { class: 'takeaways' }, takeaways.map(t => h('li', { html: MD.inline(t) }))),
          h('p', { class: 'muted small' }, 'Ficam salvos no seu caderno, na página Revisão.'));
        Glossary.decorate(tk);
        cards.push(tk);
      }
      if (concepts.length) {
        cards.push(h('div', { class: 'card' },
          h('h2', { class: 'section-h' }, Icons.el('bulb', { size: 18 }), 'Conceitos para revisar'),
          h('div', { class: 'concept-row' }, concepts.map(c => Widgets.concept(c)))));
      }
      cards.push(h('div', { class: 'card' },
        h('h2', { class: 'section-h' }, Icons.el('review', { size: 18 }), 'Review por questão'),
        h('p', { class: 'muted small' }, 'O que poderia ter sido melhor em cada questão e qual conceito está por trás disso.'),
        questionList));

      root.appendChild(h('div', { class: 'results-screen page', style: { '--c': track.color, '--track-color': track.color } },
        h('div', { class: 'results-grid' },
          h('div', { class: 'results-main' }, cards),
          h('aside', { class: 'results-host' },
            h('div', { class: 'th-char' }, view.el),
            h('div', { class: 'char-plate' }, h('strong', null, ch.name), h('span', null, ch.role)),
            dialog.el))));

      countUp(xpEl, s.xpGained);
      const lines = s.stars === 3
        ? [{ text: 'Mandou muito bem! Resultado de quem domina o assunto.', mood: 'cheer' }]
        : s.stars === 2
          ? [{ text: 'Bom trabalho! Você entendeu o essencial.', mood: 'happy' }, { text: 'Dá uma olhada no review: ali estão os pontos para chegar às 3 estrelas.', mood: 'neutral' }]
          : [{ text: 'Concluímos! Esse assunto ainda merece atenção.', mood: 'neutral' }, { text: 'Leia o review com calma e refaça o módulo quando quiser — só o melhor resultado conta.', mood: 'thinking' }];
      if (concepts.length) lines.push({ text: `Conceitos para revisar: **${concepts.slice(0, 3).join('**, **')}**.`, mood: 'neutral' });
      dialog.say(lines, { wait: false });
      if (s.stars === 3 || s.levelUp) { Sound.fanfare(); setTimeout(() => Confetti.burst(), 500); }
      (s.unlocked || []).forEach((a, i) => setTimeout(() => Achievements.toast(a), 1200 + i * 900));

      return () => { view.destroy(); dialog.destroy(); };
    },
  });
})();
