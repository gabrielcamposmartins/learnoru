/*
 * Etapa "say": o personagem fala e, opcionalmente, mostra um quadro (board)
 * com explicação em markdown e/ou exemplo de código.
 *
 *   { type: 'say', text: 'Olá!' | ['linha 1', { text: 'linha 2', mood: 'happy' }],
 *     mood: 'neutral', board: { title, md, code, caption } | null }
 *
 * Se `board` for omitido, o quadro atual permanece na tela.
 *
 * É uma etapa de explicação (teaching): o jogador pode voltar/pular as falas.
 * Contrato das etapas teaching: montar o quadro ANTES do primeiro await (a sessão
 * restaura o quadro visto ao voltar) e devolver { nav } com o resultado de ctx.explain.
 */
(function () {
  const { h } = U;

  function renderBoard(board) {
    const parts = [];
    if (board.title) parts.push(h('div', { class: 'board-title' }, board.title));
    if (board.md) parts.push(h('div', { class: 'md', html: MD.render(board.md) }));
    if (board.code) parts.push(h('div', { class: 'md', html: MD.codeBlock(board.code, board.lang || 'python') }));
    if (board.caption) parts.push(h('div', { class: 'board-caption', html: MD.inline(board.caption) }));
    // Termos do glossário ficam sublinhados, com a definição no hover.
    return Glossary.decorate(h('div', { class: 'card board' }, parts));
  }

  Game.registerStepType('say', {
    teaching: true,
    async run(ctx, step) {
      if (step.board !== undefined) {
        if (step.board === null) ctx.stage.idle();
        else ctx.stage.set(renderBoard(step.board));
      }
      const nav = await ctx.explain(step.text, { mood: step.mood || 'neutral' });
      return { nav };
    },
  });

  window.StepHelpers = Object.assign(window.StepHelpers || {}, { renderBoard });
})();
