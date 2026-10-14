/* Boot + screen flow (start, how-to, pause, win). */
(function (ISL) {
  'use strict';
  const A = ISL.assets, UI = ISL.ui, FX = ISL.fx, AU = ISL.audio;
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  /* Modals use CSS transitions so they still animate while GSAP's global timeline is paused. */
  function show(id, on) { $(id).classList.toggle('open', on); }
  function setScreen(name) { document.body.dataset.screen = name; }

  /* ---------- start screen ---------- */
  function openStart() {
    setScreen('start');
    gsap.killTweensOf(['#start-student', '#start-computer']);
    $('screen-start').classList.add('open');
    const tl = gsap.timeline();
    tl.fromTo('#start-logo', { y: -60, opacity: 0, scale: 0.8 }, { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(1.8)' })
      .fromTo('#start-student', { x: -120, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, 0.3)
      .fromTo('#start-computer', { x: 120, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, 0.4)
      .fromTo('#start-tagline', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4 }, 0.6)
      .fromTo(['#btn-play', '#btn-howto'], { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'back.out(2.2)' }, 0.7);
    gsap.to('#start-student', { y: -10, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1 });
    gsap.to('#start-computer', { y: -10, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1.2 });
  }
  function startGame() {
    AU.unlock(); AU.startMusic();
    $('screen-start').classList.remove('open');
    setScreen('game');
    introBoard();
    if (!ISL.tutorial.seen()) ISL.tutorial.run(); else ISL.game.start();
  }
  function startTutorial() {
    AU.unlock();
    $('screen-start').classList.remove('open');
    show('screen-howto', false);
    setScreen('game');
    introBoard();
    ISL.tutorial.run();
  }
  function introBoard() {
    gsap.fromTo('#board-wrap', { scale: 0.92, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.4)' });
    gsap.fromTo('.snake-head', { scale: 0 }, { scale: 1, duration: 0.45, stagger: 0.06, ease: 'back.out(2.5)', delay: 0.3 });
    gsap.fromTo('.value-tag', { scale: 0 }, { scale: 1, duration: 0.35, stagger: 0.03, ease: 'back.out(2.5)', delay: 0.5 });
    gsap.fromTo(['#turn-banner', '#card-student', '#card-computer', '#numberline', '#equation', '#tray', '#btn-roll'], { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, delay: 0.2 });
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
  function openHowto() { setSlide(0); show('screen-howto', true); pauseGame(true, false); }
  function closeHowto() { show('screen-howto', false); pauseGame(false, false); }

  /* ---------- pause ---------- */
  let paused = false;
  function pauseGame(on, showMenu = true) {
    if (document.body.dataset.screen !== 'game') return;
    paused = on;
    on ? gsap.globalTimeline.pause() : gsap.globalTimeline.resume();
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

  function goHome() {
    if (ISL.tutorial.active) ISL.tutorial.finish(false);
    hideWin(); show('screen-pause', false); paused = false;
    gsap.globalTimeline.resume();
    ISL.game.reset();
    openStart();
  }

  /* ---------- debug overlay (?debug) ---------- */
  function debugOverlay() {
    const o = $('debug-overlay'); o.hidden = false;
    const r = ISL.layout.rect('board-wrap');
    const k = r.w / 1000;
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
    ISL.layout.onChange.push(() => { UI.nlShow(ISL.game.G.positions(), ISL.game.G.turn); if (params.has('debug')) debugOverlay(); });
    ISL.voice.init();
    ISL.game.init();
    ISL.tutorial.init();
    UI.initButtons();
    ISL.game.reset();
    UI.nlShow({ student: 0, computer: 0 }, 'student');
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
    $('howto-live').addEventListener('click', () => { closeHowto(); startTutorial(); });
    $('howto-prev').addEventListener('click', () => setSlide(slide - 1));
    $('btn-pause').addEventListener('click', () => pauseGame(true));
    $('btn-resume').addEventListener('click', () => pauseGame(false));
    $('btn-restart').addEventListener('click', () => { pauseGame(false); if (ISL.tutorial.active) ISL.tutorial.finish(false); ISL.game.start(); });
    $('btn-home').addEventListener('click', goHome);
    $('btn-again').addEventListener('click', () => { hideWin(); setScreen('game'); ISL.game.start(); });
    $('btn-win-home').addEventListener('click', goHome);
    $('btn-sound').addEventListener('click', () => {
      const on = AU.toggle();
      ISL.voice.setEnabled(on);
      $('btn-sound').querySelector('img:not(.btn-bg)').src = A.url(on ? 'ui/icons/sound-on' : 'ui/icons/sound-off');
    });
    window.addEventListener('keydown', e => { if (e.code === 'Escape' && document.body.dataset.screen === 'game') pauseGame(!paused); });

    gsap.to('#loader', { opacity: 0, duration: 0.4, onComplete: () => $('loader').remove() });
    if (params.has('fast')) gsap.globalTimeline.timeScale(+params.get('fast') || 4);
    if (params.has('debug')) debugOverlay();
    if (params.has('tutorial')) startTutorial();
    else if (params.has('play')) { setScreen('game'); $('screen-start').classList.remove('open'); ISL.game.start(); }
    else if (params.has('nointro')) openStart();
    else { setScreen('intro'); $('screen-intro').classList.add('open'); gsap.delayedCall(0.45, () => ISL.intro.play(() => openStart())); }
  }

  ISL.main = { showWin, startGame, startTutorial, goHome, debugOverlay };
  window.addEventListener('DOMContentLoaded', boot);
})(window.ISL);
