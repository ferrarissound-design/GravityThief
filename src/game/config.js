export const CONFIG = {
  room: { width: 18, height: 8, depth: 22, wallThickness: 0.35 },
  player: {
    spawn: [0, 0.8, 5.5],
    size: [0.75, 1.45, 0.72],
    speed: 5.1,
    sprintSpeed: 7.2,
    acceleration: 13,
    jumpSpeed: 7.1,
    gravity: 24,
  },
  box: {
    spawn: [0, 2.15, 3.4],
    size: 1.35,
    mass: 7,
    gravity: 19,
    interactionDistance: 4,
    linearDamping: 0.38,
    angularDamping: 0.64,
  },
  switch: { position: [7.05, 0.12, 3.4], size: [2.15, 0.22, 2.15] },
  door: { position: [0, 1.75, -5.1], size: [3.35, 3.5, 0.42] },
  goal: { position: [0, 0.06, -8.8], radius: 1.65 },
};

export const GRAVITY_DIRECTIONS = [
  { id: 'down', label: '床へ', short: '床', key: '1', vector: [0, -1, 0] },
  { id: 'up', label: '天井へ', short: '天井', key: '2', vector: [0, 1, 0] },
  { id: 'left', label: '左の壁へ', short: '左', key: '3', vector: [-1, 0, 0] },
  { id: 'right', label: '右の壁へ', short: '右', key: '4', vector: [1, 0, 0] },
  { id: 'back', label: '奥の壁へ', short: '奥', key: '5', vector: [0, 0, -1] },
  { id: 'front', label: '手前の壁へ', short: '手前', key: '6', vector: [0, 0, 1] },
];
