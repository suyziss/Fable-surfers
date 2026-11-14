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

To run the simulation tests:

```bash
npm test
```

## Run on Android (Termux)

1. Install Termux from its official F-Droid or GitHub distribution.
2. In Termux:

```bash
pkg update && pkg upgrade
pkg install git nodejs-lts
git clone https://github.com/suyziss/Fable-surfers.git
cd Fable-surfers
npm start
```

3. Keep Termux running and open **http://127.0.0.1:43827** in Chrome or another Android browser on the same phone.
4. To stop the server, press `Ctrl+C` in Termux.

Alternative without npm:

```bash
node server.cjs
```

Then open the same local address. The game is browser-based; Termux runs only its local web server.

## Windows

### Method 1 — PowerShell launcher

Install Node.js 20+ (22 LTS recommended), open PowerShell in the project folder and run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Start.ps1
```

The launcher starts the local server and opens the browser. To start without opening a browser:

```powershell
.\Start.ps1 -NoBrowser
```

Stop it with:

```powershell
.\Stop.ps1
```

### Method 2 — Command Prompt

Double-click `Start.cmd`, or run it from Command Prompt. Stop with `Stop.cmd`.

### Method 3 — Node.js directly

```powershell
npm install
npm start
```

Open **http://127.0.0.1:43827**. Press `Ctrl+C` to stop.

## Linux

### Method 1 — npm

Install Node.js 20+ using your distribution's package manager or a Node.js version manager, then:

```bash
npm start
```

### Method 2 — start script

```bash
bash start.sh
```

Open **http://127.0.0.1:43827**. Stop with `bash stop.sh`.

### Method 3 — direct Node.js

```bash
node server.cjs
```

Press `Ctrl+C` to stop.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Change lane | A / D or ← / → | Swipe left / right |
| Jump | Space / ↑ / W | Swipe up |
| Slide | S / ↓ | Swipe down |
| Hoverboard | B | Double tap |
| Pause | Esc | Pause button |
| Sound | M | Sound button |

## Notes

- The server binds to `127.0.0.1`; it is intended for local play on the same device.
- Best score and settings are stored in the browser's localStorage.
- The portable Windows Node.js binary previously used during development is intentionally not committed. Install Node.js normally instead.
- Screenshots and test reports may be added in a later documentation pass.
- See [THIRD-PARTY.md](THIRD-PARTY.md) for dependency and license information and [docs/LAUNCH_GUIDE_RU.md](docs/LAUNCH_GUIDE_RU.md) for the detailed Russian guide.
