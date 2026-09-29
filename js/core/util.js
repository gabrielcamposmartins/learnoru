/* Utilitários de DOM e texto. */
(function () {
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') {
          for (const [sk, sv] of Object.entries(v)) {
            if (sk.startsWith('--')) el.style.setProperty(sk, sv);
            else el.style[sk] = sv;
          }
        }
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** minúsculas, sem acentos, espaços normalizados — usado na correção de respostas abertas. */
  function normalize(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function toast(msg, kind = 'info', ms = 2600) {
    const root = document.getElementById('toast-root');
    const t = h('div', { class: `toast toast-${kind}` }, msg);
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, ms);
  }

  /** Modal simples. `content` é um Node. Retorna função para fechar. */
  function modal(title, content, { actions = [] } = {}) {
    const root = document.getElementById('modal-root');
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    const wrap = h('div', { class: 'modal-backdrop', onclick: e => { if (e.target === wrap) close(); } },
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('div', { class: 'modal-head' },
          h('h2', null, title),
          h('button', { class: 'icon-btn', onclick: close, 'aria-label': 'Fechar' }, '✕')),
        h('div', { class: 'modal-body' }, content),
        actions.length ? h('div', { class: 'modal-actions' },
          actions.map(a => h('button', {
            class: `btn ${a.primary ? 'btn-primary' : ''} ${a.danger ? 'btn-danger' : ''}`,
            onclick: () => { if (a.onClick() !== false) close(); },
          }, a.label))) : null));
    root.appendChild(wrap);
    document.addEventListener('keydown', onKey);
    return close;
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable ||
      !!el.closest?.('.CodeMirror');
  }

  window.U = { h, escapeHtml, normalize, sleep, pick, shuffle, formatTime, toast, modal, isTypingTarget };
})();
