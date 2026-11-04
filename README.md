# Bingo Rush v1.6.0

## Team controls
- Team names are created and edited by the host only.
- Maximum 12 teams per round.
- Maximum 12 players per team.
- Players see live team availability (for example, `Bayou Ballers — 9/12`).
- Full teams stay visible as FULL but cannot be selected.
- The server rechecks capacity at join time and during host reassignment.
- Team scoring still uses each team's top 3 performers.

## Run
`npm install` then `npm start`

Player: `http://localhost:3000/`
Host: `http://localhost:3000/host.html`


## v1.6.3
- Redesigned dynamic result share cards using the Bingo Rush title-art visual language.
- Solo cards show player name, final rank, and a prominent 1ST PLACE badge for the winner.
- Team cards prioritize the team name, team rank, team score, and also show the sharing player and individual rank.
- Sponsor and Game Code remain on result cards when applicable.


## v1.6.4
- Added AUTO / MOBILE / TABLET manual registration-view selector.
- Live gameplay sponsor credit is text-only at the bottom.
- Re-centered white ball medallions using absolute 50/50 positioning.
- Completely redesigned dynamic result share card using the actual Bingo Rush title artwork, with large player/team name and 1st-place treatment.


## v1.6.5
- Simplified the Game QR Display to the Bingo Rush presentation graphic plus one live QR code.
- Removed sponsor branding from the QR display.
- Removed the Game Code and join URL from the QR display.
- Enlarged the live QR code substantially and centered it precisely on the 1920×1080 display and host preview.

## v1.6.6
- Live gameplay now uses a universal viewport-fit engine.
- The complete gameplay UI scales as one unit to the browser's actual visual viewport.
- No vertical or horizontal page scrolling during gameplay.
- Automatically recalculates on resize, browser toolbar changes, split-screen changes, and orientation changes.
- Landscape mode uses a wide two-column composition so the board remains usable rather than shrinking the portrait stack excessively.
- Board remains square and sponsor credit remains text-only.


## v1.6.7
- Fixed iPhone/iOS Safari live-game horizontal shift.
- The scaled gameplay canvas is now centered explicitly from its own center point instead of relying on grid alignment of an oversized pre-transform element.
- Keeps the full B–I–N–G–O board and top controls centered inside the visible gameplay viewport.


## v1.6.8
- Live rank moved beside the player/team name.
- Bingo counter moved below the goal/timer.
- QR display removes the visible Bingo Rush logo while keeping the neon arena background and oversized centered live QR.


## v1.6.9
- Removed the hyphen from the live called ball (example: `I 27` instead of `I-27`).
- Enlarged CURRENT CALL, the called letter/number, the color name, the instruction text, and B-I-N-G-O headers for better readability.
- Updated host current-call text to match the no-hyphen presentation.


## v1.6.10
- Current call ball now matches the stacked ball style more closely: letter on top, number below, with color underneath.
- Bumped frontend asset versions to reduce stale-cache issues after deploys.


## v1.6.11
- Removed the color word from the live called ball.
- Enlarged and re-centered the called letter and number to use the freed space.
- Frontend asset version bumped to reduce stale-cache issues after deployment.


## v1.6.12
- Goal mode now shows only the goal value; timed mode shows only the countdown timer.
- Removed the CURRENT CALL label from live gameplay.
- Removed the numeric seconds counter under the called ball.
- Removed the live instruction text under the called ball.
- The called-ball area now contains only the ball and the white countdown bar.
