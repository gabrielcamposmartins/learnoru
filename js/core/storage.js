/*
 * Persistência do progresso no localStorage.
 *
 * O XP total é a soma do MELHOR resultado de cada módulo — refazer um módulo
 * só aumenta o XP quando o jogador supera o próprio recorde.
 * Também guarda atividade diária (sequência de dias), estatísticas, conquistas
 * e termos do glossário já consultados.
 */
(function () {
  const KEY = 'ciq.progress.v1';

  const defaults = () => ({
    version: 2,
    player: { name: 'Dev' },
    modules: {},      // "trilha/modulo" -> { bestStars, bestXp, completed, plays, lastPlayed, questions: {stepId: stars}, reviews: [] }
    stats: { answered: 0, perfect: 0, flags: {} },
    activity: {},     // "AAAA-MM-DD" -> { q: questões respondidas, xp: xp ganho }
    achievements: {}, // id -> timestamp do desbloqueio
    glossarySeen: [], // chaves de termos consultados
    lastPlayed: null, // { trackId, moduleId, at }
    checkpoints: {},  // "trilha/modulo" -> { sig, index, results, shared, elapsed, total, savedAt } (módulo em andamento)
    settings: { sound: true, typingSpeed: 'normal', volume: 0.35, dailyGoal: 10, theme: 'moderno', palette: 'synthwave', crt: true },
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const d = defaults();
      const parsed = JSON.parse(raw);
      return Object.assign(d, parsed, {
        settings: Object.assign(d.settings, parsed.settings),
        stats: Object.assign(d.stats, parsed.stats),
      });
    } catch (e) {
      return defaults();
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* armazenamento indisponível */ }
    listeners.forEach(fn => fn(state));
  }

  const listeners = new Set();
  const key = (trackId, moduleId) => `${trackId}/${moduleId}`;

  /** Data local no formato AAAA-MM-DD. */
  function dayKey(date = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  const Store = {
    get state() { return state; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    dayKey,

    settings() { return state.settings; },
    setSetting(k, v) { state.settings[k] = v; save(); },

    moduleProgress(trackId, moduleId) {
      return state.modules[key(trackId, moduleId)] || null;
    },

    /**
     * Registra o resultado de uma sessão concluída (e descarta o checkpoint do módulo).
     * result: { stars, xp, reviews, questions: {stepId: stars}, flags: [] }
     * As questões respondidas já foram contadas uma a uma por recordAnswer().
     * Retorna { xpGained, newRecord, previousBest }.
     */
    recordSession(trackId, moduleId, result) {
      const k = key(trackId, moduleId);
      const prev = state.modules[k] || { bestStars: 0, bestXp: 0, plays: 0, questions: {} };
      const newRecord = result.xp > prev.bestXp || result.stars > prev.bestStars;
      const xpGained = Math.max(0, result.xp - prev.bestXp);
      const questions = Object.assign({}, prev.questions);
      for (const [id, st] of Object.entries(result.questions || {})) {
        questions[id] = Math.max(questions[id] || 0, st);
      }
      state.modules[k] = {
        bestStars: Math.max(prev.bestStars, result.stars),
        bestXp: Math.max(prev.bestXp, result.xp),
        completed: true,
        plays: prev.plays + 1,
        lastPlayed: Date.now(),
        lastStars: result.stars,
        questions,
        reviews: result.reviews || [],
      };
      // XP do dia e estatísticas gerais.
      const today = dayKey();
      const act = state.activity[today] || { q: 0, xp: 0 };
      act.xp += xpGained;
      state.activity[today] = act;
      for (const f of result.flags || []) state.stats.flags[f] = (state.stats.flags[f] || 0) + 1;
      delete state.checkpoints[k];
      state.lastPlayed = { trackId, moduleId, at: Date.now() };
      save();
      return { xpGained, newRecord, previousBest: prev };
    },

    /** Conta uma questão respondida (meta diária, sequência e estatísticas) no momento em que é concluída. */
    recordAnswer({ perfect = false } = {}) {
      const today = dayKey();
      const act = state.activity[today] || { q: 0, xp: 0 };
      act.q += 1;
      state.activity[today] = act;
      state.stats.answered += 1;
      if (perfect) state.stats.perfect += 1;
      save();
    },

    // ── Checkpoints: módulo em andamento, para continuar sem refazer as atividades concluídas ──
    checkpoint(trackId, moduleId) {
      return state.checkpoints[key(trackId, moduleId)] || null;
    },
    saveCheckpoint(trackId, moduleId, data) {
      state.checkpoints[key(trackId, moduleId)] = Object.assign({}, data, { savedAt: Date.now() });
      state.lastPlayed = { trackId, moduleId, at: Date.now() };
      save();
    },
    clearCheckpoint(trackId, moduleId) {
      const k = key(trackId, moduleId);
      if (!state.checkpoints[k]) return;
      delete state.checkpoints[k];
      save();
    },

    /** Marca o início de um módulo (para "continuar de onde parou"). */
    touchModule(trackId, moduleId) {
      state.lastPlayed = { trackId, moduleId, at: Date.now() };
      save();
    },

    totalXp() {
      return Object.values(state.modules).reduce((a, m) => a + (m.bestXp || 0), 0);
    },

    totalStars() {
      return Object.values(state.modules).reduce((a, m) => a + (m.bestStars || 0), 0);
    },

    completedCount() {
      return Object.values(state.modules).filter(m => m.completed).length;
    },

    todayActivity() {
      return state.activity[dayKey()] || { q: 0, xp: 0 };
    },

    /** Sequência de dias com atividade. `alive` = ainda dá para manter hoje. */
    streak() {
      const has = d => (state.activity[dayKey(d)] || {}).q > 0;
      const now = new Date();
      const studiedToday = has(now);
      let current = 0;
      let cursor = studiedToday ? now : addDays(now, -1);
      while (has(cursor)) { current++; cursor = addDays(cursor, -1); }
      // Maior sequência histórica.
      const days = Object.keys(state.activity).filter(k => state.activity[k].q > 0).sort();
      let best = 0;
      let run = 0;
      let prev = null;
      for (const d of days) {
        const date = new Date(`${d}T12:00:00`);
        run = prev && dayKey(addDays(prev, 1)) === d ? run + 1 : 1;
        best = Math.max(best, run);
        prev = date;
      }
      return { current, best: Math.max(best, current), studiedToday };
    },

    /** Últimos n dias (mais antigo primeiro) com a contagem de questões. */
    recentDays(n = 7) {
      const out = [];
      for (let i = n - 1; i >= 0; i--) {
        const d = addDays(new Date(), -i);
        out.push({ key: dayKey(d), date: d, q: (state.activity[dayKey(d)] || {}).q || 0 });
      }
      return out;
    },

    // ── Conquistas ──
    isUnlocked(id) { return !!state.achievements[id]; },
    unlock(id) {
      if (state.achievements[id]) return false;
      state.achievements[id] = Date.now();
      save();
      return true;
    },

    // ── Glossário ──
    markTermSeen(termKey) {
      if (state.glossarySeen.includes(termKey)) return false;
      state.glossarySeen.push(termKey);
      save();
      return true;
    },
    termSeen(termKey) { return state.glossarySeen.includes(termKey); },

    reset() {
      const settings = state.settings;
      state = defaults();
      state.settings = settings;
      save();
    },

    exportJson() { return JSON.stringify(state, null, 2); },
  };

  window.Store = Store;
})();
