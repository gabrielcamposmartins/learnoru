/*
 * Etapa "open": resposta aberta, corrigida por rubrica de palavras-chave.
 *
 *   { type: 'open', say, prompt: 'markdown', placeholder,
 *     rubric: [{ label: 'Cita baixo acoplamento', keywords: ['acoplamento', ['depende', 'abstra']], concept, why }],
 *     minWords: 8, modelAnswer: 'markdown', concept, points: 20 }
 *
 * Cada item da rubrica é coberto se QUALQUER keyword aparecer na resposta.
 * Uma keyword que é um array exige que TODAS as partes apareçam.
 * A comparação ignora maiúsculas e acentos e aceita prefixos ("desacopl" casa "desacoplado").
 */
(function () {
  const { h, normalize } = U;
  const { header, resultPanel } = StepHelpers;

  function covers(answerNorm, keywords) {
    return keywords.some(k => Array.isArray(k)
      ? k.every(part => answerNorm.includes(normalize(part)))
      : answerNorm.includes(normalize(k)));
  }

  Game.registerStepType('open', {
    scored: true,
    async run(ctx, step) {
      const minWords = step.minWords ?? 8;
      const ta = h('textarea', { class: 'open-input', rows: 7, placeholder: step.placeholder || 'Escreva sua resposta como se estivesse explicando em uma entrevista…' });
      const counter = h('span', { class: 'muted small' }, '0 palavras');
      const feedback = h('div', { class: 'q-feedback' });
      const submit = h('button', { class: 'btn btn-primary' }, 'Enviar resposta');
      const idk = h('button', { class: 'btn btn-ghost' }, 'Não sei');

      const card = h('div', { class: 'card question' },
        header(step, 'Resposta aberta'),
        h('div', { class: 'q-prompt md', html: MD.render(step.prompt) }),
        ta,
        h('div', { class: 'q-actions' }, counter, h('span', { class: 'spacer' }), idk, submit),
        feedback);
      ctx.stage.set(card);
      ctx.say(step.say || U.pick(ctx.lines('askOpen')), { mood: 'neutral', wait: false });
      setTimeout(() => ta.focus(), 50);

      const words = () => ta.value.trim().split(/\s+/).filter(Boolean).length;
      ta.addEventListener('input', () => { counter.textContent = `${words()} palavras`; });

      const answer = await new Promise(resolve => {
        submit.onclick = () => {
          if (words() < minWords) {
            feedback.innerHTML = '';
            feedback.appendChild(h('div', { class: 'q-hint warn' }, `Desenvolva um pouco mais (mínimo ${minWords} palavras). Explique o porquê, como faria numa entrevista.`));
            ctx.say('Pode desenvolver mais um pouco? Quero entender seu raciocínio.', { mood: 'thinking', wait: false });
            return;
          }
          resolve(ta.value);
        };
        idk.onclick = () => resolve(null);
        ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit.onclick(); });
      });

      ta.readOnly = true;
      submit.remove();
      idk.remove();

      const norm = normalize(answer || '');
      const rubric = step.rubric || [];
      const checks = rubric.map(item => ({ item, ok: answer ? covers(norm, item.keywords || []) : false }));
      const covered = checks.filter(c => c.ok).length;
      const ratio = rubric.length ? covered / rubric.length : (answer ? 1 : 0);
      const stars = Scoring.openStars(ratio);
      stars >= 2 ? Sound.correct() : Sound.wrong();

      feedback.innerHTML = '';
      feedback.appendChild(resultPanel(stars,
        answer ? `Você cobriu ${covered} de ${rubric.length} pontos-chave.` : 'Sem resposta — veja a resposta modelo.',
        h('div', null,
          h('ul', { class: 'rubric' }, checks.map(({ item, ok }) => h('li', { class: ok ? 'ok' : 'no' },
            h('span', { class: 'rb-icon' }, ok ? '✓' : '✗'),
            h('div', null,
              h('div', { html: MD.inline(item.label) }),
              !ok && item.why ? h('div', { class: 'muted small', html: MD.inline(item.why) }) : null,
              !ok && item.concept ? Widgets.concept(item.concept) : null)))),
          h('details', { class: 'model-answer', open: stars < 3 },
            h('summary', null, 'Resposta modelo'),
            h('div', { class: 'md', html: MD.render(step.modelAnswer || '') })),
          h('p', { class: 'muted small' }, 'A correção automática procura as ideias-chave pelas palavras usadas — compare também com a resposta modelo.'))));

      ctx.say(U.pick(ctx.lines(stars === 3 ? 'correct' : stars === 2 ? 'partial' : 'wrong')),
        { mood: stars === 3 ? 'cheer' : stars === 2 ? 'neutral' : 'concerned', wait: false });

      const reviews = checks.filter(c => !c.ok).map(({ item }) => ({
        text: `Faltou: ${item.label}${item.why ? ` — ${item.why}` : ''}`,
        concept: item.concept || step.concept,
      }));

      const result = { stars, reviews };
      await ctx.continueButton(card, { result });
      return result;
    },
  });
})();
