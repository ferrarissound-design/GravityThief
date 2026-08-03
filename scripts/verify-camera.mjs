import * as THREE from 'three';
import { ComfortCamera, normalizeCameraSettings } from '../src/game/ComfortCamera.js';
import { CONFIG } from '../src/game/config.js';
import { Game } from '../src/game/Game.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const stage = { camera: { yaw: 0, pitch: 0.16, distance: 6.5 } };
const player = new THREE.Vector3(0, 0.8, 0);
const camera = new THREE.PerspectiveCamera();
const rig = new ComfortCamera(camera, true);
rig.setSettings({ motionComfort: true, sensitivity: 'low' });
rig.reset(stage, player, []);

let state = rig.getState();
assert(state.fov === 58, 'Camera FOV must remain fixed at 58');
assert(state.pitch >= CONFIG.camera.pitch.comfortMinimum, 'Comfort pitch should start above the minimum');
assert(state.armLength >= 8, 'Mobile comfort camera should use a longer arm');
assert(camera.position.y - state.target.y >= 3, 'Comfort camera should sit at least 3m above its target');
assert(Math.abs(state.roll) < 1e-8, 'Camera roll must stay at zero');

rig.applyLook({ x: 80, y: 24 }, { x: 0, y: 0 });
const yawAfterInput = rig.yaw;
const pitchAfterInput = rig.pitch;
for (let index = 0; index < 30; index += 1) {
  rig.applyLook({ x: 0, y: 0 }, { x: 0, y: 0 });
  rig.update(player, 1 / 60);
}
assert(rig.yaw === yawAfterInput && rig.pitch === pitchAfterInput, 'Camera rotation continued after input stopped');
assert(Math.abs(camera.rotation.z) < 1e-8, 'Camera accumulated roll after updates');

const targetBeforeJump = rig.target.y;
rig.update(new THREE.Vector3(0, 1.8, 0), 1 / 60);
assert(rig.target.y - targetBeforeJump < 0.08, 'A single jump frame moved the camera target too much');

rig.applyLook({ x: 0, y: 100000 }, { x: 0, y: 0 });
assert(rig.pitch <= CONFIG.camera.pitch.max, 'Pitch exceeded its upper limit');
rig.applyLook({ x: 0, y: -100000 }, { x: 0, y: 0 });
assert(rig.pitch >= CONFIG.camera.pitch.min, 'Pitch exceeded its lower limit');

const wall = new THREE.Mesh(new THREE.BoxGeometry(8, 10, 0.4), new THREE.MeshBasicMaterial());
wall.position.set(0, 4, 4);
wall.updateMatrixWorld(true);
const collisionCamera = new THREE.PerspectiveCamera();
const collisionRig = new ComfortCamera(collisionCamera, true);
collisionRig.setSettings({ motionComfort: true, sensitivity: 'low' });
collisionRig.reset(stage, player, [wall]);
const blockedLength = collisionRig.armLength;
const idealLength = collisionRig.getIdealOffsetLength();
assert(blockedLength < idealLength, 'Wall raycast did not shorten the camera arm');
collisionRig.setColliders([]);
collisionRig.update(player, 1 / 60);
assert(collisionRig.armLength > blockedLength, 'Camera did not start returning after leaving a wall');
assert(collisionRig.armLength < idealLength, 'Camera returned to full distance in one frame');
wall.geometry.dispose();
wall.material.dispose();

assert(CONFIG.camera.sensitivity.touch.comfort.yaw <= 0.003, 'Mobile comfort yaw sensitivity is too high');
assert(CONFIG.camera.sensitivity.touch.comfort.pitch < CONFIG.camera.sensitivity.touch.comfort.yaw, 'Vertical touch sensitivity should be lower than horizontal');
assert(CONFIG.camera.sensitivity.mouse.comfort.yaw < 0.006, 'Mouse comfort sensitivity was not reduced');
assert(normalizeCameraSettings(null, true).sensitivity === 'low', 'Touch default sensitivity should be low');
assert(normalizeCameraSettings(null, true).motionComfort, 'Motion Comfort should default to ON');

function makeStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    values,
  };
}

globalThis.localStorage = makeStorage();
let settings = Game.prototype.readCameraSettings.call({ isTouchDevice: true });
assert(settings.motionComfort && settings.sensitivity === 'low', 'Missing mobile settings did not use comfort defaults');

globalThis.localStorage = makeStorage({
  gravityThiefMotionComfort: '0',
  gravityThiefCameraSensitivity: 'high',
});
settings = Game.prototype.readCameraSettings.call({ isTouchDevice: true });
assert(!settings.motionComfort && settings.sensitivity === 'high', 'Saved camera settings did not reload');

const storage = makeStorage();
globalThis.localStorage = storage;
Game.prototype.saveCameraSettings.call({ cameraSettings: { motionComfort: true, sensitivity: 'normal' } });
assert(storage.values.get('gravityThiefMotionComfort') === '1', 'Motion Comfort setting was not saved');
assert(storage.values.get('gravityThiefCameraSensitivity') === 'normal', 'Camera sensitivity was not saved');

console.log('Camera comfort, collision, input-stop, roll, jump damping, and storage checks: OK');
