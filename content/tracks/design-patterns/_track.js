Game.registerTrack({
  id: 'design-patterns',
  title: 'Design Patterns',
  icon: '🧩',
  color: '#a78bfa',
  order: 1,
  character: 'lia',
  characterRole: 'Instrutora · Design Patterns',
  description: 'Os 23 padrões do GoF em Python — criacionais, estruturais e comportamentais — mais idiomas pythônicos e anti-patterns.',
  units: [
    { id: 'fundamentos', title: 'Fundamentos', description: 'O que são padrões, as três famílias do GoF e quando não usar.' },
    { id: 'criacionais', title: 'Padrões criacionais', description: 'Como objetos são criados: Singleton, Factory, Builder, Prototype.' },
    { id: 'estruturais', title: 'Padrões estruturais', description: 'Como objetos se compõem: Adapter, Facade, Decorator, Proxy, Composite, Bridge, Flyweight.' },
    { id: 'comportamentais', title: 'Padrões comportamentais', description: 'Como objetos colaboram: Strategy, Observer, Command, State, Visitor e companhia.' },
    { id: 'pythonicos', title: 'Pythônicos & além', description: 'Null Object, registros de plugins, anti-patterns — o que o GoF não conta.' },
    { id: 'entrevistas', title: 'Entrevistas', description: 'Simulações de entrevista sobre design orientado a objetos.' },
  ],
  intro: [
    'Bem-vindo(a) à trilha de **Design Patterns**!',
    'Padrões são soluções testadas para problemas recorrentes de design. Vamos ver cada um com exemplos em `Python` e quando **não** usar.',
  ],
  lines: {
    correct: ['Perfeito! Você pegou a ideia.', 'Isso mesmo! 👏', 'Excelente — é exatamente isso.', 'Muito bem! Esse é o espírito do padrão.'],
    wrong: ['Hmm, não exatamente. Pensa no problema que o padrão resolve.', 'Quase! Tenta de novo com calma.', 'Não é essa. Lembra do exemplo que vimos?'],
  },
});
