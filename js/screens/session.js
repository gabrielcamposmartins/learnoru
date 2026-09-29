/*
 * Tela de sessão (modo foco): personagem (busto) + quadro/área de trabalho + caixa de diálogo.
 * Executa as etapas do módulo em sequência e acumula pontuação, reviews e conquistas.
 */
(function () {
  const { h } = U;

  const DEFAULT_LINES = {
    ask: ['Me diz uma coisa…', 'Qual alternativa você escolheria?', 'Pensa com calma e escolhe.'],
    askOpen: ['Explica pra mim com suas palavras.', 'Como você responderia isso numa entrevista?'],
    askCode: ['Mão no código! Os testes vão dizer se está certo.', 'Sua vez de implementar. Pode rodar os exemplos antes de enviar.'],
    correct: ['Excelente!', 'Isso mesmo!', 'Perfeito, é exatamente isso.', 'Mandou bem!'],
    partial: ['Chegou lá! Veja o que dá para melhorar.', 'Bom! Só alguns detalhes para lapidar.'],
    wrong: ['Hmm, não exatamente. Tente de novo.', 'Quase… pensa mais um pouco.', 'Não é essa. Releia o enunciado com calma.'],
    codeError: ['Seu código lançou um erro. Leia a mensagem com calma — ela diz a linha.', 'Deu erro na execução. Vamos depurar?'],
    testsFail: ['Alguns testes falharam. Compare o esperado com o obtido.', 'Ainda não. Olhe os testes que falharam — especialmente os casos de borda.'],
  };

  const TYPE_ICON = { mcq: 'target', open: 'notebook', code: 'code', sql: 'layers', pytest: 'check', tdd: 'review', order: 'menu', match: 'grid' };

  Game.registerScreen('session', {
    render(root, { trackId, moduleId }, App) {
      const track = Game.getTrack(trackId);
      const mod = Game.getModule(trackId, moduleId);
      if (!track || !mod) { App.go('home'); return; }
      const charDef = Game.castFor(track, mod);
      const side = charDef.side || 'left';
      Store.touchModule(trackId, moduleId);

      const charView = CharacterView.create(charDef);
      const dialog = DialogBox.create(charView);
      const stageInner = h('div', { class: 'stage-inner' });
      const stage = h('section', { class: 'stage', 'aria-label': 'Quadro' }, stageInner);

      const scoredSteps = mod.steps.filter(s => Game.isScoredStep(s));
      const trackerDots = scoredSteps.map(s => h('span', { class: 'qdot', title: s.title || s.concept || '', html: Icons.html(TYPE_ICON[s.type] || 'target', { size: 12 }) }));
      const segments = mod.steps.map(() => h('span', { class: 'seg' }));
      const timerEl = h('span', { class: 'session-timer' });

      const top = h('div', { class: 'session-top' },
        h('button', { class: 'icon-btn exit-btn', title: 'Sair da sessão', 'aria-label': 'Sair da sessão', onclick: () => confirmExit(), html: Icons.html('x', { size: 18 }) }),
        h('div', { class: 'session-title' },
          Widgets.trackIcon(track, 30),
          h('div', { class: 'st-text' },
            h('span', { class: 'st-track' }, track.title),
            h('span', { class: 'st-module' }, mod.title)),
          Widgets.kindBadge(mod.kind)),
        h('div', { class: 'session-progress', title: 'Progresso da sessão' }, segments),
        h('div', { class: 'qdots', title: 'Questões' }, trackerDots),
        mod.kind === 'interview' ? timerEl : null,
        h('button', { class: 'btn btn-sm ask-toggle', title: 'Perguntar à Lia sobre o que está na tela (?)', onclick: () => ask.toggle() },
          Icons.el('chat', { size: 15 }), h('span', null, 'Perguntar à Lia')));

      const charCol = h('aside', { class: 'char-col' }, charView.el,
        h('div', { class: 'char-plate' }, h('strong', null, charDef.name), h('span', null, charDef.role)));

      // A instrutora ocupa a coluna inteira (toda a altura abaixo do topo); quadro e diálogo dividem a outra.
      // O painel "Perguntar à Lia" abre como uma coluna entre os dois.
      const work = h('div', { class: 'session-work' }, stage, dialog.el);
      const main = h('div', { class: `session-main ${side === 'right' ? 'char-right' : ''}` }, charCol, work);
      const ask = AskPanel.create({
        key: `${trackId}/${moduleId}`, place: 'session', dialog, charView,
        getFocus: () => sessionFocus(),
        onToggle: open => main.classList.toggle('ask-open', open),
      });
      main.appendChild(ask.el);
      const screen = h('div', { class: 'session', style: { '--track-color': track.color, '--c': track.color } }, top, main);
      root.appendChild(screen);

      // Pré-carrega o Python se o módulo tiver código.
      if (mod.steps.some(s => ['code', 'pytest', 'tdd', 'sql'].includes(s.type))) PyRunner.warmup();

      // Cronômetro de entrevista (num checkpoint retomado, desconta o tempo já jogado).
      let startedAt = Date.now();
      let timerInt = null;
      if (mod.kind === 'interview') {
        const tick = () => { timerEl.innerHTML = ''; timerEl.append(Icons.el('clock', { size: 14 }), ` ${U.formatTime((Date.now() - startedAt) / 1000)}`); };
        tick();
        timerInt = setInterval(tick, 1000);
      }

      let alive = true;
      const results = [];
      let currentIndex = 0;

      /** O que está em foco na tela, para o assistente. */
      function sessionFocus() {
        const step = mod.steps[currentIndex];
        const scoredNow = !!(step && Game.isScoredStep(step));
        const code = [...stageInner.querySelectorAll('.CodeMirror')].map((cmEl, k) => {
          const label = cmEl.closest('.editor-host')?.previousElementSibling?.classList.contains('file-label')
            ? cmEl.closest('.editor-host').previousElementSibling.textContent.trim() : `editor ${k + 1}`;
          return { label, text: cmEl.CodeMirror ? cmEl.CodeMirror.getValue() : '' };
        });
        stageInner.querySelectorAll('textarea.code-fallback, textarea.open-input').forEach((ta, k) => {
          if (ta.value.trim()) code.push({ label: ta.classList.contains('open-input') ? 'resposta do aluno' : `editor ${k + 1}`, text: ta.value });
        });
        return {
          kind: 'session', track, module: mod,
          stepIndex: currentIndex, stepCount: mod.steps.length, stepType: step && step.type,
          activity: scoredNow ? scoredSteps.indexOf(step) + 1 : null, activityCount: scoredSteps.length,
          unanswered: scoredNow && !(current && current.committed),
          stageText: stageInner.innerText,
          code,
          speech: dialog.recent(4),
          done: results.map(r => `${r.title} (${r.stars}★)`),
        };
      }

      function setStage(node) {
        stageInner.innerHTML = '';
        node.classList.add('enter');
        stageInner.appendChild(node);
        stage.scrollTop = 0;
      }

      const ctx = {
        track, module: mod, character: charDef, charView, dialog,
        /** Estado compartilhado entre etapas da sessão (ex.: código de um kata de TDD entre ciclos). */
        shared: {},
        say: (lines, opts) => alive ? dialog.say(lines, opts) : Promise.resolve('cancel'),
        /**
         * Navegação da etapa de explicação atual (definida pela sessão):
         * { canBackOut, seen, startAtEnd, revisit }. null nas questões.
         */
        nav: null,
        /** Fala de explicação: aceita voltar/pular. Devolve 'done' | 'back' | 'skip' | 'cancel'. */
        explain: (lines, opts) => ctx.say(lines, Object.assign({}, ctx.nav, opts)),
        lines(kind) {
          const custom = charDef.lines && charDef.lines[kind];
          return custom && custom.length ? custom : DEFAULT_LINES[kind] || ['…'];
        },
        stage: {
          el: stageInner,
          set: setStage,
          idle() {
            setStage(h('div', { class: 'card stage-idle' },
              Widgets.trackIcon(track, 72),
              h('div', { class: 'stage-idle-title' }, mod.title),
              mod.summary ? h('div', { class: 'muted' }, mod.summary) : null));
          },
        },
        /**
         * Botão "Continuar" ao fim de uma questão.
         * opts.result: o resultado final da questão — a sessão já salva o checkpoint, então quem
         * fecha o jogo antes de clicar em "Continuar" não perde a atividade.
         */
        continueButton(card, opts = {}) {
          if (typeof opts === 'string') opts = { label: opts };
          if (opts.result) commit(opts.result);
          return new Promise(resolve => {
            const btn = h('button', { class: 'btn btn-primary btn-continue' }, opts.label || 'Continuar', Icons.el('arrowRight', { size: 16 }));
            btn.onclick = () => { Sound.click(); btn.disabled = true; resolve(); };
            card.appendChild(h('div', { class: 'q-actions continue-row' }, btn));
            setTimeout(() => btn.focus({ preventScroll: true }), 50);
          });
        },
      };

      // O progresso é salvo a cada atividade: só pede confirmação se houver uma atividade em andamento.
      async function confirmExit() {
        if (!current || current.committed) { App.go('track', { trackId }); return; }
        const n = results.length;
        const saved = n ? `${n === 1 ? 'A atividade já concluída fica salva' : `As ${n} atividades já concluídas ficam salvas`}. ` : '';
        U.modal('Sair da atividade?', h('p', null, `${saved}Esta atividade ainda não foi concluída: da próxima vez você recomeça a partir dela.`), {
          actions: [
            { label: 'Continuar jogando', onClick: () => {} },
            { label: 'Sair', onClick: () => App.go('track', { trackId }) },
          ],
        });
      }

      // ── Checkpoints ──
      // Salvos ao começar e ao concluir cada atividade. A assinatura descarta checkpoints de uma versão
      // anterior do módulo (etapas adicionadas/removidas mudariam o significado do índice).
      const signature = hashString(mod.steps.map(s => `${s.type}:${s.id || ''}`).join('|'));
      let current = null; // questão em andamento: { i, step, committed }

      function saveCheckpoint(index) {
        if (index <= 0 || index >= mod.steps.length) return;
        Store.saveCheckpoint(trackId, moduleId, {
          sig: signature,
          index,
          results: results.slice(),
          shared: JSON.parse(JSON.stringify(ctx.shared)),
          elapsed: Math.round((Date.now() - startedAt) / 1000),
          total: scoredSteps.length,
        });
      }

      function paintDot(qIndex, stars) {
        const dot = trackerDots[qIndex];
        if (dot) { dot.className = `qdot s${stars}`; dot.innerHTML = stars ? Icons.html('starFill', { size: 12 }) : '·'; }
      }

      /** Registra o resultado da questão em andamento (uma vez só) e salva o checkpoint seguinte. */
      function commit(res) {
        if (!current || current.committed || !res) return;
        current.committed = true;
        const { i, step } = current;
        const qIndex = scoredSteps.indexOf(step);
        paintDot(qIndex, res.stars);
        results.push({
          stepId: step.id,
          qIndex,
          type: step.type,
          title: step.title || firstLine(step.prompt),
          concept: step.concept,
          stars: res.stars,
          xp: Scoring.xpFor(step, res.stars),
          maxXp: Scoring.pointsFor(step),
          reviews: res.reviews || [],
          flags: res.flags || [],
          hintsUsed: res.hintsUsed || 0,
        });
        Store.recordAnswer({ perfect: res.stars === 3 });
        saveCheckpoint(i + 1);
      }

      /** Checkpoint válido deste módulo, ou null (descarta os que não servem mais). */
      function loadCheckpoint() {
        const cp = Store.checkpoint(trackId, moduleId);
        if (!cp) return null;
        const valid = cp.sig === signature && cp.index > 0 && cp.index < mod.steps.length && Array.isArray(cp.results);
        if (!valid) {
          Store.clearCheckpoint(trackId, moduleId);
          if (cp.sig !== signature) U.toast('Este módulo mudou desde a sua última visita — começando do início.');
          return null;
        }
        return cp;
      }

      /** Pergunta se o jogador quer continuar do checkpoint. Resolve true (continuar) ou false (recomeçar). */
      function askResume(cp) {
        return new Promise(resolve => {
          const done = cp.results.length;
          const total = scoredSteps.length;
          const nextQ = mod.steps.slice(cp.index).find(s => Game.isScoredStep(s));
          const nextNum = nextQ ? scoredSteps.indexOf(nextQ) + 1 : null;
          const choose = answer => { Sound.click(); resolve(answer); };
          const continueBtn = h('button', { class: 'btn btn-primary btn-continue', onclick: () => choose(true) },
            Icons.el('play', { size: 16 }), nextNum ? `Continuar da atividade ${nextNum}` : 'Continuar');
          const restartBtn = h('button', { class: 'btn', onclick: () => choose(false) },
            Icons.el('review', { size: 15 }), 'Recomeçar do início');
          setStage(h('div', { class: 'card resume-card' },
            Widgets.trackIcon(track, 64),
            h('div', { class: 'resume-title' }, 'Continuar de onde parou?'),
            h('p', { class: 'resume-sub' }, done
              ? `Você já concluiu ${done} de ${total} atividade${total > 1 ? 's' : ''} deste módulo.`
              : `Você já viu a explicação e parou na atividade ${nextNum} de ${total}.`),
            done ? h('ul', { class: 'resume-list' }, cp.results.map(r => h('li', null,
              Widgets.stars(r.stars, { size: 'sm' }), h('span', null, r.title)))) : null,
            h('div', { class: 'q-actions resume-actions' }, continueBtn, restartBtn)));
          ctx.say(done
            ? `Que bom te ver de volta! Você já fez **${done}** atividade${done > 1 ? 's' : ''} aqui. Continuamos de onde parou?`
            : 'Você já passou pela explicação deste módulo. Quer ir direto para as atividades?', { mood: 'happy', wait: false });
          setTimeout(() => continueBtn.focus({ preventScroll: true }), 50);
        });
      }

      async function start() {
        const cp = loadCheckpoint();
        if (cp && await askResume(cp)) {
          results.push(...cp.results);
          cp.results.forEach(r => paintDot(r.qIndex ?? scoredSteps.findIndex(s => s.id === r.stepId), r.stars));
          ctx.shared = cp.shared || {};
          startedAt = Date.now() - (cp.elapsed || 0) * 1000;
          return runSession(cp.index);
        }
        if (cp) Store.clearCheckpoint(trackId, moduleId);
        startedAt = Date.now();
        return runSession(0);
      }

      function markSegments(i) {
        segments.forEach((s, k) => {
          s.classList.toggle('done', k < i);
          s.classList.toggle('current', k === i);
        });
      }

      // Etapas de explicação (say, section…) formam blocos contínuos entre as questões.
      // Dentro de um bloco o jogador pode voltar; "Pular" leva à próxima atividade.
      const isTeaching = k => {
        const t = mod.steps[k] && Game.getStepType(mod.steps[k].type);
        return !!(t && t.teaching);
      };
      const blockStart = k => { while (k > 0 && isTeaching(k - 1)) k--; return k; };
      const blockEnd = k => { while (k < mod.steps.length && isTeaching(k)) k++; return k; };

      const SKIP_LINES = [
        'Pulando a explicação? Hunf… tudo bem. Mas depois não diga que eu não avisei!',
        'Ei! Eu preparei esse quadro com tanto carinho… Tá bom, direto para a prática.',
        'Pular, é? Confiante, hein. Vamos ver se funciona!',
      ];
      let scolded = false;

      async function reactToSkip() {
        if (scolded) return;
        scolded = true;
        await ctx.say({ text: U.pick(SKIP_LINES), mood: 'angry' }, { wait: false });
        if (alive) await U.sleep(700);
      }

      const visited = new Set();
      const stageAt = [];

      function restoreStage(node) {
        stageInner.innerHTML = '';
        stageInner.appendChild(node);
      }

      /** Executa uma etapa de explicação e devolve o índice da próxima etapa. */
      async function runTeaching(i, type, fromBack) {
        const start = blockStart(i);
        const revisit = visited.has(i);
        ctx.nav = { canBackOut: i > start, seen: revisit, startAtEnd: fromBack, revisit };
        const pending = type.run(ctx, mod.steps[i]);
        // A parte síncrona de run já montou o quadro; numa revisita, volta o quadro que estava na tela.
        if (revisit && stageAt[i]) restoreStage(stageAt[i]);
        visited.add(i);
        const res = await pending;
        ctx.nav = null;
        stageAt[i] = stageInner.firstElementChild;
        const nav = res && res.nav;
        if (nav === 'back' && i > start) return { next: i - 1, fromBack: true };
        if (nav === 'skip') {
          await reactToSkip();
          return { next: blockEnd(i) };
        }
        return { next: i + 1 };
      }

      async function runSession(from = 0) {
        if (!alive) return;
        ctx.stage.idle();
        let i = from;
        let fromBack = false;
        while (i < mod.steps.length) {
          if (!alive) return;
          currentIndex = i;
          const step = mod.steps[i];
          const type = Game.getStepType(step.type);
          markSegments(i);
          if (!type) {
            console.warn(`[Game] Tipo de etapa desconhecido: ${step.type}`);
            i++;
            continue;
          }
          if (type.teaching) {
            const r = await runTeaching(i, type, fromBack);
            if (!alive) return;
            i = r.next;
            fromBack = !!r.fromBack;
            continue;
          }
          fromBack = false;
          const qIndex = scoredSteps.indexOf(step);
          if (qIndex >= 0) trackerDots[qIndex].classList.add('current');
          current = { i, step, committed: false };
          saveCheckpoint(i);
          const res = await type.run(ctx, step);
          if (!alive) return;
          if (type.scored) commit(res);
          current = null;
          i++;
        }
        if (!alive) return;
        markSegments(mod.steps.length);
        finish();
      }

      function finish() {
        const stars = Scoring.moduleStars(results.map(r => r.stars));
        const xp = results.reduce((a, r) => a + r.xp, 0) + Scoring.moduleBonus(stars);
        const reviews = results.flatMap(r => r.reviews.map(rv => Object.assign({ question: r.title }, rv)));
        const questions = Object.fromEntries(results.map(r => [r.stepId, r.stars]));
        const flags = results.flatMap(r => r.flags);
        if (stars === 3 && results.every(r => !r.hintsUsed)) flags.push('module-perfect-no-hints');
        const levelBefore = Scoring.level(Store.totalXp()).level;
        const saved = Store.recordSession(trackId, moduleId, { stars, xp, reviews, questions, flags });
        const unlocked = Achievements.check({ notify: false });
        const levelAfter = Scoring.level(Store.totalXp()).level;
        App.go('results', {
          trackId, moduleId,
          summary: {
            stars, xp, results, reviews, unlocked,
            levelUp: levelAfter > levelBefore ? levelAfter : null,
            maxXp: Scoring.maxXpForModule(mod),
            elapsed: (Date.now() - startedAt) / 1000,
            xpGained: saved.xpGained,
            newRecord: saved.newRecord,
            previousBest: saved.previousBest,
          },
        });
      }

      start().catch(err => {
        console.error(err);
        U.toast('Erro ao executar a sessão: ' + err.message, 'bad', 5000);
      });

      return () => {
        alive = false;
        clearInterval(timerInt);
        ask.destroy();
        dialog.destroy();
        charView.destroy();
      };
    },
  });

  /** Hash curto (djb2) para a assinatura do módulo. */
  function hashString(str) {
    let hsh = 5381;
    for (let k = 0; k < str.length; k++) hsh = ((hsh << 5) + hsh + str.charCodeAt(k)) | 0;
    return (hsh >>> 0).toString(36);
  }

  function firstLine(md) {
    if (!md) return 'Questão';
    const line = String(md).split('\n').find(l => l.trim() && !l.startsWith('```')) || 'Questão';
    const clean = line.replace(/[#*`>]/g, '').trim();
    return clean.length > 90 ? clean.slice(0, 87) + '…' : clean;
  }
})();
