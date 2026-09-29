/*
 * Registro central do jogo.
 *
 * Todo conteúdo (personagens, trilhas, módulos) e todo tipo de etapa
 * (say, mcq, open, code...) é registrado aqui. Para estender o jogo basta
 * criar um novo arquivo em content/ que chame estas funções e listá-lo em
 * content/manifest.js. Veja README.md para o formato completo.
 */
(function () {
  const characters = new Map();
  const tracks = new Map();
  const stepTypes = new Map();
  const screens = new Map();
  const glossary = new Map();

  // Chave de termo: minúsculas e sem acentos ("Idempotência" == "idempotencia").
  const termKey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  function required(obj, fields, what) {
    for (const f of fields) {
      if (obj[f] === undefined || obj[f] === null || obj[f] === '') {
        throw new Error(`[Game] ${what} sem o campo obrigatório "${f}"`);
      }
    }
  }

  const Game = {
    version: '1.0.0',

    /** Personagem instrutor/entrevistador. */
    registerCharacter(def) {
      required(def, ['id', 'name'], 'Personagem');
      characters.set(def.id, Object.assign({
        role: 'Instrutor(a)',
        side: 'left',
        look: {},
        lines: {},
      }, def));
      return def;
    },

    /** Trilha (categoria) — ex.: Design Patterns, LeetCode, Arquitetura. */
    registerTrack(def) {
      required(def, ['id', 'title'], 'Trilha');
      const existing = tracks.get(def.id);
      const track = Object.assign({
        icon: '📚',
        color: '#7c9cff',
        description: '',
        character: null,
        order: tracks.size + 1,
      }, def, { modules: existing ? existing.modules : [] });
      tracks.set(def.id, track);
      (def.modules || []).forEach(m => Game.registerModule(def.id, m));
      return track;
    },

    /**
     * Módulo (aula ou entrevista) dentro de uma trilha.
     * Pode ser registrado em arquivo separado da trilha.
     */
    registerModule(trackId, def) {
      required(def, ['id', 'title', 'steps'], `Módulo em "${trackId}"`);
      let track = tracks.get(trackId);
      if (!track) {
        // Permite registrar módulos antes da trilha; a trilha completa os dados depois.
        track = { id: trackId, title: trackId, modules: [], order: 999 };
        tracks.set(trackId, track);
      }
      if (track.modules.some(m => m.id === def.id)) {
        console.warn(`[Game] Módulo duplicado "${trackId}/${def.id}" — substituindo.`);
        track.modules = track.modules.filter(m => m.id !== def.id);
      }
      const mod = Object.assign({
        kind: 'lesson', // 'lesson' | 'interview' | 'challenge'
        level: 1,
        summary: '',
        concepts: [],
        order: track.modules.length + 1,
      }, def);
      mod.steps = mod.steps.map((s, i) => Object.assign({ id: s.id || `s${i}` }, s));
      mod.takeaways = mod.takeaways || [];
      track.modules.push(mod);
      track.modules.sort((a, b) => a.order - b.order);
      if (def.glossary) Game.registerGlossary(def.glossary, { trackId, moduleId: def.id });
      return mod;
    },

    /**
     * Termos do glossário: { term, aliases?: [], definition: 'markdown curto' }.
     * Declarados no campo `glossary` de um módulo, ficam ligados a ele ("aprenda em…").
     * Termos repetidos em outros módulos viram "também em".
     */
    registerGlossary(entries, { trackId = null, moduleId = null } = {}) {
      for (const e of entries || []) {
        required(e, ['term', 'definition'], 'Termo do glossário');
        const key = termKey(e.term);
        const existing = glossary.get(key);
        if (existing) {
          existing.aliases = [...new Set([...existing.aliases, ...(e.aliases || [])])];
          if (moduleId && !existing.moduleId) Object.assign(existing, { trackId, moduleId });
          else if (moduleId && existing.moduleId !== moduleId) existing.alsoIn.push({ trackId, moduleId });
          continue;
        }
        glossary.set(key, {
          key,
          term: e.term,
          aliases: e.aliases || [],
          definition: e.definition,
          trackId: trackId || e.trackId || null,
          moduleId: moduleId || e.moduleId || null,
          alsoIn: [],
        });
      }
    },

    getGlossary() {
      return [...glossary.values()].sort((a, b) => a.term.localeCompare(b.term, 'pt'));
    },
    getTerm(term) { return glossary.get(termKey(term)) || null; },
    termKey,

    /**
     * Módulos da trilha agrupados por unidade (capítulo), na ordem de `track.units`.
     * Módulos sem unidade (ou com unidade desconhecida) vão para um grupo final.
     */
    modulesByUnit(track) {
      const units = track.units || [];
      const groups = units.map(u => ({ unit: u, modules: track.modules.filter(m => m.unit === u.id) }));
      const known = new Set(units.map(u => u.id));
      const rest = track.modules.filter(m => !known.has(m.unit));
      if (rest.length) groups.push({ unit: { id: '_outros', title: units.length ? 'Outros' : 'Módulos', description: '' }, modules: rest });
      return groups.filter(g => g.modules.length);
    },

    /**
     * Tipo de etapa. `run(ctx, step)` é async e resolve quando a etapa termina.
     * `scored: true` indica que a etapa gera estrelas/pontuação.
     */
    registerStepType(type, def) {
      stepTypes.set(type, Object.assign({ scored: false }, def));
    },

    registerScreen(name, def) {
      screens.set(name, def);
    },

    getCharacter(id) { return characters.get(id) || characters.values().next().value; },

    /**
     * Personagem efetivo de uma trilha/módulo: o mesmo personagem pode ter
     * papel, lado da tela e falas diferentes em cada trilha
     * (campos characterRole, side e lines na trilha ou no módulo).
     */
    castFor(track, mod) {
      const base = Game.getCharacter((mod && mod.character) || (track && track.character));
      const pick = key => (mod && mod[key]) || (track && track[key]);
      return Object.assign({}, base, {
        role: pick('characterRole') || base.role,
        side: pick('side') || base.side,
        lines: Object.assign({}, base.lines, track && track.lines, mod && mod.lines),
      });
    },
    getCharacters() { return [...characters.values()]; },
    getTrack(id) { return tracks.get(id); },
    /** Trilhas em ordem; trilhas ainda sem módulos ficam ocultas (a não ser com includeEmpty). */
    getTracks({ includeEmpty = false } = {}) {
      return [...tracks.values()].filter(t => includeEmpty || t.modules.length).sort((a, b) => a.order - b.order);
    },
    /** Todos os módulos de todas as trilhas: [{ track, module }]. */
    allModules() {
      return Game.getTracks().flatMap(track => track.modules.map(module => ({ track, module })));
    },
    getModule(trackId, moduleId) {
      const t = tracks.get(trackId);
      return t && t.modules.find(m => m.id === moduleId);
    },
    getStepType(type) { return stepTypes.get(type); },
    getScreen(name) { return screens.get(name); },
    isScoredStep(step) {
      const t = stepTypes.get(step.type);
      return !!(t && t.scored);
    },
  };

  window.Game = Game;
})();
