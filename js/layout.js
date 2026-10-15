/* Stage scaling + the single source of truth for every on-screen rectangle.
   All numbers are stage pixels. Heights of image-backed boxes are derived from the
   trimmed asset aspect ratio so nothing is ever stretched. */
(function (ISL) {
  'use strict';
  const A = ISL.assets;
  const ar = (key, w) => Math.round(A.hForW(key, w));

  const STAGES = { land: { w: 1920, h: 1080 }, port: { w: 1080, h: 1920 } };

  // Landscape: the board runs nearly the full stage height; the left column holds the turn
  // banner and player cards, the right column only the dice and the Roll/Hop button.
  // (the left gap leaves room for the zero jetty, which sits just outside the board).
  // Portrait: board fills the width; dice and the action button sit bottom-centre, under the thumb.
  function tables() {
    return {
      land: {
        'logo-small':    { x: 22,   y: 14,  w: 290, h: ar('ui/logo/wordmark-dark', 290) },
        'topbar':        { x: 1816, y: 24,  w: 84,  h: 84 },
        'turn-banner':   { x: 22,   y: 172, w: 290, h: ar('ui/panels/turn-student', 290) },
        'card-student':  { x: 22,   y: 340, w: 290, h: ar('ui/panels/player-student-active', 290) },
        'card-computer': { x: 22,   y: 516, w: 290, h: ar('ui/panels/player-computer-active', 290) },
        'board-wrap':    { x: 426,  y: 20,  w: 1164, h: 1040 },      // wide board (aspect ~1.12)
        'tray':          { x: 1612, y: 300, w: 290, h: ar('dice/sign-kit/tray', 290) },
        'btn-roll':      { x: 1622, y: 616, w: 270, h: ar('ui/buttons/large-idle', 270) },
        'roll-nudge':    { x: 1717, y: 528, w: 80,  h: 94 },
        'toast':         { x: 426,  y: 60,  w: 1164, h: 90 },
        'hop-hud':       { x: 788,  y: 30,  w: 440, h: 92 },
        'hop-hud-low':   { x: 788,  y: 958, w: 440, h: 92 },
        'coach':         { x: 12,   y: 690, w: 392, h: 372 }
      },
      port: {
        'logo-small':    { x: 30,   y: 22,  w: 270, h: ar('ui/logo/wordmark-dark', 270) },
        'topbar':        { x: 966,  y: 40,  w: 84,  h: 84 },
        'card-student':  { x: 24,   y: 150, w: 330, h: ar('ui/panels/player-student-active', 330) },
        'turn-banner':   { x: 384,  y: 152, w: 312, h: ar('ui/panels/turn-student', 312) },
        'card-computer': { x: 726,  y: 150, w: 330, h: ar('ui/panels/player-computer-active', 330) },
        'board-wrap':    { x: 112,  y: 352, w: 930, h: 930 },
        'tray':          { x: 330,  y: 1322, w: 420, h: ar('dice/sign-kit/tray', 420) },
        'btn-roll':      { x: 360,  y: 1700, w: 360, h: ar('ui/buttons/large-idle', 360) },
        'roll-nudge':    { x: 500,  y: 1612, w: 80,  h: 94 },
        'toast':         { x: 112,  y: 392, w: 930, h: 90 },
        'hop-hud':       { x: 357,  y: 368, w: 440, h: 92 },
        'hop-hud-low':   { x: 357,  y: 1172, w: 440, h: 92 },
        'coach':         { x: 20,   y: 140, w: 1040, h: 200 }
      }
    };
  }

  const L = {
    mode: null, scale: 1, stage: STAGES.land, rects: null,
    onChange: [],
    fit() {
      const vw = window.innerWidth, vh = window.innerHeight;
      const mode = vh / vw > 1.15 ? 'port' : 'land';
      const st = STAGES[mode];
      const scale = Math.min(vw / st.w, vh / st.h);
      const stage = document.getElementById('stage');
      stage.style.width = st.w + 'px';
      stage.style.height = st.h + 'px';
      stage.style.transform = `translate(${(vw - st.w * scale) / 2}px, ${(vh - st.h * scale) / 2}px) scale(${scale})`;
      this.scale = scale;
      if (mode !== this.mode) {
        this.mode = mode; this.stage = st;
        stage.classList.toggle('land', mode === 'land');
        stage.classList.toggle('port', mode === 'port');
        document.body.dataset.mode = mode;
        this.apply();
        this.onChange.forEach(fn => fn(mode));
      }
    },
    apply() {
      this.rects = tables()[this.mode];
      for (const [id, r] of Object.entries(this.rects)) {
        const el = document.getElementById(id);
        if (!el) continue;
        Object.assign(el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
      }
      // board: 1000 units tall (W units wide, see board.js) scaled into the wrap by its height
      const bh = this.rects['board-wrap'].h;
      document.getElementById('board').style.transform = `scale(${bh / 1000})`;
    },
    rect(id) { return this.rects[id]; },
    init() {
      this.fit();
      window.addEventListener('resize', () => this.fit());
      window.addEventListener('orientationchange', () => setTimeout(() => this.fit(), 150));
    }
  };
  ISL.layout = L;
})(window.ISL);
