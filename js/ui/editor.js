/* Editor de código Python: CodeMirror 5 (se disponível) ou textarea como fallback. */
(function () {
  const CodeEditor = {
    /** mode: 'python' (padrão) ou 'sql'. */
    create(parent, { value = '', readOnly = false, minLines = 10, mode = 'python' } = {}) {
      if (window.CodeMirror) {
        const cm = window.CodeMirror(parent, {
          value,
          mode: mode === 'sql' ? 'text/x-sqlite' : 'python',
          theme: 'game',
          lineNumbers: true,
          indentUnit: mode === 'sql' ? 2 : 4,
          tabSize: 4,
          indentWithTabs: false,
          matchBrackets: true,
          autoCloseBrackets: true,
          readOnly,
          viewportMargin: Infinity,
          extraKeys: {
            Tab: c => c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('    ', 'end'),
            'Shift-Tab': c => c.indentSelection('subtract'),
          },
        });
        // A altura mínima vai na área de rolagem (no wrapper, ela expõe a barra nativa escondida).
        cm.getScrollerElement().style.minHeight = `${minLines * 1.5}em`;
        setTimeout(() => cm.refresh(), 0);
        return {
          getValue: () => cm.getValue(),
          setValue: v => cm.setValue(v),
          focus: () => cm.focus(),
          onChange: fn => cm.on('change', () => fn(cm.getValue())),
          addKey: (key, fn) => cm.addKeyMap({ [key]: fn }),
          refresh: () => cm.refresh(),
          setReadOnly: ro => {
            cm.setOption('readOnly', ro);
            cm.getWrapperElement().classList.toggle('cm-readonly', ro);
          },
        };
      }

      // Fallback: textarea com Tab = 4 espaços e auto-indentação básica.
      const ta = U.h('textarea', { class: 'code-fallback', spellcheck: 'false', rows: minLines });
      ta.value = value;
      ta.readOnly = readOnly;
      const keyHandlers = [];
      ta.addEventListener('keydown', e => {
        for (const k of keyHandlers) if (k.test(e)) { e.preventDefault(); k.fn(); return; }
        if (e.key === 'Tab') {
          e.preventDefault();
          const { selectionStart: s, selectionEnd: en } = ta;
          ta.setRangeText('    ', s, en, 'end');
        } else if (e.key === 'Enter') {
          const s = ta.selectionStart;
          const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
          const line = ta.value.slice(lineStart, s);
          let indent = line.match(/^\s*/)[0];
          if (/:\s*$/.test(line)) indent += '    ';
          e.preventDefault();
          ta.setRangeText('\n' + indent, s, ta.selectionEnd, 'end');
        }
      });
      parent.appendChild(ta);
      return {
        getValue: () => ta.value,
        setValue: v => { ta.value = v; },
        focus: () => ta.focus(),
        onChange: fn => ta.addEventListener('input', () => fn(ta.value)),
        addKey: (key, fn) => {
          // Aceita apenas "Ctrl-Enter"/"Cmd-Enter"
          keyHandlers.push({ test: e => e.key === 'Enter' && (e.ctrlKey || e.metaKey), fn });
        },
        refresh: () => {},
        setReadOnly: ro => { ta.readOnly = ro; ta.classList.toggle('cm-readonly', ro); },
      };
    },
  };

  window.CodeEditor = CodeEditor;
})();
