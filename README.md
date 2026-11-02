# Bingo Rush v1.2

A server-backed multiplayer web MVP for the host-controlled Bingo Rush game.

## Run locally

1. Install Node.js 18 or newer.
2. Open a terminal in this folder.
3. Run:

```bash
npm start
```

4. Open the host dashboard:

```text
http://localhost:3000/host.html
```

The host creates a round and shares the generated player link.

## Current rules

- 5x5 board with B, I, N, G, O columns.
- A called letter can only be placed in its matching column.
- The player chooses which empty row position receives the ball.
- One called ball can be placed only once.
- No overwrite, remove, or pass button. An unused call expires automatically.
- Only the five horizontal rows and two diagonals score. Vertical lines do not score.
- A normal completed line scores 1 Bingo; a same-color completed line scores 2.
- All simultaneous completed lines are detected before any balls clear.
- The call deck contains 375 unique calls: 75 Bingo numbers x 5 colors.
- No exact color-number call repeats during a deck cycle. After all 375 are used, the server reshuffles a fresh 375-ball cycle and continues until the round ends.

## Host controls

- Call timer: 3, 4, 5, 6, 8, or 10 seconds.
- Solo or Team Mode.
- Timed round with a custom number of minutes, or first-to-Bingo-goal scoring.
- Late joining: allowed, cutoff after a chosen number of minutes, or closed at start.
- Sponsor name and logo.
- Add/rename/remove teams before play; team names can also be corrected later.
- Edit player names; change team assignments before play.
- Start, pause, resume, and end round.
- Live individual leaderboard on the host dashboard.
- Live team leaderboard in Team Mode.

## Team scoring

- Team sizes do not need to be equal.
- Only the top 3 individual scores on each team count toward the team total.
- If team totals tie, the team that reached the tied score first ranks higher; timestamps are tracked to the millisecond.

## Player experience

- Registration -> waiting room -> sponsor intro -> 3-2-1 -> synchronized gameplay.
- During play, players see only their own Bingo score, individual rank, and team rank when applicable.
- There is no live player leaderboard tab.
- At game over, the winner is revealed and the full final individual leaderboard appears; Team Mode also shows the final team leaderboard.
- Players can share the game link and share a result graphic after the round.
