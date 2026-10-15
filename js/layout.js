/* Stage scaling + the single source of truth for every on-screen rectangle.
   All numbers are stage pixels. Heights of image-backed boxes are derived from the
   trimmed asset aspect ratio so nothing is ever stretched. */
(function (ISL) {
  'use strict';
  const A = ISL.assets;
  const ar = (key, w) => Math.round(A.hForW(key, w));

  const STAGES = { land: { w: 1920, h: 1080 }, port: { w: 1080, h: 1920 } };

  // Landscape: the board runs nearly the full stage height and starts at the left edge (leaving just
  // room for the zero boardwalk); the logo, turn banner, cards, dice and Roll/Hop sit on the right.
  // Portrait: board fills the width; dice and the action button sit bottom-centre, under the thumb.
  function tables() {
    return {
      land: {
        // board on the left (0 is the boardwalk along its shoreline); every HUD piece on the right
        'board-wrap':    { x: 24,   y: 20,  w: 1316, h: 1040 },      // wide board (aspect ~1.27); 0 is the shoreline boardwalk
        // right column, evenly spaced: Pause pinned top-right; cards (+ turn ribbon), dice tray, Roll
        'topbar':        { x: 1816, y: 24,  w: 84,  h: 84 },
        'turn-banner':   { x: 1471, y: 156, w: 330, h: ar('ui/panels/turn-student', 330) },   // hidden (ribbon on the card)
        'card-student':  { x: 1372, y: 170, w: 258, h: ar('ui/panels/player-student-active', 258) },
        'card-computer': { x: 1642, y: 170, w: 258, h: ar('ui/panels/player-computer-active', 258) },
        'tray':          { x: 1471, y: 408, w: 330, h: ar('dice/sign-kit/tray', 330) },
        'btn-roll':      { x: 1486, y: 783, w: 300, h: ar('ui/buttons/large-idle', 300) },
        'roll-nudge':    { x: 1596, y: 697, w: 80,  h: 94 },
        'toast':         { x: 24,   y: 60,  w: 1316, h: 90 },
        'hop-hud':       { x: 462,  y: 30,  w: 440, h: 92 },
        'hop-hud-low':   { x: 462,  y: 958, w: 440, h: 92 },
        'pick-hud':      { x: 1366, y: 16,  w: 440, h: 126 },     // above the cards, never over the board
        'pick-hud-low':  { x: 1366, y: 16,  w: 440, h: 126 },
        'coach':         { x: 1366, y: 24,  w: 440, h: 372 }        // above the dice tray, beside Pause
      },
      port: {
        'topbar':        { x: 966,  y: 40,  w: 84,  h: 84 },
        'card-student':  { x: 140,  y: 168, w: 330, h: ar('ui/panels/player-student-active', 330) },
        'turn-banner':   { x: 384,  y: 152, w: 312, h: ar('ui/panels/turn-student', 312) },
        'card-computer': { x: 610,  y: 168, w: 330, h: ar('ui/panels/player-computer-active', 330) },
        'board-wrap':    { x: 34,   y: 352, w: 1012, h: 930 },
        'tray':          { x: 330,  y: 1322, w: 420, h: ar('dice/sign-kit/tray', 420) },
        'btn-roll':      { x: 360,  y: 1700, w: 360, h: ar('ui/buttons/large-idle', 360) },
        'roll-nudge':    { x: 500,  y: 1612, w: 80,  h: 94 },
        'toast':         { x: 34,   y: 392, w: 1012, h: 90 },
        'hop-hud':       { x: 320,  y: 368, w: 440, h: 92 },
        'hop-hud-low':   { x: 320,  y: 1172, w: 440, h: 92 },
        'pick-hud':      { x: 24,   y: 20,  w: 926, h: 116 },     // strip above the cards
        'pick-hud-low':  { x: 24,   y: 20,  w: 926, h: 116 },
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
