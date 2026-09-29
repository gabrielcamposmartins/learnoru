Game.registerTrack({
  id: 'observability',
  title: 'Observabilidade & SRE',
  icon: '📡',
  color: '#818cf8',
  order: 10,
  character: 'lia',
  characterRole: 'Instrutora · SRE',
  description: 'Logs estruturados, métricas, tracing distribuído, percentis de latência, SLOs e error budgets, deploy seguro e gestão de incidentes.',
  units: [
    { id: 'sinais', title: 'Os sinais', description: 'Logs, métricas, traces — e por que a média mente.' },
    { id: 'confiabilidade', title: 'Confiabilidade', description: 'SLI, SLO, SLA, error budgets e alertas por burn rate.' },
    { id: 'operacao', title: 'Operação', description: 'Deploy seguro, feature flags, incidentes e postmortems.' },
    { id: 'entrevistas', title: 'Entrevistas', description: 'SRE e operação em entrevista.' },
  ],
  intro: [
    'Bem-vindo(a) à trilha de **Observabilidade & SRE**! Sistema em produção que você não consegue observar é sistema que você não controla.',
    'Vamos de logs e métricas a **SLOs**, **error budgets** e **postmortems** — e entender por que olhar a **média** de latência esconde seus piores problemas.',
  ],
  lines: {
    askCode: ['Implemente — pense no que você gostaria de ver às 3h da manhã durante um incidente.', 'Hora do código!'],
    correct: ['Isso! O plantão agradece.', 'Perfeito — observabilidade de verdade.', 'Exato.'],
    partial: ['Bom, mas pense no que falta para diagnosticar um incidente.', 'Quase — faltou algum sinal importante.'],
    wrong: ['Hmm, isso não ajudaria durante um incidente.', 'Não exatamente — o que o usuário realmente sente?'],
  },
});
