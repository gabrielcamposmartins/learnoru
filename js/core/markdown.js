/*
 * Markdown mínimo + realce de sintaxe Python (sem dependências).
 *
 * Suporta: # títulos, parágrafos, listas (- e 1.), > citações/dicas,
 * ```blocos de código```, tabelas | a | b |, ---, `código`, **negrito**,
 * *itálico* e [links](url).
 */
(function () {
  const { escapeHtml } = U;

  const PY_KEYWORDS = new Set(('False None True and as assert async await break class continue def del elif else except ' +
    'finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case').split(' '));
  const PY_BUILTINS = new Set(('abs all any bool bytes callable chr dict dir divmod enumerate filter float format frozenset ' +
    'getattr hasattr hash hex id input int isinstance issubclass iter len list map max min next object open ord pow print ' +
    'property range repr reversed round set setattr slice sorted staticmethod classmethod str sum super tuple type vars zip ' +
    'Exception ValueError TypeError KeyError IndexError NotImplementedError RuntimeError StopIteration AttributeError').split(' '));

  const PY_TOKEN = new RegExp([
    /(#[^\n]*)/.source,                                                              // 1 comentário
    /((?:[rRbBfFuU]{1,2})?(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'))/.source, // 2 string
    /(@[A-Za-z_][\w.]*)/.source,                                                     // 3 decorator
    /\b(\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?j?)\b/.source,                               // 4 número
    /\b([A-Za-z_]\w*)\b/.source,                                                     // 5 identificador
  ].join('|'), 'g');

  function highlightPython(code) {
    let out = '';
    let last = 0;
    let prevWord = '';
    PY_TOKEN.lastIndex = 0;
    let m;
    while ((m = PY_TOKEN.exec(code))) {
      out += escapeHtml(code.slice(last, m.index));
      last = PY_TOKEN.lastIndex;
      const [tok, comment, str, deco, num, ident] = m;
      let cls = null;
      if (comment) cls = 'c';
      else if (str) cls = 's';
      else if (deco) cls = 'd';
      else if (num) cls = 'n';
      else if (ident) {
        if (PY_KEYWORDS.has(ident)) cls = 'k';
        else if (prevWord === 'def' || prevWord === 'class') cls = 'f';
        else if (ident === 'self' || ident === 'cls') cls = 'sf';
        else if (PY_BUILTINS.has(ident)) cls = 'b';
        prevWord = ident;
      }
      out += cls ? `<span class="tk-${cls}">${escapeHtml(tok)}</span>` : escapeHtml(tok);
    }
    out += escapeHtml(code.slice(last));
    return out;
  }

  const SQL_KEYWORDS = new Set(('select from where and or not in is null as join inner left right full outer cross on group by order ' +
    'having limit offset distinct union all insert into values update set delete create table index unique primary key foreign ' +
    'references drop alter add column default check constraint begin commit rollback transaction with recursive case when then ' +
    'else end over partition rows range between unbounded preceding following current row asc desc exists like glob returning ' +
    'view trigger explain query plan using natural if replace conflict do nothing integer text real blob numeric autoincrement ' +
    'intersect except cast collate window filter lateral materialized savepoint release').split(' '));
  const SQL_FUNCS = new Set(('count sum avg min max coalesce ifnull nullif length lower upper substr trim round abs date datetime ' +
    'strftime julianday row_number rank dense_rank ntile lag lead first_value last_value nth_value group_concat printf total ' +
    'json_extract json_object json_array instr replace random').split(' '));

  const SQL_TOKEN = /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:''|[^'])*')|("(?:[^"])*")|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_][\w]*)\b/g;

  function highlightSql(code) {
    let out = '';
    let last = 0;
    SQL_TOKEN.lastIndex = 0;
    let m;
    while ((m = SQL_TOKEN.exec(code))) {
      out += escapeHtml(code.slice(last, m.index));
      last = SQL_TOKEN.lastIndex;
      const [tok, comment, str, quoted, num, ident] = m;
      let cls = null;
      if (comment) cls = 'c';
      else if (str) cls = 's';
      else if (quoted) cls = 'f';
      else if (num) cls = 'n';
      else if (ident) {
        const low = ident.toLowerCase();
        if (SQL_KEYWORDS.has(low)) cls = 'k';
        else if (SQL_FUNCS.has(low)) cls = 'b';
      }
      out += cls ? `<span class="tk-${cls}">${escapeHtml(tok)}</span>` : escapeHtml(tok);
    }
    return out + escapeHtml(code.slice(last));
  }

  function highlightJson(code) {
    return escapeHtml(code)
      .replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)?/g, (_, s, colon) => colon ? `<span class="tk-f">${s}</span>${colon}` : `<span class="tk-s">${s}</span>`)
      .replace(/\b(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/gi, '<span class="tk-n">$1</span>')
      .replace(/\b(true|false|null)\b/g, '<span class="tk-k">$1</span>');
  }

  /** Requisição/resposta HTTP: linha inicial, cabeçalhos e corpo (JSON realçado). */
  function highlightHttp(code) {
    const [head, ...bodyParts] = code.split(/\n\s*\n/);
    const lines = head.split('\n').map((line, i) => {
      if (i === 0 || /^(HTTP\/|GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/.test(line)) {
        return escapeHtml(line)
          .replace(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/, '<span class="tk-k">$1</span>')
          .replace(/\b(HTTP\/[\d.]+)\s+(\d{3})/, '<span class="tk-b">$1</span> <span class="tk-n">$2</span>');
      }
      const hm = line.match(/^([\w-]+)(:\s*)(.*)$/);
      if (hm) return `<span class="tk-f">${escapeHtml(hm[1])}</span>${escapeHtml(hm[2])}<span class="tk-s">${escapeHtml(hm[3])}</span>`;
      return escapeHtml(line);
    });
    const body = bodyParts.join('\n\n');
    return lines.join('\n') + (bodyParts.length ? '\n\n' + (/^\s*[[{]/.test(body) ? highlightJson(body) : escapeHtml(body)) : '');
  }

  function highlight(code, lang) {
    if (!lang || /^py(thon)?$/i.test(lang)) return highlightPython(code);
    if (/^sql(ite)?$/i.test(lang)) return highlightSql(code);
    if (/^json$/i.test(lang)) return highlightJson(code);
    if (/^http$/i.test(lang)) return highlightHttp(code);
    return escapeHtml(code);
  }

  function inline(text) {
    // Extrai `código` primeiro para não formatar o conteúdo dele.
    const codes = [];
    let s = String(text).replace(/`([^`]+)`/g, (_, c) => {
      codes.push(c);
      return `\u0000${codes.length - 1}\u0000`;
    });
    s = escapeHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[+i])}</code>`);
  }

  function codeBlock(code, lang) {
    return `<pre class="code-block" data-lang="${escapeHtml(lang || 'python')}"><code>${highlight(code.replace(/\n$/, ''), lang)}</code></pre>`;
  }

  function render(md) {
    if (!md) return '';
    const lines = String(md).replace(/\r\n/g, '\n').split('\n');
    const html = [];
    let i = 0;

    const isBlockStart = l => /^(```|#{1,4}\s|>\s?|\s*[-*]\s|\s*\d+\.\s|\|.*\||---\s*$)/.test(l);

    while (i < lines.length) {
      const line = lines[i];

      if (/^```/.test(line)) {
        const lang = line.slice(3).trim();
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        html.push(codeBlock(buf.join('\n'), lang));
        continue;
      }
      if (/^\s*$/.test(line)) { i++; continue; }

      const hm = line.match(/^(#{1,4})\s+(.*)$/);
      if (hm) {
        const lvl = Math.min(hm[1].length + 1, 5);
        html.push(`<h${lvl}>${inline(hm[2])}</h${lvl}>`);
        i++;
        continue;
      }
      if (/^---\s*$/.test(line)) { html.push('<hr/>'); i++; continue; }

      if (/^>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
        let cls = 'callout';
        const first = buf[0] || '';
        const tag = first.match(/^\[!(dica|tip|atencao|warning|info|nota|sabia|curiosidade)\]\s*/i);
        let label = '';
        if (tag) {
          buf[0] = first.slice(tag[0].length);
          const t = tag[1].toLowerCase();
          cls += ({ dica: ' tip', tip: ' tip', atencao: ' warn', warning: ' warn', sabia: ' fact', curiosidade: ' fact' })[t] || ' info';
          label = ({ dica: 'Dica', tip: 'Dica', atencao: 'Atenção', warning: 'Atenção', sabia: 'Você sabia?', curiosidade: 'Você sabia?', info: 'Nota', nota: 'Nota' })[t];
        }
        html.push(`<blockquote class="${cls}">${label ? `<div class="callout-label">${label}</div>` : ''}${render(buf.join('\n'))}</blockquote>`);
        continue;
      }

      if (/^\|.*\|\s*$/.test(line)) {
        const rows = [];
        while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
        const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const hasHead = rows.length > 1 && /^\|?\s*:?-{2,}/.test(rows[1]);
        let t = '<div class="table-wrap"><table>';
        if (hasHead) {
          t += '<thead><tr>' + cells(rows[0]).map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead>';
          rows.splice(0, 2);
        }
        t += '<tbody>' + rows.map(r => '<tr>' + cells(r).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
        html.push(t);
        continue;
      }

      const lm = line.match(/^\s*([-*]|\d+\.)\s+/);
      if (lm) {
        const ordered = /\d/.test(lm[1]);
        const items = [];
        while (i < lines.length) {
          const m2 = lines[i].match(/^\s*([-*]|\d+\.)\s+(.*)$/);
          if (m2) { items.push(m2[2]); i++; continue; }
          // continuação de item (linha indentada)
          if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1] += ' ' + lines[i].trim(); i++; continue; }
          break;
        }
        const tag = ordered ? 'ol' : 'ul';
        html.push(`<${tag}>${items.map(it => `<li>${inline(it)}</li>`).join('')}</${tag}>`);
        continue;
      }

      const buf = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i])) buf.push(lines[i++]);
      if (!buf.length) { buf.push(lines[i++]); }
      html.push(`<p>${inline(buf.join(' '))}</p>`);
    }
    return html.join('\n');
  }

  /**
   * Converte texto de fala (com `código`, **negrito**, *itálico*) em segmentos
   * para a animação de digitação da caixa de diálogo.
   */
  function segments(text) {
    const segs = [];
    const re = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g;
    let last = 0;
    let m;
    const s = String(text);
    while ((m = re.exec(s))) {
      if (m.index > last) segs.push({ text: s.slice(last, m.index) });
      if (m[1] !== undefined) segs.push({ text: m[1], tag: 'code' });
      else if (m[2] !== undefined) segs.push({ text: m[2], tag: 'strong' });
      else segs.push({ text: m[3], tag: 'em' });
      last = re.lastIndex;
    }
    if (last < s.length) segs.push({ text: s.slice(last) });
    return segs;
  }

  window.MD = { render, inline, highlight, highlightPython, highlightSql, codeBlock, segments };
})();
