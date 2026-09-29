/*
 * Etapa "mcq": múltipla escolha (uma ou várias corretas).
 *
 *   { type: 'mcq', say: 'fala do personagem', prompt: 'markdown',
 *     options: [{ text: 'markdown', correct: true, why: 'por que está certa/errada' }, ...],
 *     multiple: false, shuffle: false,
 *     explanation: 'markdown mostrado ao final', concept: 'Conceito', points: 10 }
 *
 * Estrelas: 3 de primeira, 2 na segunda tentativa, 1 depois disso.
 */
(function () {
  const { h } = U;
  const LETTERS = 'ABCDEFGH';

  function header(step, label) {
    return h('div', { class: 'q-head' },
      h('span', { class: 'q-badge' }, label),
      step.concept ? Widgets.concept(step.concept) : null,
      h('span', { class: 'q-points' }, `${Scoring.pointsFor(step)} XP`));
  }

  /** Painel de resultado com estrelas e texto — usado por todos os tipos de questão. */
  function resultPanel(stars, title, body) {
    // Depois de respondida, a explicação pode mostrar as definições do glossário.
    if (body) Glossary.decorate(body);
    return h('div', { class: `q-result r${stars}` },
      h('div', { class: 'q-result-head' }, Widgets.stars(stars, { animate: true }), h('strong', null, title)),
      body);
  }

  Game.registerStepType('mcq', {
    scored: true,
    async run(ctx, step) {
      const options = step.shuffle ? U.shuffle(step.options) : step.options.slice();
      const correctSet = new Set(options.map((o, i) => (o.correct ? i : -1)).filter(i => i >= 0));
      const multiple = step.multiple ?? correctSet.size > 1;
      let wrong = 0;
      const selected = new Set();

      const feedback = h('div', { class: 'q-feedback' });
      const buttons = options.map((opt, i) => h('button', {
        class: 'option',
        onclick: () => choose(i),
      },
      h('span', { class: 'opt-letter' }, multiple ? '☐' : LETTERS[i]),
      h('span', { class: 'opt-text md', html: MD.render(opt.text) })));

      const confirmBtn = multiple ? h('button', { class: 'btn btn-primary', onclick: () => confirm(), disabled: true }, 'Confirmar') : null;
      const actions = h('div', { class: 'q-actions' }, confirmBtn);

      const card = h('div', { class: 'card question' },
        header(step, multiple ? 'Múltipla escolha · várias corretas' : 'Múltipla escolha'),
        h('div', { class: 'q-prompt md', html: MD.render(step.prompt) }),
        h('div', { class: 'options' }, buttons),
        actions,
        feedback);
      ctx.stage.set(card);
      ctx.say(step.say || U.pick(ctx.lines('ask')), { mood: 'thinking', wait: false });

      let finish;
      const done = new Promise(r => { finish = r; });

      function choose(i) {
        if (card.classList.contains('answered')) return;
        if (multiple) {
          if (selected.has(i)) selected.delete(i); else selected.add(i);
          buttons[i].classList.toggle('selected', selected.has(i));
          buttons[i].querySelector('.opt-letter').textContent = selected.has(i) ? '☑' : '☐';
          confirmBtn.disabled = selected.size === 0;
          Sound.click();
          return;
        }
        if (buttons[i].classList.contains('wrong')) return;
        if (correctSet.has(i)) return win([i]);
        wrong++;
        buttons[i].classList.add('wrong');
        buttons[i].disabled = true;
        Sound.wrong();
        showWrong(options[i].why);
      }

      function confirm() {
        const ok = selected.size === correctSet.size && [...selected].every(i => correctSet.has(i));
        if (ok) return win([...selected]);
        wrong++;
        Sound.wrong();
        const hits = [...selected].filter(i => correctSet.has(i)).length;
        const extra = selected.size - hits;
        showWrong(`Você marcou ${hits} de ${correctSet.size} corretas${extra ? ` e ${extra} incorreta(s)` : ''}. Revise e tente de novo.`);
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 400);
      }

      function showWrong(why) {
        feedback.innerHTML = '';
        feedback.appendChild(h('div', { class: 'q-hint bad', html: `✗ ${MD.inline(why || 'Não é essa. Tente outra alternativa.')}` }));
        ctx.say(U.pick(ctx.lines('wrong')), { mood: 'concerned', wait: false });
      }

      function win(chosen) {
        card.classList.add('answered');
        buttons.forEach((b, i) => {
          b.disabled = true;
          if (correctSet.has(i)) b.classList.add('correct');
          else if (chosen.includes(i)) b.classList.add('wrong');
        });
        confirmBtn && confirmBtn.remove();
        Sound.correct();
        const stars = Scoring.mcqStars(wrong);
        const whys = options.map((o, i) => o.why ? { i, o } : null).filter(Boolean);
        feedback.innerHTML = '';
        feedback.appendChild(resultPanel(stars, stars === 3 ? 'Correto de primeira!' : `Correto após ${wrong} erro(s).`,
          h('div', null,
            step.explanation ? h('div', { class: 'md', html: MD.render(step.explanation) }) : null,
            whys.length ? h('details', { class: 'whys' },
              h('summary', null, 'Por que cada alternativa está certa ou errada'),
              h('ul', null, whys.map(({ i, o }) => h('li', { class: correctSet.has(i) ? 'ok' : 'no', html: `<b>${LETTERS[i]}.</b> ${MD.inline(o.why)}` })))) : null)));
        ctx.say(U.pick(ctx.lines(stars === 3 ? 'correct' : 'partial')), { mood: stars === 3 ? 'cheer' : 'neutral', wait: false });
        const reviews = wrong > 0 ? [{
          text: step.review || step.explanation || 'Revise este conceito.',
          concept: step.concept,
        }] : [];
        finish({ stars, reviews });
      }

      const result = await done;
      await ctx.continueButton(card, { result });
      return result;
    },
  });

  window.StepHelpers = Object.assign(window.StepHelpers || {}, { header, resultPanel });
})();
