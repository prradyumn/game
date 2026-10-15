/* HUD widgets: buttons, turn banner, player cards, 3D dice, action button, hop prompt, toast. */
(function (ISL) {
  'use strict';
  const A = ISL.assets, B = ISL.board;
  const $ = id => document.getElementById(id);
  const fmt = n => B.fmt(n);
  const wait = s => new Promise(r => gsap.delayedCall(s, r));

  /* ---------- buttons (image state swapping) ---------- */
  const BTN_SET = { 'big-btn': 'large', 'mid-btn': 'medium', 'icon-btn': 'small' };
  function btnKind(el) { return Object.keys(BTN_SET).find(c => el.classList.contains(c)); }
  function setBtnState(el, state) {
    const bg = el.querySelector('.btn-bg'); if (!bg) return;
    bg.src = A.url(`ui/buttons/${BTN_SET[btnKind(el)]}-${state}`);
  }
  function initButtons() {
    document.querySelectorAll('.big-btn, .mid-btn, .icon-btn').forEach(el => {
      if (el.classList.contains('icon-btn') && !el.querySelector('.btn-bg')) {
        const bg = document.createElement('img'); bg.className = 'btn-bg fill'; bg.alt = '';
        bg.src = A.url('ui/buttons/small-idle'); el.prepend(bg);
      }
      el.addEventListener('pointerenter', () => !el.disabled && setBtnState(el, 'hover'));
      el.addEventListener('pointerleave', () => !el.disabled && setBtnState(el, 'idle'));
      el.addEventListener('pointerdown', () => { if (el.disabled) return; setBtnState(el, 'pressed'); ISL.audio.unlock(); ISL.audio.play('click'); });
      el.addEventListener('pointerup', () => !el.disabled && setBtnState(el, 'hover'));
    });
  }
  function enable(el, on) {
    el.disabled = !on;
    el.classList.toggle('is-disabled', !on);
    setBtnState(el, on ? 'idle' : 'disabled');
  }

  /* ---------- turn banner + cards ---------- */
  function setTurn(who) {
    const banner = $('turn-banner');
    $('turn-banner-img').src = A.url(who === 'student' ? 'ui/panels/turn-student' : 'ui/panels/turn-computer');
    $('turn-text').textContent = who === 'student' ? 'Your Turn!' : "Computer's Turn";
    banner.dataset.who = who;
    gsap.fromTo(banner, { scale: 0.7, rotation: -4 }, { scale: 1, rotation: 0, duration: 0.55, ease: 'elastic.out(1, 0.5)' });
    ['student', 'computer'].forEach(p => {
      const card = $('card-' + p);
      const active = p === who;
      card.querySelector('.card-img').src = A.url(`ui/panels/player-${p}-${active ? 'active' : 'waiting'}`);
      card.classList.toggle('active', active);
      if (active) {
        gsap.fromTo(card, { scale: 1 }, { scale: 1.05, duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.inOut' });
        // the turn ribbon on the active card replaces the separate turn banner
        gsap.fromTo(card.querySelector('.card-ribbon'), { scale: 0.4, y: 10 }, { scale: 1, y: 0, duration: 0.45, ease: 'back.out(2.6)' });
      }
    });
  }
  function setCardPos(who, n, pop = true) {
    const v = $('card-' + who).querySelector('.card-pos-val');
    v.textContent = fmt(n);
    v.classList.toggle('neg', n < 0); v.classList.toggle('pos', n > 0);
    if (pop) gsap.fromTo(v, { scale: 1.5 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
  }

  /* ---------- 3D dice ----------
     Each die is a CSS 3D cube: six faces from the face art plus three core planes that fill the
     rounded corners, so the edges read as a solid rounded cube. The cube sits in a fixed tilt
     (top and right faces visible) and a roll tumbles it through several turns to the result face.
     Rotation order matches GSAP's transform: rotateY(ry) rotateX(rx). */
  const FACES = [                       // where each face sits, and the cube rotation that brings it to the front
    { tf: '',                show: [0, 0] },     // front
    { tf: 'rotateY(180deg)', show: [0, 180] },   // back
    { tf: 'rotateY(90deg)',  show: [0, -90] },   // right
    { tf: 'rotateY(-90deg)', show: [0, 90] },    // left
    { tf: 'rotateX(90deg)',  show: [-90, 0] },   // top
    { tf: 'rotateX(-90deg)', show: [90, 0] }     // bottom
  ];
  const DIE = {
    sign: { values: [1, 1, 1, 1, -1, -1], art: v => v > 0 ? 'dice/sign-kit/plus-face' : 'dice/sign-kit/minus-face' },
    num:  { values: [1, 6, 3, 4, 2, 5],   art: v => 'dice/digits/digit-0' + v }     // opposite faces add to 7
  };
  const cubeState = { sign: { rx: 0, ry: 0 }, num: { rx: 0, ry: 0 } };
  // at rest the dice face the player (only the result face reads); while rolling they tilt into full 3D
  const TILT = { rest: { rotationX: -7, rotationY: -9 }, roll: { rotationX: -24, rotationY: -30 } };

  function buildDice() {
    ['sign', 'num'].forEach(which => {
      const die = $('die-' + which);
      die.innerHTML = '';
      const tilt = document.createElement('div'); tilt.className = 'die-tilt';
      const cube = document.createElement('div'); cube.className = 'cube'; cube.id = 'cube-' + which;
      ['core-x', 'core-y', 'core-z'].forEach(c => { const el = document.createElement('i'); el.className = 'core ' + c; cube.appendChild(el); });
      FACES.forEach((f, i) => {
        const face = document.createElement('i');
        face.className = 'face ' + (which === 'sign' && DIE.sign.values[i] < 0 ? 'minus' : 'plus');
        face.style.backgroundImage = `url(${A.url(DIE[which].art(DIE[which].values[i]))})`;
        face.dataset.tf = f.tf;
        cube.appendChild(face);
      });
      tilt.appendChild(cube); die.appendChild(tilt);
      gsap.set(tilt, TILT.rest);
    });
    sizeDice();
  }
  /** Cube edge = 84% of its slot; called on build and whenever the layout changes. */
  function sizeDice() {
    ['sign', 'num'].forEach(which => {
      const slot = $("slot-" + which), s = Math.round(slot.clientWidth * 0.84);
      const cube = $('cube-' + which); if (!cube) return;
      cube.style.setProperty('--s', s + 'px');
      cube.querySelectorAll('.face').forEach(f => { f.style.transform = `${f.dataset.tf} translateZ(${s / 2}px)`; });
    });
  }
  function faceFor(which, v) {
    const idx = DIE[which].values.map((x, i) => x === v ? i : -1).filter(i => i >= 0);
    return idx[Math.floor(Math.random() * idx.length)];
  }
  function setFace(which, v) {
    const [rx, ry] = FACES[faceFor(which, v)].show;
    cubeState[which] = { rx, ry };
    gsap.set('#cube-' + which, { rotationX: rx, rotationY: ry });
  }
  /** Smallest rotation ≥ `from + min` that lands on the same orientation as `to`. */
  const spinTo = (from, to, min) => to + 360 * Math.ceil((from + min - to) / 360);

  function rollDice(sign, num) {
    ISL.audio.play('dice');
    const chip = $('roll-chip');
    gsap.to(chip, { scale: 0, opacity: 0, duration: 0.15 });
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });
      [['sign', sign, -1], ['num', num, 1]].forEach(([which, val, dir], i) => {
        const die = $('die-' + which), shadow = die.parentElement.querySelector('.die-shadow');
        const cube = $('cube-' + which), cur = cubeState[which];
        const [tx, ty] = FACES[faceFor(which, val)].show;
        const endX = spinTo(cur.rx, tx, 540 + i * 180), endY = spinTo(cur.ry, ty, 360 + (1 - i) * 180);
        const t0 = i * 0.06, tilt = die.querySelector('.die-tilt');
        tl.to(tilt, Object.assign({ duration: 0.25, ease: 'power2.out' }, TILT.roll), t0)
          .to(tilt, Object.assign({ duration: 0.4, ease: 'back.out(1.6)' }, TILT.rest), 0.98 + t0)
          .call(() => { die.classList.remove('glow'); void die.offsetWidth; die.classList.add('glow'); }, null, 1.02 + t0);
        // toss up and bounce down in the tray…
        tl.to(die, { y: -95 - i * 10, x: dir * 8, scale: 1.1, duration: 0.38, ease: 'power2.out' }, t0)
          .to(shadow, { scale: 0.55, opacity: 0.35, duration: 0.38, ease: 'power2.out' }, t0)
          .to(die, { y: 0, x: 0, scale: 1, duration: 0.6, ease: 'bounce.out' }, 0.38 + t0)
          .to(shadow, { scale: 1, opacity: 0.8, duration: 0.6, ease: 'bounce.out' }, 0.38 + t0)
          // …while the cube tumbles in 3D and settles on the result face
          .to(cube, { rotationX: endX, rotationY: endY, duration: 0.98, ease: 'power3.out' }, t0)
          .call(() => { cubeState[which] = { rx: endX % 360, ry: endY % 360 }; gsap.set(cube, { rotationX: endX % 360, rotationY: endY % 360 }); }, null, 1.0 + t0);
      });
      tl.call(() => ISL.audio.play('diceLand'), null, 0.5);
      tl.call(() => {
        const v = sign * num;
        $('roll-chip-img').src = A.url(v > 0 ? 'ui/panels/result-plus' : 'ui/panels/result-minus');
        $('roll-chip-text').textContent = fmt(v);
      }, null, 1.0);
      tl.fromTo(chip, { scale: 0, opacity: 0, rotation: -30 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.45, ease: 'back.out(2.6)' }, 1.0);
    });
  }

  /* ---------- action button (Roll! / Hop!) ----------
     While the student must act, the big button glows and breathes. If nothing happens for a
     few seconds it escalates to a nudge, repeating until they act:
       roll mode — button wiggle, the dice hop, a bouncing arrow at the button, a chime
       hop mode  — button wiggle and the "tap to hop" prompt over the character bounces */
  let nudgeCall = null, nudgeCb = null, mode = null;
  function rollReady(on, onNudge, m = 'roll') {
    const btn = $('btn-roll');
    mode = on ? m : null; nudgeCb = onNudge || null;
    btn.classList.toggle('ready', on);
    btn.classList.toggle('small-label', on && m === 'pick');
    $('tray').classList.toggle('ready', on && m === 'roll');
    $('roll-nudge').classList.remove('on');
    gsap.killTweensOf(btn, 'scale,rotation');
    gsap.killTweensOf(['#die-sign', '#die-num'], 'y');
    gsap.set(btn, { scale: 1, rotation: 0 });
    gsap.set(['#die-sign', '#die-num'], { y: 0 });
    btn.querySelector('.btn-label').textContent = on ? ({ hop: 'Hop!', go: 'Go!', pick: 'Tap a square' }[m] || 'Roll!') : (ISL.game.G.turn === 'student' ? 'Roll!' : 'Wait…');
    btn.setAttribute('aria-label', on ? ({ hop: 'Hop', go: 'Go — land on the picked square' }[m] || 'Roll the dice') : 'Roll the dice');
    if (!on) { if (nudgeCall) { nudgeCall.kill(); nudgeCall = null; } return; }
    gsap.to(btn, { scale: 1.05, duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    poke();
  }
  /** Restart the idle timer (called on every hop so the nudge only fires when the player stalls). */
  function poke() {
    if (nudgeCall) nudgeCall.kill();
    if (!mode) return;
    let count = 0;
    const schedule = d => { nudgeCall = gsap.delayedCall(d, () => { count++; nudge(); nudgeCb && nudgeCb(count); schedule(5); }); };
    schedule(mode === 'hop' ? 3 : 3.5);
  }
  function nudge() {
    const btn = $('btn-roll');
    gsap.fromTo(btn, { rotation: 0 }, { keyframes: { rotation: [0, -7, 7, -5, 4, -2, 0] }, duration: 0.6, ease: 'none' });
    if (mode === 'hop' || mode === 'go' || mode === 'pick') {
      const p = $(mode === 'hop' ? 'hop-prompt' : 'pick-prompt');
      if (p) { p.classList.remove('bounce'); void p.offsetWidth; p.classList.add('bounce'); }
    } else {
      gsap.fromTo(['#die-sign', '#die-num'], { y: 0 }, { y: -20, duration: 0.16, yoyo: true, repeat: 1, stagger: 0.08, ease: 'power2.out' });
      const arrow = $('roll-nudge');
      arrow.classList.remove('on'); void arrow.offsetWidth; arrow.classList.add('on');
    }
    ISL.audio.play('nudge');
  }

  /* ---------- hop prompt ----------
     A pill fixed over the top of the board while the player taps the character along:
     direction arrow, "Tap to hop!" and a counter (2 / 5). It sits outside the camera, so it
     never covers the character mid-jump. (x, y are accepted for API compatibility and ignored.) */
  function hopPrompt(x, y, dir, done, total, dur, tokenEl) {
    // sit over the top of the board — or the bottom when the character is up there, so it never covers it
    const st = $('stage').getBoundingClientRect(), k = ISL.layout.scale;
    const tokenY = tokenEl ? (tokenEl.getBoundingClientRect().top - st.top) / k : Infinity;
    const r = ISL.layout.rect(tokenY < ISL.layout.stage.h * 0.4 ? 'hop-hud-low' : 'hop-hud');
    let p = $('hop-prompt');
    if (!p) {
      p = document.createElement('div'); p.id = 'hop-prompt'; p.className = 'abs';
      p.innerHTML = '<b class="hp-arrow"></b><span class="hp-text">Tap to hop!</span><span class="hp-count"></span>';
      $('stage').appendChild(p);
      Object.assign(p.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
      gsap.fromTo(p, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2.2)' });
    } else if (parseFloat(p.style.top) !== r.y) {
      gsap.to(p, { top: r.y, duration: 0.35, ease: 'power2.inOut' });
    }
    p.classList.toggle('up', dir > 0); p.classList.toggle('down', dir < 0);
    p.querySelector('.hp-arrow').textContent = dir > 0 ? '▲' : '▼';
    p.querySelector('.hp-text').textContent = done ? (dir > 0 ? 'Keep hopping up!' : 'Keep hopping down!') : (dir > 0 ? 'Tap to hop up!' : 'Tap to hop down!');
    const c = p.querySelector('.hp-count');
    c.innerHTML = `<b>${done}</b> / ${total}`;
    if (done) gsap.fromTo(c, { scale: 1.5 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
  }
  /** Pulsing ring on the square the next tap will hop to (null hides it). */
  /** A still ring on the square the next tap hops to (null removes it). It never glides or pulses:
      it simply fades out as a hop starts and fades in on the next square once the character lands. */
  function nextSquare(c) {
    const old = $('next-square');
    if (old) { old.id = ''; gsap.to(old, { opacity: 0, duration: 0.12, onComplete: () => old.remove() }); }
    if (!c) return;
    const el = document.createElement('i'); el.id = 'next-square';
    $('board-ui').appendChild(el);
    gsap.set(el, { xPercent: -50, yPercent: -50, x: c.x, y: c.y + 8 });
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.18 });
  }
  function hideHopPrompt() {
    const p = $('hop-prompt'); if (!p) return;
    p.id = '';
    gsap.to(p, { scale: 0.4, opacity: 0, duration: 0.25, onComplete: () => p.remove() });
  }

  /* ---------- stars (3 / 2 / 1 per move) ---------- */
  function setStars(total, gained) {
    const el = $('card-stars'); if (!el) return;
    el.querySelector('span').textContent = total;
    if (gained > 0) {
      gsap.fromTo(el, { scale: 1.6 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
      const r = el.getBoundingClientRect(), st = $('stage').getBoundingClientRect(), k = ISL.layout.scale;
      ISL.fx.sparkles((r.left + r.width / 2 - st.left) / k, (r.top + r.height / 2 - st.top) / k, 4 + gained * 3, $('stage'), 60);
      const pop = document.createElement('b'); pop.className = 'star-pop'; pop.textContent = '+' + '★'.repeat(gained);
      el.appendChild(pop);
      gsap.fromTo(pop, { y: 0, opacity: 1 }, { y: -46, opacity: 0, duration: 1.1, ease: 'power1.out', onComplete: () => pop.remove() });
    }
  }

  /* ---------- toast ---------- */
  function toast(html, kind = '') {
    const t = $('toast');
    t.className = 'abs show ' + kind;
    t.innerHTML = `<span>${html}</span>`;
    gsap.killTweensOf(t);
    return gsap.timeline()
      .fromTo(t, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2.5)' })
      .to(t, { opacity: 0, scale: 0.9, duration: 0.3, delay: 1.1 });
  }

  ISL.ui = {
    initButtons, enable, setBtnState, setTurn, setCardPos,
    buildDice, sizeDice, rollDice, setFace, toast, wait, rollReady, poke, setStars,
    hopPrompt, hideHopPrompt, nextSquare
  };
})(window.ISL);
