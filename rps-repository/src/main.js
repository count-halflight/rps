import './style.css';
import { Game } from './game/Game.js';

const app = document.querySelector('#app');

if (!app) {
  throw new Error('Unable to find #app root element.');
}

const game = new Game(app);
game.start();
