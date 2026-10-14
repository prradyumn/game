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
      el.innerHTML = `<i class="token-ring"></i><img class="token-shadow" src="${A.url('dice/sign-kit/shadow')}" alt=""><img class="token-img" alt="">` +
        `<svg class="token-marker" viewBox="0 0 60 70" style="top:${-IDLE_H[who] - 66}px"><path d="M19 5h22v27h13L30 64 6 32h13z" stroke-width="6" stroke-linejoin="round"/></svg>`;
      $('board-tokens').appendChild(el);
      this.el = el; this.img = el.querySelector('.token-img');
      const sh = el.querySelector('.token-shadow');
      const sw = 54; Object.assign(sh.style, { width: sw + 'px', height: A.hForW('dice/sign-kit/shadow', sw) + 'px', left: -sw / 2 + 'px', top: -A.hForW('dice/sign-kit/shadow', sw) / 2 + 'px' });
      this.inner = document.createElement('div'); // squash/stretch wrapper
      this.inner.className = 'token-body';
      this.inner.appendChild(this.img); el.appendChild(this.inner);
      this.setPose('idle');
    }
    setPose(p) {
      if (this.pose === p) return;
      this.pose = p;
      const key = `tokens/${this.who}-poses/${p}`;
      const [w, h] = A.size(key);
      const W = w * this.scale, H = h * this.scale;
      this.img.src = A.url(key);
      Object.assign(this.img.style, { width: W + 'px', height: H + 'px', left: -W / 2 + 'px', top: -H + 'px' });
      this.el.dataset.pose = p;
    }
    rest() { this.setPose(this.pos < 0 ? 'underwater' : 'idle'); }
    place(pt) { gsap.set(this.el, { x: pt.x, y: pt.y }); this.el.style.zIndex = Math.round(pt.y + 100); }
    xy() { return { x: gsap.getProperty(this.el, 'x'), y: gsap.getProperty(this.el, 'y') }; }
  }

  /* ---------- game state ---------- */
  const G = {
    sid: 0, tokens: {}, turn: 'student', over: false, forced: [], rollResolver: null,
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
    const D = slow ? 0.42 : 0.3, H = slow ? 48 : 34;
    tl.call(() => { t.setPose('hop'); AU.play('hop', { step, dir }); });
    tl.to(t.el, { x: b.x, duration: D, ease: 'none' }, 0);
    tl.to(t.el, { y: Math.min(a.y, b.y) - H, duration: D * 0.5, ease: 'power2.out' }, 0);
    tl.to(t.el, { y: b.y, duration: D * 0.5, ease: 'power2.in' }, D * 0.5);
    tl.call(() => { t.el.style.zIndex = Math.round(b.y + 101); }, null, D * 0.5);
    tl.fromTo(t.inner, { scaleY: 1, scaleX: 1 }, { scaleY: 0.84, scaleX: 1.12, duration: 0.07, yoyo: true, repeat: 1, ease: 'sine.out', transformOrigin: '50% 100%' }, D);
    tl.call(() => {
      AU.play(n < 0 ? 'plip' : 'land');
      FX.stepCount(b.x, b.y - 96, step * dir);
      if (n < 0 && prev >= 0) FX.splash(b.x, b.y);
      else if (n < 0) { FX.ripple(b.x, b.y - 4); FX.bubbles(b.x, b.y - 30, 2); }
      else if (n > 0) FX.sandPuff(b.x, b.y);
      else FX.ripple(b.x, b.y);
      UI.nlStep(t.who, n);
      t.pos = n;
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
      f: 1, duration: Math.min(2.2, 0.9 + s.pts.total / 500), ease: 'power1.inOut',
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
    UI.nlShow(G.positions(), who);
    t.rest(); other.rest();
    t.el.classList.add('is-turn'); other.el.classList.remove('is-turn', 'awaiting');
    arrange(0.2);
    const name = who === 'student' ? 'You' : 'Computer';

    if (who === 'student') {
      UI.eqMessage(opts.prompt || 'Your turn!', 'Tap <b>Roll!</b> to throw both dice.');
      if (narrate) VO.say('your_turn');
      UI.enable($('btn-roll'), true);
      UI.rollReady(true, n => { if (narrate && n === 2) VO.say('your_turn'); });
      t.el.classList.add('awaiting');
      await guard(new Promise(r => { G.rollResolver = r; }));
      opts.onRoll && opts.onRoll();
      t.el.classList.remove('awaiting');
      UI.rollReady(false);
      VO.stop();
    } else {
      UI.rollReady(false);
      UI.eqMessage('Computer is thinking…', '');
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
    FX.target(who, B.center(dest).x - 32, B.center(dest).y - 32 + (dest === 0 ? 0 : 6));
    if (narrate) VO.number(roll);
    await guard(UI.showEquation(who, start, roll, target, { hideResult: true }));
    UI.nlArc(start, dest, roll > 0 ? 'plus' : 'minus');

    // camera swoops in on the token and follows every hop
    await guard(CINE.cam.focus(t.el, ZOOM.move, 0.8));
    await moveSteps(t, dest, guard, who === 'student');
    FX.hideTarget(who);
    const steps = Math.abs(dest - start);
    let sub = `${steps} step${steps === 1 ? '' : 's'} ${roll > 0 ? 'up ⬆' : 'down ⬇'}`;
    if (target > B.MAX) sub = `Past +50 — that’s the summit!`;
    if (target < B.MIN) sub = `Can’t sink below −50 — you rest on the seafloor.`;
    UI.setCardPos(who, t.pos);
    t.setPose(roll > 0 ? 'happy' : (t.pos < 0 ? 'underwater' : 'worried'));

    // dolly-zoom equation reveal, then it docks into the panel
    await guard(CINE.hero.show({
      guard, a: start, b: roll, c: target, sub, kind: roll > 0 ? 'plus' : 'minus',
      caption: `${name} rolled <b class="${roll > 0 ? 'plus' : 'minus'}">${B.fmt(roll)}</b>`,
      hold: who === 'student' ? 1.1 : 0.7,
      speak: narrate ? () => VO.equation(start, roll, target) : null
    }));
    UI.revealResult(target, sub);
    UI.flashPanel();
    if (narrate) {
      if (target > B.MAX) await guard(VO.say('summit_past'));
      if (target < B.MIN) await guard(VO.say('seafloor'));
    }
    await guard(UI.wait(0.3));

    if (t.pos === B.MAX) return 'win';

    const s = B.snakeAt(t.pos), l = B.ladderAt(t.pos);
    if (s || l) {
      const from = t.pos, delta = (s || l).to - from;
      const caption = s ? `Oh no, a snake! It adds <b class="minus">${B.fmt(delta)}</b>` : `A ladder! It adds <b class="plus">${B.fmt(delta)}</b>`;
      await guard(UI.showEquation(who, from, delta, from + delta, { hideResult: true, panel: s ? 'bad' : 'good', caption }));
      if (narrate) VO.say(s ? 'snake' : 'ladder');
      await guard(CINE.cam.focus(t.el, ZOOM.ride, 0.6));
      if (s) await rideSnake(t, s, guard); else await climbLadder(t, l, guard);
      UI.setCardPos(who, t.pos);
      UI.nlShow(G.positions(), who);
      await guard(CINE.hero.show({
        guard, a: from, b: delta, c: from + delta, kind: s ? 'snake' : 'ladder', caption,
        sub: s ? 'Slid down the snake.' : 'Climbed the ladder!',
        hold: 0.9,
        speak: narrate ? () => VO.equation(from, delta, from + delta) : null
      }));
      UI.revealResult(t.pos, s ? 'Slid down the snake.' : 'Climbed the ladder!');
      UI.flashPanel();
      await guard(UI.wait(0.4));
    }
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
    UI.eqMessage(who === 'student' ? 'You planted the flag!' : 'The computer planted the flag!', 'First to <b class="plus">+50</b> wins.', 'gold');
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
      $('btn-roll').addEventListener('click', () => { if (G.rollResolver && !$('btn-roll').disabled) { const r = G.rollResolver; G.rollResolver = null; r(); } });
      window.addEventListener('keydown', e => {
        if (e.code !== 'Space' && e.code !== 'Enter') return;
        if (!G.rollResolver || $('btn-roll').disabled || document.body.dataset.screen !== 'game' || document.body.hasAttribute('data-paused')) return;
        const f = document.activeElement;
        if (e.code === 'Enter' && f && f.tagName === 'BUTTON' && f.id !== 'btn-roll') return;   // Enter activates the focused button
        if (f && f !== document.body) f.blur();
        e.preventDefault(); $('btn-roll').click();
      });
    },
    reset() {
      G.sid++; G.over = false; G.rollResolver = null;
      ISL.voice.stop();
      CINE.cam.reset(); CINE.hero.hide();
      ['student', 'computer'].forEach(w => { const t = G.tokens[w]; gsap.killTweensOf([t.el, t.inner]); t.el.classList.remove('is-turn', 'awaiting'); t.pos = 0; t.rest(); UI.setCardPos(w, 0); });
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
      UI.nlShow(G.positions(), 'student');
    },
    start() {
      this.reset();
      playTurn('student').catch(e => { if (e !== ABORT) console.error(e); });
    },
    /** QA helpers: queue dice results, e.g. ISL.game.force([1,6],[-1,3]) */
    force(...rolls) { G.forced.push(...rolls); },
    teleport(who, n) { G.tokens[who].pos = n; arrange(0); G.tokens[who].rest(); UI.setCardPos(who, n); UI.nlShow(G.positions(), G.turn); }
  };
})(window.ISL);
