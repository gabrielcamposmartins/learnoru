/* Componentes visuais reutilizáveis: estrelas, barras e anéis de progresso, chips. */
(function () {
  const { h } = U;

  const Widgets = {
    stars(n, { max = 3, size = 'md', animate = false } = {}) {
      const wrap = h('span', { class: `stars stars-${size}`, 'aria-label': `${n} de ${max} estrelas`, role: 'img' });
      for (let i = 0; i < max; i++) {
        const s = h('span', { class: `star ${i < n ? 'on' : ''}`, html: Icons.html(i < n ? 'starFill' : 'star', { size: { sm: 14, md: 20, lg: 28, xl: 56 }[size] || 20 }) });
        if (animate && i < n) {
          s.classList.add('pop');
          s.style.animationDelay = `${0.25 + i * 0.28}s`;
          setTimeout(() => Sound.star(i), 250 + i * 280);
        }
        wrap.appendChild(s);
      }
      return wrap;
    },

    progress(value, { color, label, thin = false } = {}) {
      const pct = Math.max(0, Math.min(1, value || 0)) * 100;
      const bar = h('div', { class: `progress ${thin ? 'thin' : ''}`, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(pct) },
        h('div', { class: 'progress-fill', style: { width: `${pct}%`, background: color || '' } }));
      if (!label) return bar;
      return h('div', { class: 'progress-labeled' }, h('div', { class: 'progress-label' }, label), bar);
    },

    /** Anel de progresso em SVG. `center` é o texto (ou nó) no meio. */
    ring(value, { size = 44, stroke = 4, color = 'var(--accent)', center = null, track = 'var(--ring-track)' } = {}) {
      const r = (size - stroke) / 2;
      const c = 2 * Math.PI * r;
      const pct = Math.max(0, Math.min(1, value || 0));
      const el = h('span', { class: 'ring', style: { width: `${size}px`, height: `${size}px` } });
      el.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
        <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
          stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
      </svg>`;
      if (center !== null) el.appendChild(h('span', { class: 'ring-center' }, center));
      return el;
    },

    concept(name) {
      return h('span', { class: 'concept-chip' }, Icons.el('bulb', { size: 13 }), name);
    },

    kindBadge(kind) {
      const map = {
        lesson: ['book', 'Aula'],
        interview: ['user', 'Entrevista'],
        challenge: ['zap', 'Desafio'],
      };
      const [icon, label] = map[kind] || ['info', kind];
      return h('span', { class: `kind-badge kind-${kind}` }, Icons.el(icon, { size: 13 }), label);
    },

    levelDots(level) {
      return h('span', { class: 'level-dots', title: ['', 'Fácil', 'Médio', 'Difícil'][level] || '' },
        [1, 2, 3].map(i => h('span', { class: `ldot ${i <= level ? 'on' : ''}` })));
    },

    /** Tile de ícone colorido de uma trilha. */
    trackIcon(track, size = 44) {
      return h('span', { class: 'track-icon', style: { '--c': track.color, width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.5)}px` } }, track.icon);
    },

    bindPyStatus() {
      const el = document.getElementById('py-status');
      if (!el) return;
      const label = el.querySelector('.label');
      const texts = { idle: 'Python', loading: 'Carregando Python…', ready: 'Python pronto', error: 'Python indisponível' };
      const upd = (s, detail) => {
        el.dataset.status = s;
        label.textContent = texts[s] || s;
        el.title = s === 'ready' ? `Pyodide ${detail || ''} — Python rodando no navegador` : s === 'error' ? `Erro: ${detail}. Clique para tentar de novo.` : 'Interpretador Python (Pyodide)';
      };
      upd(PyRunner.status);
      PyRunner.onStatus(upd);
      el.addEventListener('click', () => { if (PyRunner.status === 'error') PyRunner.retry(); });
    },
  };

  window.Widgets = Widgets;
})();
