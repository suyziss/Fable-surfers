# Fable Surfers

A browser-based 3D endless runner built with Three.js. Dodge trains and barriers, jump, slide, collect coins, and use temporary power-ups.

> This is an original project inspired by the endless-runner genre. It is not affiliated with or endorsed by Subway Surfers or its publishers.

## Features

- Three-lane endless-runner gameplay
- Jumping, sliding, lane switching and touch/swipe controls
- Procedurally generated track segments
- Trains, ramps, barriers, coins, magnets and hoverboard protection
- Local high-score and settings storage
- Three.js rendering with a reduced-quality option
- Local-only Node.js server; no account or API key required

## Quick start

Requirements: Node.js 20 or newer (Node.js 22 LTS recommended).

```bash
git clone https://github.com/suyziss/Fable-surfers.git
cd Fable-surfers
npm start
```

Open **http://127.0.0.1:43827** in your browser.

Run the simulation tests with:

```bash
npm test
```

## Android (Termux)

Install Termux from its official distribution, then run:

```bash
pkg update && pkg upgrade
pkg install git nodejs-lts
git clone https://github.com/suyziss/Fable-surfers.git
cd Fable-surfers
npm start
```

Keep Termux running and open **http://127.0.0.1:43827** in Chrome or another browser on the same phone. Stop the server with `Ctrl+C`.

Alternative:

```bash
node server.cjs
```

## Windows

Install Node.js 20+ (22 LTS recommended).

**PowerShell launcher:**

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Start.ps1
```

To start without automatically opening a browser: `.Start.ps1 -NoBrowser`. Stop with `.Stop.ps1`.

**Command Prompt:** double-click `Start.cmd`; stop with `Stop.cmd`.

**Direct Node.js / npm:**

```powershell
node server.cjs
```

or `npm start`. Open **http://127.0.0.1:43827** and press `Ctrl+C` to stop.

## Linux

Install Node.js 20+.

**npm:** `npm start`

**Launcher:** `bash start.sh`; stop with `bash stop.sh`.

**Direct:** `node server.cjs`; stop with `Ctrl+C`.

Open **http://127.0.0.1:43827**.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Change lane | A / D or ← / → | Swipe left / right |
| Jump | Space / ↑ / W | Swipe up |
| Slide | S / ↓ | Swipe down |
| Hoverboard | B | Double tap or touch button |
| Pause | Esc | Pause button |
| Sound | M | Sound button |

## Notes

- The server binds to `127.0.0.1`; it is intended for local play on the same device.
- Best score and settings are stored in browser localStorage.
- The portable Windows Node.js binary from the development folder is intentionally excluded. Install Node.js normally instead.
- `QA.md` and `docs/simulation-results.txt` are historical reports from the source project (September 2026); they have not been independently rerun against this GitHub upload.
- The original Dropbox folder contained screenshots, but the binary screenshots were not included in this source upload.
- See [THIRD-PARTY.md](THIRD-PARTY.md) for dependency and license information and [docs/LAUNCH_GUIDE_RU.md](docs/LAUNCH_GUIDE_RU.md) for the detailed Russian guide.
