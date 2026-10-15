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
    your_turn: 'Your turn, explorer! Tap Roll.',
    nudge: 'Go on, tap the Roll button to throw the dice!',
    tap_hop: 'Now tap to hop! One tap for every square.',
    pick_square: 'Where will you land? Tap the square, or drag your explorer there, then press Go!',
    hint_stay: "You didn't move! Hop the number you rolled.",
    hint_up: 'A plus number moves you up, toward the land!',
    hint_down: 'A minus number moves you down, toward the sea!',
    hint_top: "You can't go past positive fifty. Stop at the flag!",
    hint_bottom: 'Negative fifty is the seafloor. Stop there!',
    hint_zero: "Don't forget zero! The jetty counts as a step.",
    hint_next: 'Start counting from the next square, not your own.',
    hint_close: 'So close! Count again.',
    hint_far: 'Count carefully, one square for each step.',
    hint_path: 'Follow the glowing path.',
    count_together: "Let's count together! Tap to hop.",
    correct_1: 'Brilliant!',
    correct_2: 'Well done!',
    correct_3: 'You got it!',
    computer_turn: "Computer's turn. Let's see what it rolls!",
    plus: 'plus',
    equals: 'equals',
    ladder: 'A ladder! Ladders add a positive number. Up you go!',
    snake: 'Uh oh, a snake! Snakes add a negative number. Down you slide!',
    summit_past: "That's past positive fifty. You made it to the summit!",
    seafloor: "You can't go below negative fifty. You rest on the seafloor.",
    win_student: 'You reached positive fifty and planted the flag! You are an integer champion!',
    win_computer: 'The computer reached positive fifty first. So close! Play again and beat it.',
    // live tutorial
    t_welcome: 'Welcome, explorer! This whole board is a number line. Land squares are positive numbers, sea squares are negative numbers, and zero is the jetty right on the shoreline.',
    t_dice: 'Every turn, you roll two dice. The sign die says plus or minus, and the number die says how many. Then work out where you will land: tap that square, or drag your explorer there, and press Go! Tap Roll to try it!',
    t_up: 'You rolled positive four, so you hopped four squares up. Positive numbers move you up, toward the summit!',
    t_neg: "Now let's roll a negative number. Roll, then pick the square where you will land!",
    t_down: 'Negative six took you six squares down. You crossed zero and dived into the sea! Negative numbers move you down.',
    t_ladder: 'See this ladder? Land at its bottom and it adds a positive number, so you climb up. Tap Roll!',
    t_ladder_done: 'The ladder added positive twenty-two and lifted you all the way to positive nineteen. What a climb!',
    t_snake: "Watch out for snakes! A snake's head adds a negative number and slides you down. Tap Roll!",
    t_snake_done: 'The snake added negative twenty and slid you down to negative seven. Snakes pull you down!',
    t_finish: "The first explorer to reach positive fifty plants the flag and wins. You're ready. Let's play!"
  };
  for (let n = -56; n <= 56; n++) LINES[numId(n)] = numText(n);

  window.VOICE_LINES = LINES;
  window.VOICE_NUM = { numText, numId };
})();
