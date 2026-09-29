Game.registerTrack({
  id: 'distributed',
  title: 'Sistemas Distribuídos',
  icon: '🌐',
  color: '#e879f9',
  order: 12,
  character: 'lia',
  characterRole: 'Instrutora · Sistemas Distribuídos',
  description: 'Falácias da computação distribuída, relógios lógicos, quóruns, consenso, CRDTs, entrega de mensagens e idempotência.',
  units: [
    { id: 'fundamentos', title: 'Fundamentos', description: 'Falhas parciais, falácias, tempo e ordem de eventos.' },
    { id: 'coordenacao', title: 'Coordenação', description: 'Quóruns, eleição de líder, consenso e fencing tokens.' },
    { id: 'dados', title: 'Dados & mensagens', description: 'Modelos de consistência, CRDTs e garantias de entrega.' },
    { id: 'entrevistas', title: 'Entrevistas', description: 'Sistemas distribuídos em entrevista.' },
  ],
  intro: [
    'Bem-vindo(a) à trilha de **Sistemas Distribuídos**! Um sistema distribuído é aquele em que uma máquina que você nem sabia que existia pode quebrar o seu.',
    'Vamos entender por que **o tempo não é confiável**, como máquinas concordam entre si e por que "exactly-once" é quase sempre marketing.',
  ],
  lines: {
    askCode: ['Implemente — e assuma que a rede vai perder, duplicar e reordenar mensagens.', 'Hora do código distribuído!'],
    correct: ['Isso! Nenhuma partição te pega.', 'Perfeito — pensou em falha parcial.', 'Exato.'],
    partial: ['Funciona no caminho feliz; e se a mensagem chegar duas vezes?', 'Bom! Pense em falhas parciais.'],
    wrong: ['Hmm, isso quebra numa partição de rede.', 'Não exatamente — relógios de máquinas diferentes não concordam.'],
  },
});
