/* "Pick the square": after rolling, the student decides where the explorer lands.
   They tap any square (or drag the explorer onto one) — picking IS the answer, no Go button.
   A right pick is marked right at once. A wrong pick stays for 3 s (time to change their mind);
   if it's still there, it counts as a try and a hint plus a higher/lower arrow appear.
   A wrong pick gets feedback aimed at the specific mistake, with support that builds up:
     1st wrong — a hint about that mistake      2nd wrong — the path lights up as well
     3rd wrong — count it together (tap to hop)
   ask() resolves with { tries, together } once the move is settled; stars are 3 / 2 / 1. */
(function (ISL) {
  'use strict';
  const A = ISL.assets, B = ISL.board, AU = ISL.audio;
  const $ = id => document.getElementById(id);
  const fmt = n => B.fmt(n);
  const P = n => `<b class="${n > 0 ? 'plus' : n < 0 ? 'minus' : 'zero'}">${fmt(n)}</b>`;

  /* ---------- what kind of mistake is it? ---------- */
  /** Returns { id, html } — id doubles as the voice line. */
  function diagnose(start, roll, dest, n) {
    const dir = Math.sign(roll), k = Math.abs(roll), moved = n - start, m = Math.abs(moved);
    const crossesZero = (start < 0 && dest >= 0) || (start > 0 && dest <= 0) || (start < 0 && start + roll > 0) || (start > 0 && start + roll < 0);
    if (n === start) return { id: 'hint_stay', html: `You didn't move! You rolled ${P(roll)}, so hop <b>${k}</b> square${k === 1 ? '' : 's'}.` };
    if (Math.sign(moved) !== dir) return dir > 0
      ? { id: 'hint_up', html: `${P(roll)} means <b>up</b>! Move toward the land.` }
      : { id: 'hint_down', html: `${P(roll)} means <b>down</b>! Move toward the sea.` };
    if (start + roll > B.MAX) return { id: 'hint_top', html: `You can't go past ${P(50)}. Stop at the flag!` };
    if (start + roll < B.MIN) return { id: 'hint_bottom', html: `${P(-50)} is the seafloor. Stop there!` };
    if (crossesZero && m === k + 1) return { id: 'hint_zero', html: `Don't forget <b>0</b>! The jetty counts as a step.` };
    if (m === k - 1 && k > 1) return { id: 'hint_next', html: `Start counting from the <b>next</b> square, not your own.` };
    if (Math.abs(m - k) <= 2) return { id: 'hint_close', html: `So close! You moved <b>${m}</b>, you need <b>${k}</b>.` };
    return { id: 'hint_far', html: `Count carefully: one square for each step of ${P(roll)}.` };
  }

  /* ---------- picking UI ---------- */
  const WAIT = 3;   // seconds a wrong pick stays before the hint
  const S = { active: false, sel: null, start: 0, dest: 0, dragging: false, resolve: null, token: null, timer: null };
  function cancelTimer() { if (S.timer) { S.timer.kill(); S.timer = null; } }
  function boardPoint(cx, cy) {
    const r = $('board').getBoundingClientRect(), k = r.height / 1000;
    return { u: (cx - r.left) / k, v: (cy - r.top) / k };
  }
  function spot(n) { return n === 0 ? B.anchor(0, 0) : B.anchor(n, 0); }

  function ghost() {
    let g = $('pick-ghost');
    if (!g) {
      g = document.createElement('div'); g.id = 'pick-ghost';
      const src = S.token.imgs.idle;
      g.innerHTML = `<img src="${src.src}" alt="" style="width:${src.style.width};height:${src.style.height};left:${src.style.left};top:${src.style.top}">`;
      $('board-ui').appendChild(g);
    }
    return g;
  }
  function highlight(n) {
    let h = $('pick-cell');
    if (n === null) { if (h) h.remove(); return; }
    if (!h) { h = document.createElement('i'); h.id = 'pick-cell'; $('board-ui').appendChild(h); }
    const c = n === 0 ? B.anchor(0, 0) : B.center(n), w = n === 0 ? 96 : B.W / 10, hh = n === 0 ? 60 : B.CELL;
    Object.assign(h.style, { width: w + 'px', height: hh + 'px' });
    gsap.set(h, { x: c.x, y: n === 0 ? c.y - 6 : c.y, xPercent: -50, yPercent: -50 });
    h.classList.toggle('zero', n === 0);
  }
  function select(n, snap = true) {
    if (n === null || n === undefined) return;
    if (S.sel !== n) AU.play('land');
    S.sel = n;
    highlight(n);
    cancelTimer(); dirArrow(null);
    const g = ghost(), a = spot(n);
    // the explorer "lands" on the picked square (its old spot stays faintly visible)
    if (snap) gsap.to(g, { x: a.x, y: a.y, opacity: 1, duration: 0.22, ease: 'power2.out', overwrite: 'auto' });
    g.classList.add('on');
    gsap.to(S.token.el, { opacity: 0.35, duration: 0.2 });
    ISL.ui.poke();
    evaluate(n);
  }
  function settle(n) { if (!S.resolve) return; const r = S.resolve; S.resolve = null; S.judged = n; r(n); }
  /** Judge the current pick: right → at once; wrong → only if it is still there after WAIT seconds. */
  function evaluate(n) {
    if (!S.resolve) return;
    cancelTimer();
    if (n === S.dest) { S.timer = gsap.delayedCall(0.25, () => { S.timer = null; settle(n); }); return; }
    setPrompt(`You landed on ${P(n)}… <small>Not sure? Tap another square</small>`, 'ask');
    S.timer = gsap.delayedCall(WAIT, () => { S.timer = null; if (S.sel === n) settle(n); });
  }
  /** Floating arrow over the explorer's ghost: which way the right square is. */
  function dirArrow(dir) {
    const old = $('pick-dir'); if (old) old.remove();
    if (!dir) return;
    const g = ghost(), img = g.querySelector('img');
    const el = document.createElement('b'); el.id = 'pick-dir'; el.className = dir > 0 ? 'up' : 'down';
    el.innerHTML = dir > 0 ? '▲ <span>higher</span>' : '▼ <span>lower</span>';
    el.style.top = (parseFloat(img.style.top) - 30) + 'px';
    g.appendChild(el);
    gsap.fromTo(el, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(3)' });
  }
  function clearPick() {
    S.sel = null; highlight(null); cancelTimer(); dirArrow(null);
    const g = $('pick-ghost'); if (g) { g.classList.remove('on'); gsap.to(g, { opacity: 0, duration: 0.2 }); }
    if (S.token) gsap.to(S.token.el, { opacity: 1, duration: 0.2 });
  }

  /* prompt pill over the board (moves to the bottom edge when the explorer is up top) */
  function setPrompt(html, kind = 'ask') {
    let p = $('pick-prompt');
    if (!p) {
      p = document.createElement('div'); p.id = 'pick-prompt'; p.className = 'abs';
      $('stage').appendChild(p);
      gsap.fromTo(p, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2.2)' });
    }
    const st = $('stage').getBoundingClientRect(), k = ISL.layout.scale;
    const ty = S.token ? (S.token.el.getBoundingClientRect().top - st.top) / k : 1e9;
    const r = ISL.layout.rect(ty < ISL.layout.stage.h * 0.4 ? 'pick-hud-low' : 'pick-hud');
    Object.assign(p.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', minHeight: r.h + 'px' });
    p.className = 'abs ' + kind;
    p.innerHTML = `<span>${html}</span>`;
    if (kind === 'hint') { p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake'); }
  }
  function hidePrompt() { const p = $('pick-prompt'); if (p) { p.id = ''; gsap.to(p, { opacity: 0, scale: 0.9, duration: 0.2, onComplete: () => p.remove() }); } }

  function showPath(start, dest) {
    const box = $('board-ui'), dir = Math.sign(dest - start);
    for (let n = start + dir, i = 0; ; n += dir, i++) {
      const c = n === 0 ? B.anchor(0, 0) : B.center(n);
      const el = document.createElement('i'); el.className = 'path-glow' + (n === 0 ? ' zero' : '');
      Object.assign(el.style, { width: (n === 0 ? 96 : B.W / 10) + 'px', height: (n === 0 ? 60 : B.CELL) + 'px' });
      box.appendChild(el);
      gsap.set(el, { x: c.x, y: n === 0 ? c.y - 6 : c.y, xPercent: -50, yPercent: -50 });
      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25, delay: i * 0.08 });
      if (n === dest) break;
    }
  }
  function clearPath() { document.querySelectorAll('.path-glow').forEach(el => el.remove()); }

  let nudgeVoice = null;
  function onNudge(count) { if (count === 1 && nudgeVoice) ISL.voice.say(nudgeVoice); }

  /* pointer: tap a square, or press on the explorer and drag its ghost */
  function onDown(e) {
    if (!S.active || e.button > 0 || document.body.hasAttribute('data-paused')) return;
    if (e.target.closest('button')) return;
    const { u, v } = boardPoint(e.clientX, e.clientY);
    const near = n => { const a = B.anchor(n, 0); return Math.abs(u - a.x) < 55 && v > a.y - 110 && v < a.y + 20; };
    const onExplorer = near(S.start) || (S.sel !== null && near(S.sel));
    if (onExplorer) {
      S.dragging = true; cancelTimer(); dirArrow(null);
      gsap.to(S.token.el, { opacity: 0.35, duration: 0.2 });
      const g = ghost(); g.classList.add('on', 'drag');
      gsap.set(g, { x: u, y: v + 40, opacity: 0.9 });
      $('board-wrap').setPointerCapture && $('board-wrap').setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    const n = B.numberAt(u, v);
    if (n !== null) { FX.tapRipple(e.clientX, e.clientY); select(n); }
  }
  function onMove(e) {
    if (!S.dragging) return;
    const { u, v } = boardPoint(e.clientX, e.clientY);
    gsap.set(ghost(), { x: u, y: v + 40 });
    const n = B.numberAt(u, v);
    if (n !== null && n !== S.sel) { S.sel = n; highlight(n); }
  }
  function onUp(e) {
    if (!S.dragging) return;
    S.dragging = false; ghost().classList.remove('drag');
    const { u, v } = boardPoint(e.clientX, e.clientY);
    const n = B.numberAt(u, v);
    if (n !== null) { S.sel = null; select(n); }
    else if (S.sel === null) { clearPick(); }
    else select(S.sel);
  }
  const FX = ISL.fx;

  /** Wait for a pick to settle: right at once, wrong after WAIT seconds unchanged. */
  function waitPick() {
    return new Promise(res => {
      S.resolve = res;
      if (S.sel !== null && S.sel !== S.judged) evaluate(S.sel);   // picked again during the hint
    });
  }
  function confirm() { return false; }   // no Go button any more; kept so callers stay simple
  function nudgeKeys(delta) {
    if (!S.active) return;
    const base = S.sel === null ? S.start : S.sel;
    select(Math.max(B.MIN, Math.min(B.MAX, base + delta)));
  }

  /* ---------- the flow for one move ---------- */
  async function ask({ token, start, roll, dest, guard, narrate }) {
    const VO = ISL.voice;
    S.token = token; S.start = start; S.dest = dest; S.active = true; S.sel = null; S.judged = null;
    document.body.setAttribute('data-picking', '');
    ISL.game.G.pickDest = dest;                       // QA helpers read this
    clearPick();
    ISL.ui.rollReady(true, onNudge, 'pick');
    ISL.ui.enable($('btn-roll'), false);
    setPrompt(`You rolled ${P(roll)}. Where will you land? <small>Tap that square, or drag your explorer there</small>`, 'ask');
    nudgeVoice = 'pick_square';
    if (narrate) VO.say('pick_square');
    let tries = 0;
    try {
      for (;;) {
        const n = await guard(waitPick());
        VO.stop();
        if (n === dest) {
          ISL.ui.rollReady(false); ISL.ui.enable($('btn-roll'), false);
          setPrompt(`✔ ${['Brilliant!', 'Well done!', 'You got it!'][tries]} ${P(start)} ${roll > 0 ? '+' : '−'} ${Math.abs(roll)} lands on ${P(dest)}`, 'good');
          AU.play('correct');
          const h = $('pick-cell'); if (h) h.classList.add('right');
          const c = dest === 0 ? B.anchor(0, 0) : B.center(dest);
          ISL.fx.sparkles(c.x, c.y - 30, 10, undefined, 70);
          await guard(ISL.ui.wait(0.5));
          const g = $('pick-ghost'); if (g) gsap.to(g, { opacity: 0, duration: 0.25 });
          gsap.to(token.el, { opacity: 1, duration: 0.25 });
          highlight(null); clearPath();
          if (narrate) VO.say([['correct_1', 'correct_2', 'correct_3'][tries], window.VOICE_NUM.numId(dest)]);
          await guard(ISL.ui.wait(0.6));
          return { tries: tries + 1, together: false };
        }
        tries++;
        const d = diagnose(start, roll, dest, n);
        const way = Math.sign(dest - n);          // which way the right square is from the pick
        AU.play('wrong');
        token.setPose('worried');
        // the explorer stays on the wrong square, wobbles, and an arrow points the right way
        const g = ghost();
        gsap.to(g, { keyframes: { x: ['+=10', '-=20', '+=16', '-=10', '+=4'] }, duration: 0.35, ease: 'none' });
        const h = $('pick-cell'); if (h) h.classList.add('wrong');
        if (tries >= 3) {
          setPrompt(`Let's count together! Tap to hop.`, 'hint');
          if (narrate) VO.say('count_together');
          await guard(ISL.ui.wait(0.9));
          return { tries: 3, together: true };
        }
        dirArrow(way);
        const dirText = way > 0 ? 'Try a <b>higher</b> number ▲' : 'Try a <b>lower</b> number ▼';
        const generic = ['hint_close', 'hint_far', 'hint_zero', 'hint_next'].includes(d.id);
        setPrompt(`${d.html}${generic ? ' ' + dirText : ''}${tries === 2 ? ' <small>Follow the glowing path.</small>' : ''} <small>Try ${tries + 1} of 3</small>`, 'hint');
        nudgeVoice = d.id;
        if (narrate) VO.say([d.id, ...(generic ? [way > 0 ? 'go_higher' : 'go_lower'] : []), ...(tries === 2 ? ['hint_path'] : [])]);
        if (tries === 2) showPath(start, dest);
        await guard(ISL.ui.wait(0.5));
        token.rest();
        ISL.ui.rollReady(true, onNudge, 'pick');
        ISL.ui.enable($('btn-roll'), false);
      }
    } finally {
      S.active = false; S.resolve = null; S.dragging = false;
      document.body.removeAttribute('data-picking');
      clearPick(); clearPath(); hidePrompt();
      gsap.to(token.el, { opacity: 1, duration: 0.2 });
      const g = $('pick-ghost'); if (g) g.remove();
    }
  }

  function reset() {
    S.active = false; S.resolve = null; S.dragging = false; S.sel = null; cancelTimer();
    document.body.removeAttribute('data-picking');
    highlight(null); clearPath(); hidePrompt();
    const g = $('pick-ghost'); if (g) g.remove();
  }

  function init() {
    const bw = $('board-wrap');
    bw.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  ISL.answer = { ask, confirm, reset, init, diagnose, nudgeKeys, get active() { return S.active; }, get selected() { return S.sel; },
    /** QA helper: pick square n and confirm it. */
    pick(n) { if (!S.active) return false; select(n); return true; } };
})(window.ISL);
