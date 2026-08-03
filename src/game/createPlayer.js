import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js';

function part(geometry, material, position, castShadow = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

export function createPlayer(parent, world, physicsMaterial, definition, palette) {
  const [w, h, d] = CONFIG.player.size;
  const group = new THREE.Group();
  group.name = 'player';

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: palette.robot, roughness: 0.72 });
  const faceMaterial = new THREE.MeshStandardMaterial({ color: palette.robotFace ?? palette.robot, roughness: 0.58 });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: palette.eye, emissive: palette.eye, emissiveIntensity: 0.82 });
  const jointMaterial = new THREE.MeshStandardMaterial({ color: palette.joint ?? palette.gravity, roughness: 0.55 });

  group.add(part(new THREE.BoxGeometry(0.72, 0.72, 0.58), bodyMaterial, [0, 0.06, 0]));
  group.add(part(new THREE.SphereGeometry(0.31, 20, 14), faceMaterial, [0, 0.57, 0]));
  group.add(part(new THREE.BoxGeometry(0.12, 0.075, 0.035), eyeMaterial, [-0.1, 0.59, 0.335]));
  group.add(part(new THREE.BoxGeometry(0.12, 0.075, 0.035), eyeMaterial, [0.1, 0.59, 0.335]));
  group.add(part(new THREE.BoxGeometry(0.18, 0.5, 0.18), bodyMaterial, [-0.49, 0.02, 0]));
  group.add(part(new THREE.BoxGeometry(0.18, 0.5, 0.18), bodyMaterial, [0.49, 0.02, 0]));
  group.add(part(new THREE.BoxGeometry(0.22, 0.42, 0.23), bodyMaterial, [-0.2, -0.52, 0]));
  group.add(part(new THREE.BoxGeometry(0.22, 0.42, 0.23), bodyMaterial, [0.2, -0.52, 0]));
  group.add(part(new THREE.CylinderGeometry(0.09, 0.09, 0.13, 12), jointMaterial, [0, 0.78, 0]));
  group.position.set(...definition.spawn);
  parent.add(group);

  const body = new CANNON.Body({
    mass: 5,
    material: physicsMaterial,
    collisionFilterGroup: 2,
    collisionFilterMask: -1,
    shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)),
    position: new CANNON.Vec3(...definition.spawn),
    fixedRotation: true,
    linearDamping: 0.12,
  });
  body.updateMassProperties();
  world.addBody(body);

  return { group, body, halfHeight: h / 2, spawn: [...definition.spawn] };
}
