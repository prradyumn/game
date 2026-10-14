/* Voiceover player.
   Uses the Gemini-generated clips in audio/voice/ (listed in audio/voice/voice-manifest.js).
   Any line without a clip is spoken with the browser's built-in voice instead,
   so narration always works. Lines are queued and never overlap. */
(function (ISL) {
  'use strict';
  const LINES = window.VOICE_LINES || {};
  const { numId } = window.VOICE_NUM;
  const cache = {};
  let chain = Promise.resolve();
  let epoch = 0;            // bumps on stop() so queued lines are dropped
  let current = null;       // playing HTMLAudioElement
  let enabled = true;

  const clips = () => window.VOICE_CLIPS || {};
  function clipEl(id) {
    const file = clips()[id];
    if (!file) return null;
    if (!cache[id]) { const a = new Audio('audio/voice/' + file); a.preload = 'auto'; cache[id] = a; }
    return cache[id];
  }
  function playClip(id, my) {
    return new Promise(res => {
      if (my !== epoch) return res();
      const a = clipEl(id); if (!a) return res();
      current = a;
      let done = false;
      const fin = () => { if (done) return; done = true; current = null; res(); };
      a.onended = fin; a.onerror = fin;
      try { a.currentTime = 0; } catch (e) {}
      a.play().catch(fin);
      setTimeout(fin, 9000);   // safety
    });
  }
  let synthVoice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const vs = speechSynthesis.getVoices();
    const pref = ['Samantha', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Karen', 'Moira', 'Google UK English Female'];
    for (const p of pref) { const v = vs.find(v => v.name.includes(p)); if (v) return v; }
    return vs.find(v => /^en[-_]/i.test(v.lang)) || null;
  }
  function speakSynth(text, my) {
    return new Promise(res => {
      if (my !== epoch || !('speechSynthesis' in window)) return res();
      synthVoice = synthVoice || pickVoice();
      const u = new SpeechSynthesisUtterance(text);
      if (synthVoice) u.voice = synthVoice;
      u.rate = 0.98; u.pitch = 1.08; u.volume = 1;
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      u.onend = fin; u.onerror = fin;
      speechSynthesis.speak(u);
      setTimeout(fin, 1500 + text.length * 85);
    });
  }
  async function run(ids, my) {
    if (!enabled || my !== epoch) return;
    if (ids.every(id => clips()[id])) {
      for (let i = 0; i < ids.length; i++) { if (my !== epoch) return; await playClip(ids[i], my); }
    } else {
      await speakSynth(ids.map(id => LINES[id] || '').join(' '), my);
    }
  }

  const VO = {
    /** Queue a spoken sequence of line ids. Resolves when it has been spoken. */
    say(ids) {
      if (!Array.isArray(ids)) ids = [ids];
      const my = epoch;
      chain = chain.then(() => run(ids, my));
      return chain;
    },
    /** Speak "a plus b equals c" with integer words. */
    equation(a, b, c) { return VO.say([numId(a), 'plus', numId(b), 'equals', numId(c)]); },
    number(n) { return VO.say([numId(n)]); },
    stop() {
      epoch++;
      if (current) { try { current.pause(); } catch (e) {} current = null; }
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      chain = Promise.resolve();
    },
    setEnabled(on) { enabled = on; if (!on) VO.stop(); },
    /** Freeze narration with the game (pause menu / help sheet). */
    pause() {
      if (current) { try { current.pause(); } catch (e) {} }
      if ('speechSynthesis' in window) speechSynthesis.pause();
    },
    resume() {
      if (current) current.play().catch(() => {});
      if ('speechSynthesis' in window) speechSynthesis.resume();
    },
    get enabled() { return enabled; },
    hasClips() { return Object.keys(clips()).length > 0; },
    init() {
      if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { synthVoice = pickVoice(); };
      // warm the cache for the short gameplay words
      ['plus', 'equals', 'your_turn', 'computer_turn'].forEach(clipEl);
    }
  };
  ISL.voice = VO;
})(window.ISL);
