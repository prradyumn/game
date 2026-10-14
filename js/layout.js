/* Stage scaling + the single source of truth for every on-screen rectangle.
   All numbers are stage pixels. Heights of image-backed boxes are derived from the
   trimmed asset aspect ratio so nothing is ever stretched. */
(function (ISL) {
  'use strict';
  const A = ISL.assets;
  const ar = (key, w) => Math.round(A.hForW(key, w));

  const STAGES = { land: { w: 1920, h: 1080 }, port: { w: 1080, h: 1920 } };

  // Landscape: the board takes the whole height; HUD columns hug it on either side
  // (the left gap leaves room for the zero jetty, which sits just outside the board).
  function tables() {
    return {
      land: {
        'logo-small':    { x: 36,   y: 16,  w: 300, h: ar('ui/logo/wordmark-dark', 300) },
        'topbar':        { x: 1612, y: 28,  w: 288, h: 84 },
        'turn-banner':   { x: 30,   y: 168, w: 350, h: ar('ui/panels/turn-student', 350) },
        'card-student':  { x: 30,   y: 362, w: 350, h: ar('ui/panels/player-student-active', 350) },
        'card-computer': { x: 30,   y: 566, w: 350, h: ar('ui/panels/player-computer-active', 350) },
        'board-wrap':    { x: 486,  y: 40,  w: 1000, h: 1000 },
        'numberline':    { x: 1516, y: 128, w: 388, h: 186 },
        'equation':      { x: 1520, y: 322, w: 380, h: ar('ui/panels/answer-waiting', 380) },
        'tray':          { x: 1550, y: 578, w: 320, h: ar('dice/sign-kit/tray', 320) },
        'btn-roll':      { x: 1565, y: 866, w: 290, h: ar('ui/buttons/large-idle', 290) },
        'roll-nudge':    { x: 1670, y: 770, w: 80,  h: 94 },
        'toast':         { x: 486,  y: 495, w: 1000, h: 90 },
        'coach':         { x: 16,   y: 586, w: 446, h: 464 }
      },
      port: {
        'logo-small':    { x: 30,   y: 22,  w: 270, h: ar('ui/logo/wordmark-dark', 270) },
        'topbar':        { x: 768,  y: 40,  w: 282, h: 82 },
        'card-student':  { x: 24,   y: 150, w: 330, h: ar('ui/panels/player-student-active', 330) },
        'turn-banner':   { x: 384,  y: 152, w: 312, h: ar('ui/panels/turn-student', 312) },
        'card-computer': { x: 726,  y: 150, w: 330, h: ar('ui/panels/player-computer-active', 330) },
        'board-wrap':    { x: 112,  y: 352, w: 930, h: 930 },
        'numberline':    { x: 28,   y: 1318, w: 528, h: 230 },
        'equation':      { x: 40,   y: 1560, w: 500, h: ar('ui/panels/answer-waiting', 500) },
        'tray':          { x: 596,  y: 1316, w: 440, h: ar('dice/sign-kit/tray', 440) },
        'btn-roll':      { x: 646,  y: 1708, w: 340, h: ar('ui/buttons/large-idle', 340) },
        'roll-nudge':    { x: 776,  y: 1610, w: 80,  h: 94 },
        'toast':         { x: 112,  y: 772, w: 930, h: 90 },
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
      // board: 1000-unit internal space scaled into the wrap
      const bw = this.rects['board-wrap'].w;
      document.getElementById('board').style.transform = `scale(${bw / 1000})`;
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
