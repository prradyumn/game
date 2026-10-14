#!/usr/bin/env node
/* Command-line voiceover generator (Node 18+, ffmpeg on PATH).
   Same lines as tools/voice-generator.html (js/voice-lines.js), written as small MP3s into
   audio/voice/ plus audio/voice/voice-manifest.js. Existing clips are skipped, so it resumes.

   GEMINI_API_KEY=... node tools/generate-voice.js [--voice Puck] [--model gemini-2.5-pro-preview-tts] [--only id,id] [--force]

   Model note: use a TTS model that follows spoken style direction ("Say cheerfully: …").
   gemini-3.8-flash-tts reads the direction (and [tags]) aloud, so it is not suitable here.

   The key is read from the environment only — never pass it on the command line or commit it. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'audio', 'voice');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const KEY = process.env.GEMINI_API_KEY;
const VOICE = opt('voice', 'Puck');
const MODEL = opt('model', 'gemini-2.5-pro-preview-tts');
const FALLBACK = 'gemini-3.1-flash-tts-preview';
const CONCURRENCY = 4;
if (!KEY) { console.error('Set GEMINI_API_KEY in the environment.'); process.exit(1); }

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/voice-lines.js'), 'utf8'), sandbox);
const LINES = sandbox.window.VOICE_LINES;

// Narration gets character direction; numbers and joining words are read evenly so they
// splice cleanly into "negative six plus positive three equals negative three".
// Keep direction to one short lead-in sentence — the model speaks only what follows the colon.
const NARRATOR = 'Say warmly and cheerfully, like a friendly explorer guide talking to excited kids, clear and not too fast:';
const SPLICE = 'Say clearly and evenly, like a friendly game announcer:';
const isSplice = id => /^n_/.test(id) || id === 'plus' || id === 'equals';
const prompt = id => `${isSplice(id) ? SPLICE : NARRATOR} ${LINES[id]}`;

async function tts(text, tries = 6, model = MODEL) {
  for (let a = 1; ; a++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } }
      })
    });
    if (res.ok) {
      const j = await res.json();
      const part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (part) {
        const rate = +(/rate=\s*(\d+)/.exec(part.inlineData.mimeType) || [0, 24000])[1];
        return { pcm: Buffer.from(part.inlineData.data, 'base64'), rate, wav: /wav/.test(part.inlineData.mimeType) };
      }
      if (a >= tries) {
        if (model !== FALLBACK) return tts(text, 4, FALLBACK);   // e.g. a very short line the primary model declines
        throw new Error('no audio in response');
      }
    } else if (a >= tries || ![429, 500, 503].includes(res.status)) {
      throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    await new Promise(r => setTimeout(r, Math.min(30000, 1500 * 2 ** a)));
  }
}

/** PCM (raw s16le or WAV) -> trimmed, normalised mono MP3 */
function encode({ pcm, rate, wav }, file) {
  const input = wav ? ['-f', 'wav'] : ['-f', 's16le', '-ar', String(rate), '-ac', '1'];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...input, '-i', 'pipe:0',
    '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse,loudnorm=I=-16:TP=-1.5',
    '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '64k', file], { input: pcm });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const force = args.includes('--force');
  const only = opt('only', '') ? opt('only').split(',') : null;
  const ids = Object.keys(LINES).filter(id => !only || only.includes(id));
  const todo = ids.filter(id => force || !fs.existsSync(path.join(OUT, id + '.mp3')));
  console.log(`${MODEL} / ${VOICE}: ${todo.length} of ${ids.length} clips to make`);
  let done = 0, failed = [];
  const queue = todo.slice();
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (let id; (id = queue.shift());) {
      try {
        encode(await tts(prompt(id)), path.join(OUT, id + '.mp3'));
        process.stdout.write(`\r${++done}/${todo.length} ${id.padEnd(16)}`);
      } catch (e) { failed.push(id); console.error(`\n${id}: ${e.message}`); }
    }
  }));
  // manifest lists every clip on disk for the current line set
  const map = {};
  Object.keys(LINES).forEach(id => { if (fs.existsSync(path.join(OUT, id + '.mp3'))) map[id] = id + '.mp3'; });
  fs.writeFileSync(path.join(OUT, 'voice-manifest.js'),
    `/* Generated by tools/generate-voice.js (${MODEL}, voice ${VOICE}) — lists the voice clips that exist. Empty = use the browser voice. */\nwindow.VOICE_CLIPS = ${JSON.stringify(map, null, 1)};\n`);
  console.log(`\nmanifest: ${Object.keys(map).length} clips${failed.length ? '; failed: ' + failed.join(', ') : ''}`);
})();
