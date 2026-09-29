Game.registerTrack({
  id: 'python',
  title: 'Python Avançado',
  icon: '🐍',
  color: '#60a5fa',
  order: 8,
  character: 'lia',
  characterRole: 'Instrutora · Python Avançado',
  description: 'O Python por dentro: modelo de dados, geradores, decorators, context managers, descritores, metaclasses, typing moderno e pattern matching.',
  units: [
    { id: 'objetos', title: 'O modelo de objetos', description: 'Dunder methods, descritores e metaprogramação.' },
    { id: 'funcional', title: 'Iteração & composição', description: 'Iteradores, geradores, decorators e context managers.' },
    { id: 'tipos', title: 'Tipos & dados', description: 'Typing moderno, dataclasses e pattern matching estrutural.' },
  ],
  intro: [
    'Bem-vindo(a) à trilha de **Python Avançado**! Aqui a gente abre o capô da linguagem.',
    'Você vai ver como `for`, `with`, `@decorator` e `property` funcionam **por dentro** — e conhecer recursos que muita gente experiente nunca usou, como **descritores** e `__init_subclass__`.',
  ],
  lines: {
    askCode: ['Implemente do jeito pythônico!', 'Hora do código — pense no protocolo que o Python espera.'],
    correct: ['Isso! Bem pythônico.', 'Perfeito — o Guido aprovaria.', 'Exato.'],
    partial: ['Funciona, mas dá para ser mais pythônico.', 'Bom! Tem um jeito mais idiomático.'],
    wrong: ['Hmm, não é assim que o Python faz por baixo.', 'Não exatamente — qual método mágico entra em ação aqui?'],
  },
});
