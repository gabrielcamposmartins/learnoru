Game.registerTrack({
  id: 'concurrency',
  title: 'Concorrência & Async',
  icon: '🧵',
  color: '#fbbf24',
  order: 7,
  character: 'lia',
  characterRole: 'Instrutora · Concorrência',
  description: 'Threads, processos e asyncio: GIL, condições de corrida, deadlocks, event loop, TaskGroup, backpressure e as armadilhas do código assíncrono.',
  units: [
    { id: 'fundamentos', title: 'Fundamentos', description: 'Modelos de concorrência, GIL, condições de corrida e deadlocks.' },
    { id: 'async', title: 'asyncio', description: 'Event loop, corrotinas, tarefas, cancelamento, padrões e armadilhas.' },
    { id: 'entrevistas', title: 'Entrevistas', description: 'Concorrência em entrevista técnica.' },
  ],
  intro: [
    'Bem-vindo(a) à trilha de **Concorrência**! É onde os bugs mais difíceis de reproduzir moram.',
    'Vamos entender **threads**, **processos** e **asyncio** — e você vai escrever código assíncrono de verdade, com `await` rodando aqui no navegador.',
  ],
  lines: {
    askCode: ['Implemente — e pense em quem mais pode estar mexendo nesse dado.', 'Hora do código. Cuidado com o que bloqueia o event loop!'],
    correct: ['Isso! Sem corrida, sem deadlock.', 'Perfeito — concorrência bem domada.', 'Exato.'],
    partial: ['Funciona, mas pense no pior entrelaçamento possível.', 'Bom! Alguns detalhes de concorrência ficaram de fora.'],
    wrong: ['Hmm, isso tem uma condição de corrida escondida.', 'Não exatamente — o que acontece se duas tarefas rodarem ao mesmo tempo?'],
  },
});
