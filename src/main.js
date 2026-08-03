import './style.css';
import { Game } from './game/Game.js';

const game = new Game(document.querySelector('#game'));
game.start();

if (import.meta.env.DEV) window.__gravityThief = game;
