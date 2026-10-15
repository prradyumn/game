# Integer Snakes & Ladders — first draft

Open `index.html` in Chrome/Edge/Safari (double-click works; no server needed).

## Rules in this draft
- Board runs from **−50** (seafloor) to **+50** (summit). **0** is the jetty on the shoreline; both explorers start there.
- Each turn: roll the **sign die** (4 plus faces, 2 minus faces) and the **number die** (1–6). Move = position + (±n).
- After the roll, the player makes the move: **one tap per hop** (tap anywhere on the play area, press Space, or tap **Hop!**). A bubble over the character shows the direction and a counter (2 / 5). The computer hops on its own. No equations are shown on screen; the roll is shown on the dice and the round chip on the tray.
- Ladders add (+), snakes subtract (−). Values are on the tags. The big python at +43 slides you all the way down to −40.
- Reach or pass +50 to win. You can't go below −50.
- Student vs computer; the computer rolls automatically.

## Files
- `index.html` – markup for all screens
- `css/style.css` – look + static screen layouts
- `js/layout.js` – **single source of truth** for every HUD rectangle (landscape 1920×1080 and portrait 1080×1920 stages)
- `js/board.js` – board numbering, ladder/snake placement (`LADDERS`, `SNAKES`), canvas drawing, layout validation
- `js/game.js` – tokens and the turn state machine
- `js/ui.js` – 3D dice, Roll/Hop button and nudges, hop bubble, banner, cards, toast
- `js/cinema.js` – camera zoom/follow during moves
- `js/fx.js` – splashes, sand puffs, bubbles, sparkles, confetti, ambient clouds/birds/fish
- `js/audio.js` – sound hooks (placeholder synth now; add files to `audio/` and list them in `AVAILABLE`)
- `js/asset-sizes.js` – auto-generated logical (original) sizes of every shipped image
- `assets/` – the shipped art as WebP: only the images the game uses, downscaled to about 2× their largest on-screen size
- `_source-art/` (git-ignored, local only) – full-resolution PNG/JPG originals, including unused kit parts.
  After changing art there, run `node tools/optimize-assets.js` (needs Playwright). The shipped list is `tools/used-assets.json`

## Handy URL flags
- `?play` – skip the start screen and tutorial
- `?tutorial` – jump straight into the live tutorial
- `?fast=4` – speed everything up 4×
- `?debug` – show every token anchor and HUD rectangle
- Console: `ISL.game.force([1,6],[-1,3])` queues dice results; `ISL.board.validate()` checks the board layout.

## Move camera
After the dice land, the camera (`js/cinema.js`) zooms in so the character fills the view, and follows every hop, snake slide and ladder climb.
Each hop plays a note that climbs for + moves and falls for − moves, and a running count (+1, +2, …) pops over the token. With *reduce motion* turned on, the camera stays still.

## Dice
The dice are CSS 3D cubes built in `js/ui.js` from the face art (`dice/sign-kit/plus-face`, `minus-face`, `dice/digits/digit-01…06`): four plus faces and two minus faces on the sign die, and 1–6 on the number die (opposite faces add to 7). A roll tumbles each cube to its result face. To restyle them, replace those images.

## Screen transitions
Every screen change runs under the wave wipe (`transition()` in `js/main.js`): Play, How to play, Skip tutorial, the end of the tutorial, Play again, Restart, and Home.
The swap happens while the wave fully covers the stage, so resets never show, and modal fades are switched off under the wave. Extra clicks are ignored mid-transition, and Pause, Help and Esc wait until the wave has passed.

## Controls feedback
- Roll glows and breathes while it's your move. After 3.5 s idle it nudges: a wiggle, the dice hop, a bouncing arrow and a soft chime (repeats every 5 s). While hopping, the button reads **Hop!**, and if the player stalls for 3 s the hop bubble bounces and the voice says "Now tap to hop!".
- The token whose turn it is gets a glowing ring, plus a bobbing marker while waiting to roll. The active player card glows.
- **Space** rolls or hops. **Enter** does too, unless another button has focus. **Esc** pauses, or closes the help sheet if it's open.
- The only corner button is **Pause**. The pause menu holds Resume, Restart, Home, **Sound** and **How to play**; closing How to play returns to the pause menu.

## Opening cinematic
Every load opens with a ~7 s intro: you rise from the deep sea, a ladder bursts out of the water, snakes appear, the title slams in, both explorers land on the jetty, and an integer ticker counts −50 → +50. Then an SVG wave sweeps you to the start screen. **Skip ›** (or `?nointro`) jumps past it. Code: `js/intro.js`.

## Live tutorial
The first time you press **Play**, a coach walks you through four real scripted turns (+4, crossing zero with −6, a ladder, a snake). **How to play** on the start screen replays it. You can also replay it from the **?** help panel. Use **Skip tutorial** to jump straight into a game.

## Voiceover
- All lines live in `js/voice-lines.js`: numbers −56…+56 spoken as "negative three" / "positive four", the gameplay prompts, and the tutorial script.
- Without clips, the game speaks with the browser's built-in voice.
- The shipped clips (`audio/voice/*.ogg`, Opus 32 kbps) were made with `gemini-2.5-pro-preview-tts`, voice **Puck**, directed as a friendly explorer guide (numbers and the words "plus" and "equals" are read evenly so they splice into equations).
- To regenerate from the command line: `GEMINI_API_KEY=... node tools/generate-voice.js` (`--force` remakes everything, `--only id,id` remakes chosen lines, `--voice` and `--model` override). It needs ffmpeg. Keep the key in the environment and never commit it.
- Use a TTS model that follows spoken style direction. `gemini-3.8-flash-tts` reads the direction (and `[tags]`) aloud, so it isn't suitable.
- Browser alternative: open `tools/voice-generator.html` in Chrome or Edge, paste your key, press **Choose the game folder & generate**, then pick this `game` folder.

## Sound effects to add later
`audio/` names expected (Ogg, e.g. Opus): click, dice-roll, dice-land, hop, land, whoosh, reveal, splash, ladder, snake, win, lose, turn, music-loop. List each added name in `AVAILABLE` in `js/audio.js`.
