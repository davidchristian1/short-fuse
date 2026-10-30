import './style.css';
import { GAME_CONFIG } from './config/gameConfig';
import { createGame } from './game/createGame';

document.title = GAME_CONFIG.title;
if (window.matchMedia('(pointer: coarse)').matches) document.documentElement.classList.add('coarse');

const canvasHost = document.getElementById('game');
canvasHost?.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

createGame();
