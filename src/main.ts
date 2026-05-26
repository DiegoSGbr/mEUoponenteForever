import './style.css';
import { Game } from './game/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const uiRoot = document.querySelector<HTMLElement>('#ui-root');

if (!canvas || !uiRoot) {
  throw new Error('Canvas ou UI root não encontrados.');
}

const game = new Game(canvas, uiRoot);
game.init();
