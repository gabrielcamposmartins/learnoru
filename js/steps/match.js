/*
 * Etapa "match": associar cada item da esquerda ao da direita.
 *
 *   { type: 'match', id, concept, say, prompt: 'markdown',
 *     pairs: [{ left: 'markdown curto', right: 'markdown curto' }, ...],   // 3 a 6 pares
 *     explanation: 'markdown', points: 15 }
 *
 * A coluna da direita é embaralhada. Clique num item da esquerda e depois no da direita.
 * Estrelas: 3 de primeira, 2 na segunda tentativa, 1 depois. Pares certos ficam travados.
 */
(function () {
  const { h } = U;
  const { header, resultPanel } = StepHelpers;
  const COLORS = ['#7c8cff', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#fb923c', '#a78bfa', '#2dd4bf'];

  Game.registerStepType('match', {
    scored: true,
    async run(ctx, step) {
      const pairs = step.pairs;
      let rightOrder = [...pairs.keys()];
      if (pairs.length > 1) {
        do { rightOrder = U.shuffle(rightOrder); } while (rightOrder.every((v, i) => v === i));
      }
      const assign = new Map(); // esquerda i -> direita j (índices dos pares)
      const locked = new Set();
      let selected = null;
      let wrong = 0;

      const leftCol = h('div', { class: 'match-col' });
      const rightCol = h('div', { class: 'match-col' });
      const feedback = h('div', { class: 'q-feedback' });
      const checkBtn = h('button', { class: 'btn btn-primary', disabled: true }, 'Verificar pares');
      const card = h('div', { class: 'card question' },
        header(step, 'Associe os pares'),
        h('div', { class: 'q-prompt md', html: MD.render(step.prompt) }),
        h('div', { class: 'small muted' }, 'Clique num item da esquerda e depois no correspondente da direita. Clique de novo para desfazer.'),
        h('div', { class: 'match-grid' }, leftCol, rightCol),
        h('div', { class: 'q-actions' }, checkBtn),
        feedback);
      ctx.stage.set(card);
      ctx.say(step.say || 'Associe cada item ao seu par.', { mood: 'thinking', wait: false });

      const leftBtns = pairs.map((p, i) => h('button', { class: 'match-item', onclick: () => clickLeft(i) },
        h('span', { class: 'match-badge' }), h('span', { class: 'md', html: MD.inline(p.left) })));
      const rightBtns = rightOrder.map(j => h('button', { class: 'match-item', onclick: () => clickRight(j) },
        h('span', { class: 'match-badge' }), h('span', { class: 'md', html: MD.inline(pairs[j].right) })));
      leftBtns.forEach(b => leftCol.appendChild(b));
      rightBtns.forEach(b => rightCol.appendChild(b));
      const rightBtnOf = j => rightBtns[rightOrder.indexOf(j)];

      function paint() {
        const leftOf = new Map([...assign].map(([l, r]) => [r, l]));
        leftBtns.forEach((b, i) => {
          const has = assign.has(i);
          b.classList.toggle('paired', has);
          b.classList.toggle('selected', selected === i);
          b.classList.toggle('locked', locked.has(i));
          b.style.setProperty('--pair', has ? COLORS[i % COLORS.length] : 'transparent');
          b.querySelector('.match-badge').textContent = has ? String(i + 1) : '';
        });
        rightOrder.forEach((j, pos) => {
          const b = rightBtns[pos];
          const l = leftOf.get(j);
          const has = l !== undefined;
          b.classList.toggle('paired', has);
          b.classList.toggle('locked', has && locked.has(l));
          b.style.setProperty('--pair', has ? COLORS[l % COLORS.length] : 'transparent');
          b.querySelector('.match-badge').textContent = has ? String(l + 1) : '';
        });
        checkBtn.disabled = assign.size !== pairs.length;
      }

      function clickLeft(i) {
        if (locked.has(i)) return;
        // Clicar sempre seleciona (se já tinha par, o par é desfeito e o item fica selecionado).
        if (assign.has(i)) assign.delete(i);
        selected = i;
        Sound.click();
        paint();
      }

      function clickRight(j) {
        const owner = [...assign].find(([, r]) => r === j);
        if (owner && locked.has(owner[0])) return;
        if (owner) { assign.delete(owner[0]); Sound.click(); paint(); if (selected === null) return; }
        if (selected === null) { ctx.say('Primeiro escolha um item da **esquerda**.', { mood: 'neutral', wait: false }); return; }
        assign.set(selected, j);
        // Próximo item da esquerda ainda sem par vira o selecionado.
        const next = pairs.findIndex((_, i) => !assign.has(i));
        selected = next >= 0 ? next : null;
        Sound.click();
        paint();
      }

      selected = 0;
      paint();

      const stars = await new Promise(resolve => {
        checkBtn.onclick = () => {
          const wrongPairs = [...assign].filter(([l, r]) => l !== r);
          if (!wrongPairs.length) { resolve(Scoring.mcqStars(wrong)); return; }
          wrong++;
          Sound.wrong();
          for (const [l, r] of assign) if (l === r) locked.add(l);
          wrongPairs.forEach(([l, r]) => {
            [leftBtns[l], rightBtnOf(r)].forEach(b => { b.classList.add('flash-bad'); setTimeout(() => b.classList.remove('flash-bad'), 700); });
            assign.delete(l);
          });
          selected = pairs.findIndex((_, i) => !assign.has(i));
          paint();
          feedback.innerHTML = '';
          feedback.appendChild(h('div', { class: 'q-hint bad' }, `✗ ${wrongPairs.length} par(es) errado(s) foram desfeitos. Os certos ficaram travados.`));
          ctx.say(U.pick(ctx.lines('wrong')), { mood: 'concerned', wait: false });
        };
      });

      for (let i = 0; i < pairs.length; i++) locked.add(i);
      paint();
      checkBtn.remove();
      Sound.correct();
      feedback.innerHTML = '';
      feedback.appendChild(resultPanel(stars, stars === 3 ? 'Todos os pares certos de primeira!' : `Correto após ${wrong} tentativa(s).`,
        step.explanation ? h('div', { class: 'md', html: MD.render(step.explanation) }) : null));
      ctx.say(U.pick(ctx.lines(stars === 3 ? 'correct' : 'partial')), { mood: stars === 3 ? 'cheer' : 'neutral', wait: false });
      const reviews = wrong > 0 ? [{ text: step.review || step.explanation || 'Revise as associações.', concept: step.concept }] : [];
      const result = { stars, reviews };
      await ctx.continueButton(card, { result });
      return result;
    },
  });
})();
