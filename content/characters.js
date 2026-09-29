/*
 * Personagens (instrutores / entrevistadores).
 *
 * Dois jeitos de definir a aparência:
 *
 * 1) sprites — imagens do busto por expressão (preferido):
 *      sprites: { idle, explaining, waiting, cheering, worried, happy, angry }  caminhos das imagens
 *      moods:   humor -> sprite (padrão: neutral=idle, happy=happy, thinking=waiting,
 *               surprised=explaining, concerned=worried, cheer=cheering, angry=angry)
 *      talk:    sprites alternados enquanto fala (padrão: ['idle', 'explaining'])
 *      talkingMoods: humores que usam o ciclo de fala (padrão: neutral, thinking, surprised);
 *               nos demais (happy, concerned, cheer, angry) o sprite do humor fica fixo durante a fala.
 *      As cores dos sprites são harmonizadas pelo tools/harmonize_sprites.py (originais em
 *      content/assets/originais/). Ao trocar ou adicionar uma imagem, rode o script de novo.
 *
 * 2) look — busto desenhado em SVG (sem precisar de arte):
 *      skin, hair, eyes, jacket, shirt, accent, hairStyle ('short'|'bob'|'long'|'bun'|'curly'|'buzz'),
 *      glasses, beard, accessory ('headset'|'earrings'|'pencil')
 *
 * side: 'left' | 'right' — lado da tela nas sessões
 * voicePitch: tom do "blip" de fala
 * lines: falas de reação (ask, askOpen, askCode, correct, partial, wrong, codeError, testsFail)
 *
 * Cada trilha pode sobrescrever characterRole, side e lines (ver content/tracks/<trilha>/_track.js).
 */

Game.registerCharacter({
  id: 'lia',
  name: 'Lia',
  role: 'Instrutora',
  // A arte olha levemente para a esquerda: à direita da tela ela "olha" para o quadro.
  side: 'right',
  voicePitch: 640,
  sprites: {
    idle: 'content/assets/idle.png',
    explaining: 'content/assets/explaining.png',
    waiting: 'content/assets/waiting.png',
    cheering: 'content/assets/cheering.png',
    worried: 'content/assets/worried.png',
    happy: 'content/assets/happy.png',
    angry: 'content/assets/angry.png',
  },
  lines: {
    correct: ['Perfeito! Você pegou a ideia.', 'Isso mesmo! 👏', 'Excelente — é exatamente isso.', 'Muito bem!'],
    partial: ['Bom! Só alguns detalhes para lapidar.', 'Está no caminho certo — veja os pontos de melhoria.'],
    wrong: ['Hmm, não exatamente. Tente de novo com calma.', 'Quase! Pensa mais um pouco.', 'Não é essa. Lembra do exemplo que vimos?'],
  },
});
