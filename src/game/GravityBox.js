import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG, GRAVITY_DIRECTIONS } from './config.js';

export class GravityBox {
  constructor(scene, world, material) {
    this.scene = scene;
    this.world = world;
    this.size = CONFIG.box.size;
    this.gravityDirection = new CANNON.Vec3(0, -1, 0);
    this.directionId = 'down';
    this.stolen = false;
    this.particles = [];

    this.group = new THREE.Group();
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(this.size, this.size, this.size),
      new THREE.MeshStandardMaterial({ color: 0xf4a252, roughness: 0.42, metalness: 0.06 }),
    );
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.geometry.translate(0, 0, 0);
    this.group.add(cube);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(cube.geometry),
      new THREE.LineBasicMaterial({ color: 0x8f522f, transparent: true, opacity: 0.72 }),
    );
    this.group.add(edges);

    this.arrow = new THREE.Group();
    const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0x12b8a6, emissive: 0x086d66, emissiveIntensity: 0.5 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.72, 12), arrowMaterial);
    shaft.position.y = 0.36;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 16), arrowMaterial);
    head.position.y = 0.88;
    this.arrow.add(shaft, head);
    this.arrow.position.y = this.size * 0.7;
    this.group.add(this.arrow);

    this.halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.055, 10, 40),
      new THREE.MeshBasicMaterial({ color: 0x8ef7ed, transparent: true, opacity: 0.82 }),
    );
    this.halo.rotation.x = Math.PI / 2;
    this.halo.position.y = this.size * 0.83;
    this.halo.visible = false;
    this.group.add(this.halo);

    this.group.position.set(...CONFIG.box.spawn);
    scene.add(this.group);

    this.body = new CANNON.Body({
      mass: CONFIG.box.mass,
      material,
      shape: new CANNON.Box(new CANNON.Vec3(this.size / 2, this.size / 2, this.size / 2)),
      position: new CANNON.Vec3(...CONFIG.box.spawn),
      linearDamping: CONFIG.box.linearDamping,
      angularDamping: CONFIG.box.angularDamping,
    });
    world.addBody(this.body);
    this.updateArrow();
  }

  applyGravity() {
    if (!this.gravityDirection) return;
    const force = CONFIG.box.mass * CONFIG.box.gravity;
    this.body.applyForce(this.gravityDirection.scale(force));
  }

  steal() {
    if (!this.gravityDirection) return false;
    this.gravityDirection = null;
    this.directionId = null;
    this.stolen = true;
    this.body.velocity.scale(0.15, this.body.velocity);
    this.body.angularVelocity.scale(0.15, this.body.angularVelocity);
    this.updateArrow();
    this.burst(0x7ff3e5);
    return true;
  }

  setGravity(id) {
    const direction = GRAVITY_DIRECTIONS.find((item) => item.id === id);
    if (!direction) return;
    this.gravityDirection = new CANNON.Vec3(...direction.vector);
    this.directionId = id;
    this.stolen = false;
    this.body.wakeUp();
    this.updateArrow();
    this.burst(0xffd177);
  }

  updateArrow() {
    this.arrow.visible = Boolean(this.gravityDirection);
    this.halo.visible = !this.gravityDirection;
    if (this.gravityDirection) {
      const up = new THREE.Vector3(0, 1, 0);
      const target = new THREE.Vector3(this.gravityDirection.x, this.gravityDirection.y, this.gravityDirection.z);
      this.arrow.quaternion.setFromUnitVectors(up, target.normalize());
    }
  }

  burst(color) {
    const material = new THREE.PointsMaterial({ color, size: 0.12, transparent: true, opacity: 1, depthWrite: false });
    const positions = [];
    const velocities = [];
    for (let i = 0; i < 34; i += 1) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(1.2 + Math.random() * 2.4);
      positions.push(0, 0, 0);
      velocities.push(v);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, material);
    points.position.copy(this.group.position);
    this.scene.add(points);
    this.particles.push({ points, velocities, age: 0 });
  }

  update(delta) {
    this.group.position.copy(this.body.position);
    this.group.quaternion.copy(this.body.quaternion);
    this.halo.rotation.z += delta * 0.8;
    const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.08;
    this.arrow.scale.setScalar(pulse);

    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      particle.age += delta;
      const array = particle.points.geometry.attributes.position.array;
      particle.velocities.forEach((velocity, index) => {
        velocity.multiplyScalar(0.96);
        array[index * 3] += velocity.x * delta;
        array[index * 3 + 1] += velocity.y * delta;
        array[index * 3 + 2] += velocity.z * delta;
      });
      particle.points.geometry.attributes.position.needsUpdate = true;
      particle.points.material.opacity = Math.max(0, 1 - particle.age / 0.75);
      if (particle.age > 0.75) {
        this.scene.remove(particle.points);
        particle.points.geometry.dispose();
        particle.points.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  reset() {
    this.body.position.set(...CONFIG.box.spawn);
    this.body.quaternion.set(0, 0, 0, 1);
    this.body.velocity.setZero();
    this.body.angularVelocity.setZero();
    this.gravityDirection = new CANNON.Vec3(0, -1, 0);
    this.directionId = 'down';
    this.stolen = false;
    this.updateArrow();
    this.update(0);
  }
}
