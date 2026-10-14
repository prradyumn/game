/* Stage scaling + the single source of truth for every on-screen rectangle.
   All numbers are stage pixels. Heights of image-backed boxes are derived from the
   trimmed asset aspect ratio so nothing is ever stretched. */
(function (ISL) {
  'use strict';
  const A = ISL.assets;
  const ar = (key, w) => Math.round(A.hForW(key, w));

  const STAGES = { land: { w: 1920, h: 1080 }, port: { w: 1080, h: 1920 } };

  function tables() {
    return {
      land: {
        'logo-small':    { x: 40,   y: 18,  w: 300, h: ar('ui/logo/wordmark-dark', 300) },
        'topbar':        { x: 1592, y: 30,  w: 288, h: 84 },
        'turn-banner':   { x: 40,   y: 180, w: 360, h: ar('ui/panels/turn-student', 360) },
        'card-student':  { x: 40,   y: 384, w: 360, h: ar('ui/panels/player-student-active', 360) },
        'card-computer': { x: 40,   y: 594, w: 360, h: ar('ui/panels/player-computer-active', 360) },
        'board-wrap':    { x: 506,  y: 62,  w: 960, h: 960 },
        'numberline':    { x: 1482, y: 146, w: 420, h: 196 },
        'equation':      { x: 1492, y: 352, w: 400, h: ar('ui/panels/answer-waiting', 400) },
        'tray':          { x: 1527, y: 612, w: 330, h: ar('dice/sign-kit/tray', 330) },
        'btn-roll':      { x: 1552, y: 904, w: 280, h: ar('ui/buttons/large-idle', 280) },
        'toast':         { x: 506,  y: 497, w: 960, h: 90 },
        'coach':         { x: 20,   y: 600, w: 446, h: 452 }
      },
      port: {
        'logo-small':    { x: 30,   y: 22,  w: 270, h: ar('ui/logo/wordmark-dark', 270) },
        'topbar':        { x: 768,  y: 40,  w: 282, h: 82 },
        'card-student':  { x: 24,   y: 152, w: 330, h: ar('ui/panels/player-student-active', 330) },
        'turn-banner':   { x: 384,  y: 154, w: 312, h: ar('ui/panels/turn-student', 312) },
        'card-computer': { x: 726,  y: 152, w: 330, h: ar('ui/panels/player-computer-active', 330) },
        'board-wrap':    { x: 112,  y: 350, w: 950, h: 950 },
        'numberline':    { x: 36,   y: 1334, w: 510, h: 200 },
        'equation':      { x: 46,   y: 1566, w: 490, h: ar('ui/panels/answer-waiting', 490) },
        'tray':          { x: 600,  y: 1370, w: 420, h: ar('dice/sign-kit/tray', 420) },
        'btn-roll':      { x: 640,  y: 1730, w: 340, h: ar('ui/buttons/large-idle', 340) },
        'toast':         { x: 112,  y: 780, w: 950, h: 90 },
        'coach':         { x: 20,   y: 142, w: 1040, h: 204 }
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
