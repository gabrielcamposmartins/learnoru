/*
 * Etapa "order": colocar itens na ordem certa (arrastando ou com ↑ ↓).
 *
 *   { type: 'order', id, concept, say, prompt: 'markdown',
 *     items: ['primeiro', 'segundo', 'terceiro'],   // na ORDEM CORRETA (são embaralhados na tela)
 *     explanation: 'markdown', points: 15 }
 *
 * Estrelas: 3 de primeira, 2 na segunda tentativa, 1 depois.
 * Após um erro, os itens que já estão na posição certa ficam marcados.
 */
(function () {
  const { h } = U;
  const { header, resultPanel } = StepHelpers;

  function shuffledIndices(n) {
    const base = [...Array(n).keys()];
    if (n < 2) return base;
    let s;
    do { s = U.shuffle(base); } while (s.every((v, i) => v === i));
    return s;
  }

  Game.registerStepType('order', {
    scored: true,
    async run(ctx, step) {
      const items = step.items;
      let order = shuffledIndices(items.length); // order[pos] = índice do item
      let wrong = 0;
      let dragFrom = null;

      const list = h('ol', { class: 'order-list', 'aria-label': 'Itens para ordenar' });
      const feedback = h('div', { class: 'q-feedback' });
      const checkBtn = h('button', { class: 'btn btn-primary' }, 'Verificar ordem');
      const card = h('div', { class: 'card question' },
        header(step, 'Ordene'),
        h('div', { class: 'q-prompt md', html: MD.render(step.prompt) }),
        h('div', { class: 'small muted' }, 'Arraste os itens ou use as setas. Dica: com um item focado, Alt + ↑/↓ também move.'),
        list,
        h('div', { class: 'q-actions' }, checkBtn),
        feedback);
      ctx.stage.set(card);
      ctx.say(step.say || 'Coloque na ordem certa.', { mood: 'thinking', wait: false });

      function move(from, to) {
        if (to < 0 || to >= order.length || from === to) return;
        const [x] = order.splice(from, 1);
        order.splice(to, 0, x);
        Sound.click();
        render(to);
      }

      function render(focusPos = null) {
        list.innerHTML = '';
        list.classList.remove('checked');
        order.forEach((itemIdx, pos) => {
          const li = h('li', { class: 'order-item', draggable: 'true', tabindex: 0, dataset: { pos } },
            h('span', { class: 'order-handle', 'aria-hidden': 'true' }, '⋮⋮'),
            h('span', { class: 'order-num' }, String(pos + 1)),
            h('span', { class: 'order-text md', html: MD.inline(items[itemIdx]) }),
            h('span', { class: 'order-btns' },
              h('button', { class: 'icon-btn sm', 'aria-label': 'Mover para cima', disabled: pos === 0, onclick: () => move(pos, pos - 1) }, '↑'),
              h('button', { class: 'icon-btn sm', 'aria-label': 'Mover para baixo', disabled: pos === order.length - 1, onclick: () => move(pos, pos + 1) }, '↓')));
          li.addEventListener('dragstart', e => { dragFrom = pos; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
          li.addEventListener('dragend', () => { li.classList.remove('dragging'); dragFrom = null; });
          li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('drop-target'); });
          li.addEventListener('dragleave', () => li.classList.remove('drop-target'));
          li.addEventListener('drop', e => { e.preventDefault(); li.classList.remove('drop-target'); if (dragFrom !== null) move(dragFrom, pos); });
          li.addEventListener('keydown', e => {
            if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); move(pos, pos - 1); }
            if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); move(pos, pos + 1); }
          });
          list.appendChild(li);
        });
        if (focusPos !== null) list.children[focusPos] && list.children[focusPos].focus();
      }
      render();

      const stars = await new Promise(resolve => {
        checkBtn.onclick = () => {
          const ok = order.every((v, i) => v === i);
          if (ok) { resolve(Scoring.mcqStars(wrong)); return; }
          wrong++;
          Sound.wrong();
          const right = order.filter((v, i) => v === i).length;
          [...list.children].forEach((li, pos) => li.classList.add(order[pos] === pos ? 'pos-ok' : 'pos-bad'));
          list.classList.add('checked');
          feedback.innerHTML = '';
          feedback.appendChild(h('div', { class: 'q-hint bad' }, `✗ ${right} de ${items.length} na posição certa (marcados em verde). Reorganize e tente de novo.`));
          ctx.say(U.pick(ctx.lines('wrong')), { mood: 'concerned', wait: false });
        };
      });

      checkBtn.remove();
      [...list.children].forEach(li => { li.classList.add('pos-ok'); li.draggable = false; li.querySelectorAll('button').forEach(b => b.remove()); });
      Sound.correct();
      feedback.innerHTML = '';
      feedback.appendChild(resultPanel(stars, stars === 3 ? 'Ordem perfeita de primeira!' : `Correto após ${wrong} tentativa(s).`,
        step.explanation ? h('div', { class: 'md', html: MD.render(step.explanation) }) : null));
      ctx.say(U.pick(ctx.lines(stars === 3 ? 'correct' : 'partial')), { mood: stars === 3 ? 'cheer' : 'neutral', wait: false });
      const reviews = wrong > 0 ? [{ text: step.review || step.explanation || 'Revise a sequência.', concept: step.concept }] : [];
      const result = { stars, reviews };
      await ctx.continueButton(card, { result });
      return result;
    },
  });
})();
