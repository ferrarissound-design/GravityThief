import './style.css';
import { Game } from './game/Game.js';

const game = new Game(document.querySelector('#game'));
game.start();
