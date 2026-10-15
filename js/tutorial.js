/* Live "How to play" tutorial: a coach walks the student through real turns on the
   real board with scripted dice, so every rule is shown with a live example. */
(function (ISL) {
  'use strict';
  const A = ISL.assets, B = ISL.board, UI = ISL.ui, VO = ISL.voice;
  const $ = id => document.getElementById(id);
  const KEY = 'isl_tutorial_done';

  // Scripted rolls → 0 +4 = 4, 4 −6 = −2 (crosses zero), −2 −1 = −3 (ladder → 19), 19 −6 = 13 (snake → −7)
  const ROLLS = [[1, 4], [-1, 6], [-1, 1], [-1, 6]];
  const P = n => `<b class="${n > 0 ? 'plus' : n < 0 ? 'minus' : ''}">${B.fmt(n)}</b>`;
  const STEPS = [
    { id: 't_welcome', pose: 'wave', spot: 'board', next: 'Next',
      html: `This board is a <b>number line</b>! Land squares are ${P(1)} <b>positive</b>, sea squares are ${P(-1)} <b>negative</b>. <b>0</b> is the jetty on the shoreline.` },
    { id: 't_dice', pose: 'thinking', spot: 'dice', roll: true,
      html: `Roll two dice: the <b>sign die</b> says <b class="plus">+</b> or <b class="minus">−</b>, the <b>number die</b> says how many. Then <b>tap to hop</b>, one tap for every square. Try it!` },
    { id: 't_up', pose: 'happy', spot: 'shore', next: 'Next',
      html: `You rolled ${P(4)} and hopped <b>4 squares up</b>. Positive numbers move you <b>up</b>, toward the summit.` },
    { id: 't_neg', pose: 'thinking', spot: 'dice', roll: true,
      html: `Now let's roll a <b class="minus">negative</b> number. Roll, then tap to hop!` },
    { id: 't_down', pose: 'underwater', spot: 'shore', next: 'Next',
      html: `${P(-6)} took you <b>6 squares down</b>. You crossed <b>0</b> and dived into the sea! Negative numbers move you <b>down</b>.` },
    { id: 't_ladder', pose: 'idle', spot: 'ladder', roll: true,
      html: `See this ladder? Land on its bottom and it <b>adds a positive</b> number. Roll!` },
    { id: 't_ladder_done', pose: 'cheer', spot: 'ladder', next: 'Next',
      html: `The ladder added ${P(22)} and lifted you all the way to ${P(19)}. What a climb!` },
    { id: 't_snake', pose: 'worried', spot: 'snake', roll: true,
      html: `Watch out! A snake's head <b>adds a negative</b> number and slides you down. Roll!` },
    { id: 't_snake_done', pose: 'worried', spot: 'snake', next: 'Next',
      html: `The snake added ${P(-20)} and slid you down to ${P(-7)}. Snakes pull you down!` },
    { id: 't_finish', pose: 'cheer', spot: 'summit', next: "Let's play!",
      html: `First explorer to reach ${P(50)} plants the flag and wins. You're ready!` }
  ];

  /* ---------- spotlight targets in stage pixels ---------- */
  function boardRect(x0, y0, x1, y1, pad = 12) {
    const r = ISL.layout.rect('board-wrap'), k = r.h / 1000;
    return { x: r.x + x0 * k - pad, y: r.y + y0 * k - pad, w: (x1 - x0) * k + pad * 2, h: (y1 - y0) * k + pad * 2 };
  }
  function union(...ids) {
    const rs = ids.map(id => ISL.layout.rect(id));
    const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y));
    const x2 = Math.max(...rs.map(r => r.x + r.w)), y2 = Math.max(...rs.map(r => r.y + r.h));
    return { x: x - 10, y: y - 10, w: x2 - x + 20, h: y2 - y + 20 };
  }
  function cellsRect(a, b) {
    const ca = B.center(a), cb = B.center(b);
    return boardRect(Math.min(ca.x, cb.x) - 60, Math.min(ca.y, cb.y) - 60, Math.max(ca.x, cb.x) + 60, Math.max(ca.y, cb.y) + 60, 4);
  }
  const SPOTS = {
    board: () => boardRect(0, 0, B.W, 1000, 20),
    dice: () => union('tray', 'btn-roll'),
    shore: () => boardRect(-110, 300, B.W, 700, 8),
    ladder: () => cellsRect(-3, 19),
    snake: () => cellsRect(13, -7),
    summit: () => cellsRect(50, 50)
  };

  let spotKey = null;
  function spot(key) {
    spotKey = key;
    const el = $('spotlight');
    if (!key) { gsap.to(el, { opacity: 0, duration: 0.25 }); return; }
    const r = SPOTS[key]();
    gsap.to(el, { left: r.x, top: r.y, width: r.w, height: r.h, opacity: 1, duration: 0.45, ease: 'power2.inOut' });
  }
  function coachShow(on) {
    const c = $('coach');
    c.classList.toggle('open', on);
    if (on) gsap.fromTo('#coach-card', { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' });
  }
  function setStep(i, st) {
    $('coach-text').innerHTML = st.html;
    $('coach-step').textContent = `${i + 1} / ${STEPS.length}`;
    const pose = $('coach-pose');
    pose.src = A.url('tokens/student-poses/' + st.pose);
    pose.dataset.pose = st.pose;
    $('coach-next').style.display = st.next ? '' : 'none';
    $('coach-hint').style.display = st.roll ? '' : 'none';
    if (st.next) $('coach-next').querySelector('.btn-label').textContent = st.next;
    $('coach').classList.toggle('rolling', !!st.roll);
    document.body.toggleAttribute('data-tut-roll', !!st.roll);
    gsap.fromTo('#coach-text', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3 });
    gsap.fromTo(pose, { scale: 0.8 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
  }

  let nextResolver = null;
  const Tutorial = {
    active: false,
    seen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } },
    async run() {
      const game = ISL.game, G = game.G;
      game.reset();
      const guard = game.guardFactory(G.sid);
      G.forced = ROLLS.map(r => r.slice());
      this.active = true;
      document.body.dataset.tutorial = '1';
      coachShow(true);
      try {
        for (let i = 0; i < STEPS.length; i++) {
          const st = STEPS[i];
          setStep(i, st);
          spot(st.spot);
          VO.say(st.id);
          if (st.roll) {
            await game.doTurn('student', guard, { narrate: false, prompt: 'Tutorial', onRoll: () => { spot(null); $('coach').classList.add('dim'); } });
            $('coach').classList.remove('dim');
          } else {
            await guard(new Promise(r => { nextResolver = r; }));
            VO.stop();
          }
        }
        ISL.main.transition(() => this.finish(true));   // "Let's play!" — real game starts under the wave
      } catch (e) {
        if (e !== game.ABORT) console.error(e);
      }
    },
    finish(startGame, markSeen = true) {
      this.active = false;
      delete document.body.dataset.tutorial;
      if (markSeen) { try { localStorage.setItem(KEY, '1'); } catch (e) {} }
      ISL.game.G.forced = [];
      VO.stop();
      spot(null);
      coachShow(false);
      $('coach').classList.remove('dim', 'rolling');
      document.body.removeAttribute('data-tut-roll');
      if (startGame) ISL.game.start();
    },
    relayout() { if (this.active && spotKey) spot(spotKey); },
    init() {
      $('coach-next').addEventListener('click', () => { if (nextResolver) { const r = nextResolver; nextResolver = null; r(); } });
      $('coach-skip').addEventListener('click', () => { ISL.audio.play('click'); ISL.main.transition(() => this.finish(true)); });
      gsap.set('#spotlight', { opacity: 0 });
      ISL.layout.onChange.push(() => this.relayout());
    }
  };
  ISL.tutorial = Tutorial;
})(window.ISL);
