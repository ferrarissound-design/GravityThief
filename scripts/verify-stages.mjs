import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Game } from '../src/game/Game.js';
import { STAGE_COUNT, STAGE_DEFINITIONS } from '../src/game/stages/stageDefinitions.js';
import { loadStage } from '../src/game/stages/stageLoader.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeWorld() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0) });
  const floor = new CANNON.Material('room');
  const player = new CANNON.Material('player');
  const box = new CANNON.Material('box');
  return { world, materials: { floor, player, box } };
}

assert(STAGE_COUNT === 5, `Expected 5 stages, received ${STAGE_COUNT}`);
assert(new Set(STAGE_DEFINITIONS.map((stage) => stage.name)).size === 5, 'Stage names must be unique');
assert(new Set(STAGE_DEFINITIONS.map((stage) => stage.palette.background)).size === 5, 'Every stage needs a distinct palette');
assert(
  STAGE_DEFINITIONS.map((stage) => stage.name).join('|') === 'はじめの一歩|壁をこえろ|重力の曲がり角|ふたつの重力|重力コア',
  'Campaign order must stay fixed from easiest to hardest',
);
assert(
  STAGE_DEFINITIONS.map((stage) => stage.boxes.length).join(',') === '1,1,1,2,2',
  'Campaign complexity must increase from single-box to multi-box stages',
);

const scene = new THREE.Scene();
const { world, materials } = makeWorld();

for (const stage of STAGE_DEFINITIONS) {
  const runtime = loadStage({
    scene,
    world,
    stage,
    physicsMaterials: materials,
    onBoxImpact: () => {},
  });

  assert(runtime.boxes.length === stage.boxes.length, `Stage ${stage.id}: box count mismatch`);
  assert(runtime.switches.length === stage.switches.length, `Stage ${stage.id}: switch count mismatch`);
  assert(runtime.doors.length === stage.doors.length, `Stage ${stage.id}: door count mismatch`);
  assert(runtime.bodies.length === world.bodies.length, `Stage ${stage.id}: body tracking mismatch`);
  stage.doors.forEach((door) => door.requires.forEach((switchId) => {
    assert(stage.switches.some((item) => item.id === switchId), `Stage ${stage.id}: door references missing switch ${switchId}`);
  }));

  runtime.switches.forEach((switchState, index) => {
    const box = runtime.boxes[index % runtime.boxes.length];
    box.body.position.set(switchState.position[0], box.size / 2 + 0.18, switchState.position[2]);
    box.body.velocity.setZero();
  });

  const gameState = {
    stage,
    runtime,
    boxes: runtime.boxes,
    switches: runtime.switches,
    doors: runtime.doors,
    player: runtime.player,
    ui: { toast() {}, showClear() {}, setStealState() {} },
    clear: false,
    freePlay: false,
    currentStageIndex: stage.id - 1,
    highestStage: stage.id,
    saveProgress() {},
    vibrate() {},
  };

  Game.prototype.updateSwitches.call(gameState, 0.2);
  Game.prototype.updateDoors.call(gameState, 0.2);
  assert(runtime.switches.every((item) => item.active), `Stage ${stage.id}: switch activation failed`);
  assert(runtime.doors.every((item) => item.open), `Stage ${stage.id}: door rule failed`);

  runtime.boxes.forEach((box) => box.body.position.set(0, stage.room.height - 1, 0));
  Game.prototype.updateSwitches.call(gameState, 0.35);
  Game.prototype.updateDoors.call(gameState, 0.2);
  if (stage.id === 4) {
    assert(runtime.switches.every((item) => !item.active), 'Stage 4: hold switches did not release');
    assert(runtime.doors.every((item) => !item.open), 'Stage 4: door did not close after hold switches released');
  }
  if (stage.id === 5) {
    assert(runtime.switches[0].active, 'Stage 5: latch switch did not stay active');
    assert(!runtime.switches[1].active, 'Stage 5: hold switch did not release');
    assert(runtime.doors[0].open && !runtime.doors[1].open, 'Stage 5: middle/final gate rules are incorrect');
  }

  runtime.player.body.position.set(stage.goal.position[0], 0.8, stage.goal.position[2]);
  Game.prototype.updateGoal.call(gameState, 1 / 60);
  assert(gameState.clear, `Stage ${stage.id}: goal did not clear`);

  runtime.dispose();
  assert(world.bodies.length === 0, `Stage ${stage.id}: physics bodies leaked after dispose`);
  assert(scene.children.length === 0, `Stage ${stage.id}: Three.js objects leaked after dispose`);
  console.log(`Stage ${stage.id}: OK`);
}

console.log('All five stages passed load, rule, goal, and cleanup checks.');

function makeStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

globalThis.localStorage = makeStorage();
let progress = Game.prototype.readProgress.call({ saveProgress: Game.prototype.saveProgress });
assert(progress.current === 1 && progress.highest === 1, 'Empty progress should start at stage 1');

globalThis.localStorage = makeStorage({ gravityThiefHighestStage: '4' });
progress = Game.prototype.readProgress.call({ saveProgress: Game.prototype.saveProgress });
assert(progress.current === 4 && progress.highest === 4, 'Highest stage should be a valid resume point');

globalThis.localStorage = makeStorage({ gravityThiefCurrentStage: 'broken', gravityThiefHighestStage: '99' });
progress = Game.prototype.readProgress.call({ saveProgress: Game.prototype.saveProgress });
assert(progress.current === 1 && progress.highest === 1, 'Corrupt progress should recover to stage 1');
console.log('Progress storage recovery: OK');
