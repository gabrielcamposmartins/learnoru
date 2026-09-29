Game.registerTrack({
  id: 'testing',
  title: 'Testes em Python',
  icon: '🧪',
  color: '#f472b6',
  order: 4,
  character: 'lia',
  characterRole: 'Instrutora · Qualidade & Testes',
  description: 'pytest na prática, fixtures, parametrize, mocks, TDD, property-based testing, snapshot e testes de integração.',
  units: [
    { id: 'fundamentos', title: 'Fundamentos', description: 'Por que testar, pirâmide de testes e o essencial do pytest.' },
    { id: 'dubles', title: 'Dublês de teste', description: 'Stubs, fakes, spies e mocks — e quando não usar.' },
    { id: 'tdd', title: 'TDD', description: 'Red → Green → Refactor, na prática, com katas guiados.' },
    { id: 'qualidade', title: 'Técnicas avançadas', description: 'Boas práticas, property-based, builders de dados, snapshot e integração.' },
    { id: 'entrevistas', title: 'Entrevistas', description: 'Estratégia de testes em entrevista.' },
  ],
  intro: [
    'Bem-vindo(a) à trilha de **Testes em Python**! Aqui quem escreve os testes é **você** — com `pytest` rodando de verdade.',
    'Para saber se seus testes são bons, eu planto **bugs** no código: um bom teste precisa pegá-los. E no fim, vamos praticar **TDD** ciclo a ciclo.',
  ],
  lines: {
    askCode: ['Mão no código! Pense também em como você testaria isso.', 'Implemente — os testes vão dizer se está certo.'],
    correct: ['Isso! Teste bom é teste que pega bug.', 'Perfeito — cobertura de verdade, não só de linha.', 'Excelente!'],
    partial: ['Bom! Mas alguns casos ficaram de fora.', 'Quase lá — pense nos casos de borda.'],
    testsFail: ['Algum teste falhou. Leia a mensagem do pytest com calma — ela mostra os valores.', 'Vermelho! Compare o esperado com o obtido.'],
  },
});
