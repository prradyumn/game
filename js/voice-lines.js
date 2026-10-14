/* Every voiceover line in the game. Shared by the game (js/voice.js) and the
   Gemini voice generator (tools/voice-generator.html), so ids always match. */
(function () {
  'use strict';
  const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty'];
  function words(k) {
    if (k < 20) return ONES[k];
    const t = Math.floor(k / 10), o = k % 10;
    return TENS[t] + (o ? '-' + ONES[o] : '');
  }
  /** Spoken form of an integer: "negative three", "zero", "positive four". */
  function numText(n) { return n === 0 ? 'zero' : (n > 0 ? 'positive ' : 'negative ') + words(Math.abs(n)); }
  function numId(n) { return n === 0 ? 'n_0' : (n > 0 ? 'n_p' : 'n_m') + Math.abs(n); }

  const LINES = {
    // gameplay
    your_turn: 'Your turn! Tap roll.',
    computer_turn: "Computer's turn.",
    plus: 'plus',
    equals: 'equals',
    ladder: 'A ladder! Ladders add a positive number.',
    snake: 'Oh no, a snake! Snakes add a negative number.',
    summit_past: "That's past positive fifty. You reach the summit!",
    seafloor: "You can't go below negative fifty. You rest on the seafloor.",
    win_student: 'You reached positive fifty! You planted the flag. You win!',
    win_computer: 'The computer reached positive fifty first. Good try! Play again and beat it.',
    // live tutorial
    t_welcome: 'Welcome, explorer! This board is a number line. The land squares are positive numbers, and the sea squares are negative numbers. Zero is the jetty, right on the shoreline.',
    t_dice: 'Every turn, you roll two dice. The sign die says plus or minus. The number die says how many. Tap roll to try it!',
    t_up: 'Zero plus positive four equals positive four. Adding a positive number moves you up, toward the summit.',
    t_neg: "Now let's add a negative number. Tap roll!",
    t_down: 'Positive four plus negative six equals negative two. Adding a negative number moves you down. You crossed zero and dived into the sea!',
    t_ladder: 'See this ladder? If you land at its bottom, it adds a positive number and you climb up. Tap roll!',
    t_ladder_done: 'Negative three plus positive twenty-two equals positive nineteen. What a climb!',
    t_snake: "Watch out for snakes! A snake's head adds a negative number and slides you down. Tap roll!",
    t_snake_done: 'Positive thirteen plus negative twenty equals negative seven. Snakes pull you down.',
    t_finish: "The first explorer to reach positive fifty plants the flag and wins. You're ready. Let's play!"
  };
  for (let n = -56; n <= 56; n++) LINES[numId(n)] = numText(n);

  window.VOICE_LINES = LINES;
  window.VOICE_NUM = { numText, numId };
})();
