# Bingo Rush v1.5

Bingo Rush is a host-controlled real-time multiplayer bingo strategy game.

## What's new in v1.5

- Host sponsor name may be left blank. Player screens hide sponsor text when no sponsor name/logo is supplied.
- **Global Host Reset** danger-zone control. It removes the entire room, players, teams, scores, sponsor, settings, and releases the Game Code.
- **QR DISPLAY** tab in the Host Dashboard.
- Dynamic QR code generator for the current reusable Game Code / round link.
- Dedicated **1920 × 1080** presentation display for TVs and projectors.
- QR display shows the Bingo Rush title artwork, optional sponsor, scannable join QR, and large Game Code.
- The host can open the QR presentation in a separate browser window for venue display.

## Run locally

```bash
npm install
npm start
```

Player site:

```text
http://localhost:3000/
```

Host Dashboard:

```text
http://localhost:3000/host.html
```

## Render

Build command:

```text
npm install
```

Start command:

```text
npm start
```

The QR generator uses the `qrcode` npm package, which installs automatically with `npm install`.

## QR display

After creating/restoring a game room, click **QR DISPLAY** in the Host Dashboard. The tab contains a 16:9 preview and an **OPEN 1920 × 1080 DISPLAY** button. The full presentation is also available at:

```text
/qr.html?code=YOURCODE
```

The QR always points to the current reusable room and includes the current round number in the join URL for fresh social/link previews.

## Global reset vs next round

**NEXT ROUND / RESET** keeps the Game Code, registered players, teams, assignments, sponsor, and room settings. It clears boards, scores, rankings, winner data, and starts the 375-ball deck over at Cycle 1.

**GLOBAL HOST RESET** permanently deletes the room and releases the Game Code. Connected players are returned to the Game Code entry screen.
