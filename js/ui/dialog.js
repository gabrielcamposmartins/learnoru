/*
 * Caixa de diálogo estilo RPG/visual novel: o texto sai letra por letra,
 * clique/Espaço/Enter/→ completa a frase ou avança para a próxima.
 *
 * Navegação (nas falas que esperam o jogador):
 *   ← / botão "Voltar"        volta uma fala (falas já vistas aparecem inteiras, sem redigitar)
 *   Shift+→ / botão "Pular"   pula o restante da explicação
 * say() devolve 'done' | 'back' | 'skip' | 'cancel' para quem chamou decidir o que fazer
 * (a sessão usa 'back' para voltar à etapa anterior e 'skip' para ir à próxima atividade).
 */
(function () {
  const { h, escapeHtml, sleep } = U;
  const SPEEDS = { slow: 34, normal: 20, fast: 9, instant: 0 };

  const DialogBox = {
    create(characterView) {
      const def = characterView.def;
      const textEl = h('div', { class: 'dialog-text', 'aria-live': 'polite' });
      const nextEl = h('div', { class: 'dialog-next', 'aria-hidden': 'true' }, h('span', { class: 'dn-label' }, 'continuar'), h('kbd', null, 'Espaço'));
      const history = [];

      const logBtn = h('button', {
        class: 'dialog-log-btn', title: 'Histórico de falas', 'aria-label': 'Histórico de falas',
        onclick: e => { e.stopPropagation(); showHistory(); },
        html: Icons.html('notebook', { size: 15 }),
      });
      const backBtn = h('button', {
        class: 'dialog-nav-btn', title: 'Voltar uma fala (←)', 'aria-label': 'Voltar uma fala',
        onclick: e => { e.stopPropagation(); if (e.detail) e.currentTarget.blur(); requestNav('back'); },
      }, Icons.el('chevronLeft', { size: 15 }), h('span', null, 'Voltar'));
      const skipBtn = h('button', {
        class: 'dialog-nav-btn nav-skip', title: 'Pular a explicação (Shift + →)', 'aria-label': 'Pular a explicação',
        onclick: e => { e.stopPropagation(); if (e.detail) e.currentTarget.blur(); requestNav('skip'); },
      }, h('span', null, 'Pular'), Icons.el('forward', { size: 15 }));
      const navEl = h('div', { class: 'dialog-nav' }, backBtn, skipBtn);

      const el = h('div', { class: 'dialog', role: 'region', 'aria-label': `Fala de ${def.name}` },
        h('div', { class: 'dialog-name' }, def.name, h('span', { class: 'dialog-role' }, def.role)),
        logBtn,
        textEl,
        h('div', { class: 'dialog-foot' }, navEl, nextEl));

      let gen = 0;
      let typing = false;
      let skip = false;           // completa a linha que está sendo digitada
      let pendingNav = null;      // 'back' | 'skip' pedido durante a digitação
      let actionResolver = null;  // resolve a espera entre falas com 'next' | 'back' | 'skip' | 'cancel'
      let nav = null;             // { canBack() } enquanto uma fala navegável está ativa
      let backOnly = false;       // última linha de uma fala wait=false: só aceita "Voltar"
      let lastBlip = 0;

      el.addEventListener('click', e => { if (!e.target.closest('.dialog-nav')) advance(); });

      function onKey(e) {
        if (U.isTypingTarget(document.activeElement)) return;
        if (document.querySelector('.modal-backdrop')) return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        if (e.key === 'ArrowLeft' && !e.shiftKey) {
          if (!nav) return;
          e.preventDefault();
          requestNav('back');
          return;
        }
        if (e.key === 'ArrowRight' && e.shiftKey) {
          if (!nav) return;
          e.preventDefault();
          requestNav('skip');
          return;
        }
        if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'ArrowRight') return;
        // Botões focados tratam o Enter/Espaço normalmente.
        if (e.key !== 'ArrowRight' && document.activeElement && document.activeElement.tagName === 'BUTTON' && !el.contains(document.activeElement)) return;
        if (!typing && (!actionResolver || backOnly)) return;
        e.preventDefault();
        advance();
      }
      document.addEventListener('keydown', onKey);

      function resolveAction(action) {
        if (!actionResolver) return false;
        const r = actionResolver;
        actionResolver = null;
        r(action);
        return true;
      }

      function advance() {
        if (typing) { skip = true; return; }
        if (backOnly) return;
        if (resolveAction('next')) Sound.click();
      }

      function requestNav(kind) {
        if (!nav) return;
        if (kind === 'back' && !nav.canBack()) return;
        if (kind === 'skip' && backOnly) return;
        Sound.click();
        if (typing) { pendingNav = kind; skip = true; return; }
        resolveAction(kind);
      }

      function setNav(state) {
        nav = state;
        el.classList.toggle('navigable', !!state);
        if (state) backBtn.disabled = !state.canBack();
      }

      function renderFull(segs) {
        textEl.innerHTML = segs.map(s => s.tag ? `<${s.tag}>${escapeHtml(s.text)}</${s.tag}>` : escapeHtml(s.text)).join('');
      }

      /** Digita a linha. Devolve true se ela foi mostrada inteira (e não interrompida por navegação). */
      async function typeLine(text, myGen) {
        const segs = MD.segments(text);
        textEl.innerHTML = '';
        const delay = SPEEDS[Store.settings().typingSpeed] ?? SPEEDS.normal;
        if (delay === 0) { renderFull(segs); return true; }
        typing = true;
        skip = false;
        el.classList.add('typing');
        let count = 0;
        try {
          for (const seg of segs) {
            const node = seg.tag ? document.createElement(seg.tag) : document.createTextNode('');
            textEl.appendChild(node);
            for (const c of seg.text) {
              // Outra fala assumiu a caixa: sai sem tocar no texto (senão sobrescreveria a fala nova).
              if (myGen !== gen) return false;
              if (skip) { renderFull(segs); return !pendingNav; }
              node.textContent += c;
              count++;
              if (count % 3 === 0) characterView.flap();
              // Uma "sílaba" a cada ~100 ms, só em letras — independente da velocidade do texto.
              const now = performance.now();
              if (/[\p{L}\d]/u.test(c) && now - lastBlip > 100) { lastBlip = now; Sound.blip(def.voicePitch || 520); }
              const pause = /[.!?]/.test(c) ? 7 : /[,;:]/.test(c) ? 3 : 1;
              await sleep(delay * pause);
            }
          }
          return true;
        } finally {
          if (myGen === gen) {
            typing = false;
            el.classList.remove('typing');
          }
        }
      }

      function waitAction(myGen) {
        return new Promise(resolve => {
          // Se outra fala começar (gen mudou), esta espera é liberada.
          const check = setInterval(() => { if (myGen !== gen) done('cancel'); }, 100);
          function done(action) {
            clearInterval(check);
            if (actionResolver === done) actionResolver = null;
            resolve(action);
          }
          actionResolver = done;
        });
      }

      function showHistory() {
        const list = h('div', { class: 'history' },
          history.length ? history.map(line => h('p', { html: `<b>${escapeHtml(def.name)}:</b> ${MD.inline(line)}` }))
            : h('p', { class: 'muted' }, 'Nada ainda.'));
        U.modal('Histórico de falas', list);
        setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0);
      }

      const api = {
        el,
        /**
         * Fala uma ou mais linhas. Cada linha pode ser string ou { text, mood }.
         * opts.mood        humor inicial
         * opts.wait=false  não espera o jogador avançar depois da última linha; com uma linha só, sem
         *                  navegação; com várias, a última linha ainda aceita "Voltar" (a promessa só
         *                  resolve quando o jogador volta ou outra fala começa — não use await nesse caso)
         * opts.canBackOut  "Voltar" na primeira linha devolve 'back' (a sessão volta à etapa anterior)
         * opts.seen        as linhas já foram vistas: aparecem inteiras, sem digitar
         * opts.startAtEnd  começa pela última linha (ao voltar de uma etapa seguinte)
         */
        async say(lines, opts = {}) {
          const list = normalizeLines(lines);
          const myGen = ++gen;
          resolveAction('cancel');
          pendingNav = null;
          typing = false;
          backOnly = false;
          el.classList.remove('typing', 'lingering');
          characterView.setTalking(false);
          if (!list.length) return 'done';
          return runLines(list, opts, myGen);
        },

        /**
         * Suspende a fala atual para uma interjeição (ex.: a resposta do assistente) e devolve um controle:
         *   alive           false se outra fala assumiu a caixa (aí o controle não faz mais nada)
         *   show(text, m)   mostra um texto parado (ex.: "pensando…")
         *   speak(lines)    fala como numa explicação (digitação, voz, voltar/pular); resolve ao terminar
         *   stop()          encerra a fala da interjeição em andamento
         *   resume()        devolve a fala suspensa (texto, humor, navegação e a espera pelo jogador)
         */
        async suspend() {
          if (typing) {
            skip = true;
            for (let k = 0; k < 100 && typing; k++) await sleep(15);
          }
          const myGen = gen;
          const saved = {
            html: textEl.innerHTML,
            mood: characterView.mood,
            nav,
            backOnly,
            resolver: actionResolver,
            classes: ['can-advance', 'lingering'].filter(c => el.classList.contains(c)),
          };
          actionResolver = null;
          backOnly = false;
          setNav(null);
          el.classList.remove('can-advance', 'lingering');
          let open = true;
          const alive = () => open && myGen === gen;
          return {
            get alive() { return alive(); },
            show(text, mood) {
              if (!alive()) return;
              if (mood) characterView.setMood(mood);
              characterView.setTalking(false);
              renderFull(MD.segments(text));
            },
            speak(lines, opts = {}) {
              if (!alive()) return Promise.resolve('cancel');
              return runLines(normalizeLines(lines), opts, myGen);
            },
            stop() {
              if (!alive()) return;
              if (typing) { pendingNav = 'skip'; skip = true; } else resolveAction('skip');
            },
            resume() {
              if (!alive()) return;
              open = false;
              characterView.setTalking(false);
              if (saved.mood) characterView.setMood(saved.mood);
              textEl.innerHTML = saved.html;
              backOnly = saved.backOnly;
              setNav(saved.nav);
              saved.classes.forEach(c => el.classList.add(c));
              actionResolver = saved.resolver;
            },
          };
        },

        /** Últimas n falas mostradas (para dar contexto ao assistente). */
        recent(n = 4) { return history.slice(-n); },
      };

      function normalizeLines(lines) {
        return (Array.isArray(lines) ? lines : [lines]).filter(Boolean)
          .map(item => (typeof item === 'string' ? { text: item } : item));
      }

      /** Laço de falas compartilhado por say() e pelas interjeições (mesma geração = mesma caixa). */
      async function runLines(list, opts, myGen) {
          // Humor vigente em cada linha, para restaurar ao voltar.
          const moods = [];
          let m = opts.mood;
          list.forEach((item, k) => { if (item.mood) m = item.mood; moods[k] = m; });

          const navigable = opts.wait !== false || list.length > 1;
          let i = opts.startAtEnd ? list.length - 1 : 0;
          let seenMax = opts.seen ? list.length - 1 : -1;
          setNav(navigable ? { canBack: () => i > 0 || !!opts.canBackOut } : null);

          try {
            while (i < list.length) {
              if (myGen !== gen) return 'cancel';
              const item = list[i];
              if (moods[i]) characterView.setMood(moods[i]);
              if (nav) backBtn.disabled = !nav.canBack();
              el.classList.remove('can-advance');

              if (i <= seenMax) {
                renderFull(MD.segments(item.text));
              } else {
                history.push(item.text);
                characterView.setTalking(true);
                const complete = await typeLine(item.text, myGen);
                if (myGen !== gen) return 'cancel';
                characterView.setTalking(false);
                if (complete) seenMax = i;
              }

              let action = pendingNav;
              pendingNav = null;
              if (!action) {
                const lingering = i === list.length - 1 && opts.wait === false;
                if (lingering && !navigable) return 'done';
                backOnly = lingering;
                el.classList.toggle('lingering', lingering);
                el.classList.toggle('can-advance', !lingering);
                action = await waitAction(myGen);
                if (myGen === gen) {
                  backOnly = false;
                  el.classList.remove('can-advance', 'lingering');
                }
              }
              if (action === 'cancel' || myGen !== gen) return 'cancel';
              if (action === 'skip') return 'skip';
              if (action === 'back') {
                if (i > 0) i--;
                else if (opts.canBackOut) return 'back';
                continue;
              }
              i++;
            }
            return 'done';
          } finally {
            if (myGen === gen) {
              setNav(null);
              backOnly = false;
              el.classList.remove('can-advance', 'lingering');
            }
          }
      }

      return Object.assign(api, {
        /** Interrompe qualquer fala em andamento. */
        interrupt() {
          gen++;
          typing = false;
          backOnly = false;
          el.classList.remove('typing', 'can-advance', 'lingering');
          characterView.setTalking(false);
          resolveAction('cancel');
          setNav(null);
        },
        advance,
        destroy() {
          gen++;
          resolveAction('cancel');
          document.removeEventListener('keydown', onKey);
        },
      });
    },
  };

  window.DialogBox = DialogBox;
})();
