import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export function createBlock(parent, world, physicsMaterial, definition, registerBody) {
  const { size, position } = definition;
  const material = new THREE.MeshStandardMaterial({
    color: definition.color,
    roughness: definition.roughness ?? 0.82,
    transparent: Boolean(definition.glass) || definition.opacity !== undefined,
    opacity: definition.glass ? 0.34 : (definition.opacity ?? 1),
    depthWrite: !definition.glass,
    emissive: 0x000000,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = definition.id ?? 'stage-block';
  mesh.position.set(...position);
  mesh.receiveShadow = true;
  mesh.castShadow = Boolean(definition.castShadow ?? !definition.glass);
  parent.add(mesh);

  const body = new CANNON.Body({
    mass: 0,
    material: physicsMaterial,
    type: definition.kinematic ? CANNON.Body.KINEMATIC : CANNON.Body.STATIC,
    shape: new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)),
    position: new CANNON.Vec3(...position),
  });
  world.addBody(body);
  registerBody(body);
  return { mesh, body };
}

export function createRoom(parent, world, physicsMaterial, stage, registerBody) {
  const { width: w, height: h, depth: d } = stage.room;
  const t = 0.35;
  const palette = stage.palette;
  const definitions = {
    floor: { id: 'floor', size: [w, t, d], position: [0, -t / 2, 0], color: palette.floor },
    ceiling: { id: 'ceiling', size: [w, t, d], position: [0, h + t / 2, 0], color: palette.ceiling, opacity: 0.44 },
    left: { id: 'left-wall', size: [t, h, d], position: [-w / 2 - t / 2, h / 2, 0], color: palette.wall },
    right: { id: 'right-wall', size: [t, h, d], position: [w / 2 + t / 2, h / 2, 0], color: palette.wall },
    back: { id: 'back-wall', size: [w, h, t], position: [0, h / 2, -d / 2 - t / 2], color: palette.wall },
    front: { id: 'front-wall', size: [w, h, t], position: [0, h / 2, d / 2 + t / 2], color: palette.wall },
  };

  const surfaces = Object.fromEntries(Object.entries(definitions).map(([id, definition]) => [
    id,
    createBlock(parent, world, physicsMaterial, definition, registerBody),
  ]));

  const grid = new THREE.GridHelper(w, Math.max(16, Math.round(w)), palette.grid, palette.grid);
  grid.name = 'floor-grid';
  grid.position.y = 0.012;
  grid.material.transparent = true;
  grid.material.opacity = stage.id === 5 ? 0.34 : 0.48;
  parent.add(grid);

  return { ...surfaces, grid };
}
