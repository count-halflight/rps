import { GAME_CONFIG } from './config.js';
import { createInitialState } from './state.js';

export class Game {
  constructor(rootElement) {
    this.root = rootElement;
    this.state = createInitialState();

    this.handleStartClick = this.handleStartClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  start() {
    this.render();
    this.bindEvents();
  }

  bindEvents() {
    const startButton = this.root.querySelector('[data-action="start"]');
    startButton?.addEventListener('click', this.handleStartClick);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  handleStartClick() {
    this.state.started = true;
    this.state.message = 'RPS is ready for its first gameplay system.';
    this.render();
  }

  handleKeyDown(event) {
    if (event.key === GAME_CONFIG.controls.primaryAction) {
      this.state.started = true;
      this.state.message = 'Primary action triggered.';
      this.render();
    }

    if (event.key === GAME_CONFIG.controls.secondaryAction) {
      this.state.paused = !this.state.paused;
      this.state.message = this.state.paused ? 'Paused' : 'Resumed';
      this.render();
    }
  }

  render() {
    this.root.innerHTML = `
      <main class="game-shell">
        <section class="game-card">
          <p class="eyebrow">GAME PROJECT</p>

          <h1>${GAME_CONFIG.title}</h1>

          <p class="version">v${GAME_CONFIG.version}</p>

          <p class="status">
            ${this.state.message || GAME_CONFIG.defaultMessage}
          </p>

          <div class="game-meta">
            <div class="meta-item">
              <span class="meta-label">Status</span>
              <strong>${this.state.started ? 'Started' : 'Waiting'}</strong>
            </div>

            <div class="meta-item">
              <span class="meta-label">Level</span>
              <strong>${this.state.level}</strong>
            </div>

            <div class="meta-item">
              <span class="meta-label">Score</span>
              <strong>${this.state.score}</strong>
            </div>
          </div>

          <button type="button" data-action="start">
            ${this.state.started ? 'Restart' : 'Start'}
          </button>

          <p class="hint">
            Enter = primary action · Escape = pause
          </p>
        </section>
      </main>
    `;

    this.root
      .querySelector('[data-action="start"]')
      ?.addEventListener('click', this.handleStartClick);
  }
}
