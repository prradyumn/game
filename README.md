# Integer Snakes & Ladders — first draft

Open `index.html` in Chrome/Edge/Safari (double-click works; no server needed).

## Rules in this draft
- Board runs from **−50** (seafloor) to **+50** (summit). **0** is the jetty on the shoreline; both explorers start there.
- Each turn: roll the **sign die** (4 plus faces, 2 minus faces) and the **number die** (1–6). Move = position + (±n).
- The equation panel and number line show the sum (`−3 + (+5) = +2`); tokens hop automatically, crossing zero through the jetty.
- Ladders add (+), snakes subtract (−). Values are on the tags.
- Reach or pass +50 to win. You can't go below −50.
- Student vs computer; the computer rolls automatically.

## Files
- `index.html` – markup for all screens
- `css/style.css` – look + static screen layouts
- `js/layout.js` – **single source of truth** for every HUD rectangle (landscape 1920×1080 and portrait 1080×1920 stages)
- `js/board.js` – board numbering, ladder/snake placement (`LADDERS`, `SNAKES`), canvas drawing, layout validation
- `js/game.js` – tokens and the turn state machine
- `js/ui.js` – dice, number line, equation panel, banner, cards
- `js/fx.js` – splashes, sand puffs, bubbles, sparkles, confetti, ambient clouds/birds/fish
- `js/audio.js` – sound hooks (placeholder synth now; add files to `audio/` and list them in `AVAILABLE`)
- `js/asset-sizes.js` – auto-generated trimmed sizes of every image
- `assets/` – cleaned copies of the art: trimmed to their real edges, stray slivers removed,
  number-line and menu sheets re-cut, world painting re-aligned so its 10 bands match the 10 rows exactly

## Handy URL flags
- `?play` – skip the start screen and tutorial
- `?tutorial` – jump straight into the live tutorial
- `?fast=4` – speed everything up 4×
- `?debug` – show every token anchor and HUD rectangle
- Console: `ISL.game.force([1,6],[-1,3])` queues dice results; `ISL.board.validate()` checks the board layout.

## Move cinematic
After the dice land, the camera (`js/cinema.js`) zooms in on the token and follows each hop.
Every hop plays a note that climbs for + moves and falls for − moves, and a running count (+1, +2, …) pops over the token.
Then the big equation card dolly-zooms in (the card pushes in while the scene pulls back), reveals the answer, and docks into the equation panel.
Snake and ladder rides get the same treatment. With *reduce motion* turned on, the camera stays still and the card just fades.

## Controls feedback
- Roll glows and breathes while it's your move. After 3.5 s idle it nudges: a wiggle, the dice hop, a bouncing arrow and a soft chime (repeats every 5 s).
- The token whose turn it is gets a glowing ring, plus a bobbing marker while waiting to roll. The active player card glows.
- **Space** always rolls. **Enter** rolls unless another button has focus. **Esc** pauses, or closes the help sheet if it's open.

## Opening cinematic
Every load opens with a ~7 s intro: you rise from the deep sea, a ladder bursts out of the water, snakes appear, the title slams in, both explorers land on the jetty, and an integer ticker counts −50 → +50. Then an SVG wave sweeps you to the start screen. **Skip ›** (or `?nointro`) jumps past it. Code: `js/intro.js`.

## Live tutorial
The first time you press **Play**, a coach walks you through four real scripted turns (+4, crossing zero with −6, a ladder, a snake). **How to play** on the start screen replays it. You can also replay it from the **?** help panel. Use **Skip tutorial** to jump straight into a game.

## Voiceover
- All lines live in `js/voice-lines.js`: numbers −56…+56 spoken as "negative three" / "positive four", the equation words, and the tutorial script.
- Without clips, the game speaks with the browser's built-in voice.
- The shipped clips (`audio/voice/*.mp3`) were made with `gemini-2.5-pro-preview-tts`, voice **Puck**, directed as a friendly explorer guide (numbers and the words "plus" and "equals" are read evenly so they splice into equations).
- To regenerate from the command line: `GEMINI_API_KEY=... node tools/generate-voice.js` (`--force` remakes everything, `--only id,id` remakes chosen lines, `--voice` and `--model` override). It needs ffmpeg. Keep the key in the environment and never commit it.
- Use a TTS model that follows spoken style direction. `gemini-3.8-flash-tts` reads the direction (and `[tags]`) aloud, so it isn't suitable.
- Browser alternative: open `tools/voice-generator.html` in Chrome or Edge, paste your key, press **Choose the game folder & generate**, then pick this `game` folder.

## Sound effects to add later
`audio/` names expected: click, dice-roll, dice-land, hop, splash, ladder, snake, win, lose, turn, music-loop (.mp3).
