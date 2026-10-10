# RPS — Codex Project Instructions

You are developing a game called **RPS**.

The repository should remain clean, modular, runnable, and easy to expand.

## Primary rules

- Keep the project runnable after every meaningful change.
- Do not remove working functionality unless explicitly requested.
- Do not rewrite large working systems unnecessarily.
- Prefer small reusable modules over giant files.
- Fix build errors before finishing a task.
- Fix obvious browser console errors before finishing a task.
- Keep gameplay constants easy to modify.
- Keep controls configurable.
- Avoid unnecessary dependencies.
- Preserve existing working behavior unless the requested feature requires changing it.

## Current technical baseline

The project currently uses:

- HTML
- CSS
- JavaScript
- Vite

You may introduce libraries or a game engine if there is a strong technical reason, but do not add dependencies simply for convenience.

## Recommended long-term structure

As the project grows, prefer a structure similar to:

```text
src/
  main.js
  style.css

  game/
    Game.js
    config.js
    state.js

    core/
      Input.js
      Time.js
      Audio.js
      Camera.js

    entities/
      Player.js
      Enemy.js
      Projectile.js

    systems/
      CombatSystem.js
      CollisionSystem.js
      SaveSystem.js

    scenes/
      MainMenuScene.js
      GameScene.js
      PauseScene.js

    ui/
      HUD.js
      Menu.js

  assets/
    images/
    audio/
    fonts/
```

Do not create empty architecture purely for appearance.

Only add folders and abstractions when the game actually needs them.

## Gameplay implementation guidance

When implementing gameplay:

- Keep input separate from game logic.
- Keep rendering separate from state where practical.
- Use delta time for animation and movement.
- Avoid frame-rate-dependent movement.
- Avoid hardcoded magic numbers.
- Put tunable values in configuration objects.
- Prefer deterministic logic when possible.
- Avoid unnecessary global state.

## Save systems

If a save system is added:

- Keep the format versioned.
- Handle missing fields safely.
- Avoid breaking previous saves when adding new fields.
- Store only data necessary to reconstruct the game state.

## UI

UI should be:

- clear
- responsive
- keyboard-friendly
- readable
- visually consistent

Avoid excessive effects that hurt readability.

## Performance

Before introducing complex optimization:

1. Confirm the issue exists.
2. Identify the real bottleneck.
3. Optimize the smallest relevant system.

Avoid premature optimization.

## Assets

When assets are introduced:

- keep filenames descriptive
- avoid duplicate files
- organize assets by type
- avoid unnecessarily large files
- prefer web-friendly formats

## Before completing any Codex task

Always check:

1. Does the app start?
2. Does the requested feature work?
3. Are there console errors?
4. Does `npm run build` succeed?
5. Did the change break an existing feature?
6. Does the README need updating?

## Required build check

Run:

```bash
npm install
npm run build
```

The task should not be considered complete while the build is failing.

## Important

The project direction will evolve through future prompts.

Do not invent major game mechanics, story, monetization, multiplayer architecture, or backend infrastructure unless the user asks for them.
