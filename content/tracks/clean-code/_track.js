Game.registerTrack({
  id: 'clean-code',
  title: 'Clean Code & Refatoração',
  icon: '🧹',
  color: '#34d399',
  order: 9,
  character: 'lia',
  characterRole: 'Instrutora · Clean Code',
  description: 'Nomes, funções, code smells, catálogo de refatorações, complexidade ciclomática, acoplamento, princípios e como domar código legado.',
  units: [
    { id: 'fundamentos', title: 'Fundamentos', description: 'Nomes, funções e o catálogo de code smells.' },
    { id: 'refatoracao', title: 'Refatoração', description: 'Refatorações clássicas e como medir complexidade.' },
    { id: 'design', title: 'Design & princípios', description: 'Acoplamento, coesão, connascence e princípios (e seus exageros).' },
    { id: 'legado', title: 'Código legado', description: 'Seams, testes de caracterização e mudanças seguras.' },
    { id: 'entrevistas', title: 'Entrevistas', description: 'Code review ao vivo.' },
  ],
  intro: [
    'Bem-vindo(a) à trilha de **Clean Code & Refatoração**! Código é lido muito mais vezes do que é escrito.',
    'Vamos aprender a **enxergar** problemas (os *code smells*), a corrigi-los com segurança (as **refatorações**) — e a medir complexidade de verdade, com a própria árvore sintática do Python.',
  ],
  lines: {
    askCode: ['Refatore — os testes garantem que o comportamento não muda.', 'Hora de limpar esse código!'],
    correct: ['Isso! Bem mais legível.', 'Perfeito — dá gosto de ler.', 'Exato.'],
    partial: ['Melhorou, mas ainda tem cheiro por aí.', 'Bom! Dá para simplificar mais.'],
    wrong: ['Hmm, isso não resolve o problema de design.', 'Não exatamente — qual é o cheiro principal aqui?'],
  },
});
