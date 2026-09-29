/* Regras de pontuação, estrelas e níveis. */
(function () {
  const DEFAULT_POINTS = { mcq: 10, open: 20, code: 40, pytest: 40, tdd: 50, order: 15, match: 15, sql: 30 };
  const MODULE_BONUS = 20;

  const LEVEL_TITLES = ['Estagiário(a)', 'Júnior', 'Júnior II', 'Pleno', 'Pleno II', 'Sênior', 'Sênior II', 'Staff', 'Principal', 'Distinguished'];

  /** XP necessário para atingir o nível n (n >= 1). */
  const xpForLevel = n => 50 * n * (n - 1);

  const Scoring = {
    pointsFor(step) {
      return step.points ?? DEFAULT_POINTS[step.type] ?? 10;
    },

    xpFor(step, stars) {
      return Math.round(Scoring.pointsFor(step) * stars / 3);
    },

    /** Múltipla escolha: 3★ de primeira, 2★ na segunda, 1★ depois. */
    mcqStars(wrongAttempts) {
      return Math.max(1, 3 - wrongAttempts);
    },

    /** Resposta aberta: proporção de critérios da rubrica cobertos. */
    openStars(ratio) {
      if (ratio >= 0.8) return 3;
      if (ratio >= 0.5) return 2;
      if (ratio > 0) return 1;
      return 0;
    },

    /**
     * Código: começa com 3★ e perde 1★ por cada problema encontrado.
     * Retorna { stars, deductions: [{ text, concept }] }.
     */
    codeStars({ solved, gaveUp, hintsUsed, failedSubmissions, slow, slowConcept, reviewFlags }) {
      if (gaveUp || !solved) return { stars: 0, deductions: [{ text: 'Solução não concluída — veja a solução de referência.', concept: null }] };
      const deductions = [];
      if (slow) deductions.push({ text: 'Os testes de desempenho ficaram lentos — a complexidade pode melhorar.', concept: slowConcept || 'Complexidade (Big-O)' });
      if (reviewFlags.length) deductions.push(...reviewFlags.map(r => ({ text: r.text, concept: r.concept })));
      if (hintsUsed > 0) deductions.push({ text: `Usou ${hintsUsed} dica(s).`, concept: null });
      if (failedSubmissions >= 3) deductions.push({ text: `${failedSubmissions} envios com falha antes de acertar.`, concept: null });
      // Cada tipo de problema tira no máximo 1 estrela; mínimo 1★ se resolveu.
      const kinds = (slow ? 1 : 0) + (reviewFlags.length ? 1 : 0) + (hintsUsed > 0 ? 1 : 0) + (failedSubmissions >= 3 ? 1 : 0);
      return { stars: Math.max(1, 3 - kinds), deductions };
    },

    /**
     * Escrever testes (mutation testing): começa com 3★.
     * Bugs não detectados tiram 1★ (ou 2★ se sobreviveram mais de 40%); reviews, dicas e
     * 3+ envios inválidos tiram 1★ cada. Mínimo 1★ se os testes são válidos.
     */
    pytestStars({ gaveUp, killed, total, survivors, hintsUsed, failedSubmissions, reviewFlags }) {
      if (gaveUp) return { stars: 0, deductions: [{ text: 'Testes não concluídos — veja os testes de referência.', concept: null }] };
      const deductions = survivors.map(m => ({
        text: `Seus testes não pegaram o bug **${m.name}**${m.why ? ` — ${m.why}` : ''}`,
        concept: m.concept || null,
      }));
      deductions.push(...reviewFlags.map(r => ({ text: r.text, concept: r.concept })));
      if (hintsUsed > 0) deductions.push({ text: `Usou ${hintsUsed} dica(s).`, concept: null });
      if (failedSubmissions >= 3) deductions.push({ text: `${failedSubmissions} envios inválidos antes de acertar.`, concept: null });
      let kinds = 0;
      if (total && killed < total) kinds += killed / total >= 0.6 ? 1 : 2;
      if (reviewFlags.length) kinds++;
      if (hintsUsed > 0) kinds++;
      if (failedSubmissions >= 3) kinds++;
      return { stars: Math.max(1, 3 - kinds), deductions };
    },

    moduleStars(questionStars) {
      if (!questionStars.length) return 3;
      const avg = questionStars.reduce((a, b) => a + b, 0) / questionStars.length;
      // 3★ tolera no máximo ~1 questão com 2★ a cada 4.
      if (avg >= 2.75) return 3;
      if (avg >= 1.6) return 2;
      if (avg > 0) return 1;
      return 0;
    },

    moduleBonus(stars) { return stars > 0 ? Math.round(MODULE_BONUS * stars / 3) : 0; },

    level(xp) {
      let n = 1;
      while (xp >= xpForLevel(n + 1)) n++;
      const cur = xpForLevel(n);
      const next = xpForLevel(n + 1);
      return {
        level: n,
        title: LEVEL_TITLES[Math.min(n - 1, LEVEL_TITLES.length - 1)],
        into: xp - cur,
        needed: next - cur,
        progress: (xp - cur) / (next - cur),
      };
    },

    maxXpForModule(mod) {
      const q = mod.steps.filter(s => Game.isScoredStep(s)).reduce((a, s) => a + Scoring.pointsFor(s), 0);
      return q + MODULE_BONUS;
    },
  };

  window.Scoring = Scoring;
})();
