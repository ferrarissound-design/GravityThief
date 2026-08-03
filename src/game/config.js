export const CONFIG = {
  player: {
    size: [0.75, 1.45, 0.72],
    speed: 5.1,
    sprintSpeed: 7.2,
    acceleration: 13,
    jumpSpeed: 7.1,
    gravity: 24,
  },
  box: {
    mass: 7,
    gravity: 19,
    interactionDistance: 6.8,
    linearDamping: 0.38,
    angularDamping: 0.64,
  },
  storage: {
    currentStage: 'gravityThiefCurrentStage',
    highestStage: 'gravityThiefHighestStage',
    repeatHintSeen: 'gravityThiefRepeatHintSeen',
  },
};

// Directions are fixed to room coordinates and never rotate with the camera.
export const GRAVITY_DIRECTIONS = [
  { id: 'down', label: '床へ', short: '床', key: '1', vector: [0, -1, 0], surface: 'floor' },
  { id: 'up', label: '天井へ', short: '天井', key: '2', vector: [0, 1, 0], surface: 'ceiling' },
  { id: 'left', label: '左の壁へ', short: '左', key: '3', vector: [-1, 0, 0], surface: 'left' },
  { id: 'right', label: '右の壁へ', short: '右', key: '4', vector: [1, 0, 0], surface: 'right' },
  { id: 'back', label: '奥の壁へ', short: '奥', key: '5', vector: [0, 0, -1], surface: 'back' },
  { id: 'front', label: '手前の壁へ', short: '手前', key: '6', vector: [0, 0, 1], surface: 'front' },
];
