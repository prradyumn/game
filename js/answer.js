/* "Pick the square": after rolling, the student decides where the explorer lands.
   They tap any square (or drag a ghost of the explorer onto one) and press Go!.
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
  const S = { active: false, sel: null, start: 0, dragging: false, resolve: null, token: null };
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
    if (S.sel !== n) AU.play('click');
    S.sel = n;
    highlight(n);
    const g = ghost(), a = spot(n);
    if (snap) gsap.to(g, { x: a.x, y: a.y, opacity: 0.85, duration: 0.18, ease: 'power2.out', overwrite: 'auto' });
    g.classList.add('on');
    ISL.ui.enable($('btn-roll'), true);
    ISL.ui.rollReady(true, onNudge, 'go');
    setPrompt(`Land on ${P(n)}? Press <b>Go!</b>`, 'ask');
  }
  function clearPick() {
    S.sel = null; highlight(null);
    const g = $('pick-ghost'); if (g) { g.classList.remove('on'); gsap.to(g, { opacity: 0, duration: 0.2 }); }
    ISL.ui.enable($('btn-roll'), false);
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
    const a = B.anchor(S.start, 0);
    const onExplorer = Math.abs(u - a.x) < 55 && v > a.y - 110 && v < a.y + 20;
    if (onExplorer) {
      S.dragging = true;
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

  /** Wait for one confirmed pick (Go!, Enter or Space). */
  function waitPick() {
    return new Promise(res => { S.resolve = res; });
  }
  function confirm() {
    if (!S.active || S.sel === null || !S.resolve) return false;
    const r = S.resolve; S.resolve = null; r(S.sel); return true;
  }
  function nudgeKeys(delta) {
    if (!S.active) return;
    const base = S.sel === null ? S.start : S.sel;
    select(Math.max(B.MIN, Math.min(B.MAX, base + delta)));
  }

  /* ---------- the flow for one move ---------- */
  async function ask({ token, start, roll, dest, guard, narrate }) {
    const VO = ISL.voice;
    S.token = token; S.start = start; S.active = true; S.sel = null;
    document.body.setAttribute('data-picking', '');
    ISL.game.G.pickDest = dest;                       // QA helpers read this
    clearPick();
    ISL.ui.rollReady(true, onNudge, 'go');
    ISL.ui.enable($('btn-roll'), false);
    setPrompt(`You rolled ${P(roll)}. Where will you land? <small>Tap a square, or drag your explorer</small>`, 'ask');
    nudgeVoice = 'pick_square';
    if (narrate) VO.say('pick_square');
    let tries = 0;
    try {
      for (;;) {
        const n = await guard(waitPick());
        VO.stop();
        if (n === dest) {
          ISL.ui.rollReady(false); ISL.ui.enable($('btn-roll'), false);
          setPrompt(`${['Brilliant!', 'Well done!', 'You got it!'][tries]} ${P(start)} ${roll > 0 ? '+' : '−'} ${Math.abs(roll)} lands on ${P(dest)}`, 'good');
          AU.play('correct');
          const g = $('pick-ghost'); if (g) gsap.to(g, { opacity: 0, scale: 1.3, duration: 0.3 });
          highlight(null); clearPath();
          if (narrate) VO.say([['correct_1', 'correct_2', 'correct_3'][tries], window.VOICE_NUM.numId(dest)]);
          await guard(ISL.ui.wait(0.6));
          return { tries: tries + 1, together: false };
        }
        tries++;
        const d = diagnose(start, roll, dest, n);
        AU.play('wrong');
        token.setPose('worried');
        // the ghost wobbles and bounces back to the explorer
        const g = ghost(), a = spot(start);
        gsap.timeline()
          .to(g, { keyframes: { x: ['+=10', '-=20', '+=16', '-=10', '+=4'] }, duration: 0.35, ease: 'none' })
          .to(g, { x: a.x, y: a.y, opacity: 0, duration: 0.45, ease: 'power2.in' });
        highlight(null); S.sel = null;
        ISL.ui.enable($('btn-roll'), false);
        if (tries >= 3) {
          setPrompt(`Let's count together! Tap to hop.`, 'hint');
          if (narrate) VO.say('count_together');
          await guard(ISL.ui.wait(0.9));
          return { tries: 3, together: true };
        }
        setPrompt(`${d.html}${tries === 2 ? ' <small>Follow the glowing path.</small>' : ''} <small>Try ${tries + 1} of 3</small>`, 'hint');
        nudgeVoice = d.id;
        if (narrate) VO.say(tries === 2 ? [d.id, 'hint_path'] : d.id);
        if (tries === 2) showPath(start, dest);
        await guard(ISL.ui.wait(0.5));
        token.rest();
        ISL.ui.rollReady(true, onNudge, 'go');
        ISL.ui.enable($('btn-roll'), false);
      }
    } finally {
      S.active = false; S.resolve = null; S.dragging = false;
      document.body.removeAttribute('data-picking');
      clearPick(); clearPath(); hidePrompt();
      const g = $('pick-ghost'); if (g) g.remove();
    }
  }

  function reset() {
    S.active = false; S.resolve = null; S.dragging = false; S.sel = null;
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
    pick(n) { if (!S.active) return false; select(n); return confirm(); } };
})(window.ISL);
