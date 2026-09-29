/*
 * Aparência: tema (moderno | retro), paleta do tema retro e efeito CRT.
 * Aplica atributos no <html> (data-theme, data-palette, data-crt) que o css/retro.css usa.
 * O index.html tem uma cópia mínima disto no <head> para aplicar o tema antes da primeira pintura.
 */
(function () {
  const RETRO_FONTS = 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=Orbitron:wght@500;600;700;800&display=swap';

  const THEMES = [
    { id: 'moderno', name: 'Moderno', desc: 'Escuro, limpo, cantos arredondados' },
    { id: 'retro', name: 'Retrofuturista', desc: 'Neon, grade no horizonte, visual de HUD' },
  ];

  // colors: [destaque, destaque 2, fundo] — usados nas amostras das configurações.
  const PALETTES = [
    { id: 'synthwave', name: 'Synthwave', colors: ['#ff2a6d', '#05d9e8', '#0d0221'] },
    { id: 'tron', name: 'Tron', colors: ['#00e5ff', '#2f7bff', '#000b13'] },
    { id: 'vaporwave', name: 'Vaporwave', colors: ['#ff71ce', '#01cdfe', '#1a0b2e'] },
    { id: 'fosforo', name: 'Fósforo verde', colors: ['#33ff66', '#a6ff4d', '#010a03'] },
    { id: 'ambar', name: 'Âmbar', colors: ['#ffb000', '#ff7a00', '#0c0600'] },
  ];

  function ensureFonts() {
    if (document.getElementById('retro-fonts')) return;
    const link = document.createElement('link');
    link.id = 'retro-fonts';
    link.rel = 'stylesheet';
    link.href = RETRO_FONTS;
    document.head.appendChild(link);
  }

  const Theme = {
    THEMES,
    PALETTES,
    RETRO_FONTS,
    apply(settings = Store.settings()) {
      const root = document.documentElement;
      const retro = settings.theme === 'retro';
      const palette = PALETTES.some(p => p.id === settings.palette) ? settings.palette : PALETTES[0].id;
      root.dataset.theme = retro ? 'retro' : 'moderno';
      root.dataset.palette = palette;
      root.dataset.crt = settings.crt === false ? 'off' : 'on';
      if (retro) ensureFonts();
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = retro ? PALETTES.find(p => p.id === palette).colors[2] : '#07090e';
    },
  };

  window.Theme = Theme;
})();
