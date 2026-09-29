/*
 * Painel "Perguntar à Lia": conversa com o assistente sobre o que está na tela.
 *
 *   const ask = AskPanel.create({ key, place: 'session'|'home', dialog, charView, getFocus, onToggle })
 *   ask.el (montar na tela) · ask.toggle(force?) · ask.destroy()
 *
 * A resposta chega aos poucos no painel (markdown completo, com código) e depois a Lia a FALA na caixa de
 * diálogo, como numa explicação: a fala que estava na caixa é suspensa e volta ao final (DialogBox.suspend).
 */
(function () {
  const { h } = U;
  const conversations = new Map(); // key -> [{ role: 'user'|'assistant', text }]  (vive enquanto o jogo está aberto)

  const SUGGESTIONS = {
    session: ['Explica de outro jeito?', 'Me dá um exemplo prático', 'Me dá uma dica (sem a resposta)', 'Por que isso cai em entrevista?'],
    home: ['Por onde eu começo?', 'O que eu devo revisar?', 'Qual trilha me prepara para entrevistas?'],
  };
  const THINKING = ['Hmm… deixa eu pensar.', 'Boa pergunta! Um instante…', 'Deixa eu ver…'];
  const BACKEND_LABEL = { cli: 'Claude local', api: 'API' };

  function create({ key, place, dialog, getFocus, onToggle }) {
    const messages = conversations.get(key) || [];
    conversations.set(key, messages);
    let isOpen = false;
    let abort = null;
    let handle = null;  // fala suspensa da Lia enquanto ela responde
    let speech = null;  // promessa da fala da interjeição em andamento
    let turn = 0;       // cada pergunta nova invalida as anteriores
    let focusTimer = null;

    const statusEl = h('span', { class: 'ask-status', dataset: { state: 'checking' } }, '…');
    const log = h('div', { class: 'ask-log', 'aria-live': 'polite' });
    const setup = h('div', { class: 'ask-setup', hidden: true });
    const input = h('textarea', { class: 'ask-input', rows: 2, maxlength: 4000,
      placeholder: place === 'home' ? 'Pergunte sobre as trilhas ou qualquer conceito…' : 'Pergunte sobre o que está na tela…' });
    const sendBtn = h('button', { class: 'btn btn-primary ask-send', type: 'submit', title: 'Enviar (Enter)', 'aria-label': 'Enviar' },
      Icons.el('send', { size: 16 }));
    const form = h('form', { class: 'ask-form', onsubmit: e => { e.preventDefault(); send(input.value); } }, input, sendBtn);
    const chips = h('div', { class: 'ask-chips' },
      SUGGESTIONS[place].map(t => h('button', { type: 'button', class: 'chip chip-btn', onclick: () => send(t) }, t)));
    const closeBtn = h('button', { class: 'icon-btn sm', title: 'Fechar (Esc)', 'aria-label': 'Fechar', onclick: () => toggle(false),
      html: Icons.html('x', { size: 15 }) });
    const el = h('aside', { class: `ask-panel ask-${place}`, hidden: true, 'aria-label': 'Perguntar à Lia' },
      h('div', { class: 'ask-head' },
        Icons.el('chat', { size: 17 }), h('strong', null, 'Pergunte à Lia'), statusEl, h('span', { class: 'spacer' }), closeBtn),
      setup, log, chips, form,
      h('div', { class: 'ask-hint' }, 'Enter envia · Shift+Enter quebra linha · Esc fecha · ? abre'));

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
      if (e.key === 'Escape') { e.preventDefault(); toggle(false); }
    });

    function onKey(e) {
      if (e.key !== '?' || e.ctrlKey || e.altKey || e.metaKey) return;
      if (U.isTypingTarget(document.activeElement) || document.querySelector('.modal-backdrop')) return;
      e.preventDefault();
      toggle();
    }
    document.addEventListener('keydown', onKey);

    // ── Mensagens ──
    function bubble(role, text, { pending = false } = {}) {
      const body = h('div', { class: 'ask-body md' });
      const node = h('div', { class: `ask-msg ${role} ${pending ? 'pending' : ''}` },
        role === 'assistant' ? h('span', { class: 'ask-who' }, 'Lia') : null, body);
      setText(node, text, role);
      log.appendChild(node);
      log.scrollTop = log.scrollHeight;
      return node;
    }

    function setText(node, text, role = 'assistant', final = false) {
      const body = node.querySelector('.ask-body');
      if (role === 'user') body.textContent = text;
      else body.innerHTML = text ? MD.render(text) : '<span class="ask-dots" aria-label="pensando"></span>';
      if (final && role === 'assistant') Glossary.decorate(body);
      const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
      if (nearBottom || final) log.scrollTop = log.scrollHeight;
    }

    function renderLog() {
      log.innerHTML = '';
      if (!messages.length) {
        log.appendChild(h('div', { class: 'ask-empty' },
          place === 'home'
            ? 'Pergunte sobre qualquer trilha, conceito ou por onde começar. A Lia conhece todo o conteúdo do jogo.'
            : 'Pergunte sobre o quadro, a questão ou o seu código. A Lia vê o que está na sua tela — e, se a questão ainda não foi respondida, dá pistas em vez da resposta.'));
        return;
      }
      for (const m of messages) setText(bubble(m.role, m.text), m.text, m.role, true);
    }

    // ── Status / configuração ──
    async function refreshStatus(force = false) {
      const st = await AssistantAPI.status({ refresh: force });
      if (st.offline) {
        statusEl.dataset.state = 'off';
        statusEl.textContent = 'sem servidor';
      } else if (st.active) {
        statusEl.dataset.state = st.active;
        statusEl.textContent = `${BACKEND_LABEL[st.active]} · ${(st.models[st.model] || '').replace('Claude ', '')}`;
      } else {
        statusEl.dataset.state = 'off';
        statusEl.textContent = 'indisponível';
      }
      statusEl.title = st.active === 'cli' ? `Claude Code local (${st.cli.path}) — usa o plano da sua conta`
        : st.active === 'api' ? `Chave de API (${st.api.hint})` : 'Nenhum acesso ao Claude configurado';
      renderSetup(st);
      return st;
    }

    function renderSetup(st) {
      setup.hidden = !!st.active;
      form.hidden = chips.hidden = !st.active;
      if (st.active) return;
      setup.innerHTML = '';
      if (st.offline) {
        setup.append(h('p', null, 'O assistente precisa do servidor do jogo. Abra o jogo pelo atalho da área de trabalho ',
          h('code', null, 'tools/iniciar.bat'), ' (ou ', h('code', null, 'python tools/serve.py'), ').'));
      } else {
        setup.append(
          h('p', null, 'Não encontrei acesso ao Claude neste computador. Escolha um:'),
          h('ul', null,
            h('li', { html: '<b>Seu plano do Claude:</b> instale o Claude Code e faça login rodando <code>claude</code> num terminal. O jogo usa <code>claude -p</code>.' }),
            h('li', { html: '<b>Chave de API:</b> informe em Configurações → Assistente (ou na variável <code>ANTHROPIC_API_KEY</code>).' })),
          h('div', { class: 'row-gap' },
            h('button', { class: 'btn btn-sm', type: 'button', onclick: () => App.openSettings('assistant') }, Icons.el('settings', { size: 14 }), 'Configurações'),
            h('button', { class: 'btn btn-sm', type: 'button', onclick: () => refreshStatus(true) }, Icons.el('review', { size: 14 }), 'Verificar de novo')));
      }
    }

    // ── Pergunta → resposta falada ──
    async function send(raw) {
      const question = String(raw || '').trim();
      if (!question) return;
      const st = await refreshStatus();
      if (!st.active) return;
      const myTurn = ++turn;
      if (abort) abort.abort();
      clearTimeout(focusTimer);
      input.value = '';
      input.blur(); // Espaço/Enter voltam a avançar as falas da Lia
      if (!messages.length) log.innerHTML = '';
      messages.push({ role: 'user', text: question });
      bubble('user', question);
      const answerNode = bubble('assistant', '', { pending: true });
      el.classList.add('busy');

      // A Lia suspende o que estava dizendo (a aula volta depois) e pensa.
      if (!handle || !handle.alive) handle = await dialog.suspend();
      if (myTurn !== turn) return;
      dialog.el.classList.add('thinking');
      say([{ text: U.pick(THINKING), mood: 'thinking' }], { wait: false });

      const focus = getFocus();
      const context = AssistantContext.buildContext(focus, question);
      const history = messages.slice(0, -1).slice(-8);
      abort = new AbortController();
      let text = '';
      let renderTimer = null;
      const flushRender = () => { renderTimer = null; setText(answerNode, text); };
      try {
        await AssistantAPI.ask({ question, context, history }, ev => {
          if (ev.type === 'delta') {
            text += ev.text;
            if (!renderTimer) renderTimer = setTimeout(flushRender, 70);
          }
        }, abort.signal);
        if (myTurn !== turn) return;
        clearTimeout(renderTimer);
        el.classList.remove('busy');
        answerNode.classList.remove('pending');
        setText(answerNode, text, 'assistant', true);
        messages.push({ role: 'assistant', text });
        dialog.el.classList.remove('thinking');
        await speak(AssistantContext.toSpeech(text).map(t => ({ text: t, mood: 'neutral' })), myTurn);
      } catch (e) {
        clearTimeout(renderTimer);
        if (e.name === 'AbortError' || myTurn !== turn) {
          answerNode.classList.remove('pending');
          if (!text) answerNode.remove();
          return;
        }
        el.classList.remove('busy');
        answerNode.classList.remove('pending');
        answerNode.classList.add('error');
        setText(answerNode, `**Não consegui responder.** ${e.message}`, 'assistant', true);
        messages.pop(); // a pergunta sem resposta não entra no histórico enviado ao modelo
        dialog.el.classList.remove('thinking');
        await speak([{ text: 'Ops… não consegui responder agora. Veja o motivo no painel.', mood: 'concerned' }], myTurn);
      }
    }

    /** Fala pela interjeição, uma de cada vez: encerra a fala anterior e espera ela terminar. */
    async function say(lines, opts) {
      // Se a aula seguiu enquanto a Lia pensava (outra fala assumiu a caixa), ela suspende a fala nova e responde.
      if (!handle || !handle.alive) {
        handle = await dialog.suspend();
        speech = null;
      }
      if (speech) {
        handle.stop();
        await speech;
      }
      if (!handle.alive) return 'cancel';
      const p = handle.speak(lines, opts);
      speech = p;
      const result = await p;
      if (speech === p) speech = null;
      return result;
    }

    /** Fala a resposta e, se ninguém perguntou outra coisa nesse meio-tempo, devolve a aula. */
    async function speak(lines, myTurn) {
      if (myTurn !== turn) return;
      await say(lines);
      if (myTurn !== turn || !handle || !handle.alive) return;
      handle.resume();
      handle = null;
    }

    function toggle(force) {
      isOpen = typeof force === 'boolean' ? force : !isOpen;
      el.hidden = !isOpen;
      if (onToggle) onToggle(isOpen);
      if (isOpen) {
        refreshStatus();
        log.scrollTop = log.scrollHeight;
        clearTimeout(focusTimer);
        focusTimer = setTimeout(() => input.focus({ preventScroll: true }), 30);
      }
    }

    renderLog();

    return {
      el,
      toggle,
      get open() { return isOpen; },
      destroy() {
        turn++;
        if (abort) abort.abort();
        document.removeEventListener('keydown', onKey);
      },
    };
  }

  window.AskPanel = { create };
})();
