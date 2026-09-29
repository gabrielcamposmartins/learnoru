/*
 * Personagem 2D (busto). Dois modos:
 *  - sprites: imagens por expressão (ver createSprite)
 *  - SVG desenhado a partir do `look` (fallback, sem precisar de arte)
 * Expressões: neutral, happy, thinking, surprised, concerned, cheer, angry.
 * A boca "fala" enquanto o texto é digitado no diálogo.
 */
(function () {
  // 'cheer' = comemoração (acertos, resultado perfeito); no SVG equivale a 'happy'.
  // 'angry' = bronca bem-humorada (ex.: pular a explicação); use com moderação.
  const MOODS = ['neutral', 'happy', 'thinking', 'surprised', 'concerned', 'cheer', 'angry'];

  const BROWS = {
    neutral: ['M121 123 Q136 116 151 122', 'M169 122 Q184 116 199 123'],
    happy: ['M121 119 Q136 110 151 117', 'M169 117 Q184 110 199 119'],
    thinking: ['M121 122 Q136 118 151 123', 'M169 115 Q184 106 199 114'],
    surprised: ['M121 113 Q136 102 151 111', 'M169 111 Q184 102 199 113'],
    concerned: ['M121 124 Q136 121 151 115', 'M169 115 Q184 121 199 124'],
    angry: ['M121 114 Q136 118 151 125', 'M169 125 Q184 118 199 114'],
  };

  const MOUTHS = {
    neutral: { d: 'M146 181 Q160 189 174 181', fill: false },
    happy: { d: 'M143 177 Q160 199 177 177 Q160 184 143 177 Z', fill: true },
    thinking: { d: 'M149 185 Q158 181 172 183', fill: false },
    surprised: { d: 'M152 184 a8 10 0 1 0 16 0 a8 10 0 1 0 -16 0', fill: true },
    concerned: { d: 'M147 187 Q160 178 173 187', fill: false },
    angry: { d: 'M147 186 Q160 181 173 186', fill: false },
  };
  const MOUTH_OPEN = { d: 'M148 179 Q160 195 172 179 Q160 182 148 179 Z', fill: true };
  const MOUTH_HALF = { d: 'M150 181 Q160 189 170 181 Q160 183 150 181 Z', fill: true };

  const PUPIL_OFFSET = {
    neutral: [0, 0], happy: [0, 0], thinking: [4, -4], surprised: [0, 0], concerned: [0, 2], angry: [0, 1],
  };

  function shade(hex, amt) {
    const n = parseInt(hex.replace('#', ''), 16);
    const clamp = v => Math.max(0, Math.min(255, v));
    const r = clamp((n >> 16) + amt);
    const g = clamp(((n >> 8) & 0xff) + amt);
    const b = clamp((n & 0xff) + amt);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  function hairBack(style, c) {
    switch (style) {
      case 'bob':
        return `<path d="M86 132 Q82 58 160 52 Q238 58 234 132 L238 214 Q214 230 198 208 L122 208 Q106 230 82 214 Z" fill="${c}"/>`;
      case 'long':
        return `<path d="M84 130 Q80 54 160 50 Q240 54 236 130 L246 300 Q220 318 200 290 L120 290 Q100 318 74 300 Z" fill="${c}"/>`;
      case 'bun':
        return `<circle cx="160" cy="52" r="30" fill="${c}"/><circle cx="160" cy="52" r="30" fill="none" stroke="${shade(c, -25)}" stroke-width="3" stroke-dasharray="6 8"/>`;
      case 'curly': {
        let s = '';
        for (let i = 0; i <= 12; i++) {
          const a = Math.PI * (0.95 + i * 0.1);
          const x = 160 + Math.cos(a) * 74;
          const y = 138 + Math.sin(a) * 84;
          s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${20 + (i % 3) * 3}" fill="${c}"/>`;
        }
        return s + `<path d="M84 140 Q86 190 96 214 L224 214 Q234 190 236 140 Z" fill="${c}"/>`;
      }
      default:
        return '';
    }
  }

  function hairFront(style, c) {
    const hl = shade(c, 35);
    switch (style) {
      case 'short':
        return `<path d="M93 140 Q86 66 160 58 Q234 66 227 140 Q222 104 198 92 Q170 108 132 96 Q104 106 93 140 Z" fill="${c}"/>
                <path d="M130 76 Q160 66 190 76" stroke="${hl}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".5"/>`;
      case 'bob':
      case 'long':
        return `<path d="M93 142 Q90 62 160 58 Q230 62 227 142 Q216 98 178 88 Q150 114 104 110 Q97 122 93 142 Z" fill="${c}"/>
                <path d="M150 72 Q182 70 206 88" stroke="${hl}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".45"/>`;
      case 'bun':
        return `<path d="M95 134 Q94 66 160 64 Q226 66 225 134 Q212 94 160 90 Q108 94 95 134 Z" fill="${c}"/>
                <path d="M128 76 Q160 68 192 76" stroke="${hl}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".45"/>`;
      case 'curly': {
        let s = '';
        for (let i = 0; i <= 8; i++) {
          const a = Math.PI * (1.08 + i * 0.105);
          const x = 160 + Math.cos(a) * 60;
          const y = 128 + Math.sin(a) * 62;
          s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${15 + (i % 2) * 3}" fill="${c}"/>`;
        }
        return s;
      }
      case 'buzz':
        return `<path d="M95 128 Q92 70 160 64 Q228 70 225 128 Q214 96 160 92 Q106 96 95 128 Z" fill="${c}" opacity=".9"/>`;
      default:
        return '';
    }
  }

  function svg(look, uid) {
    const L = Object.assign({
      skin: '#f1c7a5', hair: '#3b2a24', hairStyle: 'short', eyes: '#3b6ea8',
      jacket: '#334155', shirt: '#e2e8f0', accent: '#7c9cff', glasses: false,
      accessory: null, beard: false, lips: '#9b3b4a',
    }, look);
    const skinShade = shade(L.skin, -28);
    const jacketShade = shade(L.jacket, -22);
    const mouthColor = shade(L.lips, -30);

    const glasses = L.glasses ? `
      <g class="glasses" fill="rgba(200,230,255,.10)" stroke="#1f2533" stroke-width="3.5">
        <rect x="116" y="131" width="38" height="29" rx="9"/>
        <rect x="166" y="131" width="38" height="29" rx="9"/>
        <path d="M154 143 Q160 139 166 143" fill="none"/>
        <path d="M116 141 L98 136 M204 141 L222 136" fill="none"/>
      </g>` : '';

    let accessory = '';
    if (L.accessory === 'headset') {
      accessory = `
        <path d="M90 146 Q88 44 160 42 Q232 44 230 146" fill="none" stroke="#1f2533" stroke-width="9" stroke-linecap="round"/>
        <rect x="80" y="130" width="20" height="36" rx="8" fill="#1f2533"/>
        <rect x="220" y="130" width="20" height="36" rx="8" fill="#1f2533"/>
        <rect x="84" y="136" width="8" height="24" rx="4" fill="${L.accent}"/>
        <path d="M92 164 Q100 200 138 200" fill="none" stroke="#1f2533" stroke-width="4" stroke-linecap="round"/>
        <circle cx="140" cy="200" r="5" fill="${L.accent}"/>`;
    } else if (L.accessory === 'earrings') {
      accessory = `<circle cx="96" cy="170" r="4.5" fill="${L.accent}"/><circle cx="224" cy="170" r="4.5" fill="${L.accent}"/>`;
    } else if (L.accessory === 'pencil') {
      accessory = `<g transform="rotate(-20 222 116)"><rect x="214" y="92" width="7" height="44" rx="2" fill="#fbbf24"/><path d="M214 136 L217.5 146 L221 136 Z" fill="#f5d0a9"/><rect x="214" y="92" width="7" height="6" fill="#f87171"/></g>`;
    }

    const beard = L.beard ? `<path d="M100 160 Q104 222 160 232 Q216 222 220 160 Q214 196 192 204 Q160 214 128 204 Q106 196 100 160 Z" fill="${L.hair}" opacity=".92"/>
      <path d="M140 176 Q160 170 180 176 Q160 182 140 176 Z" fill="${L.hair}"/>` : '';

    return `
<svg class="char-svg" viewBox="0 0 320 380" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="glow-${uid}" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="${L.accent}" stop-opacity=".35"/>
      <stop offset="100%" stop-color="${L.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="160" cy="170" r="160" fill="url(#glow-${uid})"/>
  <g class="char-body">
    <!-- torso -->
    <path d="M22 380 C 30 300, 88 268, 160 266 C 232 268, 290 300, 298 380 Z" fill="${L.jacket}"/>
    <path d="M128 262 L160 330 L192 262 Q160 276 128 262 Z" fill="${L.shirt}"/>
    <path d="M112 270 L160 352 L138 272 Z" fill="${jacketShade}"/>
    <path d="M208 270 L160 352 L182 272 Z" fill="${jacketShade}"/>
    <rect x="214" y="306" width="36" height="22" rx="4" fill="${L.accent}" opacity=".95"/>
    <rect x="219" y="312" width="18" height="3" rx="1.5" fill="#0b0f1a" opacity=".6"/>
    <rect x="219" y="318" width="24" height="3" rx="1.5" fill="#0b0f1a" opacity=".4"/>
    <!-- pescoço -->
    <path d="M136 200 L136 262 Q160 280 184 262 L184 200 Z" fill="${L.skin}"/>
    <path d="M136 206 Q160 236 184 206 L184 222 Q160 246 136 222 Z" fill="${skinShade}" opacity=".7"/>
    <g class="char-head">
      ${hairBack(L.hairStyle, L.hair)}
      <!-- orelhas -->
      <ellipse cx="97" cy="150" rx="11" ry="17" fill="${L.skin}"/>
      <ellipse cx="223" cy="150" rx="11" ry="17" fill="${L.skin}"/>
      <ellipse cx="98" cy="150" rx="5" ry="9" fill="${skinShade}" opacity=".5"/>
      <ellipse cx="222" cy="150" rx="5" ry="9" fill="${skinShade}" opacity=".5"/>
      <!-- rosto -->
      <ellipse cx="160" cy="142" rx="64" ry="76" fill="${L.skin}"/>
      <path d="M200 90 Q226 130 214 180 Q206 206 180 214 Q210 190 212 146 Q212 112 200 90 Z" fill="${skinShade}" opacity=".25"/>
      <ellipse class="blush" cx="123" cy="170" rx="11" ry="6" fill="#f472b6" opacity=".18"/>
      <ellipse class="blush" cx="197" cy="170" rx="11" ry="6" fill="#f472b6" opacity=".18"/>
      ${beard}
      <!-- olhos -->
      <g class="eyes">
        <g class="eye">
          <ellipse cx="136" cy="146" rx="11" ry="12" fill="#fff"/>
          <g class="pupil"><circle cx="136" cy="147" r="7.5" fill="${L.eyes}"/><circle cx="136" cy="147" r="3.8" fill="#0b0f1a"/><circle cx="138.5" cy="144" r="2.2" fill="#fff"/></g>
        </g>
        <g class="eye">
          <ellipse cx="184" cy="146" rx="11" ry="12" fill="#fff"/>
          <g class="pupil"><circle cx="184" cy="147" r="7.5" fill="${L.eyes}"/><circle cx="184" cy="147" r="3.8" fill="#0b0f1a"/><circle cx="186.5" cy="144" r="2.2" fill="#fff"/></g>
        </g>
      </g>
      <path class="brow brow-l" d="${BROWS.neutral[0]}" stroke="${shade(L.hair, -10)}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path class="brow brow-r" d="${BROWS.neutral[1]}" stroke="${shade(L.hair, -10)}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M160 152 Q155 166 163 169" stroke="${skinShade}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path class="mouth" d="${MOUTHS.neutral.d}" stroke="${mouthColor}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" data-fill="${mouthColor}"/>
      ${hairFront(L.hairStyle, L.hair)}
      ${glasses}
      ${accessory}
    </g>
  </g>
</svg>`;
  }

  let uidSeq = 0;

  /*
   * Modo sprite: o personagem é um conjunto de imagens (busto).
   *
   *   sprites: { idle, explaining, waiting, cheering, worried, happy, angry }  // caminhos das imagens
   *   moods:   { neutral: 'idle', happy: 'happy', ... }           // sprite de cada humor
   *   talk:    ['idle', 'explaining']                             // alternados enquanto fala
   *   talkingMoods: ['neutral', 'thinking', 'surprised']          // humores que "falam" com o ciclo acima;
   *                                                               // os demais mantêm o sprite do humor.
   * Sprite ausente cai no idle; sem sprite 'happy', o humor happy usa o ciclo de fala.
   */
  const DEFAULT_SPRITE_MOODS = {
    neutral: 'idle', happy: 'happy', thinking: 'waiting', surprised: 'explaining', concerned: 'worried', cheer: 'cheering',
    angry: 'angry',
  };
  const TALK_INTERVAL_MS = 110;

  function createSprite(charDef) {
    const sprites = charDef.sprites;
    const moodMap = Object.assign({}, DEFAULT_SPRITE_MOODS, charDef.moods);
    const talk = charDef.talk || ['idle', 'explaining'];
    const talkingMoods = charDef.talkingMoods
      || ['neutral', 'thinking', 'surprised'].concat(sprites[moodMap.happy] ? [] : ['happy']);
    const fallback = sprites.idle ? 'idle' : Object.keys(sprites)[0];

    const el = U.h('div', { class: 'character sprite', dataset: { mood: 'neutral' } });
    const frame = U.h('div', { class: 'sprite-frame' });
    const imgs = {};
    for (const [name, src] of Object.entries(sprites)) {
      imgs[name] = U.h('img', { class: 'sprite-img', src, alt: '', draggable: 'false', decoding: 'async', dataset: { sprite: name } });
      frame.appendChild(imgs[name]);
    }
    el.appendChild(frame);

    let mood = 'neutral';
    let talking = false;
    let mouthOpen = false;
    let lastFlap = 0;
    let current = null;

    const resolve = name => (imgs[name] ? name : fallback);

    function show(name) {
      name = resolve(name);
      if (current === name) return;
      if (current) imgs[current].classList.remove('on');
      imgs[name].classList.add('on');
      current = name;
      el.dataset.sprite = name;
    }

    function render() {
      if (talking && talkingMoods.includes(mood)) show(mouthOpen ? talk[1] : talk[0]);
      else show(moodMap[mood] || fallback);
    }

    function setMood(m) {
      if (!MOODS.includes(m)) m = 'neutral';
      mood = m;
      el.dataset.mood = m;
      render();
    }

    render();

    return {
      el,
      def: charDef,
      get mood() { return mood; },
      setMood,
      /** Alterna boca aberta/fechada — limitado no tempo para não piscar rápido demais. */
      flap() {
        const now = performance.now();
        if (now - lastFlap < TALK_INTERVAL_MS) return;
        lastFlap = now;
        mouthOpen = !mouthOpen;
        render();
      },
      setTalking(on) {
        talking = on;
        mouthOpen = on;
        lastFlap = performance.now();
        el.classList.toggle('talking', on);
        render();
      },
      destroy() {},
    };
  }

  const CharacterView = {
    MOODS,

    create(charDef) {
      if (charDef.sprites) return createSprite(charDef);
      const uid = `c${++uidSeq}`;
      const el = U.h('div', { class: 'character', dataset: { mood: 'neutral' } });
      el.innerHTML = svg(charDef.look || {}, uid);
      const mouth = el.querySelector('.mouth');
      const browL = el.querySelector('.brow-l');
      const browR = el.querySelector('.brow-r');
      const pupils = el.querySelectorAll('.pupil');
      const fillColor = mouth.getAttribute('data-fill');
      let mood = 'neutral';
      let flapState = 0;

      function setMouth(shape) {
        mouth.setAttribute('d', shape.d);
        mouth.setAttribute('fill', shape.fill ? fillColor : 'none');
      }

      function setMood(m) {
        if (m === 'cheer') m = 'happy';
        if (!MOODS.includes(m)) m = 'neutral';
        mood = m;
        el.dataset.mood = m;
        browL.setAttribute('d', BROWS[m][0]);
        browR.setAttribute('d', BROWS[m][1]);
        const [dx, dy] = PUPIL_OFFSET[m];
        pupils.forEach(p => p.setAttribute('transform', `translate(${dx} ${dy})`));
        setMouth(MOUTHS[m]);
      }

      // Piscar em intervalos aleatórios.
      let blinkTimer;
      const scheduleBlink = () => {
        blinkTimer = setTimeout(() => {
          el.classList.add('blink');
          setTimeout(() => el.classList.remove('blink'), 140);
          scheduleBlink();
        }, 2200 + Math.random() * 3000);
      };
      scheduleBlink();

      return {
        el,
        def: charDef,
        get mood() { return mood; },
        setMood,
        /** Chamado a cada poucos caracteres digitados. */
        flap() {
          flapState = (flapState + 1) % 3;
          setMouth(flapState === 0 ? MOUTHS[mood] : flapState === 1 ? MOUTH_OPEN : MOUTH_HALF);
        },
        setTalking(on) {
          el.classList.toggle('talking', on);
          if (!on) setMouth(MOUTHS[mood]);
        },
        destroy() { clearTimeout(blinkTimer); },
      };
    },
  };

  window.CharacterView = CharacterView;
})();
