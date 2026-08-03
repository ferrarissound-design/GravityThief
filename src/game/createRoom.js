import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js';

function addBlock(scene, world, size, position, color, physicsMaterial, options = {}) {
  const geometry = new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.82,
    transparent: options.opacity !== undefined,
    opacity: options.opacity ?? 1,
  }));
  mesh.position.set(...position);
  mesh.receiveShadow = true;
  mesh.castShadow = Boolean(options.castShadow);
  scene.add(mesh);

  const body = new CANNON.Body({
    mass: 0,
    material: physicsMaterial,
    type: options.kinematic ? CANNON.Body.KINEMATIC : CANNON.Body.STATIC,
    shape: new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)),
    position: new CANNON.Vec3(...position),
  });
  world.addBody(body);
  return { mesh, body };
}

export function createRoom(scene, world, physicsMaterial) {
  const { width: w, height: h, depth: d, wallThickness: t } = CONFIG.room;
  const floor = addBlock(scene, world, [w, t, d], [0, -t / 2, 0], 0xf7edcf, physicsMaterial);
  const ceiling = addBlock(scene, world, [w, t, d], [0, h + t / 2, 0], 0xf2e6c9, physicsMaterial, { opacity: 0.36 });
  const left = addBlock(scene, world, [t, h, d], [-w / 2 - t / 2, h / 2, 0], 0xd9a483, physicsMaterial);
  const right = addBlock(scene, world, [t, h, d], [w / 2 + t / 2, h / 2, 0], 0xd9a483, physicsMaterial);
  const back = addBlock(scene, world, [w, h, t], [0, h / 2, -d / 2 - t / 2], 0xdca887, physicsMaterial);
  const front = addBlock(scene, world, [w, h, t], [0, h / 2, d / 2 + t / 2], 0xdca887, physicsMaterial);

  const grid = new THREE.GridHelper(w, 18, 0xd6bb88, 0xe9d9b5);
  grid.position.y = 0.012;
  scene.add(grid);

  // A low pedestal makes the first gravity theft easy to read.
  const pedestal = addBlock(scene, world, [2.8, 1.18, 2.8], [0, 0.59, 3.4], 0xc6d6dd, physicsMaterial, { castShadow: true });

  // Partition the goal room while leaving a central doorway.
  const doorZ = CONFIG.door.position[2];
  const openingWidth = CONFIG.door.size[0];
  const sideWidth = (w - openingWidth) / 2;
  addBlock(scene, world, [sideWidth, h, 0.46], [-(openingWidth + sideWidth) / 2, h / 2, doorZ], 0xe1b08e, physicsMaterial);
  addBlock(scene, world, [sideWidth, h, 0.46], [(openingWidth + sideWidth) / 2, h / 2, doorZ], 0xe1b08e, physicsMaterial);
  addBlock(scene, world, [openingWidth, 1.0, 0.46], [0, h - 0.5, doorZ], 0xe1b08e, physicsMaterial);

  const door = addBlock(scene, world, CONFIG.door.size, CONFIG.door.position, 0x6e8b9b, physicsMaterial, {
    roughness: 0.45,
    castShadow: true,
    kinematic: true,
  });
  const doorPanel = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.18, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x95e4db, emissive: 0x30877f, emissiveIntensity: 0.5 }),
  );
  doorPanel.position.set(0, 0.65, 0.24);
  door.mesh.add(doorPanel);

  return { floor, ceiling, left, right, back, front, pedestal, door };
}
