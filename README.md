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
