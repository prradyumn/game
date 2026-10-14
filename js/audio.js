/* Audio manager.
   Real audio files can be dropped into /audio later (see FILES map). Until a file
   exists, a tiny WebAudio synth plays a placeholder so every event already has a hook. */
(function (ISL) {
  'use strict';
  const FILES = {
    click: 'audio/click.mp3',
    dice: 'audio/dice-roll.mp3',
    diceLand: 'audio/dice-land.mp3',
    hop: 'audio/hop.mp3',
    land: 'audio/land.mp3',
    whoosh: 'audio/whoosh.mp3',
    reveal: 'audio/reveal.mp3',
    splash: 'audio/splash.mp3',
    ladder: 'audio/ladder.mp3',
    snake: 'audio/snake.mp3',
    win: 'audio/win.mp3',
    lose: 'audio/lose.mp3',
    turn: 'audio/turn.mp3',
    music: 'audio/music-loop.mp3'
  };
  // List the names whose files have been added to /audio (e.g. ['dice','hop']). Others use the synth.
  const AVAILABLE = [];
  let ctx = null, enabled = true;
  const buffers = {};       // name -> HTMLAudioElement that loaded OK
  let music = null;

  let unlocked = false;
  function ac() {
    if (!unlocked) return null;
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type = 'sine', vol = 0.15, when = 0, slideTo = null) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.12, when = 0, hp = 800) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + when;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination); s.start(t);
  }
  /** Band-passed noise swept up or down: a soft camera whoosh. */
  function whoosh(dur, up, vol = 0.07) {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(up ? 280 : 1900, t);
    f.frequency.exponentialRampToValueAtTime(up ? 1900 : 260, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(c.destination); s.start(t);
  }
  // Hop notes climb a major pentatonic for + moves and fall for − moves, so counting is audible.
  const HOP_NOTES = [392, 440, 494, 587, 659, 784, 880, 988, 1175, 1319, 1568];
  function hopNote(o) {
    const i = Math.max(0, (o.step || 1) - 1);
    const k = o.dir < 0 ? Math.max(0, 8 - i) : Math.min(HOP_NOTES.length - 1, 2 + i);
    return HOP_NOTES[k];
  }
  const SYNTH = {
    click: () => tone(660, 0.07, 'triangle', 0.12),
    dice: () => { for (let i = 0; i < 7; i++) noise(0.04, 0.08, i * 0.09, 2500); },
    diceLand: () => { noise(0.06, 0.14, 0, 1200); tone(180, 0.08, 'triangle', 0.1); },
    hop: (o = {}) => { const f = hopNote(o); tone(f * 0.8, 0.13, 'sine', 0.12, 0, f * 1.18); tone(f * 2, 0.06, 'triangle', 0.025, 0.01); },
    land: () => { noise(0.05, 0.05, 0, 200); tone(150, 0.08, 'sine', 0.1, 0, 85); },
    plip: () => { tone(1250, 0.1, 'sine', 0.07, 0, 480); tone(620, 0.08, 'sine', 0.03, 0.03, 900); },
    whoosh: (o = {}) => whoosh(o.up ? 0.55 : 0.7, !!o.up),
    reveal: () => [1046, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.22, 'triangle', 0.07, i * 0.06)),
    nudge: () => { tone(988, 0.1, 'sine', 0.06); tone(1319, 0.14, 'sine', 0.06, 0.1); },
    splash: () => { noise(0.35, 0.16, 0, 600); tone(300, 0.2, 'sine', 0.05, 0, 120); },
    ladder: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.1, i * 0.09)),
    snake: () => tone(700, 0.7, 'sawtooth', 0.05, 0, 140),
    win: () => [523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, i * 0.13)),
    lose: () => [440, 392, 349].forEach((f, i) => tone(f, 0.25, 'triangle', 0.1, i * 0.18)),
    turn: () => tone(880, 0.12, 'sine', 0.08)
  };

  // Probe optional files once (missing files fail silently -> synth fallback).
  function probe() {
    if (location.protocol === 'file:') {
      // HEAD requests are blocked on file://, so just try to load each element.
    }
    Object.entries(FILES).filter(([name]) => AVAILABLE.includes(name)).forEach(([name, src]) => {
      const a = new Audio();
      a.preload = 'auto';
      a.addEventListener('canplaythrough', () => { buffers[name] = a; }, { once: true });
      a.addEventListener('error', () => {}, { once: true });
      a.src = src;
    });
  }

  const Audio_ = {
    init() { probe(); },
    unlock() { unlocked = true; ac(); },
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      if (music) enabled ? music.play().catch(() => {}) : music.pause();
      return enabled;
    },
    /** opts are passed to the synth (e.g. hop {step, dir}); real files get a matching pitch via playbackRate. */
    play(name, opts) {
      if (!enabled) return;
      const el = buffers[name];
      if (el) {
        try {
          const c = el.cloneNode(); c.volume = 0.7;
          if (name === 'hop' && opts) c.playbackRate = hopNote(opts) / 587;
          c.play().catch(() => {});
        } catch (e) {}
        return;
      }
      SYNTH[name] && SYNTH[name](opts);
    },
    startMusic() {
      if (!buffers.music || !enabled) return;
      music = buffers.music; music.loop = true; music.volume = 0.35; music.play().catch(() => {});
    }
  };
  ISL.audio = Audio_;
})(window.ISL);
