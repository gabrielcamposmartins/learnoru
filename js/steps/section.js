/*
 * Etapa "section": cartão de transição entre partes da sessão
 * (ex.: "Atividades de fixação", "Problema 2").
 *
 *   { type: 'section', title: 'Atividades de fixação', subtitle: '...', icon: '🎯', text: 'fala opcional' }
 *
 * Etapa de explicação (teaching): participa do voltar/pular — ver say.js.
 */
(function () {
  const { h } = U;

  Game.registerStepType('section', {
    teaching: true,
    async run(ctx, step) {
      if (!(ctx.nav && ctx.nav.revisit)) Sound.fanfare();
      ctx.stage.set(h('div', { class: 'card section-card' },
        h('div', { class: 'section-icon' }, step.icon || '🎯'),
        h('div', { class: 'section-title' }, step.title),
        step.subtitle ? h('div', { class: 'section-sub', html: MD.inline(step.subtitle) }) : null));
      const nav = await ctx.explain(step.text || `**${step.title}** — vamos lá!`, { mood: step.mood || 'cheer' });
      return { nav };
    },
  });
})();
