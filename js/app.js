/*
 * Inicialização: carrega os arquivos de conteúdo listados em content/manifest.js,
 * configura o roteamento por hash, a barra lateral e as configurações.
 *
 * Rotas: #/                          -> início
 *        #/trilha/<id>[/<modulo>]     -> trilha (opcionalmente destacando um módulo)
 *        #/jogar/<trilha>/<modulo>    -> sessão
 *        #/glossario[/<termo>]        -> glossário
 *        #/revisao                    -> revisão e caderno
 *        #/conquistas                 -> conquistas
 */
(function () {
  const { h } = U;
  const screenEl = document.getElementById('screen');
  let cleanup = null;

  /** Carrega os scripts em paralelo, executando na ordem do manifest. */
  function loadScripts(list) {
    return Promise.all(list.map(src => new Promise(resolve => {
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    })));
  }

  const ACTIVE_NAV = { home: 'home', track: 'track', session: 'track', results: 'track', glossary: 'glossary', achievements: 'achievements', review: 'review' };

  function mount(name, params) {
    const screen = Game.getScreen(name);
    if (!screen) return mount('home', {});
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } }
    cleanup = null;
    screenEl.innerHTML = '';
    screenEl.className = `screen screen-${name}`;
    Shell.focus(name === 'session');
    Shell.setActive(ACTIVE_NAV[name] || name, params || {});
    Shell.setTitle('');
    cleanup = screen.render(screenEl, params || {}, App) || null;
    window.scrollTo(0, 0);
  }

  const App = {
    /** Navega para uma tela. 'results' não tem rota (depende do estado da sessão). */
    go(name, params = {}) {
      const enc = encodeURIComponent;
      const hash = name === 'home' ? '#/'
        : name === 'track' ? `#/trilha/${enc(params.trackId)}${params.focus ? `/${enc(params.focus)}` : ''}`
          : name === 'play' ? `#/jogar/${enc(params.trackId)}/${enc(params.moduleId)}`
            : name === 'glossary' ? `#/glossario${params.term ? `/${enc(params.term)}` : ''}`
              : name === 'achievements' ? '#/conquistas'
                : name === 'review' ? '#/revisao'
                  : null;
      if (hash) {
        if (location.hash === hash) route(); // força recarregar (ex.: "Refazer")
        else location.hash = hash;
      } else {
        mount(name, params);
      }
    },
    /** Abre as configurações; section 'assistant' rola até o assistente. */
    openSettings: section => openSettings(section),
  };

  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    if (parts[0] === 'trilha' && parts[1]) return mount('track', { trackId: parts[1], focus: parts[2] || null });
    if (parts[0] === 'jogar' && parts[1] && parts[2]) return mount('session', { trackId: parts[1], moduleId: parts[2] });
    if (parts[0] === 'glossario') return mount('glossary', { term: parts[1] || null });
    if (parts[0] === 'conquistas') return mount('achievements', {});
    if (parts[0] === 'revisao') return mount('review', {});
    return mount('home', {});
  }

  function openSettings(section) {
    const st = Store.settings();
    const select = (key, options) => h('select', { onchange: e => Store.setSetting(key, isNaN(+e.target.value) ? e.target.value : +e.target.value) },
      options.map(([v, l]) => h('option', { value: v, selected: String(st[key]) === String(v) }, l)));
    const sound = h('input', { type: 'checkbox', checked: st.sound, onchange: e => Store.setSetting('sound', e.target.checked) });
    const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: st.volume, onchange: e => { Store.setSetting('volume', +e.target.value); Sound.blip(640); } });

    const assistantBlock = assistantSettings();
    const body = h('div', { class: 'settings' },
      appearanceSettings(),
      h('hr'),
      assistantBlock,
      h('hr'),
      h('label', { class: 'setting' }, h('span', null, 'Velocidade do texto'),
        select('typingSpeed', [['slow', 'Lenta'], ['normal', 'Normal'], ['fast', 'Rápida'], ['instant', 'Instantânea']])),
      h('label', { class: 'setting' }, h('span', null, 'Meta diária'),
        select('dailyGoal', [[5, '5 questões'], [10, '10 questões'], [20, '20 questões'], [30, '30 questões']])),
      h('label', { class: 'setting' }, h('span', null, 'Efeitos sonoros'), sound),
      h('label', { class: 'setting' }, h('span', null, 'Volume'), vol),
      h('hr'),
      h('div', { class: 'setting' },
        h('span', null, 'Progresso'),
        h('div', { class: 'row-gap' },
          h('button', { class: 'btn btn-sm', onclick: () => {
            const blob = new Blob([Store.exportJson()], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: 'code-interview-quest-progresso.json' });
            a.click();
          } }, 'Exportar'),
          h('button', { class: 'btn btn-sm btn-danger', onclick: () => {
            closeSettings();
            U.modal('Apagar progresso?', h('p', null, 'Todo o XP, estrelas, conquistas e reviews serão apagados. Isso não pode ser desfeito.'), {
              actions: [
                { label: 'Cancelar', onClick: () => {} },
                { label: 'Apagar tudo', danger: true, onClick: () => { Store.reset(); U.toast('Progresso apagado.'); App.go('home'); } },
              ],
            });
          } }, 'Apagar'))),
      h('p', { class: 'muted small' }, 'Atalhos: Ctrl+K busca · ? pergunta à Lia · Espaço/Enter/→ avança o diálogo · ← volta uma fala · Shift+→ pula a explicação · Ctrl+Enter executa o código · Ctrl+Shift+Enter envia.'));
    const closeSettings = U.modal('Configurações', body);
    if (section === 'assistant') setTimeout(() => assistantBlock.scrollIntoView({ block: 'center' }), 60);
  }

  /** Assistente "Perguntar à Lia": modo (Claude local / API), modelo e chave — guardados pelo servidor local. */
  function assistantSettings() {
    const wrap = h('div', { class: 'setting-block assistant-settings' },
      h('span', { class: 'setting-label' }, 'Assistente — Perguntar à Lia'), h('p', { class: 'muted small' }, 'Verificando…'));
    function render(st) {
      wrap.innerHTML = '';
      wrap.append(h('span', { class: 'setting-label' }, 'Assistente — Perguntar à Lia'));
      if (st.offline) {
        wrap.append(h('p', { class: 'muted small' }, 'Disponível quando o jogo é aberto pelo servidor local (atalho da área de trabalho ou tools/iniciar.bat).'));
        return;
      }
      const using = st.active === 'cli' ? `Claude Code local — usa o seu plano (${st.cli.path})`
        : st.active === 'api' ? `chave de API ${st.api.hint}${st.api.source === 'env' ? ' (variável ANTHROPIC_API_KEY)' : ''}`
          : 'nenhum acesso encontrado';
      const modeSel = h('select', { onchange: e => save({ mode: e.target.value }) },
        [['auto', 'Automático (Claude local → API)'], ['cli', 'Só Claude local (claude -p)'], ['api', 'Só chave de API']]
          .map(([v, l]) => h('option', { value: v, selected: st.mode === v }, l)));
      const modelSel = h('select', { onchange: e => save({ model: e.target.value }) },
        Object.entries(st.models).map(([v, l]) => h('option', { value: v, selected: st.model === v }, l)));
      const keyInput = h('input', { type: 'password', class: 'input key-input', autocomplete: 'off', spellcheck: 'false',
        placeholder: st.api.source === 'config' ? `Salva (${st.api.hint}) — cole outra para trocar` : 'sk-ant-…' });
      wrap.append(
        h('p', { class: `assistant-using ${st.active ? 'ok' : 'off'}` }, h('span', { class: 'dot' }), `Em uso: ${using}`),
        h('label', { class: 'setting' }, h('span', null, 'Modo'), modeSel),
        h('label', { class: 'setting' }, h('span', null, 'Modelo'), modelSel),
        h('div', { class: 'setting-block' },
          h('span', null, 'Chave de API da Anthropic (opcional)'),
          h('div', { class: 'key-row' }, keyInput,
            h('button', { class: 'btn btn-sm', onclick: () => keyInput.value.trim() && save({ api_key: keyInput.value.trim() }) }, 'Salvar'),
            st.api.source === 'config' ? h('button', { class: 'btn btn-sm btn-danger', onclick: () => save({ api_key: '' }) }, 'Remover') : null)),
        h('p', { class: 'muted small' },
          `A chave fica só neste computador (${st.configFile}) — nunca no navegador nem no repositório. `,
          st.cli.available ? 'O Claude Code foi encontrado: no modo automático, o jogo usa o seu plano via claude -p.'
            : 'Para usar o seu plano do Claude, instale o Claude Code e faça login rodando claude num terminal.'));
    }
    async function save(update) {
      try {
        render(await AssistantAPI.saveConfig(update));
        U.toast('Assistente atualizado.');
      } catch (e) {
        U.toast(`Não consegui salvar: ${e.message}`, 'bad');
      }
    }
    AssistantAPI.status({ refresh: true }).then(render);
    return wrap;
  }

  /** Tema (moderno/retro), paleta e efeito CRT — aplicados na hora. */
  function appearanceSettings() {
    const wrap = h('div', { class: 'appearance' });
    function set(key, value) {
      Store.setSetting(key, value);
      Theme.apply();
      Sound.click();
      render();
    }
    function render() {
      const st = Store.settings();
      const retro = st.theme === 'retro';
      wrap.innerHTML = '';
      wrap.append(
        h('div', { class: 'setting-block' },
          h('span', { class: 'setting-label' }, 'Tema'),
          h('div', { class: 'theme-options', role: 'radiogroup', 'aria-label': 'Tema' },
            Theme.THEMES.map(t => h('button', {
              class: `theme-option theme-${t.id} ${(st.theme || 'moderno') === t.id ? 'active' : ''}`,
              role: 'radio', 'aria-checked': String((st.theme || 'moderno') === t.id),
              onclick: () => set('theme', t.id),
            },
            h('span', { class: 'theme-preview', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
            h('strong', null, t.name),
            h('small', null, t.desc))))),
        retro ? h('div', { class: 'setting-block' },
          h('span', { class: 'setting-label' }, 'Paleta'),
          h('div', { class: 'palette-options', role: 'radiogroup', 'aria-label': 'Paleta de cores' },
            Theme.PALETTES.map(p => h('button', {
              class: `palette-option ${st.palette === p.id ? 'active' : ''}`,
              role: 'radio', 'aria-checked': String(st.palette === p.id), title: p.name,
              style: { '--sw1': p.colors[0], '--sw2': p.colors[1], '--sw3': p.colors[2] },
              onclick: () => set('palette', p.id),
            }, h('span', { class: 'swatch', 'aria-hidden': 'true' }), h('span', null, p.name))))) : null,
        retro ? h('label', { class: 'setting' }, h('span', null, 'Efeito CRT (linhas de varredura)'),
          h('input', { type: 'checkbox', checked: st.crt !== false, onchange: e => set('crt', e.target.checked) })) : null);
    }
    render();
    return wrap;
  }

  async function init() {
    Theme.apply();
    document.getElementById('btn-settings').addEventListener('click', openSettings);
    Widgets.bindPyStatus();
    screenEl.appendChild(h('div', { class: 'loading' }, h('div', { class: 'spinner' }), 'Carregando conteúdo…'));

    // Arquivos listados mas ainda inexistentes (conteúdo planejado) são ignorados em silêncio;
    // erros de sintaxe de um arquivo aparecem no console sem derrubar os demais.
    const results = await loadScripts(window.CONTENT_MANIFEST || []);
    const failed = results.filter(ok => !ok).length;
    if (failed) console.info(`[Game] ${failed} arquivo(s) de conteúdo planejado ainda não existem.`);

    Shell.init();
    Achievements.check({ notify: false });
    window.addEventListener('hashchange', route);
    route();
  }

  window.App = App;
  init();
})();
