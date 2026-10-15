/* Opening cinematic: rise from the deep sea, a ladder bursts out of the water,
   snakes appear, the title slams in, the explorers land on the jetty, the
   integer ticker counts −50 → +50, then an SVG wave sweeps us into the game. */
(function (ISL) {
  'use strict';
  const A = ISL.assets, FX = ISL.fx, AU = ISL.audio;
  const $ = id => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);

  // All positions in stage pixels, per orientation.
  const POS = {
    land: {
      title: { cx: 960, cy: 250, w: 900 },
      plus: { cx: 250, cy: 150, w: 150, rot: -14 },
      minus: { cx: 1670, cy: 150, w: 150, rot: 12 },
      ladder: { b: { x: 1690, y: 1050 }, t: { x: 1780, y: 400 }, gap: 64, rw: 22, step: 46, rungH: 26 },
      python: { x: 70, y: 352, w: 330 },
      jetty: { cx: 960, cy: 700, w: 400 },
      chars: { h: 210, student: 872, computer: 1048 },
      ticker: { cx: 960, y: 780, size: 128 },
      tagline: { cx: 960, y: 935, w: 1300, size: 42 },
      krait: { y: 850, w: 300 }
    },
    port: {
      title: { cx: 540, cy: 600, w: 980 },
      plus: { cx: 130, cy: 300, w: 140, rot: -14 },
      minus: { cx: 950, cy: 300, w: 140, rot: 12 },
      ladder: { b: { x: 950, y: 1890 }, t: { x: 1010, y: 1010 }, gap: 60, rw: 20, step: 44, rungH: 24 },
      python: { x: 14, y: 790, w: 290 },
      jetty: { cx: 540, cy: 1080, w: 400 },
      chars: { h: 230, student: 452, computer: 630 },
      ticker: { cx: 540, y: 1250, size: 124 },
      tagline: { cx: 540, y: 1420, w: 800, size: 42 },
      krait: { y: 1720, w: 330 }
    }
  };

  function img(key, w, parent, cls) {
    const el = document.createElement('img');
    el.src = A.url(key); el.alt = ''; el.className = 'intro-el ' + (cls || '');
    el.style.width = w + 'px'; el.style.height = A.hForW(key, w) + 'px';
    parent.appendChild(el);
    return el;
  }
  const at = (el, x, y, extra = {}) => gsap.set(el, Object.assign({ x, y, xPercent: -50, yPercent: -50 }, extra));

  /* ---------- SVG wave wipe ---------- */
  function wavePath(top, W, H, band, phase, amp) {
    const pts = [];
    const step = W / 24;
    for (let x = 0; x <= W + 1; x += step) pts.push([x, top + Math.sin(x / W * Math.PI * 3 + phase) * amp]);
    let d = `M ${-10} ${H + band + 400} L ${-10} ${pts[0][1]} `;
    pts.forEach(([x, y]) => { d += `L ${x.toFixed(1)} ${y.toFixed(1)} `; });
    d += `L ${W + 10} ${pts[pts.length - 1][1]} L ${W + 10} ${top + band} `;
    for (let x = W; x >= -1; x -= step) d += `L ${x.toFixed(1)} ${(top + band + Math.sin(x / W * Math.PI * 2.5 - phase) * amp).toFixed(1)} `;
    return d + 'Z';
  }
  /** Wave transition. onCovered fires while the screen is fully covered; resolves when it has passed. */
  function wipe(onCovered, duration = 1.7) {
    const st = ISL.layout.stage, W = st.w, H = st.h;
    const svg = $('wipe');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.display = 'block';
    const back = $('wipe-back'), front = $('wipe-front'), foam = $('wipe-foam');
    const band = H * 1.5, amp = Math.min(W, H) * 0.035;
    const o = { t: 0 };
    let covered = false;
    return new Promise(res => {
      gsap.to(o, {
        t: 1, duration, ease: 'power1.inOut',
        onUpdate() {
          const top = H + 40 - o.t * (H + band + 120);
          const ph = o.t * 9;
          back.setAttribute('d', wavePath(top - H * 0.07, W, H, band, ph + 1.3, amp * 1.2));
          front.setAttribute('d', wavePath(top, W, H, band - H * 0.1, ph, amp));
          foam.setAttribute('d', wavePath(top, W, H, band - H * 0.1, ph, amp));
          if (!covered && top < -H * 0.08) { covered = true; onCovered && onCovered(); }
        },
        onComplete() { svg.style.display = 'none'; res(); }
      });
      AU.play('wave');
    });
  }

  /* ---------- the cinematic ---------- */
  function build() {
    const mode = ISL.layout.mode, P = POS[mode], st = ISL.layout.stage;
    const root = $('screen-intro');
    root.innerHTML = '<div id="intro-bg"></div><div id="intro-deep"></div><div id="intro-layer"></div><div id="intro-flash"></div><button id="intro-skip" type="button">Skip ›</button>';
    root.classList.add('open');
    const layer = $('intro-layer');
    const E = {};

    // ladder painted once onto its own canvas
    const L = P.ladder, pad = 40;
    const minX = Math.min(L.b.x, L.t.x) - L.gap - pad, minY = L.t.y - pad;
    const cw = Math.abs(L.t.x - L.b.x) + (L.gap + pad) * 2, ch = L.b.y - L.t.y + pad * 2;
    const cv = document.createElement('canvas');
    cv.width = cw * 2; cv.height = ch * 2; cv.className = 'intro-el';
    Object.assign(cv.style, { width: cw + 'px', height: ch + 'px', left: minX + 'px', top: minY + 'px' });
    const ctx = cv.getContext('2d'); ctx.scale(2, 2);
    ISL.board.paintLadder(ctx, { x: L.b.x - minX, y: L.b.y - minY }, { x: L.t.x - minX, y: L.t.y - minY }, true, L.gap, L.rw, L.step, L.rungH);
    layer.appendChild(cv); E.ladder = cv;

    E.python = img('snakes/python/full-snake', P.python.w, layer);
    gsap.set(E.python, { x: P.python.x, y: P.python.y, transformOrigin: '50% 100%' });

    const j = P.jetty, jh = A.hForW('board-pieces/zero-jetty', j.w);
    E.jetty = img('board-pieces/zero-jetty', j.w, layer);
    at(E.jetty, j.cx, j.cy);
    E.feetY = j.cy - jh * 0.5 + jh * 0.42 + j.w * 0.075;

    const ch2 = P.chars.h;
    const sw = A.wForH('tokens/student-poses/hop', ch2), cw2 = A.wForH('tokens/computer-poses/hop', ch2 * 1.04);
    E.student = img('tokens/student-poses/hop', sw, layer);
    E.computer = img('tokens/computer-poses/hop', cw2, layer);
    gsap.set(E.student, { x: P.chars.student, y: E.feetY, xPercent: -50, yPercent: -100, transformOrigin: '50% 100%' });
    gsap.set(E.computer, { x: P.chars.computer, y: E.feetY, xPercent: -50, yPercent: -100, transformOrigin: '50% 100%' });

    E.krait = img('snakes/sea-krait/full-snake', P.krait.w, layer);
    E.plus = img('dice/sign-kit/plus-face', P.plus.w, layer, 'die-pop');
    E.minus = img('dice/sign-kit/minus-face', P.minus.w, layer, 'die-pop');
    at(E.plus, P.plus.cx, P.plus.cy, { rotation: P.plus.rot });
    at(E.minus, P.minus.cx, P.minus.cy, { rotation: P.minus.rot });

    const t = P.title, th = A.hForW('ui/logo/wordmark-dark', t.w);
    const tbox = document.createElement('div');
    tbox.id = 'intro-title'; tbox.className = 'intro-el';
    Object.assign(tbox.style, { width: t.w + 'px', height: th + 'px' });
    tbox.innerHTML = `<img src="${A.url('ui/logo/wordmark-dark')}" alt="Integer Snakes &amp; Ladders"><img id="intro-shine" src="${A.url('ui/logo/wordmark-dark')}" alt="">`;
    layer.appendChild(tbox); at(tbox, t.cx, t.cy); E.title = tbox;

    const tk = document.createElement('div');
    tk.id = 'intro-ticker'; tk.className = 'intro-el';
    tk.style.fontSize = P.ticker.size + 'px';
    tk.innerHTML = '<span class="tk-num">−50</span>';
    layer.appendChild(tk); gsap.set(tk, { x: P.ticker.cx, y: P.ticker.y, xPercent: -50 }); E.ticker = tk;

    const tg = document.createElement('div');
    tg.id = 'intro-tagline'; tg.className = 'intro-el';
    Object.assign(tg.style, { width: P.tagline.w + 'px', fontSize: P.tagline.size + 'px' });
    tg.innerHTML = 'A number-line adventure from <b class="minus">−50</b> to <b class="plus">+50</b>!';
    layer.appendChild(tg); gsap.set(tg, { x: P.tagline.cx, y: P.tagline.y, xPercent: -50 }); E.tagline = tg;

    // light rays + bubbles
    E.rays = ['ray-01', 'ray-02', 'ray-03'].map((r, i) => {
      const el = img('background/atmosphere/' + r, st.w * 0.22, layer, 'intro-ray');
      gsap.set(el, { x: st.w * (0.08 + i * 0.32), y: st.h * 0.5, opacity: 0 });
      return el;
    });
    E.P = P; E.st = st;
    return E;
  }

  function timeline(E) {
    const P = E.P, st = E.st;
    const tl = gsap.timeline({ paused: true });
    const bg = $('intro-bg'), deep = $('intro-deep'), layer = $('intro-layer');

    // sound design: music cue (its big hit lands on the title slam at 2.75 s) + timed effects
    tl.call(() => { AU.music('intro', 0.3); AU.play('intro_deep'); }, null, 0)
      .call(() => AU.play('intro_bubbles'), null, 0.35)
      .call(() => AU.play('intro_bubbles'), null, 1.1)
      .call(() => AU.play('intro_whoosh'), null, 1.62)
      .call(() => AU.play('intro_hiss'), null, 2.05)
      .call(() => AU.play('intro_boom'), null, 2.75)
      .call(() => AU.play('intro_pop'), null, 3.05)
      .call(() => AU.play('intro_pop'), null, 3.17);
    // integer ticker: rising ticks as it counts, a bell when it lands on +50
    for (let i = 0; i < 12; i++) tl.call(() => AU.play('tick', { i }), null, 4.05 + i * 0.12);
    tl.call(() => AU.play('intro_ding'), null, 5.5);

    // 1. rise from the deep
    tl.fromTo(bg, { scale: 2.1 }, { scale: 1, duration: 2.3, ease: 'power2.inOut' }, 0)
      .fromTo(deep, { opacity: 0.55 }, { opacity: 0, duration: 2.0, ease: 'power1.in' }, 0);
    ['fish-01', 'fish-03', 'fish-02', 'fish-01'].forEach((f, i) => {
      const w = rnd(110, 170), el = img('background/atmosphere/' + f, w, layer);
      const ltr = i % 2 === 0, y = st.h * (0.3 + i * 0.13);
      tl.fromTo(el, { x: ltr ? -w : st.w + w, y, scaleX: ltr ? 1 : -1, opacity: 0.85 }, { x: ltr ? st.w + w : -w * 2, duration: rnd(2.6, 3.4), ease: 'sine.inOut' }, i * 0.25);
      tl.to(el, { opacity: 0, duration: 0.4 }, 2.2);
    });
    for (let i = 0; i < 22; i++) {
      const el = document.createElement('img');
      el.src = A.url(i % 3 ? 'fx/effects/bubble-small' : 'fx/effects/bubble-medium'); el.className = 'intro-el';
      const s = rnd(16, 46); el.style.width = el.style.height = s + 'px';
      layer.appendChild(el);
      const x = rnd(0, st.w);
      tl.fromTo(el, { x, y: st.h + 40, opacity: 0.9 }, { x: x + rnd(-60, 60), y: rnd(-80, st.h * 0.45), opacity: 0, duration: rnd(1.4, 2.4), ease: 'sine.in' }, rnd(0, 1.3));
    }
    tl.to(E.rays, { opacity: 0.6, duration: 0.8, stagger: 0.12 }, 1.3);

    // sea krait swims across underneath
    tl.fromTo(E.krait, { x: -E.P.krait.w, y: P.krait.y }, { x: st.w + 40, duration: 5.4, ease: 'none' }, 0.2);
    tl.to(E.krait, { y: `+=${28}`, rotation: 4, duration: 0.6, yoyo: true, repeat: 8, ease: 'sine.inOut' }, 0.2);

    // 2. jetty pops out of the water with a splash, ladder bursts upward
    tl.fromTo(E.jetty, { y: P.jetty.cy + 120, opacity: 0 }, { y: P.jetty.cy, opacity: 1, duration: 0.55, ease: 'back.out(2)' }, 1.55)
      .call(() => { FX.frames(['fx/effects/splash-01', 'fx/effects/splash-02', 'fx/effects/splash-03', 'fx/effects/splash-04'], P.jetty.cx, P.jetty.cy + 40, P.jetty.w * 0.7, 14, layer); AU.play('intro_surface'); }, null, 1.6);
    tl.fromTo(E.ladder, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 0.7, ease: 'power3.out' }, 1.75)
      .call(() => { FX.frames(['fx/effects/splash-01', 'fx/effects/splash-02', 'fx/effects/splash-03', 'fx/effects/splash-04'], (P.ladder.b.x + P.ladder.t.x) / 2, st.h * 0.5 + 30, 200, 14, layer); AU.play('intro_burst'); AU.play('intro_creak'); }, null, 1.9);
    tl.fromTo(E.python, { yPercent: 60, opacity: 0, scaleY: 0.4 }, { yPercent: 0, opacity: 1, scaleY: 1, duration: 0.6, ease: 'back.out(2.2)' }, 2.0)
      .to(E.python, { scaleY: 0.94, scaleX: 1.04, duration: 0.5, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 2.6);

    // 3. title slam + flash + shake + sparkles
    tl.fromTo(E.title, { scale: 2.8, opacity: 0, filter: 'blur(14px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'back.out(1.5)' }, 2.35)
      .fromTo('#intro-flash', { opacity: 0.75 }, { opacity: 0, duration: 0.55, ease: 'power2.out', immediateRender: false }, 2.75)
      .fromTo(layer, { x: -14 }, { x: 0, duration: 0.45, ease: 'elastic.out(1.2, 0.2)', immediateRender: false }, 2.75)
      .call(() => { AU.play('intro_shimmer'); FX.sparkles(P.title.cx, P.title.cy, 18, layer, P.title.w * 0.55); }, null, 2.78)
      .fromTo('#intro-shine', { webkitMaskPosition: '150% 0', maskPosition: '150% 0' }, { webkitMaskPosition: '-60% 0', maskPosition: '-60% 0', duration: 1.1, ease: 'power2.inOut', immediateRender: false }, 3.05)
      .to(E.title, { y: '-=10', duration: 1.4, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 3.3);

    // sign dice pop in and float
    tl.fromTo([E.plus, E.minus], { scale: 0, rotation: 0 }, { scale: 1, rotation: (i) => i ? P.minus.rot : P.plus.rot, duration: 0.55, ease: 'back.out(3)', stagger: 0.12 }, 3.0)
      .to([E.plus, E.minus], { y: '-=16', duration: 1.1, yoyo: true, repeat: 3, ease: 'sine.inOut', stagger: 0.3 }, 3.6);

    // 4. explorers hop onto the jetty
    [[E.student, -1, 'student'], [E.computer, 1, 'computer']].forEach(([el, side, who], i) => {
      const x0 = side < 0 ? -200 : st.w + 200, x1 = P.chars[who];
      const t0 = 3.25 + i * 0.18;
      tl.call(() => AU.play('hop', { step: 2 + i * 2, dir: 1 }), null, t0)
        .fromTo(el, { x: x0, opacity: 1 }, { x: x1, duration: 0.75, ease: 'power1.out' }, t0)
        .fromTo(el, { y: E.feetY - 260 }, { y: E.feetY, duration: 0.75, ease: 'bounce.out' }, t0)
        .call(() => { el.src = A.url(`tokens/${who}-poses/${who === 'student' ? 'wave' : 'happy'}`); el.style.width = A.wForH(`tokens/${who}-poses/${who === 'student' ? 'wave' : 'happy'}`, P.chars.h * (who === 'computer' ? 1.04 : 1)) + 'px'; el.style.height = P.chars.h * (who === 'computer' ? 1.04 : 1) + 'px'; AU.play('intro_dock'); }, null, t0 + 0.62)
        .fromTo(el, { scaleY: 0.82, scaleX: 1.12 }, { scaleY: 1, scaleX: 1, duration: 0.35, ease: 'back.out(3)', immediateRender: false }, t0 + 0.64);
    });

    // 5. integer ticker −50 → +50 and tagline
    const num = E.ticker.querySelector('.tk-num');
    const cnt = { v: -50 };
    tl.fromTo(E.ticker, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2.5)' }, 3.95)
      .to(cnt, {
        v: 50, duration: 1.5, ease: 'power2.inOut',
        onUpdate() {
          const v = Math.round(cnt.v);
          num.textContent = v > 0 ? '+' + v : v < 0 ? '−' + -v : '0';
          num.className = 'tk-num ' + (v > 0 ? 'plus' : v < 0 ? 'minus' : 'zero');
        }
      }, 4.0)
      .to(E.ticker, { scale: 1.18, duration: 0.18, yoyo: true, repeat: 1 }, 5.5)
      .fromTo(E.tagline, { opacity: 0, y: P.tagline.y + 20 }, { opacity: 1, y: P.tagline.y, duration: 0.45 }, 4.6);
    tl.addLabel('wipe', 6.6);
    return tl;
  }

  ISL.intro = {
    wipe,
    /** Plays the cinematic. `onCovered` fires while the wave covers the screen. */
    play(onCovered) {
      const E = build();
      const tl = timeline(E);
      return new Promise(res => {
        let wiping = false;
        const go = () => {
          if (wiping) return; wiping = true;
          tl.pause();
          if (tl.time() < 6.5) AU.music('loop', 1.6);   // skipped early: hand over to the calm loop
          wipe(() => {
            tl.kill();                          // drop the whole cinematic timeline, not just its element tweens
            gsap.killTweensOf($('screen-intro').querySelectorAll('*'));
            $('screen-intro').classList.remove('open');
            $('screen-intro').innerHTML = '';
            onCovered && onCovered();
          }).then(res);
        };
        tl.call(go, null, 'wipe');
        $('intro-skip').addEventListener('click', e => { e.stopPropagation(); AU.unlock(); go(); });
        $('screen-intro').addEventListener('pointerdown', () => AU.unlock(), { once: true });
        tl.play(0);
      });
    }
  };
})(window.ISL);
