/* Audio manager: sound effects, music and mixing.

   Sounds live in audio/sfx/*.ogg and music in audio/music/*.ogg (generated with ElevenLabs
   Sound Effects and Gemini Lyria, see README). Over http(s) every file is decoded into Web Audio
   buffers, so effects start instantly and can overlap. Opened straight from a file (file://),
   browsers block fetch(), so it falls back to <audio> elements. Any sound without a file plays a
   tiny synth placeholder instead, so every event always has a sound.

   Mixing: effects → sfx bus, music → music bus, both → master. Big effects and the voiceover
   briefly lower ("duck") the music so they stay clear. Pause suspends everything. */
(function (ISL) {
  'use strict';
  const SFX = ['click', 'dice', 'diceLand', 'boing', 'land', 'plip', 'splash', 'whoosh', 'nudge', 'ladder', 'slide', 'turn', 'win', 'lose',
    'intro_surface', 'intro_deep', 'intro_bubbles', 'intro_burst', 'intro_creak', 'intro_hiss', 'intro_whoosh', 'intro_boom',
    'intro_shimmer', 'intro_pop', 'intro_dock', 'intro_ding', 'intro_wave'];
  const MUSIC = { intro: 'audio/music/intro.ogg', loop: 'audio/music/loop.ogg' };
  // game event -> [file, gain, duck music?]; one event may layer several files
  const EVENTS = {
    click: [['click', 0.5]], dice: [['dice', 0.8]], diceLand: [['diceLand', 0.75]],
    hop: [['boing', 0.5]], land: [['land', 0.5]], plip: [['plip', 0.55]],
    splash: [['splash', 0.8, true]], whoosh: [['whoosh', 0.35]], nudge: [['nudge', 0.6]],
    ladder: [['ladder', 0.7], ['intro_shimmer', 0.35]], snake: [['intro_hiss', 0.7], ['slide', 0.8, true]],
    turn: [['turn', 0.45]], win: [['win', 0.9, true]], lose: [['lose', 0.8, true]],
    wave: [['intro_wave', 0.85, true]]
  };
  const MUSIC_VOL = { intro: 1, loop: 0.32 };

  let ctx = null, master, sfxBus, musicBus, duckGain;
  let unlocked = false, enabled = true, musicOn = true, useWebAudio = location.protocol !== 'file:';
  const buffers = {}, elems = {};
  let track = null, wantTrack = null;   // current music { name, src|el, gain }

  try { const m = localStorage.getItem('isl_music'); if (m === '0') musicOn = false; } catch (e) {}

  function graph() {
    if (ctx) return ctx;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; useWebAudio = false; return null; }
    master = ctx.createGain(); master.gain.value = enabled ? 1 : 0; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    duckGain = ctx.createGain(); duckGain.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 1 : 0; musicBus.connect(duckGain);
    return ctx;
  }

  /* ---------- loading ---------- */
  function load() {
    const files = SFX.map(n => [n, `audio/sfx/${n}.ogg`]).concat(Object.entries(MUSIC));
    if (useWebAudio && graph()) {
      files.forEach(([n, url]) => fetch(url).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })
        .then(b => ctx.decodeAudioData(b)).then(buf => { buffers[n] = buf; if (wantTrack === n && unlocked) music(n); })
        .catch(() => { fallbackEl(n, url); }));
    } else files.forEach(([n, url]) => fallbackEl(n, url));
  }
  function fallbackEl(n, url) {
    const a = new Audio(); a.preload = 'auto'; a.src = url;
    a.addEventListener('canplaythrough', () => { elems[n] = a; if (wantTrack === n && unlocked) music(n); }, { once: true });
  }

  /* ---------- synth placeholders (only used when a file is missing) ---------- */
  function tone(freq, dur, type = 'sine', vol = 0.15, when = 0, slideTo = null) {
    if (!graph() || !unlocked) return;
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  const SYNTH = {
    click: () => tone(660, 0.07, 'triangle', 0.12), hop: o => { const f = hopNote(o); tone(f * 0.8, 0.13, 'sine', 0.12, 0, f * 1.18); },
    land: () => tone(150, 0.08, 'sine', 0.1, 0, 85), plip: () => tone(1250, 0.1, 'sine', 0.07, 0, 480),
    nudge: () => { tone(988, 0.1, 'sine', 0.06); tone(1319, 0.14, 'sine', 0.06, 0.1); }, turn: () => tone(880, 0.12, 'sine', 0.08),
    tick: o => tone(700 + (o && o.i || 0) * 45, 0.05, 'triangle', 0.05)
  };

  // Hop pitch climbs a major pentatonic for + moves and falls for − moves, so counting is audible.
  const HOP_NOTES = [392, 440, 494, 587, 659, 784, 880, 988, 1175, 1319, 1568];
  function hopNote(o = {}) {
    const i = Math.max(0, (o.step || 1) - 1);
    return HOP_NOTES[o.dir < 0 ? Math.max(0, 8 - i) : Math.min(HOP_NOTES.length - 1, 2 + i)];
  }

  /* ---------- playback ---------- */
  function playFile(name, gain = 1, rate = 1, duck = false) {
    if (!enabled || !unlocked) return false;
    if (buffers[name] && ctx) {
      if (ctx.state === 'suspended' && !paused) ctx.resume();
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = buffers[name]; s.playbackRate.value = rate; g.gain.value = gain;
      s.connect(g).connect(sfxBus); s.start();
      if (duck) duckMusic(0.45, buffers[name].duration / rate);
      return true;
    }
    if (elems[name]) {
      try { const c = elems[name].cloneNode(); c.volume = Math.min(1, gain); c.preservesPitch = false; c.playbackRate = rate; c.play().catch(() => {}); } catch (e) {}
      return true;
    }
    return false;
  }
  /** Duck the music to `level` for about `dur` seconds, then ease back. */
  function duckMusic(level = 0.45, dur = 0.6) {
    if (!duckGain) return;
    const t = ctx.currentTime, g = duckGain.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(level, t + 0.05);
    g.setValueAtTime(level, t + Math.max(0.1, dur * 0.7));
    g.linearRampToValueAtTime(1, t + dur + 0.4);
  }
  let voiceDucked = false;
  function duckForVoice(on) {
    if (!duckGain || voiceDucked === on) return;
    voiceDucked = on;
    const t = ctx.currentTime, g = duckGain.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(on ? 0.4 : 1, t + (on ? 0.12 : 0.5));
  }

  /* ---------- music ---------- */
  /** Switch music track with a crossfade (fade seconds). Remembers the request until audio unlocks. */
  function music(name, fade = 1.5) {
    wantTrack = name;
    if (!unlocked) return;
    if (track && track.name === name) return;
    const old = track;
    if (old) stopTrack(old, fade);
    track = null;
    const vol = MUSIC_VOL[name] || 0.5, loop = name === 'loop';
    if (buffers[name] && ctx) {
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = buffers[name]; s.loop = loop;
      g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.linearRampToValueAtTime(vol, ctx.currentTime + (old ? fade : 0.05));
      s.connect(g).connect(musicBus); s.start();
      if (!loop) s.onended = () => { if (track && track.src === s) track = null; };
      track = { name, src: s, gain: g };
    } else if (elems[name]) {
      const a = elems[name]; a.loop = loop; a.currentTime = 0; a.volume = musicOn && enabled ? vol : 0; a.play().catch(() => {});
      track = { name, el: a, vol };
    }
  }
  function stopTrack(t, fade = 1) {
    if (t.src) {
      const now = ctx.currentTime; t.gain.gain.cancelScheduledValues(now); t.gain.gain.setValueAtTime(t.gain.gain.value, now);
      t.gain.gain.linearRampToValueAtTime(0.0001, now + fade); try { t.src.stop(now + fade + 0.05); } catch (e) {}
    } else if (t.el) {
      const a = t.el, v0 = a.volume, t0 = performance.now();
      const step = () => { const k = Math.min(1, (performance.now() - t0) / (fade * 1000)); a.volume = v0 * (1 - k); if (k < 1) requestAnimationFrame(step); else a.pause(); };
      step();
    }
  }

  let paused = false;
  const Audio_ = {
    init() { load(); },
    unlock() {
      if (unlocked) { if (ctx && ctx.state === 'suspended' && !paused) ctx.resume(); return; }
      unlocked = true; graph();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      if (wantTrack) music(wantTrack);
    },
    get enabled() { return enabled; },
    get musicOn() { return musicOn; },
    /** Debug/QA readout: current music track and how many files are decoded vs element fallbacks. */
    get status() { return { track: track && track.name, decoded: Object.keys(buffers).length, elements: Object.keys(elems).length, ctx: ctx && ctx.state }; },
    /** Master sound on/off (effects, music and voice). */
    toggle() {
      enabled = !enabled;
      if (master) master.gain.setTargetAtTime(enabled ? 1 : 0, ctx.currentTime, 0.05);
      if (track && track.el) track.el.volume = enabled && musicOn ? track.vol : 0;
      return enabled;
    },
    /** Music only on/off (remembered). */
    toggleMusic() {
      musicOn = !musicOn;
      try { localStorage.setItem('isl_music', musicOn ? '1' : '0'); } catch (e) {}
      if (musicBus) musicBus.gain.setTargetAtTime(musicOn ? 1 : 0, ctx.currentTime, 0.1);
      if (track && track.el) track.el.volume = enabled && musicOn ? track.vol : 0;
      return musicOn;
    },
    /** Play a game event (see EVENTS) or a raw sfx file name. opts.step/opts.dir pitch the hop. */
    play(name, opts) {
      if (!enabled) return;
      const layers = EVENTS[name] || [[name, 1]];
      const rate = name === 'hop' && opts ? hopNote(opts) / 587 : 1;
      let any = false;
      layers.forEach(([file, gain, duck]) => { if (playFile(file, gain, rate, duck)) any = true; });
      if (!any && SYNTH[name]) SYNTH[name](opts);
    },
    music, duck: duckMusic, duckForVoice,
    startMusic() { music('loop', 2); },
    stopMusic(fade = 1) { wantTrack = null; if (track) stopTrack(track, fade); track = null; },
    pause() { paused = true; if (ctx && ctx.state === 'running') ctx.suspend(); if (track && track.el) track.el.pause(); },
    resume() { paused = false; if (ctx && ctx.state === 'suspended' && unlocked) ctx.resume(); if (track && track.el && musicOn && enabled) track.el.play().catch(() => {}); }
  };
  ISL.audio = Audio_;
})(window.ISL);
