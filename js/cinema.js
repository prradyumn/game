/* Move camera: zooms the whole game screen around the moving character and follows it while it
   hops, rides a snake or climbs a ladder (scale >= 1 is clamped so the view never leaves the
   stage). Honours prefers-reduced-motion (no camera moves). */
(function (ISL) {
  'use strict';
  const AU = ISL.audio;
  const $ = id => document.getElementById(id);
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- camera ---------- */
  const cam = { s: 1, fx: 0, fy: 0, follow: null, on: false };
  const scene = () => $('screen-game');

  /** A token's body centre in stage pixels. */
  function tokenPoint(el) {
    const r = ISL.layout.rect('board-wrap'), k = r.h / 1000;
    return { x: r.x + gsap.getProperty(el, 'x') * k, y: r.y + (gsap.getProperty(el, 'y') - 45) * k };
  }
  function render() {
    const st = ISL.layout.stage, s = cam.s;
    let x, y;
    if (s >= 1) {
      x = Math.min(0, Math.max(st.w - st.w * s, st.w / 2 - cam.fx * s));
      y = Math.min(0, Math.max(st.h - st.h * s, st.h / 2 - cam.fy * s));
    } else {           // pulled back past 1:1 — shrink around the stage centre
      x = st.w / 2 * (1 - s); y = st.h / 2 * (1 - s);
    }
    gsap.set(scene(), { x, y, scale: s, transformOrigin: '0 0', force3D: false });
  }
  gsap.ticker.add((time, dt) => {
    if (!cam.on) return;
    if (cam.follow && !gsap.globalTimeline.paused()) {
      const p = tokenPoint(cam.follow);
      const a = 1 - Math.exp(-dt / 1000 * 6 * gsap.globalTimeline.timeScale());
      cam.fx += (p.x - cam.fx) * a; cam.fy += (p.y - cam.fy) * a;
    }
    render();
  });

  const Cam = {
    get enabled() { return !reduced; },
    /** Zoom to scale z and keep following the token element. */
    focus(el, z, dur = 0.8) {
      if (reduced) return Promise.resolve();
      if (!cam.on) { const p = tokenPoint(el); cam.fx = p.x; cam.fy = p.y; cam.on = true; }
      cam.follow = el;
      AU.play('whoosh', { up: z > cam.s });
      return new Promise(r => gsap.to(cam, { s: z, duration: dur, ease: 'power2.inOut', overwrite: 'auto', onComplete: r }));
    },
    release(dur = 0.6) {
      if (!cam.on) return Promise.resolve();
      cam.follow = null;
      return new Promise(r => gsap.to(cam, { s: 1, duration: dur, ease: 'power2.inOut', overwrite: 'auto', onComplete: () => { Cam.reset(); r(); } }));
    },
    reset() {
      gsap.killTweensOf(cam);
      cam.on = false; cam.follow = null; cam.s = 1;
      gsap.set(scene(), { clearProps: 'transform' });
    }
  };

  ISL.cine = { cam: Cam, reduced };
})(window.ISL);
