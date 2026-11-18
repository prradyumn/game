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
  /** Spoken form of an integer: "minus three", "zero", "plus four". */
  function numText(n) { return n === 0 ? 'zero' : (n > 0 ? 'plus ' : 'minus ') + words(Math.abs(n)); }
  function numId(n) { return n === 0 ? 'n_0' : (n > 0 ? 'n_p' : 'n_m') + Math.abs(n); }

  const LINES = {
    // gameplay
    tap_hop: 'Now tap to hop! One tap for every square.',
    pick_square: 'Where will you land? Tap that square, or drag your explorer there!',
    hint_stay: "You didn't move! Hop the number you rolled.",
    hint_up: 'For a positive number, move forward, toward the land!',
    hint_down: 'For a negative number, move you backward, toward the sea!',
    hint_top: "You can't go past plus fifty. Stop at the flag!",
    hint_bottom: "Minus fifty is the seafloor. Stop there!",
    hint_zero: "Don't forget zero! The boardwalk counts as a step.",
    hint_next: 'Start counting from the next square, not your own.',
    hint_close: 'So close! Count again.',
    hint_far: 'Count carefully, one square for each step.',
    count_together: "Let's count together! Tap to hop.",
    ladder: 'A ladder! Up you go!',
    snake: 'Uh oh, a snake! Down you slide!',
    summit_past: "That's past plus fifty. You made it to the summit!",
    seafloor: "You can't go below minus fifty. You rest on the seafloor.",
    win_student: "You reached plus fifty. You Won!! You are an integer champion!",
    win_computer: "The computer reached plus fifty first. You were so close!",
    land_on: 'You land on',
    good_job: 'Good job.',
    // rules of the game (shown and spoken before every new game)
    rules_intro: "Before starting to play, let's understand the rules of the game.",
    rules_players: '2 players will play this game. You and computer. Each player will roll the dice turn by turn. Both the players will start from the "Zero"',
    rules_roll: 'Roll the sign die and the number die. Together they give you an integer number like plus four or minus three. You have to move your explorer as many steps on the board as the number appear on the dice.',
    rules_move: 'For a positive number, you will move forward and for the negative number, you moves backward toward the deep sea!',
    rules_win: 'If you find a ladder, climb up the ladder. It can take you to the mountain top faster. But if snake bites, you will slide down the tail. First explorer to reach plus fifty, will win!',
    // live tutorial
    t_welcome: "Welcome, explorer! This board is an integers' number line. Positive numbers are on the land, and negative numbers are in the sea. Zero is the boardwalk between them.",
    t_dice: "Roll two dice. The sign die says plus or minus, and it decides your direction. A plus sign means move forward, and a minus sign means move backward. The number die decides how many squares to jump. Check the dice, then drag your explorer to the correct number.",
    t_up: "You rolled plus four and hopped four squares forward. Positive numbers move you forward, toward the mountain peak.",
    t_neg: "Now let's check a negative number. Roll, then pick the square where you'll land!",
    t_down: "Minus six took you six squares down. You crossed zero and dived into the sea! Negative numbers take you backward, or down.",
    t_ladder: "Got a ladder? Climb it! It can take you up faster. Roll!",
    t_ladder_done: "This ladder took you to plus nineteen, twenty-two squares forward. What a climb!",
    t_snake: "Watch out for a snake's bite! It adds a negative number and slides you down. Roll!",
    t_snake_done: "The snake brought you twenty steps back and slid you down to minus seven. Snakes pull you down!",
    t_finish: "The first explorer to reach plus fifty, will win. Are you ready?"
  };
  for (let n = -50; n <= 50; n++) LINES[numId(n)] = numText(n);

  window.VOICE_LINES = LINES;
  window.VOICE_NUM = { numText, numId };
})();
