/* Visual effects: board particles, sprite-frame effects, confetti, ambient background life. */
(function (ISL) {
  'use strict';
  const A = ISL.assets;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  function img(key, w, parent, cls) {
    const el = document.createElement('img');
    el.src = A.url(key); el.alt = ''; el.className = 'fx ' + (cls || '');
    el.style.width = w + 'px'; el.style.height = A.hForW(key, w) + 'px';
    parent.appendChild(el);
    return el;
  }
  /** Centre an element on (x,y) using GSAP so later tweens compose with it. */
  function at(el, x, y) { gsap.set(el, { x, y, xPercent: -50, yPercent: -50 }); }
  const boardFx = () => document.getElementById('board-fx');

  const FX = {
    /** Play a sequence of sprite frames centred at the bottom on (x,y). */
    frames(keys, x, y, w, fps = 14, parent = boardFx()) {
      const el = img(keys[0], w, parent, 'frames');
      const set = k => { el.src = A.url(k); el.style.height = A.hForW(k, w) + 'px'; };
      gsap.set(el, { x, y, xPercent: -50, yPercent: -100 });
      const tl = gsap.timeline({ onComplete: () => el.remove() });
      keys.forEach((k, i) => tl.call(() => set(k), null, i / fps));
      tl.to(el, { opacity: 0, duration: 0.18 }, keys.length / fps - 0.05);
      return tl;
    },
    splash(x, y) { ISL.audio.play('splash'); return FX.frames(['fx/effects/splash-01', 'fx/effects/splash-02', 'fx/effects/splash-03', 'fx/effects/splash-04'], x, y + 6, 78, 13); },
    sandPuff(x, y) { return FX.frames(['fx/effects/sand-puff-01', 'fx/effects/sand-puff-02', 'fx/effects/sand-puff-03'], x, y + 8, 52, 16); },
    bubbles(x, y, n = 4) {
      const p = boardFx();
      for (let i = 0; i < n; i++) {
        const k = pick(['fx/effects/bubble-small', 'fx/effects/bubble-medium', 'fx/effects/bubble-small']);
        const el = img(k, rnd(8, 16), p);
        at(el, x + rnd(-14, 14), y - rnd(10, 30));
        gsap.to(el, { y: `-=${rnd(50, 90)}`, x: `+=${rnd(-12, 12)}`, opacity: 0, duration: rnd(0.9, 1.5), delay: i * 0.08, ease: 'sine.out', onComplete: () => el.remove() });
      }
    },
    sparkles(x, y, n = 6, parent = boardFx(), spread = 50) {
      for (let i = 0; i < n; i++) {
        const el = img(pick(['fx/effects/sparkle-01', 'fx/effects/sparkle-02', 'fx/effects/sparkle-03']), rnd(14, 26), parent);
        at(el, x, y);
        const a = rnd(0, Math.PI * 2), d = rnd(spread * 0.5, spread);
        gsap.fromTo(el, { scale: 0.2, rotation: rnd(-40, 40) }, {
          x: `+=${Math.cos(a) * d}`, y: `+=${Math.sin(a) * d}`, scale: 1, rotation: '+=90',
          duration: 0.55, ease: 'power2.out', delay: i * 0.03
        });
        gsap.to(el, { opacity: 0, scale: 0.4, duration: 0.3, delay: 0.45 + i * 0.03, onComplete: () => el.remove() });
      }
    },
    ripple(x, y) {
      const el = img('board-pieces/ripple-ring', 70, boardFx());
      at(el, x, y);
      gsap.fromTo(el, { scale: 0.3, opacity: 0.9 }, { scale: 1.3, opacity: 0, duration: 0.8, ease: 'sine.out', onComplete: () => el.remove() });
    },
    pathDot(x, y, sign) {
      const el = img('fx/effects/path-dot', 13, boardFx(), 'path-dot');
      at(el, x, y);
      if (sign < 0) el.style.filter = 'hue-rotate(185deg) saturate(1.4)';
      gsap.fromTo(el, { scale: 0 }, { scale: 1, duration: 0.2, ease: 'back.out(3)' });
      return el;
    },
    /** A square lights up as the token lands on it. */
    cellFlash(c, dir) {
      const w = ISL.board.W / 10, h = ISL.board.CELL;
      const el = document.createElement('i');
      el.className = 'fx cell-flash ' + (dir > 0 ? 'plus' : 'minus');
      Object.assign(el.style, { width: w + 'px', height: h + 'px' });
      boardFx().appendChild(el); at(el, c.x, c.y);
      gsap.fromTo(el, { opacity: 0.95, scale: 0.85 }, { opacity: 0, scale: 1.08, duration: 0.6, ease: 'power2.out', onComplete: () => el.remove() });
    },
    /** Ripple where the player tapped (viewport coords), on the stage so it isn't affected by the camera. */
    tapRipple(cx, cy) {
      const st = document.getElementById('stage'), r = st.getBoundingClientRect(), k = ISL.layout.scale;
      const el = document.createElement('i'); el.className = 'fx tap-ripple';
      st.appendChild(el); at(el, (cx - r.left) / k, (cy - r.top) / k);
      gsap.fromTo(el, { scale: 0.3, opacity: 0.9 }, { scale: 1.4, opacity: 0, duration: 0.45, ease: 'power2.out', onComplete: () => el.remove() });
    },
    /** Running step count (+1, +2, …) popping over the token on each hop. */
    stepCount(x, y, v) {
      const el = document.createElement('span');
      el.className = 'fx step-pop ' + (v > 0 ? 'plus' : 'minus');
      el.textContent = ISL.board.fmt(v);
      boardFx().appendChild(el);
      at(el, x, y);
      gsap.timeline({ onComplete: () => el.remove() })
        .fromTo(el, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, y: '-=26', duration: 0.22, ease: 'back.out(3)' })
        .to(el, { y: '-=22', opacity: 0, duration: 0.45, ease: 'power1.in' }, 0.32);
    },
    /** Target ring pulsing on the destination square. */
    target(who, x, y) {
      const el = document.getElementById('target-' + (who === 'student' ? 'coral' : 'violet'));
      gsap.killTweensOf(el);
      gsap.set(el, { x, y, xPercent: 0, yPercent: 0, opacity: 0, scale: 0.4, rotation: 0 });
      gsap.to(el, { opacity: 0.95, scale: 1, duration: 0.3, ease: 'back.out(2)' });
      gsap.to(el, { rotation: 360, duration: 6, ease: 'none', repeat: -1 });
    },
    hideTarget(who) {
      const el = document.getElementById('target-' + (who === 'student' ? 'coral' : 'violet'));
      gsap.to(el, { opacity: 0, scale: 0.5, duration: 0.25, onComplete: () => gsap.killTweensOf(el) });
    },
    confetti(container, n = 70) {
      const keys = ['fx/confetti/confetti-01', 'fx/confetti/confetti-02', 'fx/confetti/confetti-03', 'fx/confetti/confetti-04', 'fx/confetti/confetti-05', 'fx/confetti/confetti-06'];
      const W = container.clientWidth || 1920, H = container.clientHeight || 1080;
      for (let i = 0; i < n; i++) {
        const el = img(pick(keys), rnd(18, 38), container, 'confetti-bit');
        gsap.set(el, { x: rnd(0, W), y: rnd(-200, -40), rotation: rnd(0, 360) });
        gsap.to(el, { y: H + 80, x: `+=${rnd(-160, 160)}`, rotation: `+=${rnd(360, 900)}`, duration: rnd(2.4, 4.4), delay: rnd(0, 1.4), ease: 'sine.in', onComplete: () => el.remove() });
        gsap.to(el, { scaleX: 0.3, duration: rnd(0.2, 0.4), repeat: 9, yoyo: true, ease: 'sine.inOut' });
      }
    },

    /* ---------- ambient life in the full-viewport background ---------- */
    ambient() {
      const amb = document.getElementById('ambient');
      gsap.killTweensOf(amb.querySelectorAll('*'));
      amb.innerHTML = '';
      const gen = (FX._gen = (FX._gen || 0) + 1);
      const alive = () => gen === FX._gen;
      const vw = () => window.innerWidth, vh = () => window.innerHeight;
      const unit = () => Math.min(vw(), vh() * 16 / 9) / 1920;   // background-relative scale
      // clouds drifting in the sky (top half)
      const clouds = ['cloud-01', 'cloud-02', 'cloud-03', 'cloud-04'];
      const spawnCloud = (first) => {
        if (!alive()) return;
        const k = 'background/atmosphere/' + pick(clouds);
        const w = rnd(150, 280) * Math.max(unit(), 0.5);
        const el = img(k, w, amb, 'amb cloud');
        const y = rnd(0.03, 0.30) * vh();
        const startX = first ? rnd(-0.1, 1) * vw() : -w - 20;
        gsap.set(el, { x: startX, y, opacity: rnd(0.75, 0.95) });
        const dist = vw() + w + 40 - startX;
        gsap.to(el, { x: vw() + 40, duration: dist / rnd(12, 22), ease: 'none', onComplete: () => { el.remove(); spawnCloud(false); } });
      };
      for (let i = 0; i < 3; i++) spawnCloud(true);
      // birds crossing occasionally
      const spawnBird = () => {
        if (!alive()) return;
        const k = 'background/birds/' + pick(['bird-01-level', 'bird-02-level']);
        const w = rnd(70, 110) * Math.max(unit(), 0.5);
        const el = img(k, w, amb, 'amb bird');
        const ltr = Math.random() < 0.5;
        const y = rnd(0.06, 0.28) * vh();
        gsap.set(el, { x: ltr ? -w : vw() + w, y, scaleX: ltr ? 1 : -1 });
        gsap.to(el, { x: ltr ? vw() + w : -w * 2, duration: rnd(14, 22), ease: 'none', onComplete: () => el.remove() });
        gsap.to(el, { y: `+=${rnd(20, 50)}`, duration: rnd(1.6, 2.4), repeat: -1, yoyo: true, ease: 'sine.inOut' });
        gsap.to(el, { scaleY: 0.82, duration: 0.28, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        gsap.delayedCall(rnd(16, 28), spawnBird);
      };
      gsap.delayedCall(2, spawnBird);
      // fish in the sea (bottom half)
      const spawnFish = (first) => {
        if (!alive()) return;
        const k = 'background/atmosphere/' + pick(['fish-01', 'fish-02', 'fish-03']);
        const w = rnd(50, 95) * Math.max(unit(), 0.5);
        const el = img(k, w, amb, 'amb fish');
        const ltr = Math.random() < 0.5;
        const y = rnd(0.58, 0.92) * vh();
        const x0 = first ? rnd(0, vw()) : (ltr ? -w : vw() + w);
        gsap.set(el, { x: x0, y, scaleX: ltr ? 1 : -1, opacity: 0.55 });
        gsap.to(el, { x: ltr ? vw() + w : -w * 2, duration: Math.abs((ltr ? vw() + w : -w * 2) - x0) / rnd(25, 45), ease: 'none', onComplete: () => { el.remove(); gsap.delayedCall(rnd(1, 4), () => spawnFish(false)); } });
        gsap.to(el, { y: `+=${rnd(10, 26)}`, duration: rnd(1.2, 2), repeat: -1, yoyo: true, ease: 'sine.inOut' });
      };
      for (let i = 0; i < 2; i++) spawnFish(true);
      // light rays just under the horizon
      ['ray-01', 'ray-02', 'ray-03'].forEach((r, i) => {
        const w = 300 * Math.max(unit(), 0.5);
        const el = img('background/atmosphere/' + r, w, amb, 'amb ray');
        gsap.set(el, { x: (0.12 + i * 0.34) * vw(), y: 0.505 * vh(), opacity: 0.35 });
        gsap.to(el, { opacity: 0.7, duration: rnd(2.5, 4), repeat: -1, yoyo: true, ease: 'sine.inOut', delay: i });
      });
      // seaweed swaying at the bottom corners
      [['seaweed-01', 0.01], ['seaweed-02', 0.86], ['seaweed-01', 0.93]].forEach(([k, fx], i) => {
        const w = rnd(150, 210) * Math.max(unit(), 0.5);
        const el = img('background/atmosphere/' + k, w, amb, 'amb weed');
        gsap.set(el, { x: fx * vw(), y: vh() - A.hForW('background/atmosphere/' + k, w) + 8, transformOrigin: '50% 100%' });
        gsap.to(el, { skewX: rnd(4, 7), duration: rnd(2, 3), repeat: -1, yoyo: true, ease: 'sine.inOut', delay: i * 0.4 });
      });
      // pollen sparkles in the sky
      for (let i = 0; i < 3; i++) {
        const el = img('background/atmosphere/' + pick(['pollen-small', 'pollen-medium']), rnd(40, 70) * Math.max(unit(), 0.5), amb, 'amb pollen');
        gsap.set(el, { x: rnd(0, vw()), y: rnd(0.1, 0.45) * vh(), opacity: 0 });
        gsap.to(el, { opacity: 0.8, y: '-=40', duration: rnd(3, 5), repeat: -1, yoyo: true, ease: 'sine.inOut', delay: rnd(0, 4) });
      }
    }
  };
  ISL.fx = FX;
})(window.ISL);
