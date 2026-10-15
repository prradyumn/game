/* Boot + screen flow (start, how-to, pause, win). */
(function (ISL) {
  'use strict';
  const A = ISL.assets, UI = ISL.ui, FX = ISL.fx, AU = ISL.audio;
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  /* Modals use CSS transitions so they still animate while GSAP's global timeline is paused. */
  function show(id, on) { $(id).classList.toggle('open', on); }
  function setScreen(name) { document.body.dataset.screen = name; }

  /* ---------- screen transitions ----------
     Every screen change runs under the wave wipe: the swap (resets, modals, which screen is
     shown) happens while the wave fully covers the stage, so nothing pops, flashes or visibly
     resets. `busy` swallows extra clicks and blocks pausing until the wave has passed. */
  let busy = false;
  function transition(swap, duration = 1.25) {
    if (busy) return;
    busy = true;
    AU.unlock();
    ISL.voice.stop();
    paused = false; document.body.removeAttribute('data-paused');
    gsap.globalTimeline.resume();                  // the wave itself runs on GSAP
    ISL.intro.wipe(() => {
      // screens swap instantly under the wave (no half-faded modal peeking out as it lifts)
      document.body.classList.add('no-fade');
      try { swap(); } catch (e) { console.error(e); }
      requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('no-fade')));
    }, duration).then(() => { busy = false; });
  }

  /* ---------- start screen ---------- */
  /** delay: hold the entrance until a covering wave starts to pass */
  function openStart(delay = 0) {
    setScreen('start');
    gsap.killTweensOf(['#start-logo', '#start-student', '#start-computer', '#start-tagline', '#btn-play', '#btn-howto']);
    $('screen-start').classList.add('open');
    const tl = gsap.timeline({ delay });
    tl.fromTo('#start-logo', { y: -60, opacity: 0, scale: 0.8 }, { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(1.8)' })
      .fromTo('#start-student', { x: -120, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, 0.3)
      .fromTo('#start-computer', { x: 120, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, 0.4)
      .fromTo('#start-tagline', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4 }, 0.6)
      .fromTo(['#btn-play', '#btn-howto'], { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'back.out(2.2)' }, 0.7);
    gsap.to('#start-student', { y: -10, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: delay + 1 });
    gsap.to('#start-computer', { y: -10, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: delay + 1.2 });
  }
  /** Swap to the game screen (called under the wave). */
  function enterGame(tutorial) {
    AU.startMusic();
    hideWin();
    show('screen-start', false); show('screen-howto', false); show('screen-pause', false);
    setScreen('game');
    introBoard();
    if (ISL.tutorial.active && !tutorial) ISL.tutorial.finish(false);
    if (tutorial) ISL.tutorial.run(); else ISL.game.start();
  }
  const startGame = () => transition(() => enterGame(!ISL.tutorial.seen()));
  const startTutorial = () => transition(() => enterGame(true));
  function introBoard() {
    gsap.fromTo('#board-wrap', { scale: 0.92, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.4)' });
    gsap.fromTo('.snake-head', { scale: 0 }, { scale: 1, duration: 0.45, stagger: 0.06, ease: 'back.out(2.5)', delay: 0.3 });
    gsap.fromTo('.value-tag', { scale: 0 }, { scale: 1, duration: 0.35, stagger: 0.03, ease: 'back.out(2.5)', delay: 0.5 });
    gsap.fromTo(['#logo-small', '#topbar', '#turn-banner', '#card-student', '#card-computer', '#numberline', '#equation', '#tray', '#btn-roll'], { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.04, delay: 0.2 });
  }

  /* ---------- how to play ---------- */
  let slide = 0;
  function setSlide(i) {
    slide = Math.max(0, Math.min(2, i));
    const slides = document.querySelectorAll('.howto-slide');
    slides.forEach((s, k) => s.classList.toggle('on', k === slide));
    document.querySelectorAll('#howto-dots i').forEach((d, k) => d.classList.toggle('on', k === slide));
    $('howto-next').querySelector('.btn-label').textContent = slide === 2 ? "Let's go!" : 'Next';
    $('howto-prev').style.visibility = slide === 0 ? 'hidden' : 'visible';
  }
  // How to play opens from the pause menu: it swaps with the menu and closing it returns there.
  function openHowto() {
    if (busy) return;
    setSlide(0);
    show('screen-pause', false); show('screen-howto', true);
    if (!paused) pauseGame(true, false);
  }
  function closeHowto() { show('screen-howto', false); if (paused) show('screen-pause', true); }
  const howtoOpen = () => $('screen-howto').classList.contains('open');

  /* ---------- pause ---------- */
  let paused = false;
  function pauseGame(on, showMenu = true) {
    if (document.body.dataset.screen !== 'game' || busy) return;
    paused = on;
    on ? gsap.globalTimeline.pause() : gsap.globalTimeline.resume();
    on ? ISL.voice.pause() : ISL.voice.resume();
    document.body.toggleAttribute('data-paused', on);
    if (showMenu) show('screen-pause', on);
  }

  /* ---------- win ---------- */
  function showWin(who) {
    setScreen('win');
    $('win-art').src = A.url(who === 'student' ? 'ui/screens/student-win' : 'ui/screens/computer-win');
    $('win-title').textContent = who === 'student' ? 'You reached +50!' : 'Computer reached +50!';
    $('win-sub').textContent = who === 'student' ? 'You planted the flag on the summit. Integer champion!' : 'So close! Roll again and beat the computer.';
    AU.play(who === 'student' ? 'win' : 'lose');
    $('screen-win').classList.add('open');
    gsap.fromTo('#win-art', { scale: 0.5, opacity: 0, y: 40 }, { scale: 1, opacity: 1, y: 0, duration: 0.7, ease: 'back.out(1.7)' });
    gsap.fromTo(['#win-title', '#win-sub', '#btn-again', '#btn-win-home'], { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: 0.1, delay: 0.4, duration: 0.4 });
    gsap.fromTo('#win-rays', { rotation: 0 }, { rotation: 360, duration: 30, ease: 'none', repeat: -1 });
    if (who === 'student') FX.confetti($('confetti'));
  }
  function hideWin() { $('screen-win').classList.remove('open'); $('confetti').innerHTML = ''; gsap.killTweensOf('#win-rays'); }

  /** Back to the start screen (called under the wave). */
  function enterHome() {
    if (ISL.tutorial.active) ISL.tutorial.finish(false, false);   // left early: offer it again next time
    hideWin(); show('screen-pause', false); show('screen-howto', false);
    ISL.game.reset();
    openStart(0.3);
  }
  const goHome = () => transition(enterHome);

  /* ---------- debug overlay (?debug) ---------- */
  function debugOverlay() {
    const o = $('debug-overlay'); o.hidden = false;
    const r = ISL.layout.rect('board-wrap');
    const k = r.h / 1000;
    let html = '';
    for (let n = -50; n <= 50; n++) {
      const a = ISL.board.anchor(n);
      html += `<i class="dbg-dot" style="left:${r.x + a.x * k}px;top:${r.y + a.y * k}px"></i>`;
    }
    Object.values(ISL.layout.rects).forEach(rc => { html += `<b class="dbg-rect" style="left:${rc.x}px;top:${rc.y}px;width:${rc.w}px;height:${rc.h}px"></b>`; });
    o.innerHTML = html;
  }

  /* ---------- boot ---------- */
  async function boot() {
    ISL.layout.init();
    AU.init();
    await A.preloadAll(p => { $('loader-bar').firstElementChild.style.width = Math.round(p * 100) + '%'; });
    if (document.fonts && document.fonts.ready) { try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) {} }
    ISL.board.build();
    // switching orientation changes the board's aspect: rebuild it and put the tokens back
    ISL.layout.onChange.push(() => { ISL.board.build(); ISL.game.arrange && ISL.game.arrange(0); UI.sizeDice(); if (params.has('debug')) debugOverlay(); });
    ISL.voice.init();
    UI.buildDice();
    ISL.game.init();
    ISL.tutorial.init();
    UI.initButtons();
    ISL.game.reset();
    FX.ambient();
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => FX.ambient(), 300); });

    // flag cloth flutter
    gsap.to('.flag-cloth', { skewY: 6, scaleX: 0.92, duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '0% 50%' });
    gsap.to('.crab', { x: 6, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    gsap.to('.weed', { skewX: 8, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 100%' });

    // wire buttons
    $('btn-play').addEventListener('click', startGame);
    $('btn-howto').addEventListener('click', startTutorial);
    $('btn-help').addEventListener('click', openHowto);
    $('howto-close').addEventListener('click', () => document.body.dataset.screen === 'game' ? closeHowto() : show('screen-howto', false));
    $('howto-next').addEventListener('click', () => { if (slide === 2) closeHowto(); else setSlide(slide + 1); });
    $('howto-live').addEventListener('click', startTutorial);
    $('howto-prev').addEventListener('click', () => setSlide(slide - 1));
    $('btn-pause').addEventListener('click', () => pauseGame(true));
    $('btn-resume').addEventListener('click', () => pauseGame(false));
    $('btn-restart').addEventListener('click', () => transition(() => enterGame(false)));
    $('btn-home').addEventListener('click', goHome);
    $('btn-again').addEventListener('click', () => transition(() => enterGame(false)));
    $('btn-win-home').addEventListener('click', goHome);
    $('btn-sound').addEventListener('click', () => {
      const on = AU.toggle();
      ISL.voice.setEnabled(on);
      $('btn-sound').querySelector('img:not(.btn-bg)').src = A.url(on ? 'ui/icons/sound-on' : 'ui/icons/sound-off');
    });
    window.addEventListener('keydown', e => {
      if (e.code !== 'Escape' || document.body.dataset.screen !== 'game' || busy) return;
      if (howtoOpen()) closeHowto();           // Esc closes the help sheet instead of un-pausing underneath it
      else pauseGame(!paused);
    });

    gsap.to('#loader', { opacity: 0, duration: 0.4, onComplete: () => $('loader').remove() });
    if (params.has('fast')) gsap.globalTimeline.timeScale(+params.get('fast') || 4);
    if (params.has('debug')) debugOverlay();
    if (params.has('tutorial')) startTutorial();
    else if (params.has('play')) { setScreen('game'); $('screen-start').classList.remove('open'); ISL.game.start(); }
    else if (params.has('nointro')) openStart();
    else { setScreen('intro'); $('screen-intro').classList.add('open'); gsap.delayedCall(0.45, () => ISL.intro.play(() => openStart(0.35))); }
  }

  ISL.main = { showWin, startGame, startTutorial, goHome, debugOverlay, transition, enterGame, get busy() { return busy; } };
  window.addEventListener('DOMContentLoaded', boot);
})(window.ISL);
