/* HUD widgets: buttons, turn banner, player cards, number line, equation panel, dice, toast. */
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
      if (active) gsap.fromTo(card, { scale: 1 }, { scale: 1.05, duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.inOut' });
    });
  }
  function setCardPos(who, n) {
    const v = $('card-' + who).querySelector('.card-pos-val');
    v.textContent = fmt(n);
    v.classList.toggle('neg', n < 0); v.classList.toggle('pos', n > 0);
    gsap.fromTo(v, { scale: 1.5 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
  }

  /* ---------- number line ---------- */
  const NL = { start: -6, count: 13, focus: 'student' };
  function nlGeom() {
    const track = $('nl-track');
    const w = track.clientWidth, pad = w * 0.085;
    return { w, pad, step: (w - pad * 2) / (NL.count - 1) };
  }
  function tickX(n) { const g = nlGeom(); return g.pad + (n - NL.start) * g.step; }
  function nlBuild(center) {
    NL.start = Math.max(B.MIN, Math.min(B.MAX - NL.count + 1, center - 6));
    const track = $('nl-track');
    track.style.setProperty('--plank-h', A.hForW('number-line/pieces/panel', track.clientWidth) + 'px');
    const box = $('nl-ticks'); box.innerHTML = '';
    for (let i = 0; i < NL.count; i++) {
      const n = NL.start + i;
      const t = document.createElement('div');
      t.className = 'nl-tick' + (n === 0 ? ' zero' : n > 0 ? ' pos' : ' neg');
      t.style.left = tickX(n) + 'px';
      t.innerHTML = `<i></i><span>${B.label(n)}</span>`;
      box.appendChild(t);
    }
  }
  function nlMarker(who) {
    let m = $('nl-marker-' + who);
    if (!m) {
      m = document.createElement('img');
      m.id = 'nl-marker-' + who; m.className = 'nl-marker ' + who; m.alt = '';
      m.src = A.url(`tokens/${who}-parts/mini-head`);
      $('nl-markers').appendChild(m);
    }
    return m;
  }
  function nlShow(positions, focusWho) {
    NL.focus = focusWho;
    nlBuild(positions[focusWho]);
    ['student', 'computer'].forEach(who => {
      const m = nlMarker(who), n = positions[who];
      const inside = n >= NL.start && n <= NL.start + NL.count - 1;
      const slot = positions.student === positions.computer ? (who === 'student' ? -0.22 : 0.22) : 0;
      gsap.set(m, { x: tickX(Math.max(NL.start, Math.min(NL.start + NL.count - 1, n))) + slot * nlGeom().step, xPercent: -50, opacity: inside ? 1 : 0 });
      m.style.zIndex = who === focusWho ? 3 : 2;
    });
    $('nl-arcs').innerHTML = '';
  }
  function nlArc(from, to, kind) {
    const box = $('nl-arcs'); box.innerHTML = '';
    const x1 = tickX(from), x2 = tickX(to);
    const key = kind === 'plus' ? 'number-line/pieces/plus-arc' : 'number-line/pieces/minus-arc';
    const w = Math.abs(x2 - x1);
    const h = Math.max(16, Math.min(46, A.hForW(key, w)));
    const el = document.createElement('img');
    el.src = A.url(key); el.className = 'nl-arc'; el.alt = '';
    Object.assign(el.style, { left: Math.min(x1, x2) + 'px', width: w + 'px', height: h + 'px' });
    if (from > to) el.style.transform = 'scaleX(-1)';
    box.appendChild(el);
    gsap.fromTo(el, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.45, ease: 'power1.inOut' });
    // little count bubbles over each hop
    const sign = Math.sign(to - from);
    for (let i = 1; i <= Math.abs(to - from); i++) {
      const c = document.createElement('span');
      c.className = 'nl-count ' + (sign > 0 ? 'plus' : 'minus');
      c.textContent = (sign > 0 ? '+' : '−') + '1';
      c.style.left = tickX(from + sign * (i - 0.5)) + 'px';
      box.appendChild(c);
      gsap.fromTo(c, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.2, delay: 0.1 + i * 0.07 });
    }
  }
  function nlStep(who, n) {
    const m = nlMarker(who);
    if (n < NL.start || n > NL.start + NL.count - 1) return;
    gsap.to(m, { x: tickX(n), duration: 0.22, ease: 'power1.inOut', opacity: 1 });
    gsap.fromTo(m, { y: 0 }, { y: -14, duration: 0.11, yoyo: true, repeat: 1, ease: 'sine.out' });
  }

  /* ---------- equation panel ---------- */
  const PANEL = { waiting: 'answer-waiting', active: 'answer-typing', good: 'answer-correct', bad: 'answer-retry', gold: 'answer-revealed' };
  function eqPanel(state) { $('eq-panel').src = A.url('ui/panels/' + PANEL[state]); }
  function numSpan(n, cls = '') { return `<span class="eq-n ${n > 0 ? 'pos' : n < 0 ? 'neg' : 'zero'} ${cls}">${fmt(n)}</span>`; }
  async function showEquation(who, pos, roll, result, opts = {}) {
    const name = who === 'student' ? 'You' : 'Computer';
    eqPanel(opts.panel || 'active');
    $('eq-caption').innerHTML = opts.caption || `${name} rolled ${numSpan(roll, 'roll')}`;
    const line = $('eq-line');
    line.innerHTML =
      `${numSpan(pos)}<span class="eq-op">+</span><span class="eq-paren">(</span>${numSpan(roll, 'roll')}<span class="eq-paren">)</span>` +
      `<span class="eq-op">=</span><span class="eq-result">${opts.hideResult ? '?' : fmt(result)}</span>`;
    $('eq-sub').innerHTML = opts.sub || '';
    fitText(line);
    const parts = line.children;
    gsap.fromTo(parts, { opacity: 0, y: 12, scale: 0.6 }, { opacity: 1, y: 0, scale: 1, duration: 0.28, stagger: 0.07, ease: 'back.out(2.5)' });
    gsap.fromTo($('eq-caption'), { opacity: 0 }, { opacity: 1, duration: 0.25 });
    await wait(0.6);
  }
  function revealResult(result, sub) {
    const r = $('eq-line').querySelector('.eq-result');
    if (r) {
      r.textContent = fmt(result);
      r.className = 'eq-result ' + (result > 0 ? 'pos' : result < 0 ? 'neg' : 'zero');
      gsap.fromTo(r, { scale: 1.8 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' });
    }
    if (sub !== undefined) { $('eq-sub').innerHTML = sub; gsap.fromTo($('eq-sub'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3 }); }
  }
  function eqMessage(caption, sub, panel = 'waiting') {
    eqPanel(panel);
    $('eq-caption').innerHTML = caption; $('eq-line').innerHTML = ''; $('eq-sub').innerHTML = sub || '';
  }
  /** Shrink the equation font if it would overflow its box (keeps it inside the paper). */
  function fitText(el) {
    el.style.fontSize = '';
    const max = el.parentElement.clientWidth;
    let fs = parseFloat(getComputedStyle(el).fontSize);
    let guard = 20;
    while (el.scrollWidth > max && fs > 14 && guard--) { fs -= 2; el.style.fontSize = fs + 'px'; }
  }

  /* ---------- dice ---------- */
  const faceKey = {
    sign: s => s > 0 ? 'dice/sign-kit/plus-face' : 'dice/sign-kit/minus-face',
    num: n => 'dice/digits/digit-0' + n
  };
  function setFace(which, v) {
    const img = $('die-' + which).querySelector('.die-face');
    img.src = A.url(faceKey[which](v));
  }
  function rollDice(sign, num) {
    ISL.audio.play('dice');
    const chip = $('roll-chip');
    gsap.to(chip, { scale: 0, opacity: 0, duration: 0.15 });
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });
      [['sign', sign, -1], ['num', num, 1]].forEach(([which, val, dir], i) => {
        const die = $('die-' + which), shadow = die.parentElement.querySelector('.die-shadow');
        const spins = dir * (360 * 2);
        tl.to(die, { y: -95 - i * 10, x: dir * 8, rotation: spins / 2, scale: 1.08, duration: 0.38, ease: 'power2.out' }, i * 0.06)
          .to(shadow, { scale: 0.55, opacity: 0.35, duration: 0.38, ease: 'power2.out' }, i * 0.06)
          .to(die, { y: 0, x: 0, rotation: spins, scale: 1, duration: 0.6, ease: 'bounce.out' }, 0.38 + i * 0.06)
          .to(shadow, { scale: 1, opacity: 0.8, duration: 0.6, ease: 'bounce.out' }, 0.38 + i * 0.06)
          .set(die, { rotation: 0 });
        // face flicker while airborne
        for (let k = 0; k < 11; k++) {
          tl.call(() => setFace(which, which === 'sign' ? (Math.random() < 0.5 ? 1 : -1) : 1 + Math.floor(Math.random() * 6)), null, i * 0.06 + k * 0.075);
        }
        tl.call(() => setFace(which, val), null, 0.86 + i * 0.06);
      });
      tl.call(() => ISL.audio.play('diceLand'), null, 0.5);
      tl.call(() => {
        const v = sign * num;
        $('roll-chip-img').src = A.url(v > 0 ? 'ui/panels/result-plus' : 'ui/panels/result-minus');
        $('roll-chip-text').textContent = fmt(v);
      }, null, 1.0);
      tl.fromTo(chip, { scale: 0, opacity: 0, rotation: -30 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.45, ease: 'back.out(2.6)' }, 1.0);
      tl.call(() => {
        const r = $('tray').getBoundingClientRect(); // fx in board space not needed; sparkle on chip
      }, null, 1.1);
    });
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
    nlShow, nlArc, nlStep, nlBuild,
    showEquation, revealResult, eqMessage, eqPanel,
    rollDice, setFace, toast, wait
  };
})(window.ISL);
