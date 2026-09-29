Game.registerTrack({
  id: 'architecture',
  title: 'Arquitetura de Software',
  icon: '🏛️',
  color: '#fb923c',
  order: 3,
  character: 'lia',
  characterRole: 'Arquiteta de Software',
  description: 'SOLID, estilos arquiteturais, DDD, eventos, CQRS, sagas e como documentar e evoluir uma arquitetura.',
  units: [
    { id: 'principios', title: 'Princípios', description: 'SOLID e inversão/injeção de dependência.' },
    { id: 'estilos', title: 'Estilos arquiteturais', description: 'Camadas, hexagonal, monólito × microsserviços e arquitetura orientada a eventos.' },
    { id: 'ddd', title: 'Domain-Driven Design', description: 'Linguagem ubíqua, bounded contexts, agregados e eventos de domínio.' },
    { id: 'dados-eventos', title: 'Dados & eventos', description: 'CQRS, Event Sourcing e sagas para transações distribuídas.' },
    { id: 'qualidades', title: 'Qualidades & evolução', description: 'Escalabilidade, fitness functions, métricas de acoplamento, ADRs e C4.' },
    { id: 'entrevistas', title: 'Entrevistas', description: 'Modelagem de domínio e system design.' },
  ],
  intro: [
    'Olá! Nesta trilha eu sou sua **arquiteta de software**. Arquitetura é a arte de tomar decisões difíceis de mudar depois.',
    'Vamos estudar princípios e estilos arquiteturais, sempre olhando os **trade-offs** — é isso que entrevistadores querem ouvir.',
  ],
  lines: {
    ask: ['Qual decisão de arquitetura você tomaria?', 'Pense nos trade-offs e escolha.'],
    askOpen: ['Arquitetura é sobre trade-offs. Me explica os seus.', 'Como você defenderia essa decisão numa revisão de design?'],
    correct: ['Isso! Decisão bem fundamentada.', 'Perfeito — pensou como arquiteta(o).', 'Exato. Esse é o trade-off certo.'],
    partial: ['Boa direção. Faltaram alguns trade-offs.', 'Bom! Mas uma revisão de arquitetura pediria mais detalhes.'],
    wrong: ['Hmm, isso traria problemas em produção. Pense de novo.', 'Não exatamente — qual seria o custo dessa escolha?'],
  },
});
