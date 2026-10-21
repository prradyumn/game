/* Tokens + turn state machine (student vs computer). */
(function (ISL) {
  'use strict';
  const A = ISL.assets, B = ISL.board, UI = ISL.ui, FX = ISL.fx, AU = ISL.audio, CINE = ISL.cine;
  const $ = id => document.getElementById(id);
  const ABORT = { aborted: true };
  const SIGN_FACES = [1, 1, 1, 1, -1, -1];     // sign die: 4 plus faces, 2 minus faces
  const ZOOM = { move: 1.9, ride: 1.45 };       // camera zoom while hopping / riding a snake or ladder

  /* ---------- tokens ---------- */
  const IDLE_H = { student: 86, computer: 90 };  // on-board height of the idle pose (board units)
  class Token {
    constructor(who) {
      this.who = who; this.pos = 0; this.pose = null;
      const idle = A.size(`tokens/${who}-poses/idle`);
      this.scale = IDLE_H[who] / idle[1];
      const el = document.createElement('div');
      el.className = 'token ' + who; el.id = 'token-' + who;
      el.innerHTML = `<i class="token-ring"></i><img class="token-shadow" src="${A.url('dice/sign-kit/shadow')}" alt="">` +
        `<svg class="token-marker" viewBox="0 0 60 70" style="top:${-IDLE_H[who] - 66}px"><path d="M19 5h22v27h13L30 64 6 32h13z" stroke-width="6" stroke-linejoin="round"/></svg>`;
      $('board-tokens').appendChild(el);
      this.el = el;
      const sh = el.querySelector('.token-shadow');
      const sw = 54; Object.assign(sh.style, { width: sw + 'px', height: A.hForW('dice/sign-kit/shadow', sw) + 'px', left: -sw / 2 + 'px', top: -A.hForW('dice/sign-kit/shadow', sw) / 2 + 'px' });
      this.inner = document.createElement('div'); // squash/stretch wrapper
      this.inner.className = 'token-body';
      el.appendChild(this.inner);
      // Every pose is a pre-sized, pre-decoded image stacked in the body; changing pose only flips
      // which one is visible, so the character never blanks or stretches while a new image decodes.
      this.imgs = {};
      Object.keys(window.ASSET_SIZES).filter(k => k.startsWith(`tokens/${who}-poses/`)).forEach(key => {
        const [w, h] = A.size(key), W = w * this.scale, H = h * this.scale;
        const im = document.createElement('img');
        im.className = 'token-img'; im.alt = ''; im.decoding = 'sync'; im.src = A.url(key);
        Object.assign(im.style, { width: W + 'px', height: H + 'px', left: -W / 2 + 'px', top: -H + 'px' });
        this.inner.appendChild(im);
        this.imgs[key.split('/').pop()] = im;
      });
      this.setPose('idle');
    }
    setPose(p) {
      if (this.pose === p || !this.imgs[p]) return;
      if (this.pose) this.imgs[this.pose].classList.remove('on');
      this.imgs[p].classList.add('on');
      this.pose = p;
      this.el.dataset.pose = p;
    }
    rest() { this.setPose(this.pos < 0 ? 'underwater' : 'idle'); }
    place(pt) { gsap.set(this.el, { x: pt.x, y: pt.y }); this.el.style.zIndex = Math.round(pt.y + 100); }
    xy() { return { x: gsap.getProperty(this.el, 'x'), y: gsap.getProperty(this.el, 'y') }; }
  }

  /* ---------- game state ---------- */
  const G = {
    sid: 0, tokens: {}, turn: 'student', over: false, forced: [], rollResolver: null, hopResolver: null, hopTold: false, stars: 0, pickDest: null,
    positions() { return { student: this.tokens.student.pos, computer: this.tokens.computer.pos }; },
    slotFor(who) {
      const p = this.positions();
      if (p.student !== p.computer) return 0;
      return who === 'student' ? -1 : 1;
    }
  };

  function guardFactory(sid) {
    return async p => { const r = await p; if (sid !== G.sid) throw ABORT; return r; };
  }
  const tlPromise = tl => new Promise(r => tl.eventCallback('onComplete', r));

  function arrange(duration = 0.25) {
    ['student', 'computer'].forEach(who => {
      const t = G.tokens[who];
      const pt = B.anchor(t.pos, G.slotFor(who));
      gsap.to(t.el, { x: pt.x, y: pt.y, duration, ease: 'power2.out' });
      t.el.style.zIndex = Math.round(pt.y + 100) + (who === G.turn ? 1 : 0);
    });
  }

  /* one hop from current spot to square n; step = hop number in this move, dir = ±1 */
  function hop(t, n, prev, step, dir, slow) {
    const a = t.xy(), b = B.anchor(n, 0);
    const tl = gsap.timeline();
    // the token's spot glides square to square while its body (not its shadow or ring) arcs up:
    // the ground shadow shrinks under the jump, so every hop reads clearly
    const D = slow ? 0.4 : 0.3, H = slow ? 72 : 42;
    const shadow = t.el.querySelector('.token-shadow');
    tl.call(() => { t.setPose('hop'); AU.play('hop', { step, dir }); });
    tl.to(t.el, { x: b.x, y: b.y, duration: D, ease: 'none' }, 0);
    // body: ease into a quick stretch (never snap), rise, fall; then a squash on landing
    tl.to(t.inner, { scaleY: 1.12, scaleX: 0.9, duration: 0.06, ease: 'power1.out', transformOrigin: '50% 100%' }, 0);
    tl.to(t.inner, { scaleY: 1, scaleX: 1, duration: D * 0.5 - 0.06, ease: 'power1.inOut' }, 0.06);
    tl.to(t.inner, { y: -H - Math.max(0, a.y - b.y) * 0.25, duration: D * 0.5, ease: 'power2.out' }, 0);
    tl.to(t.inner, { y: 0, duration: D * 0.5, ease: 'power2.in' }, D * 0.5);
    tl.to(shadow, { scale: 0.5, opacity: 0.22, duration: D * 0.5, ease: 'power2.out' }, 0);
    tl.to(shadow, { scale: 1, opacity: 0.55, duration: D * 0.5, ease: 'power2.in' }, D * 0.5);
    tl.call(() => { t.el.style.zIndex = Math.round(b.y + 101); }, null, D * 0.5);
    tl.to(t.inner, { scaleY: slow ? 0.76 : 0.86, scaleX: slow ? 1.2 : 1.1, duration: 0.08, yoyo: true, repeat: 1, ease: 'sine.out', transformOrigin: '50% 100%' }, D);
    tl.call(() => {
      AU.play(n < 0 ? 'plip' : 'land');
      FX.stepCount(b.x, b.y - 96, step * dir);
      if (slow && n !== 0) FX.cellFlash(B.center(n), dir);
      if (n < 0 && prev >= 0) FX.splash(b.x, b.y);
      else if (n < 0) { FX.ripple(b.x, b.y - 4); FX.bubbles(b.x, b.y - 30, 2); }
      else if (n > 0) FX.sandPuff(b.x, b.y);
      else FX.ripple(b.x, b.y);
      t.pos = n;
      UI.setCardPos(t.who, n, false);
    }, null, D);
    return tl;
  }

  async function moveSteps(t, to, guard, slow) {
    const dir = Math.sign(to - t.pos);
    const dots = [];
    let step = 0;
    while (t.pos !== to) {
      const prev = t.pos, n = t.pos + dir;
      await guard(tlPromise(hop(t, n, prev, ++step, dir, slow)));
      if (n !== 0) { const c = B.center(n); dots.push(FX.pathDot(c.x, c.y + 4, dir)); }
      if (slow) await guard(UI.wait(0.07));
    }
    gsap.to(dots, { opacity: 0, duration: 0.6, delay: 0.8, stagger: 0.05, onComplete: () => dots.forEach(d => d.remove()) });
  }

  /** The player's move: one tap (or Space / the Hop! button) per hop. Taps queue up, so quick
      tapping never loses a hop, and extra taps past the landing square are ignored. */
  async function hopByTap(t, to, guard, narrate) {
    const dir = Math.sign(to - t.pos), total = Math.abs(to - t.pos);
    if (!total) return;
    const VO = ISL.voice;
    let done = 0, queued = 0, wake = null;
    // the counter updates as each hop starts; the still ring marks only the square the next tap lands on
    const prompt = (n = t.pos) => { const a = B.anchor(n, 0); UI.hopPrompt(a.x, a.y - IDLE_H[t.who] - 46, dir, done, total, 0, t.el); };
    const markNext = () => UI.nextSquare(t.pos + dir === 0 ? B.anchor(0, 0) : B.center(t.pos + dir));
    G.hopResolver = () => { if (done + queued < total) { queued++; UI.poke(); if (wake) { const w = wake; wake = null; w(); } } };
    UI.enable($('btn-roll'), true);
    UI.rollReady(true, n => { if (narrate && n === 1) VO.say('tap_hop'); }, 'hop');
    prompt(); markNext();
    if (narrate && !G.hopTold) { G.hopTold = true; VO.say('tap_hop'); }
    const dots = [];
    while (done < total) {
      if (!queued) await guard(new Promise(r => { wake = r; }));
      queued--;
      if (done === 0) VO.stop();
      const prev = t.pos, n = t.pos + dir;
      UI.nextSquare(null);                       // ring leaves while the character is in the air
      const h = hop(t, n, prev, ++done, dir, true);
      if (done < total) prompt(n); else UI.hideHopPrompt();
      await guard(tlPromise(h));
      if (n !== 0) { const c = B.center(n); dots.push(FX.pathDot(c.x, c.y + 4, dir)); }
      if (done < total) markNext();              // …and appears on the next square once it has landed
    }
    G.hopResolver = null;
    UI.rollReady(false); UI.enable($('btn-roll'), false);
    UI.hideHopPrompt(); UI.nextSquare(null);
    gsap.to(dots, { opacity: 0, duration: 0.6, delay: 0.8, stagger: 0.05, onComplete: () => dots.forEach(d => d.remove()) });
  }

  async function rideSnake(t, s, guard) {
    AU.play('snake');
    B.setHead(s, 'alert');
    gsap.fromTo(s.headEl, { scale: 1 }, { scale: 1.3, duration: 0.2, yoyo: true, repeat: 1, ease: 'back.out(3)' });
    gsap.fromTo(s.tagEl, { scale: 1 }, { scale: 1.35, duration: 0.25, yoyo: true, repeat: 1 });
    t.setPose('worried');
    UI.toast(`Snake! <b class="minus">${B.fmt(s.to - s.from)}</b>`, 'bad');
    await guard(UI.wait(0.6));
    const prog = { f: 0 };
    let wasLand = t.pos >= 0;
    await guard(new Promise(res => gsap.to(prog, {
      f: 1, duration: Math.min(3.4, 0.9 + s.pts.total / 450), ease: 'power1.inOut',
      onUpdate() {
        const p = B.along(s.pts, prog.f);
        const y = p.y + 20 + 8 * prog.f;
        gsap.set(t.el, { x: p.x, y, rotation: Math.sin(prog.f * Math.PI * 4) * 8 });
        t.el.style.zIndex = Math.round(y + 101);
        const nowLand = y < 500 + 34;
        if (wasLand && !nowLand) { FX.splash(p.x, y); wasLand = false; }
      },
      onComplete: res
    })));
    gsap.set(t.el, { rotation: 0 });
    t.pos = s.to;
    B.setHead(s, 'content');
    if (t.pos < 0) FX.bubbles(B.anchor(t.pos).x, B.anchor(t.pos).y - 30, 5);
  }

  async function climbLadder(t, l, guard) {
    AU.play('ladder');
    t.setPose('happy');
    gsap.fromTo(l.tagEl, { scale: 1 }, { scale: 1.35, duration: 0.25, yoyo: true, repeat: 1 });
    UI.toast(`Ladder! <b class="plus">${B.fmt(l.to - l.from)}</b>`, 'good');
    await guard(UI.wait(0.5));
    const pts = B.ladderPath(l);
    const prog = { f: 0 };
    t.setPose('hop');
    let wasSea = t.pos < 0;
    await guard(new Promise(res => gsap.to(prog, {
      f: 1, duration: 0.6 + pts.total / 420, ease: 'power1.inOut',
      onUpdate() {
        const p = B.along(pts, prog.f);
        const y = p.y + 34 + Math.abs(Math.sin(prog.f * Math.PI * 7)) * -6;
        gsap.set(t.el, { x: p.x, y });
        t.el.style.zIndex = Math.round(y + 101);
        if (wasSea && y < 500 + 34) { FX.splash(p.x, y + 10); wasSea = false; }
      },
      onComplete: res
    })));
    t.pos = l.to;
    const a = B.anchor(t.pos);
    FX.sparkles(a.x, a.y - 40, 8);
    t.setPose('cheer');
    await guard(UI.wait(0.45));
  }

  /* ---------- the turn ---------- */
  function rollValues() {
    if (G.forced.length) return G.forced.shift();
    return [SIGN_FACES[Math.floor(Math.random() * 6)], 1 + Math.floor(Math.random() * 6)];
  }

  /** One complete turn for `who`. Returns 'win' or 'done'. opts.narrate=false silences auto voice. */
  async function doTurn(who, guard, opts = {}) {
    const VO = ISL.voice;
    const narrate = opts.narrate !== false;
    const t = G.tokens[who], other = G.tokens[who === 'student' ? 'computer' : 'student'];
    G.turn = who;
    UI.setTurn(who); AU.play('turn');
    t.rest(); other.rest();
    t.el.classList.add('is-turn'); other.el.classList.remove('is-turn', 'awaiting');
    arrange(0.2);

    if (who === 'student') {
      if (narrate) VO.say('your_turn');
      UI.enable($('btn-roll'), true);
      UI.rollReady(true, n => { if (narrate && n === 2) VO.say('nudge'); });
      t.el.classList.add('awaiting');
      await guard(new Promise(r => { G.rollResolver = r; }));
      opts.onRoll && opts.onRoll();
      t.el.classList.remove('awaiting');
      UI.rollReady(false);
      VO.stop();
    } else {
      UI.rollReady(false);
      t.setPose('thinking');
      if (narrate) VO.say('computer_turn');
      await guard(UI.wait(1.0));
    }
    UI.enable($('btn-roll'), false);

    const [sign, num] = rollValues();
    const roll = sign * num;
    if (who === 'computer') t.setPose('idle');
    await guard(UI.rollDice(sign, num));

    const start = t.pos;
    const target = start + roll;
    const dest = Math.max(B.MIN, Math.min(B.MAX, target));
    if (who === 'computer') FX.target(who, B.center(dest).x - 32, B.center(dest).y - 32 + (dest === 0 ? 0 : 6));
    if (narrate) VO.number(roll);

    if (who === 'student') {
      // the student decides where the explorer lands (whole board in view), with hints if wrong
      const land = () => {                      // a right pick: the explorer simply stands on the square, no hopping
        const prev = t.pos; t.pos = dest; t.setPose(roll > 0 ? 'happy' : (dest < 0 ? 'underwater' : 'worried'));
        arrange(0); UI.setCardPos('student', dest, false);
        const a = B.anchor(dest, G.slotFor('student'));
        if (dest < 0 && prev >= 0) FX.splash(a.x, a.y); else if (dest > 0) FX.sandPuff(a.x, a.y);
      };
      const res = await ISL.answer.ask({ token: t, start, roll, dest, guard, narrate, land });
      G.stars += 4 - res.tries;
      UI.setStars(G.stars, 4 - res.tries);
      // then the camera swoops in and the explorer hops there — or they count it together
      if (res.together) {
        await guard(CINE.cam.focus(t.el, ZOOM.move, 0.8));
        await hopByTap(t, dest, guard, narrate);
      }
    } else {
      // camera swoops in so the character fills the view, then the hops happen
      await guard(CINE.cam.focus(t.el, ZOOM.move, 0.8));
      await moveSteps(t, dest, guard, false);
    }
    FX.hideTarget(who);
    UI.setCardPos(who, t.pos);
    t.setPose(roll > 0 ? 'happy' : (t.pos < 0 ? 'underwater' : 'worried'));
    if (target > B.MAX) UI.toast('Summit! <b class="plus">+50</b>', 'good');
    if (target < B.MIN) UI.toast('Seafloor! <b class="minus">−50</b>', 'bad');
    if (narrate) {
      if (target > B.MAX) await guard(VO.say('summit_past'));
      if (target < B.MIN) await guard(VO.say('seafloor'));
    }
    await guard(UI.wait(0.45));

    if (t.pos === B.MAX) { await guard(CINE.cam.release(0.6)); return 'win'; }

    const s = B.snakeAt(t.pos), l = B.ladderAt(t.pos);
    if (s || l) {
      if (narrate) VO.say(s ? 'snake' : 'ladder');
      await guard(CINE.cam.focus(t.el, ZOOM.ride, 0.6));
      if (s) await rideSnake(t, s, guard); else await climbLadder(t, l, guard);
      UI.setCardPos(who, t.pos);
      await guard(UI.wait(0.35));
    }
    await guard(CINE.cam.release(0.6));
    t.rest();
    arrange();
    return t.pos === B.MAX ? 'win' : 'done';
  }

  async function playTurn(who) {
    const guard = guardFactory(G.sid);
    let w = who;
    for (;;) {
      const r = await doTurn(w, guard);
      if (r === 'win') return finish(w, guard);
      await guard(UI.wait(0.35));
      w = w === 'student' ? 'computer' : 'student';
    }
  }

  async function finish(who, guard) {
    G.over = true;
    const t = G.tokens[who], other = G.tokens[who === 'student' ? 'computer' : 'student'];
    t.setPose('cheer'); other.setPose(who === 'student' ? 'worried' : 'happy');
    gsap.to('.flag-cloth', { scale: 1.25, duration: 0.3, yoyo: true, repeat: 3, transformOrigin: '0% 50%' });
    FX.sparkles(B.anchor(B.MAX).x, B.anchor(B.MAX).y - 50, 14, undefined, 90);
    UI.toast(who === 'student' ? 'You planted the flag!' : 'Computer planted the flag!', 'good');
    await guard(UI.wait(1.2));
    ISL.main.showWin(who);
    ISL.voice.say(who === 'student' ? 'win_student' : 'win_computer');
  }

  /* ---------- public ---------- */
  ISL.game = {
    G, ABORT, doTurn, guardFactory, arrange,
    init() {
      $('board-tokens').innerHTML = '';
      G.tokens.student = new Token('student');
      G.tokens.computer = new Token('computer');
      const act = () => {
        if ($('btn-roll').disabled) return;
        if (G.rollResolver) { const r = G.rollResolver; G.rollResolver = null; r(); }
        else if (ISL.answer.active) ISL.answer.confirm();
        else if (G.hopResolver) G.hopResolver();
      };
      $('btn-roll').addEventListener('click', act);
      // while hopping, a tap anywhere on the play area (not on a button) makes one hop
      $('screen-game').addEventListener('pointerdown', e => {
        if (!G.hopResolver || e.target.closest('button') || document.body.hasAttribute('data-paused')) return;
        AU.unlock(); FX.tapRipple(e.clientX, e.clientY); G.hopResolver();
      });
      window.addEventListener('keydown', e => {
        // picking: arrow keys step the selection up/down the number line
        if (ISL.answer.active && !document.body.hasAttribute('data-paused') && /^Arrow(Up|Down|Left|Right)$/.test(e.code)) {
          e.preventDefault(); ISL.answer.nudgeKeys(e.code === 'ArrowUp' || e.code === 'ArrowRight' ? 1 : -1); return;
        }
        if (e.code !== 'Space' && e.code !== 'Enter') return;
        if (!(G.rollResolver || G.hopResolver || ISL.answer.active) || $('btn-roll').disabled || document.body.dataset.screen !== 'game' || document.body.hasAttribute('data-paused')) return;
        const f = document.activeElement;
        if (e.code === 'Enter' && f && f.tagName === 'BUTTON' && f.id !== 'btn-roll') return;   // Enter activates the focused button
        if (f && f !== document.body) f.blur();
        e.preventDefault(); act();
      });
    },
    reset() {
      G.sid++; G.over = false; G.rollResolver = null; G.hopResolver = null;
      ISL.voice.stop();
      CINE.cam.reset(); UI.hideHopPrompt(); UI.nextSquare(null); ISL.answer.reset();
      G.stars = 0; UI.setStars(0, 0);
      ['student', 'computer'].forEach(w => {
        const t = G.tokens[w], sh = t.el.querySelector('.token-shadow');
        gsap.killTweensOf([t.el, t.inner, sh]);
        gsap.set(t.inner, { y: 0, scaleX: 1, scaleY: 1 }); gsap.set(sh, { scale: 1, opacity: 0.55 });
        t.el.classList.remove('is-turn', 'awaiting'); t.pos = 0; t.rest(); UI.setCardPos(w, 0);
      });
      G.turn = 'student';
      UI.rollReady(false);
      arrange(0);
      gsap.set([G.tokens.student.el, G.tokens.computer.el], { rotation: 0 });
      document.getElementById('board-fx').innerHTML = '';
      B.SNAKES.forEach(s => B.setHead(s, 'content'));
      ['student', 'computer'].forEach(w => FX.hideTarget(w));
      UI.setFace('sign', 1); UI.setFace('num', 1);
      gsap.set('#roll-chip', { scale: 0, opacity: 0 });
      UI.enable($('btn-roll'), false);
    },
    start() {
      this.reset();
      playTurn('student').catch(e => { if (e !== ABORT) console.error(e); });
    },
    /** QA helpers: queue dice results, e.g. ISL.game.force([1,6],[-1,3]) */
    force(...rolls) { G.forced.push(...rolls); },
    /** QA helper: answer the current pick with square n (default: the right answer). */
    pick(n = G.pickDest) { return ISL.answer.pick(n); },
    teleport(who, n) { G.tokens[who].pos = n; arrange(0); G.tokens[who].rest(); UI.setCardPos(who, n); }
  };
})(window.ISL);
