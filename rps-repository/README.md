# RPS

RPS is a game project being developed with the help of Codex.

This repository contains a lightweight browser-game starter architecture using JavaScript and Vite.

## Current status

Initial project scaffold.

The starter currently includes:

- Vite development environment
- modular game bootstrap
- basic game state
- configurable game settings
- responsive starter interface
- GitHub Actions build verification
- Codex development instructions

## Requirements

Install:

- Node.js 22 or newer
- npm

## Setup

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/rps.git
```

Enter the folder:

```bash
cd rps
```

Install dependencies:

```bash
npm install
```

Start development mode:

```bash
npm run dev
```

Vite will display the local development URL, usually:

```text
http://localhost:5173
```

## Production build

```bash
npm run build
```

The production output is generated inside:

```text
dist/
```

## Preview production build

```bash
npm run preview
```

## Current controls

| Control | Action |
|---|---|
| Enter | Primary action |
| Escape | Pause / resume |

These are temporary starter controls and can be replaced when the real game mechanics are defined.

## Project structure

```text
src/
  main.js
  style.css

  game/
    Game.js
    config.js
    state.js
```

## Codex

Read `CODEX.md` before making major changes with Codex.

## GitHub Actions

Every push to `main` and every pull request to `main` runs:

```bash
npm ci
npm run build
```

This verifies that the project still builds successfully.
