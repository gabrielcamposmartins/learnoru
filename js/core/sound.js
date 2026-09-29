/* Efeitos sonoros sintetizados (WebAudio) — sem arquivos de áudio. */
(function () {
  let ctx = null;

  function audio() {
    if (!Store.settings().sound) return null;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) {
      return null;
    }
  }

  function tone(freq, dur = 0.06, type = 'square', gain = 0.05, when = 0) {
    const a = audio();
    if (!a) return;
    const vol = gain * (Store.settings().volume ?? 0.35) * 2;
    const t0 = a.currentTime + when;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Escala pentatônica (em semitons): qualquer sequência de notas soa agradável.
  const VOICE_STEPS = [0, 2, 4, 7, 9];
  let lastStep = 0;

  /**
   * "Voz" do personagem: sílaba curta e suave — senoide com um harmônico discreto,
   * ataque/decaimento sem cliques, filtro passa-baixa e um leve deslize descendente.
   */
  function voice(base) {
    const a = audio();
    if (!a) return;
    const vol = 0.045 * (Store.settings().volume ?? 0.35);
    // Evita repetir a mesma nota e prefere passos pequenos (soa como entonação).
    let step;
    do { step = VOICE_STEPS[Math.floor(Math.random() * VOICE_STEPS.length)]; } while (step === lastStep || Math.abs(step - lastStep) > 7);
    lastStep = step;
    const freq = base * 0.75 * Math.pow(2, step / 12);
    const t0 = a.currentTime + 0.005;
    const dur = 0.085;

    const filter = a.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.5;

    const g = a.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const main = a.createOscillator();
    main.type = 'sine';
    main.frequency.setValueAtTime(freq, t0);
    main.frequency.exponentialRampToValueAtTime(freq * 0.93, t0 + dur);

    const overtone = a.createOscillator();
    const og = a.createGain();
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 2, t0);
    overtone.frequency.exponentialRampToValueAtTime(freq * 2 * 0.93, t0 + dur);
    og.gain.value = 0.18;

    main.connect(g);
    overtone.connect(og).connect(g);
    g.connect(filter).connect(a.destination);
    [main, overtone].forEach(o => { o.start(t0); o.stop(t0 + dur + 0.03); });
  }

  const Sound = {
    /** "Voz" do personagem — cada personagem tem um tom base (voicePitch). */
    blip(pitch = 520) { voice(pitch); },
    click() { tone(880, 0.04, 'triangle', 0.05); },
    correct() { [660, 880, 1320].forEach((f, i) => tone(f, 0.12, 'triangle', 0.07, i * 0.08)); },
    wrong() { [220, 170].forEach((f, i) => tone(f, 0.16, 'sawtooth', 0.04, i * 0.12)); },
    star(i = 0) { tone(990 + i * 220, 0.14, 'triangle', 0.07); },
    fanfare() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.06, i * 0.1)); },
  };

  window.Sound = Sound;
})();
