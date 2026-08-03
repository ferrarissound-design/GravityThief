import * as THREE from 'three';
import { createRoom, createBlock } from '../createRoom.js';
import { createPlayer } from '../createPlayer.js';
import { GravityBox } from '../GravityBox.js';
import { GRAVITY_DIRECTIONS } from '../config.js';

function createSwitch(parent, definition, palette) {
  const [w, h, d] = definition.size;
  const group = new THREE.Group();
  group.name = definition.id;
  group.position.set(...definition.position);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(w * 0.58, w * 0.64, 0.18, 28),
    new THREE.MeshStandardMaterial({ color: '#A94B3D', roughness: 0.62 }),
  );
  base.receiveShadow = true;
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(w * 0.5, Math.min(w, d) * 0.54, h, 28),
    new THREE.MeshStandardMaterial({ color: palette.switch, emissive: palette.switch, emissiveIntensity: 0.18, roughness: 0.45 }),
  );
  plate.name = `${definition.id}-plate`;
  plate.position.y = 0.15;
  plate.castShadow = true;
  const pulseRing = new THREE.Mesh(
    new THREE.TorusGeometry(w * 0.58, 0.055, 10, 42),
    new THREE.MeshBasicMaterial({ color: palette.gravity, transparent: true, opacity: 0, depthWrite: false }),
  );
  pulseRing.rotation.x = Math.PI / 2;
  pulseRing.position.y = 0.2;
  group.add(base, plate, pulseRing);
  parent.add(group);

  return {
    ...definition,
    group,
    plate,
    pulseRing,
    active: false,
    dwell: 0,
    release: 0,
    pulse: 0,
  };
}

function createDoor(parent, world, physicsMaterial, definition, palette, registerBody) {
  const block = createBlock(parent, world, physicsMaterial, {
    ...definition,
    color: definition.color ?? palette.door,
    roughness: 0.45,
    castShadow: true,
    kinematic: true,
  }, registerBody);
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(Math.min(1.15, definition.size[0] * 0.4), 0.18, 0.055),
    new THREE.MeshStandardMaterial({ color: palette.gravity, emissive: palette.gravity, emissiveIntensity: 0.54 }),
  );
  panel.position.set(0, definition.size[1] * 0.18, definition.size[2] / 2 + 0.035);
  block.mesh.add(panel);
  const closedPosition = [...definition.position];
  const openPosition = definition.openPosition ?? [definition.position[0], definition.position[1] + definition.size[1] + 2.2, definition.position[2]];
  return { ...definition, ...block, closedPosition, openPosition, open: false, announced: false };
}

function createGoal(parent, definition, palette) {
  const group = new THREE.Group();
  group.name = 'goal';
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(definition.radius, definition.radius, 0.08, 42),
    new THREE.MeshStandardMaterial({ color: palette.goal, emissive: palette.goal, emissiveIntensity: 0.34, transparent: true, opacity: 0.9 }),
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(definition.radius * 0.72, 0.13, 12, 44),
    new THREE.MeshStandardMaterial({ color: palette.goal, emissive: palette.goal, emissiveIntensity: 0.72, roughness: 0.35 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.14;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(definition.radius * 0.42, definition.radius * 0.82, 3.7, 28, 1, true),
    new THREE.MeshBasicMaterial({ color: palette.goal, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 1.85;
  group.add(disc, ring, beam);
  group.position.set(...definition.position);
  parent.add(group);
  return { group, ring, beam, ...definition };
}

function disposeObjectTree(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.filter(Boolean).forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

export function loadStage({ scene, world, stage, physicsMaterials, onBoxImpact }) {
  const root = new THREE.Group();
  root.name = `stage-${stage.id}`;
  scene.add(root);
  const bodies = [];
  const registerBody = (body) => bodies.push(body);

  const room = createRoom(root, world, physicsMaterials.floor, stage, registerBody);
  const obstacles = stage.obstacles.map((definition) => createBlock(root, world, physicsMaterials.floor, {
    ...definition,
    color: definition.color ?? stage.palette.obstacle,
  }, registerBody));
  const player = createPlayer(root, world, physicsMaterials.player, stage.player, stage.palette);
  registerBody(player.body);
  const boxes = stage.boxes.map((definition) => {
    const box = new GravityBox(root, world, physicsMaterials.box, definition, stage.palette, onBoxImpact);
    registerBody(box.body);
    return box;
  });
  const switches = stage.switches.map((definition) => createSwitch(root, definition, stage.palette));
  const doors = stage.doors.map((definition) => createDoor(root, world, physicsMaterials.floor, definition, stage.palette, registerBody));
  const goal = createGoal(root, stage.goal, stage.palette);

  if (stage.id === 5) {
    const coreLightA = new THREE.PointLight(stage.palette.gravity, 18, 16, 2);
    coreLightA.position.set(-6, 5.5, 4);
    const coreLightB = new THREE.PointLight(stage.palette.goal, 14, 14, 2);
    coreLightB.position.set(6, 4.5, -5);
    root.add(coreLightA, coreLightB);
  }

  const clearPreview = () => {
    Object.values(room).forEach((surface) => {
      if (!surface?.mesh?.material?.emissive) return;
      surface.mesh.material.emissive.set(0x000000);
      surface.mesh.material.emissiveIntensity = 0;
    });
    boxes.forEach((box) => box.hidePreview());
  };

  const previewDirection = (directionId, box) => {
    clearPreview();
    const direction = GRAVITY_DIRECTIONS.find((item) => item.id === directionId);
    if (!direction || !box) return;
    box.showPreview(direction.vector);
    const surface = room[direction.surface];
    if (surface?.mesh?.material?.emissive) {
      surface.mesh.material.emissive.set(stage.palette.gravity);
      surface.mesh.material.emissiveIntensity = 0.46;
    }
  };

  const dispose = () => {
    clearPreview();
    boxes.forEach((box) => box.dispose());
    bodies.forEach((body) => world.removeBody(body));
    scene.remove(root);
    disposeObjectTree(root);
  };

  return { root, bodies, room, obstacles, player, boxes, switches, doors, goal, previewDirection, clearPreview, dispose };
}
