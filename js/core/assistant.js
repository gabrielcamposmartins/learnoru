/*
 * Assistente "Perguntar à Lia": cliente da API local (tools/serve.py → tools/assistant.py)
 * e montagem do contexto enviado ao Claude.
 *
 * O contexto tem, nesta ordem de prioridade:
 *   1. o que está em foco na tela (quadro/questão atual, código no editor, últimas falas)
 *   2. o módulo em foco inteiro (quadros das explicações, conceitos, pontos-chave)
 *   3. trechos da plataforma relacionados à pergunta (módulos e termos do glossário)
 *   4. progresso do jogador e o catálogo de trilhas/módulos
 */
(function () {
  const HEADERS = { 'Content-Type': 'application/json', 'X-CIQ-Assistant': '1' };
  const LIMITS = { stage: 6000, code: 4000, module: 9000, related: 6000, catalog: 7000, total: 45000 };
  const STOPWORDS = new Set(('a o os as um uma uns umas de do da dos das em no na nos nas por para pra com sem sobre ' +
    'que qual quais quando como onde porque por que se nao sim mais menos muito muita isso isto esse essa este esta ' +
    'eu voce voces ele ela eles elas me te lhe meu minha seu sua e ou mas entao tambem ja ainda so ser estar ter fazer ' +
    'pode posso poderia devo deve qualquer cada entre ate apos antes depois the and what how why is are of to in').split(' '));

  let statusCache = null;

  const clip = (s, n) => {
    s = String(s || '').trim();
    return s.length > n ? s.slice(0, n) + '…' : s;
  };

  // ── API local ──
  const AssistantAPI = {
    /** { active: 'cli'|'api'|null, mode, model, models, cli, api } ou { offline: true } sem o servidor do jogo. */
    async status({ refresh = false } = {}) {
      if (statusCache && !refresh) return statusCache;
      try {
        const r = await fetch('/api/assistant/status', { headers: HEADERS, cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        statusCache = await r.json();
      } catch (e) {
        statusCache = { offline: true, active: null, error: String(e.message || e) };
      }
      return statusCache;
    },

    async saveConfig(update) {
      const r = await fetch('/api/assistant/config', { method: 'POST', headers: HEADERS, body: JSON.stringify(update) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      statusCache = await r.json();
      return statusCache;
    },

    /**
     * Faz a pergunta e recebe a resposta aos poucos.
     * onEvent({type: 'meta'|'delta'|'done'|'error', ...}). Resolve com o texto completo.
     */
    async ask({ question, context, history }, onEvent, signal) {
      const r = await fetch('/api/assistant/ask', {
        method: 'POST', headers: HEADERS, signal,
        body: JSON.stringify({ question, context, history }),
      });
      if (!r.ok || !r.body) throw new Error(r.status === 404 || r.status === 501
        ? 'O assistente precisa do servidor do jogo (tools/iniciar.bat).' : `Falha na conexão (HTTP ${r.status}).`);
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let text = '';
      let error = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev;
          try { ev = JSON.parse(line); } catch (e) { continue; }
          if (ev.type === 'delta') text += ev.text;
          if (ev.type === 'error') error = ev.message;
          onEvent && onEvent(ev);
        }
      }
      if (error) throw new Error(error);
      return text;
    },
  };

  // ── Conteúdo da plataforma em texto ──
  function boardText(board) {
    if (!board) return '';
    return [board.title ? `### ${board.title}` : '', board.md || '', board.code ? '```python\n' + board.code + '\n```' : '', board.caption || '']
      .filter(Boolean).join('\n');
  }

  function speechText(text) {
    return (Array.isArray(text) ? text : [text]).map(t => (typeof t === 'string' ? t : t && t.text) || '').join(' ');
  }

  /** O módulo como texto: metadados + explicações (quadros e falas) + títulos das atividades. */
  function moduleDigest(track, mod, limit = LIMITS.module) {
    const parts = [
      `Trilha: ${track.title} — Módulo: ${mod.title} (${mod.kind === 'interview' ? 'entrevista' : mod.kind === 'challenge' ? 'desafio' : 'aula'})`,
      mod.summary ? `Resumo: ${mod.summary}` : '',
      mod.concepts && mod.concepts.length ? `Conceitos: ${mod.concepts.join(', ')}` : '',
      mod.takeaways && mod.takeaways.length ? `Pontos-chave:\n${mod.takeaways.map(t => `- ${t}`).join('\n')}` : '',
    ];
    const steps = mod.steps.map((s, i) => {
      if (s.type === 'say') return [boardText(s.board), `(Lia: ${clip(speechText(s.text), 400)})`].filter(Boolean).join('\n');
      if (s.type === 'section') return `— ${s.title} —`;
      if (Game.isScoredStep(s)) return `[Atividade ${i + 1} (${s.type}): ${clip(s.title || s.prompt, 160)}]`;
      return '';
    }).filter(Boolean);
    parts.push(`Conteúdo do módulo:\n${steps.join('\n\n')}`);
    return clip(parts.filter(Boolean).join('\n'), limit);
  }

  function tokens(text) {
    return [...new Set(U.normalize(text).replace(/[^a-z0-9+#\s-]/g, ' ').split(/\s+/)
      .filter(w => w.length >= 3 && !STOPWORDS.has(w)))];
  }

  /** Módulos e termos do glossário que tocam nas palavras da pergunta. */
  function related(question, excludeKey) {
    const words = tokens(question);
    if (!words.length) return '';
    const scored = [];
    for (const { track, module: mod } of Game.allModules()) {
      if (`${track.id}/${mod.id}` === excludeKey) continue;
      const title = U.normalize(`${mod.title} ${(mod.concepts || []).join(' ')}`);
      const body = U.normalize(`${mod.summary || ''} ${(mod.takeaways || []).join(' ')} ${mod.steps.map(s => s.board ? `${s.board.title || ''} ${s.board.md || ''}` : '').join(' ')}`);
      let score = 0;
      for (const w of words) {
        if (title.includes(w)) score += 5;
        const hits = body.split(w).length - 1;
        score += Math.min(hits, 6);
      }
      if (score >= 5) scored.push({ score, track, mod });
    }
    scored.sort((a, b) => b.score - a.score);
    const mods = scored.slice(0, 3).map(({ track, mod }) => moduleDigest(track, mod, 2000));

    const qn = U.normalize(question);
    const terms = Game.getGlossary().filter(t => [t.term, ...t.aliases].some(a => {
      const an = U.normalize(a);
      return an.length >= 3 && (qn.includes(an) || words.includes(an));
    })).slice(0, 6).map(t => `- **${t.term}**: ${t.definition}`);

    const out = [];
    if (mods.length) out.push(`Módulos relacionados da plataforma:\n\n${mods.join('\n\n---\n\n')}`);
    if (terms.length) out.push(`Glossário:\n${terms.join('\n')}`);
    return clip(out.join('\n\n'), LIMITS.related);
  }

  function catalog() {
    const lines = Game.getTracks().map(t => `- ${t.title}: ${t.modules.map(m => m.title).join(' · ')}`);
    return clip(`Trilhas e módulos da plataforma:\n${lines.join('\n')}`, LIMITS.catalog);
  }

  function progressText() {
    const xp = Store.totalXp();
    const lv = Scoring.level(xp);
    const done = Game.allModules().filter(x => (Store.moduleProgress(x.track.id, x.module.id) || {}).completed)
      .map(x => `${x.module.title} (${Store.moduleProgress(x.track.id, x.module.id).bestStars}★)`);
    const weak = new Map();
    for (const { track, module } of Game.allModules()) {
      const p = Store.moduleProgress(track.id, module.id);
      for (const r of (p && p.reviews) || []) if (r.concept) weak.set(r.concept, (weak.get(r.concept) || 0) + 1);
    }
    const weakList = [...weak.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c);
    return [
      `Jogador: nível ${lv.level} (${lv.title}), ${xp} XP, ${done.length} módulo(s) concluído(s).`,
      done.length ? `Concluídos: ${clip(done.join(', '), 1200)}` : 'Ainda não concluiu nenhum módulo.',
      weakList.length ? `Conceitos para revisar (errou antes): ${weakList.join(', ')}` : '',
    ].filter(Boolean).join('\n');
  }

  /**
   * Monta o contexto para a pergunta. `focus` vem da tela:
   *   { kind: 'home' } ou
   *   { kind: 'session', track, module, stepIndex, stepCount, stepType, activity, activityCount,
   *     unanswered, stageText, code: [{label, text}], speech: [...], done: [...] }
   */
  function buildContext(focus, question) {
    const parts = [];
    if (focus.kind === 'session') {
      const { track, module: mod } = focus;
      const where = focus.activity
        ? `Atividade ${focus.activity} de ${focus.activityCount} (tipo: ${focus.stepType})`
        : `Explicação (etapa ${focus.stepIndex + 1} de ${focus.stepCount})`;
      parts.push(`TELA ATUAL: aula "${mod.title}" (trilha ${track.title}) — ${where}.`);
      if (focus.unanswered) {
        parts.push('ATENÇÃO: há uma QUESTÃO AINDA NÃO RESPONDIDA na tela. Não entregue a resposta nem a solução — dê pistas e explique o conceito.');
      }
      if (focus.stageText) parts.push(`O que aparece no quadro agora:\n"""\n${clip(focus.stageText, LIMITS.stage)}\n"""`);
      for (const c of focus.code || []) {
        if (c.text && c.text.trim()) parts.push(`Código do aluno no editor (${c.label}):\n\`\`\`\n${clip(c.text, LIMITS.code)}\n\`\`\``);
      }
      if (focus.speech && focus.speech.length) parts.push(`Últimas falas da Lia:\n${focus.speech.map(s => `- ${s}`).join('\n')}`);
      if (focus.done && focus.done.length) parts.push(`Atividades já feitas neste módulo: ${focus.done.join('; ')}`);
      parts.push(moduleDigest(track, mod));
      const rel = related(question, `${track.id}/${mod.id}`);
      if (rel) parts.push(rel);
      parts.push(progressText());
      parts.push(catalog());
    } else {
      parts.push('TELA ATUAL: página inicial do jogo (escolha de trilhas e módulos).');
      if (focus.next) parts.push(`Sugestão de próximo módulo na tela: ${focus.next}`);
      parts.push(progressText());
      const rel = related(question, null);
      if (rel) parts.push(rel);
      parts.push(catalog());
    }
    return clip(parts.join('\n\n'), LIMITS.total);
  }

  /**
   * Converte a resposta (markdown) em falas para a caixa de diálogo: parágrafos curtos, blocos de código
   * trocados por uma referência ao painel e itens de lista como falas próprias.
   */
  function toSpeech(answer, maxLen = 260) {
    const text = String(answer || '').replace(/\r\n/g, '\n')
      .replace(/```[\s\S]*?(```|$)/g, '\n\n(veja o código no painel ao lado)\n\n');
    const paras = [];
    for (const block of text.split(/\n\s*\n/)) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      let buf = [];
      const flush = () => { if (buf.length) paras.push(buf.join(' ')); buf = []; };
      for (const l of lines) {
        const item = l.match(/^([-*•]|\d+[.)])\s+(.*)$/);
        const clean = l.replace(/^#{1,6}\s+/, '').replace(/^>\s?/, '');
        if (item) { flush(); paras.push(`• ${item[2]}`); } else buf.push(clean);
      }
      flush();
    }
    const out = [];
    for (const p of paras) {
      if (p.length <= maxLen) { out.push(p); continue; }
      // Frases longas demais para uma fala: quebra nas pontuações finais.
      let cur = '';
      for (const sentence of p.match(/[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/g) || [p]) {
        if (cur && (cur + sentence).length > maxLen) { out.push(cur.trim()); cur = ''; }
        cur += sentence;
      }
      if (cur.trim()) out.push(cur.trim());
    }
    return out.filter(Boolean);
  }

  window.AssistantAPI = AssistantAPI;
  window.AssistantContext = { buildContext, toSpeech, moduleDigest };
})();
