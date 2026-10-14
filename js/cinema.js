/* Move cinematics.
   Camera: zooms the whole game screen around a token and follows it while it hops
   (scale >= 1 is clamped so the view never leaves the stage).
   Hero: the big equation card. It dolly-zooms in — the card pushes toward the viewer
   while the scene behind pulls back — reveals the answer, then docks into the equation panel.
   Both honour prefers-reduced-motion (no camera moves, a simple fade for the card). */
(function (ISL) {
  'use strict';
  const B = ISL.board, AU = ISL.audio;
  const $ = id => document.getElementById(id);
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const wait = s => new Promise(r => gsap.delayedCall(s, r));
  const fmt = n => B.fmt(n);

  /* ---------- camera ---------- */
  const cam = { s: 1, fx: 0, fy: 0, follow: null, on: false };
  const scene = () => $('screen-game');

  /** A token's body centre in stage pixels. */
  function tokenPoint(el) {
    const r = ISL.layout.rect('board-wrap'), k = r.w / 1000;
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
    /** Dolly out: drop the follow and pull back to scale s (below 1 shows the scene shrinking away). */
    pullBack(s = 0.93, dur = 1.1) {
      if (reduced) return;
      cam.on = true; cam.follow = null;
      gsap.to(cam, { s, duration: dur, ease: 'expo.out', overwrite: 'auto' });
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

  /* ---------- hero equation ---------- */
  const numSpan = (n, cls = '') => `<span class="eq-n ${n > 0 ? 'pos' : n < 0 ? 'neg' : 'zero'} ${cls}">${fmt(n)}</span>`;
  function stagePoint(el) {
    const sr = $('stage').getBoundingClientRect(), r = el.getBoundingClientRect(), k = ISL.layout.scale;
    return { x: (r.left + r.width / 2 - sr.left) / k, y: (r.top + r.height / 2 - sr.top) / k };
  }
  function fit(line, max) {
    line.style.fontSize = '';
    let fs = parseFloat(getComputedStyle(line).fontSize), n = 30;
    while (line.scrollWidth > max && fs > 30 && n--) { fs -= 4; line.style.fontSize = fs + 'px'; }
  }

  /**
   * Play the reveal for a + (b) = c.
   * opts: guard (turn abort guard), caption, sub, kind ('plus'|'minus'|'snake'|'ladder'),
   *       speak (fn returning a promise — narration that the hold waits for), hold (min seconds).
   */
  async function show(opts) {
    const guard = opts.guard || (p => p);
    const root = $('eq-hero'), card = $('hero-card'), line = $('hero-line'), sub = $('hero-sub');
    const r = ISL.layout.rect('board-wrap');
    const w = Math.min(r.w * 0.86, 860);
    gsap.killTweensOf([card, '#hero-scrim', line]);
    gsap.set(card, { left: r.x + r.w / 2, top: r.y + r.h / 2, width: w, xPercent: -50, yPercent: -50, x: 0, y: 0, opacity: 0 });
    card.dataset.kind = opts.kind || 'plus';
    $('hero-cap').innerHTML = opts.caption || '';
    line.innerHTML =
      `${numSpan(opts.a)}<span class="eq-op">+</span><span class="eq-paren">(</span>${numSpan(opts.b, 'roll')}<span class="eq-paren">)</span>` +
      `<span class="eq-op">=</span><span class="eq-result">?</span>`;
    sub.innerHTML = '';
    root.classList.add('on');
    fit(line, w - 80);

    // 1. dolly: the card pushes in out of a blur while the scene behind pulls away
    Cam.pullBack(0.93, 1.1);
    AU.play('whoosh', { up: false });
    const parts = line.children;
    const tl = gsap.timeline();
    tl.fromTo('#hero-scrim', { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0);
    if (reduced) {
      tl.fromTo(card, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0);
    } else {
      tl.fromTo(card, { scale: 0.42, opacity: 0, filter: 'blur(12px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out' }, 0.05)
        .fromTo(line, { letterSpacing: '0.3em' }, { letterSpacing: '0em', duration: 0.9, ease: 'expo.out' }, 0.05)
        .fromTo(parts, { opacity: 0, y: 34, scale: 0.4 }, { opacity: 1, y: 0, scale: 1, stagger: 0.08, duration: 0.38, ease: 'back.out(2.4)' }, 0.22)
        .fromTo('#hero-cap', { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.35 }, 0.2);
    }
    await guard(new Promise(res => tl.eventCallback('onComplete', res)));
    await guard(wait(0.2));

    // 2. the answer flips in with a glow burst
    const res = line.querySelector('.eq-result');
    res.textContent = fmt(opts.c);
    res.className = 'eq-result ' + (opts.c > 0 ? 'pos' : opts.c < 0 ? 'neg' : 'zero');
    AU.play('reveal');
    card.classList.remove('burst'); void card.offsetWidth; card.classList.add('burst');
    gsap.fromTo(res, { scale: 2.4, rotationX: -80, opacity: 0 }, { scale: 1, rotationX: 0, opacity: 1, duration: 0.55, ease: 'back.out(2.6)' });
    const p = stagePoint(res);
    ISL.fx.sparkles(p.x, p.y, 12, root, 90);
    if (opts.sub) { sub.innerHTML = opts.sub; gsap.fromTo(sub, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, delay: 0.2 }); }

    // 3. hold while the narration reads it (never shorter than `hold`)
    await guard(Promise.all([wait(opts.hold ?? 1.1), opts.speak ? opts.speak() : null]));

    // 4. dock into the equation panel while the camera settles back to 1:1
    const e = ISL.layout.rect('equation');
    const from = stagePoint(card);
    const out = gsap.timeline();
    out.to(card, { x: e.x + e.w / 2 - from.x, y: e.y + e.h / 2 - from.y, scale: reduced ? 1 : 0.3, opacity: 0, duration: 0.5, ease: 'power3.in' }, 0)
       .to('#hero-scrim', { opacity: 0, duration: 0.45 }, 0.05);
    Cam.release(0.6);
    await guard(new Promise(r2 => out.eventCallback('onComplete', r2)));
    root.classList.remove('on');
    card.classList.remove('burst');
  }

  function hide() {
    gsap.killTweensOf(['#hero-card', '#hero-scrim', '#hero-line']);
    $('eq-hero').classList.remove('on');
    $('hero-card').classList.remove('burst');
    gsap.set('#hero-scrim', { opacity: 0 });
  }

  ISL.cine = { cam: Cam, hero: { show, hide }, reduced };
})(window.ISL);
