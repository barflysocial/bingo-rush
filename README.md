# Bingo Rush v1.4

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

Players open the main Bingo Rush site and enter the host's custom Game Code.

## New in v1.4

- The host creates a custom reusable Game Code (4–15 letters/numbers), such as `BARFLY`.
- The same Game Code is reused across multiple rounds in the same game room.
- The Host Dashboard now has **NEXT ROUND / RESET** after a round ends.
- Reset clears boards, scores, ranks, winner state, team totals, and the call deck, while preserving the Game Code, players, team assignments, team names, sponsor, and game settings.
- Players join from the main site by entering the Game Code rather than needing a unique player link.
- Share buttons now share the main Bingo Rush address plus the Game Code.
- The player registration page no longer repeats the large Bingo Rush title artwork. It leads with the round sponsor, then registration.

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

- Custom reusable Game Code.
- Call timer: 3, 4, 5, 6, 8, or 10 seconds.
- Solo or Team Mode.
- Timed round with a custom number of minutes, or first-to-Bingo-goal scoring.
- Late joining: allowed, cutoff after a chosen number of minutes, or closed at start.
- Sponsor name and logo.
- Add/rename/remove teams before play.
- Edit player names; change team assignments before play.
- Start, pause, resume, end, and reset for the next round.
- Live individual leaderboard on the host dashboard.
- Live team leaderboard in Team Mode.

## Team scoring

- Team sizes do not need to be equal.
- Only the top 3 individual scores on each team count toward the team total.
- If team totals tie, the team that reached the tied score first ranks higher; timestamps are tracked to the millisecond.

## Player experience

- Title screen -> enter Game Code -> sponsor registration -> waiting room -> sponsor intro -> 3-2-1 -> synchronized gameplay.
- During play, players see only their own Bingo score, individual rank, and team rank when applicable.
- There is no live player leaderboard tab.
- At game over, the winner is revealed and the full final individual leaderboard appears; Team Mode also shows the final team leaderboard.
- When the host resets the room, connected players automatically return to the waiting room with the same Game Code.


## v1.4.0 cache fix
App HTML, JavaScript, and CSS are served with no-store headers and versioned script/style URLs so a new deploy cannot run an older cached host.js against the new server API.


## v1.4.0
- Removed the large Bingo Rush artwork from the player waiting room.
- Waiting room now leads with the round sponsor and player/room status only.


## v1.4 rich sharing
- Share Game now uses a clean `/join/GAMECODE?r=ROUND` URL.
- The shared URL contains server-rendered Open Graph + Twitter Card metadata for rich previews in Messages, Facebook, WhatsApp, X, Slack, Discord, and other compatible apps.
- The rich preview title includes the Game Code and the description includes the sponsor when configured.
- Direct share links bypass manual Game Code entry and open the player registration flow for that room.
- `roundNumber` increments on NEXT ROUND / RESET so the same reusable room can generate a fresh share URL each round while keeping the same Game Code.
- Added a 1200×630 `public/assets/bingo-rush-share.png` social preview image.
