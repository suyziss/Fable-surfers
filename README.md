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

---

# 🇷🇺 Русская версия

**Fable Surfers** — оригинальная 3D-игра в жанре endless runner, работающая в браузере. Уклоняйся от поездов и препятствий, прыгай, скользи, собирай монеты и используй бонусы.

## ✨ Возможности

- Три игровые полосы, прыжки, подкат и смена полос.
- Процедурная генерация игрового мира.
- Поезда, рампы, препятствия и монеты.
- Магнит и ховерборд.
- Сохранение рекордов в браузере.
- Клавиатура и сенсорное управление.
- Локальный запуск без аккаунтов и API-ключей.

## 📱 Android — Termux

Установи Termux, затем выполни:

```bash
pkg update && pkg upgrade
pkg install git nodejs-lts
git clone https://github.com/suyziss/Fable-surfers.git
cd Fable-surfers
npm start
```

Открой браузер на телефоне и перейди по адресу:

**http://127.0.0.1:43827**

Оставь Termux работающим во время игры. Для остановки сервера нажми `Ctrl+C`.

Альтернативный запуск:

```bash
node server.cjs
```

## 🪟 Windows

Требуется Node.js 20 или новее.

**1. PowerShell:**

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Start.ps1
```

Остановка:

```powershell
.\Stop.ps1
```

**2. Через CMD:** запусти `Start.cmd`. Для остановки — `Stop.cmd`.

**3. Напрямую через Node.js:**

```powershell
node server.cjs
```

**4. Через npm:**

```powershell
npm start
```

Затем открой **http://127.0.0.1:43827**. При ручном запуске остановка — `Ctrl+C`.

## 🐧 Linux

Требуется Node.js 20 или новее.

**1. Через npm:**

```bash
npm start
```

**2. Через скрипт запуска:**

```bash
bash start.sh
```

Остановка:

```bash
bash stop.sh
```

**3. Напрямую через Node.js:**

```bash
node server.cjs
```

Открой **http://127.0.0.1:43827**. При ручном запуске нажми `Ctrl+C` для остановки.

## 🎮 Управление

| Действие | Клавиатура | Телефон |
|---|---|---|
| Смена полосы | A / D или ← / → | Свайп влево / вправо |
| Прыжок | Space / ↑ / W | Свайп вверх |
| Подкат | S / ↓ | Свайп вниз |
| Ховерборд | B | Кнопка на экране |
| Пауза | Esc | Кнопка паузы |
| Звук | M | Кнопка звука |

## 📖 Подробная инструкция

[Открыть руководство по запуску на Android, Windows и Linux](https://github.com/suyziss/Fable-surfers/blob/main/docs/LAUNCH_GUIDE_RU.md)

## 🔗 Ссылки

- [GitHub — исходный код Fable Surfers](https://github.com/suyziss/Fable-surfers)
- [Сообщить об ошибке](https://github.com/suyziss/Fable-surfers/issues)
- [Скачать проект ZIP-архивом](https://github.com/suyziss/Fable-surfers/archive/refs/heads/main.zip)

---

*Fable Surfers — самостоятельный проект, вдохновлённый жанром бесконечных раннеров. Не является официальной игрой Subway Surfers.*
