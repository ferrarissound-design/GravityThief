export const CONFIG = {
  player: {
    size: [0.75, 1.45, 0.72],
    speed: 5.1,
    sprintSpeed: 7.2,
    acceleration: 9,
    deceleration: 15,
    turnAcceleration: 13,
    jumpSpeed: 7.1,
    gravity: 24,
  },
  camera: {
    fov: 58,
    near: 0.1,
    far: 90,
    lookAtHeight: 0.36,
    heightOffset: { comfort: 1.35, standard: 1.05 },
    distance: {
      comfortDesktop: 8.1,
      comfortMobile: 8.7,
      standardDesktop: 7.6,
      standardMobile: 8.1,
    },
    pitch: {
      min: -0.2,
      max: 0.9,
      comfortMinimum: 0.22,
    },
    sensitivity: {
      mouse: {
        comfort: { yaw: 0.0042, pitch: 0.0027 },
        standard: { yaw: 0.0048, pitch: 0.0031 },
      },
      touch: {
        comfort: { yaw: 0.0028, pitch: 0.00175 },
        standard: { yaw: 0.0035, pitch: 0.0022 },
      },
      scale: { low: 0.76, normal: 1, high: 1.22 },
    },
    follow: {
      horizontalComfort: 9,
      horizontalStandard: 11,
      verticalComfort: 2.4,
      verticalStandard: 4,
      verticalDeadZoneComfort: 0.58,
      verticalDeadZoneStandard: 0.34,
    },
    collision: {
      padding: 0.42,
      minDistance: 2.35,
      approachSpeed: 11,
      returnSpeedComfort: 2.15,
      returnSpeedStandard: 3.2,
    },
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
    motionComfort: 'gravityThiefMotionComfort',
    cameraSensitivity: 'gravityThiefCameraSensitivity',
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
