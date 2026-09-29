Game.registerTrack({
  id: 'security',
  title: 'Segurança de Aplicações',
  icon: '🛡️',
  color: '#f87171',
  order: 11,
  character: 'lia',
  characterRole: 'Instrutora · AppSec',
  description: 'Modelagem de ameaças, injeção, XSS/CSRF/SSRF, senhas e MFA, autorização (IDOR/BOLA), criptografia na prática e cadeia de suprimentos.',
  units: [
    { id: 'fundamentos', title: 'Fundamentos', description: 'CIA, modelagem de ameaças (STRIDE) e defesa em profundidade.' },
    { id: 'ataques', title: 'Ataques clássicos', description: 'Injeção, XSS, CSRF, SSRF e path traversal — e como se defender.' },
    { id: 'identidade', title: 'Identidade & acesso', description: 'Senhas, MFA, sessões, RBAC/ABAC e falhas de autorização.' },
    { id: 'pratica', title: 'Na prática', description: 'Criptografia sem armadilhas, segredos e supply chain.' },
    { id: 'entrevistas', title: 'Entrevistas', description: 'Segurança em entrevista técnica.' },
  ],
  intro: [
    'Bem-vindo(a) à trilha de **Segurança de Aplicações**! Aqui você vai pensar como quem ataca — para defender melhor.',
    'Vamos explorar vulnerabilidades reais em código Python (com consertos testados) e conceitos como **STRIDE**, **BOLA** e **confused deputy**, que muita gente nunca ouviu falar.',
  ],
  lines: {
    askCode: ['Corrija a vulnerabilidade — os testes incluem um ataque de verdade.', 'Implemente com segurança!'],
    correct: ['Isso! Porta fechada.', 'Perfeito — atacante frustrado.', 'Exato.'],
    partial: ['Melhorou, mas ainda há uma brecha.', 'Bom! Pense no atacante mais criativo.'],
    wrong: ['Hmm, isso ainda seria explorável.', 'Não exatamente — como um atacante contornaria isso?'],
  },
});
