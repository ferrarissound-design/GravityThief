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

export function createPlayer(scene, world, material) {
  const [w, h, d] = CONFIG.player.size;
  const group = new THREE.Group();
  group.name = 'player';

  const cream = new THREE.MeshStandardMaterial({ color: 0xfff5dc, roughness: 0.72 });
  const warmWhite = new THREE.MeshStandardMaterial({ color: 0xfffbef, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x28364a, roughness: 0.6 });
  const eye = new THREE.MeshStandardMaterial({ color: 0x59d9ff, emissive: 0x1687a8, emissiveIntensity: 0.9 });
  const joint = new THREE.MeshStandardMaterial({ color: 0xe8b85a, roughness: 0.55 });

  group.add(part(new THREE.BoxGeometry(0.72, 0.72, 0.58), cream, [0, 0.06, 0]));
  group.add(part(new THREE.SphereGeometry(0.31, 20, 14), warmWhite, [0, 0.57, 0]));
  group.add(part(new THREE.BoxGeometry(0.12, 0.075, 0.035), eye, [-0.1, 0.59, 0.335]));
  group.add(part(new THREE.BoxGeometry(0.12, 0.075, 0.035), eye, [0.1, 0.59, 0.335]));
  group.add(part(new THREE.BoxGeometry(0.18, 0.5, 0.18), cream, [-0.49, 0.02, 0]));
  group.add(part(new THREE.BoxGeometry(0.18, 0.5, 0.18), cream, [0.49, 0.02, 0]));
  group.add(part(new THREE.BoxGeometry(0.22, 0.42, 0.23), cream, [-0.2, -0.52, 0]));
  group.add(part(new THREE.BoxGeometry(0.22, 0.42, 0.23), cream, [0.2, -0.52, 0]));
  group.add(part(new THREE.CylinderGeometry(0.09, 0.09, 0.13, 12), joint, [0, 0.78, 0]));
  group.position.set(...CONFIG.player.spawn);
  scene.add(group);

  const body = new CANNON.Body({
    mass: 5,
    material,
    shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)),
    position: new CANNON.Vec3(...CONFIG.player.spawn),
    fixedRotation: true,
    linearDamping: 0.12,
  });
  body.updateMassProperties();
  world.addBody(body);

  return { group, body, halfHeight: h / 2 };
}
