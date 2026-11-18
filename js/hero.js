/* Big animated title card for the tap-to-start screen: ladders cross behind bold, bouncy lettering,
   three pawns peek over the top, snakes slither in from the sides and the two explorers pop up below.
   Built from SVG + CSS and animated with GSAP. Everything sizes from the box's width (container units). */
(function (ISL) {
  'use strict';
  const A = ISL.assets;

  const ladder = (id, wood, dark, hi) => `
    <svg class="hr-ladder" id="${id}" viewBox="0 0 90 460" aria-hidden="true">
      <g stroke="${dark}" stroke-width="5" stroke-linejoin="round">
        <rect x="6" y="2" width="16" height="456" rx="7" fill="${wood}"/><rect x="68" y="2" width="16" height="456" rx="7" fill="${wood}"/>
        ${[40, 100, 160, 220, 280, 340, 400].map(y => `<rect x="14" y="${y}" width="62" height="16" rx="6" fill="${wood}"/>`).join('')}
      </g>
      <g fill="${hi}" opacity=".55"><rect x="10" y="10" width="4" height="440" rx="2"/><rect x="72" y="10" width="4" height="440" rx="2"/>${[40, 100, 160, 220, 280, 340, 400].map(y => `<rect x="18" y="${y + 3}" width="54" height="4" rx="2"/>`).join('')}</g>
    </svg>`;

  const pawn = (cls, c1, c2) => `
    <svg class="hr-pawn ${cls}" viewBox="0 0 80 150" aria-hidden="true">
      <defs><radialGradient id="pg-${cls}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".25" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
      <linearGradient id="pb-${cls}" x1="0" x2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
      <path d="M40 52 C58 80 66 110 74 140 Q40 152 6 140 C14 110 22 80 40 52Z" fill="url(#pb-${cls})" stroke="#2a1456" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="40" cy="34" r="27" fill="url(#pg-${cls})" stroke="#2a1456" stroke-width="5"/>
    </svg>`;

  const letters = (word, cls) => [...word].map((ch, i) => `<span class="hr-l ${cls}" style="--i:${i}">${ch}</span>`).join('');

  function html() {
    return `
      <div class="hr-stage">
        ${ladder('hr-lad-l', '#f4c63a', '#7a4a08', '#fff6c2')}
        ${ladder('hr-lad-r', '#a05cf0', '#3c1580', '#e8d2ff')}
        ${pawn('p1', '#ffc933', '#e08a00')}${pawn('p2', '#5ee06a', '#1f9a3a')}${pawn('p3', '#4aa8ff', '#1e5fd0')}
        <img class="hr-snake hr-sn-l" src="${A.url('snakes/python/full-snake')}" alt="">
        <img class="hr-snake hr-sn-r" src="${A.url('snakes/sea-krait/full-snake')}" alt="">
        <div class="hr-word hr-w1">${letters('SNAKE', 'a')}</div>
        <div class="hr-word hr-w2">${letters('AND', 'w')}</div>
        <div class="hr-word hr-w3">${letters('LADDER', 'b')}</div>
        <img class="hr-hero hr-h-l" src="${A.url('tokens/student-poses/wave')}" alt="">
        <img class="hr-hero hr-h-r" src="${A.url('tokens/computer-poses/idle')}" alt="">
        <div class="hr-ribbon"><span>INTEGER VERSION</span></div>
        <div class="hr-clip"><div class="hr-shine"></div></div>
      </div>`;
  }

  let tl = null, idle = null;
  const Hero = {
    build(el) { el.innerHTML = html(); },
    stop() { if (tl) tl.kill(); if (idle) idle.kill(); tl = idle = null; },
    play(el) {
      this.stop();
      const q = s => el.querySelectorAll(s);
      gsap.set(q('.hr-l'), { y: -520, rotation: () => gsap.utils.random(-25, 25), opacity: 0 });
      gsap.set('#hr-lad-l', { x: -400, rotation: 70, opacity: 0 }); gsap.set('#hr-lad-r', { x: 400, rotation: -70, opacity: 0 });
      gsap.set(q('.hr-pawn'), { y: 260, opacity: 0 });
      gsap.set(q('.hr-snake'), { x: (i) => i ? 420 : -420, opacity: 0 });
      gsap.set(q('.hr-hero'), { y: 280, opacity: 0 });
      gsap.set(q('.hr-ribbon'), { scaleX: 0, opacity: 0 });
      gsap.set(q('.hr-shine'), { xPercent: -140 });
      tl = gsap.timeline();
      tl.to('#hr-lad-l', { x: 0, rotation: 22, opacity: 1, duration: 0.9, ease: 'back.out(1.5)' }, 0)
        .to('#hr-lad-r', { x: 0, rotation: -22, opacity: 1, duration: 0.9, ease: 'back.out(1.5)' }, 0.08)
        .to(q('.hr-pawn'), { y: 0, opacity: 1, duration: 0.6, stagger: 0.12, ease: 'back.out(2.4)' }, 0.35)
        .to(q('.hr-snake'), { x: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: 'power3.out' }, 0.45)
        .to(q('.hr-l.a'), { y: 0, rotation: (i) => [-6, 4, -3, 5, -4][i], opacity: 1, duration: 0.75, stagger: 0.09, ease: 'bounce.out' }, 0.5)
        .to(q('.hr-l.w'), { y: 0, rotation: (i) => [-8, 2, 7][i], opacity: 1, duration: 0.6, stagger: 0.08, ease: 'back.out(2.2)' }, 0.95)
        .to(q('.hr-l.b'), { y: 0, rotation: (i) => [4, -5, 3, -4, 5, -3][i], opacity: 1, duration: 0.75, stagger: 0.09, ease: 'bounce.out' }, 1.05)
        .to(q('.hr-hero'), { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: 'back.out(2)' }, 1.4)
        .to(q('.hr-ribbon'), { scaleX: 1, opacity: 1, duration: 0.55, ease: 'back.out(1.8)' }, 1.55)
        .fromTo(el, { scale: 1.06 }, { scale: 1, duration: 0.5, ease: 'power2.out' }, 1.6)
        .add(() => {
          idle = gsap.timeline({ repeat: -1 });
          q('.hr-l').forEach((l, i) => gsap.to(l, { y: -9, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: i * 0.08 }));
          gsap.to(q('.hr-pawn'), { y: -10, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.25 });
          gsap.to(q('.hr-snake'), { rotation: (i) => i ? -4 : 4, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 90%' });
          gsap.to(q('.hr-hero'), { y: -8, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.3 });
          gsap.to('#hr-lad-l', { rotation: 19, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
          gsap.to('#hr-lad-r', { rotation: -19, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
          gsap.fromTo(q('.hr-shine'), { xPercent: -140 }, { xPercent: 140, duration: 1.1, repeat: -1, repeatDelay: 2.6, ease: 'power1.inOut' });
        }, 2.2);
    }
  };
  ISL.hero = Hero;
})(window.ISL);
