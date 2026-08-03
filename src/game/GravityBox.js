import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG, GRAVITY_DIRECTIONS } from './config.js';

export class GravityBox {
  constructor(parent, world, physicsMaterial, definition, palette, onImpact) {
    this.parent = parent;
    this.world = world;
    this.id = definition.id;
    this.spawn = [...definition.position];
    this.size = definition.size;
    this.palette = palette;
    this.gravityDirection = new CANNON.Vec3(0, -1, 0);
    this.directionId = definition.gravity ?? 'down';
    this.stolen = false;
    this.particles = [];
    this.targeted = false;
    this.hintPulse = 0;
    this.directionEffectTime = 0;
    this.squashTime = 0;
    this.lastImpactAt = -Infinity;

    this.group = new THREE.Group();
    this.group.name = definition.id;
    this.visual = new THREE.Group();
    this.cubeMaterial = new THREE.MeshStandardMaterial({
      color: definition.color ?? palette.box,
      roughness: 0.42,
      metalness: 0.06,
      emissive: palette.gravity,
      emissiveIntensity: 0,
    });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(this.size, this.size, this.size), this.cubeMaterial);
    cube.castShadow = true;
    cube.receiveShadow = true;
    this.visual.add(cube);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(cube.geometry),
      new THREE.LineBasicMaterial({ color: palette.gravity, transparent: true, opacity: 0.68 }),
    );
    this.visual.add(edges);
    this.group.add(this.visual);

    this.arrow = this.createArrow(1.28, palette.gravity, 0.13, 0.27);
    this.arrow.position.y = this.size * 0.7;
    this.group.add(this.arrow);

    this.halo = new THREE.Mesh(
      new THREE.TorusGeometry(this.size * 0.68, 0.055, 10, 40),
      new THREE.MeshBasicMaterial({ color: palette.gravity, transparent: true, opacity: 0.82 }),
    );
    this.halo.rotation.x = Math.PI / 2;
    this.halo.position.y = this.size * 0.83;
    this.halo.visible = false;
    this.group.add(this.halo);

    this.targetRing = new THREE.Mesh(
      new THREE.TorusGeometry(this.size * 0.82, 0.065, 10, 48),
      new THREE.MeshBasicMaterial({ color: palette.gravity, transparent: true, opacity: 0.88, depthWrite: false }),
    );
    this.targetRing.rotation.x = Math.PI / 2;
    this.targetRing.position.y = -this.size * 0.58;
    this.targetRing.visible = false;
    this.group.add(this.targetRing);

    this.previewArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 3.5, palette.gravity, 0.55, 0.3);
    this.previewArrow.visible = false;
    this.group.add(this.previewArrow);

    this.effectArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 3.1, palette.gravity, 0.55, 0.3);
    this.effectArrow.visible = false;
    this.group.add(this.effectArrow);

    this.effectRing = new THREE.Mesh(
      new THREE.TorusGeometry(this.size * 0.72, 0.075, 10, 48),
      new THREE.MeshBasicMaterial({ color: palette.gravity, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.effectRing.rotation.x = Math.PI / 2;
    this.group.add(this.effectRing);

    this.group.position.set(...this.spawn);
    parent.add(this.group);

    this.body = new CANNON.Body({
      mass: definition.mass ?? CONFIG.box.mass,
      material: physicsMaterial,
      shape: new CANNON.Box(new CANNON.Vec3(this.size / 2, this.size / 2, this.size / 2)),
      position: new CANNON.Vec3(...this.spawn),
      linearDamping: CONFIG.box.linearDamping,
      angularDamping: CONFIG.box.angularDamping,
    });
    world.addBody(this.body);

    this.onCollide = (event) => {
      const impact = Math.abs(event.contact?.getImpactVelocityAlongNormal?.() ?? 0);
      const now = performance.now();
      if (impact < 4.2 || now - this.lastImpactAt < 360) return;
      this.lastImpactAt = now;
      this.squashTime = 0.2;
      this.burst(palette.gravity, 14);
      onImpact?.(this, impact);
    };
    this.body.addEventListener('collide', this.onCollide);
    this.updateArrow();
  }

  createArrow(length, color, shaftRadius, headRadius) {
    const arrow = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.48 });
    const shaftLength = length * 0.62;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius * 0.55, shaftRadius * 0.55, shaftLength, 12), material);
    shaft.position.y = shaftLength / 2;
    const head = new THREE.Mesh(new THREE.ConeGeometry(headRadius, length * 0.34, 16), material);
    head.position.y = shaftLength + length * 0.17;
    arrow.add(shaft, head);
    return arrow;
  }

  applyGravity() {
    if (!this.gravityDirection) return;
    const force = this.body.mass * CONFIG.box.gravity;
    this.body.applyForce(this.gravityDirection.scale(force));
  }

  steal(targetPosition) {
    if (!this.gravityDirection) return false;
    this.gravityDirection = null;
    this.directionId = null;
    this.stolen = true;
    this.body.velocity.scale(0.15, this.body.velocity);
    this.body.angularVelocity.scale(0.15, this.body.angularVelocity);
    this.updateArrow();
    this.burst(this.palette.gravity, 28);
    if (targetPosition) this.absorbToward(targetPosition);
    return true;
  }

  setGravity(id) {
    const direction = GRAVITY_DIRECTIONS.find((item) => item.id === id);
    if (!direction) return false;
    this.gravityDirection = new CANNON.Vec3(...direction.vector);
    this.directionId = id;
    this.stolen = false;
    this.body.wakeUp();
    this.updateArrow();
    this.triggerDirectionEffect(direction.vector);
    this.burst(this.palette.gravity, 24, direction.vector);
    return true;
  }

  setTargeted(active) {
    this.targeted = active;
    this.targetRing.visible = active || this.hintPulse > 0;
    this.cubeMaterial.emissiveIntensity = active ? 0.2 : 0;
  }

  showPreview(vector) {
    this.previewArrow.setDirection(new THREE.Vector3(...vector).normalize());
    this.previewArrow.visible = true;
  }

  hidePreview() {
    this.previewArrow.visible = false;
  }

  pulseHint() {
    this.hintPulse = 1.6;
    this.targetRing.visible = true;
  }

  isAtCeiling(roomHeight) {
    const restingHeight = roomHeight - this.size / 2;
    return this.body.position.y >= restingHeight - 0.35;
  }

  updateArrow() {
    this.arrow.visible = Boolean(this.gravityDirection);
    this.halo.visible = !this.gravityDirection;
    if (!this.gravityDirection) return;
    const up = new THREE.Vector3(0, 1, 0);
    const target = new THREE.Vector3(this.gravityDirection.x, this.gravityDirection.y, this.gravityDirection.z).normalize();
    this.arrow.quaternion.setFromUnitVectors(up, target);
  }

  triggerDirectionEffect(vector) {
    this.directionEffectTime = 0.46;
    this.effectArrow.setDirection(new THREE.Vector3(...vector).normalize());
    this.effectArrow.visible = true;
    this.effectRing.material.opacity = 0.8;
    this.effectRing.scale.setScalar(0.45);
  }

  burst(color, count = 24, bias = null) {
    const material = new THREE.PointsMaterial({ color, size: 0.12, transparent: true, opacity: 1, depthWrite: false });
    const positions = [];
    const velocities = [];
    const biasVector = bias ? new THREE.Vector3(...bias).normalize().multiplyScalar(2.1) : null;
    for (let i = 0; i < count; i += 1) {
      const velocity = new THREE.Vector3().randomDirection().multiplyScalar(1 + Math.random() * 2);
      if (biasVector) velocity.add(biasVector);
      positions.push(0, 0, 0);
      velocities.push(velocity);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, material);
    points.position.copy(this.group.position);
    this.parent.add(points);
    this.particles.push({ points, velocities, age: 0, duration: 0.72 });
  }

  absorbToward(targetPosition) {
    const material = new THREE.PointsMaterial({ color: this.palette.gravity, size: 0.14, transparent: true, opacity: 0.95, depthWrite: false });
    const positions = [];
    const velocities = [];
    const start = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
    const target = new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z);
    const direction = target.sub(start);
    for (let i = 0; i < 18; i += 1) {
      positions.push((Math.random() - 0.5) * this.size, (Math.random() - 0.5) * this.size, (Math.random() - 0.5) * this.size);
      velocities.push(direction.clone().multiplyScalar(0.85 + Math.random() * 0.4));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, material);
    points.position.copy(start);
    this.parent.add(points);
    this.particles.push({ points, velocities, age: 0, duration: 0.55 });
  }

  update(delta) {
    this.group.position.copy(this.body.position);
    this.group.quaternion.copy(this.body.quaternion);
    this.halo.rotation.z += delta * 0.8;
    this.targetRing.rotation.z += delta * 0.9;
    const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.08;
    this.arrow.scale.setScalar(pulse);
    if (this.targeted || this.hintPulse > 0) this.targetRing.scale.setScalar(pulse);

    if (this.hintPulse > 0) {
      this.hintPulse -= delta;
      this.targetRing.visible = true;
      this.cubeMaterial.emissiveIntensity = 0.25 + Math.sin(performance.now() * 0.02) * 0.12;
      if (this.hintPulse <= 0) this.setTargeted(this.targeted);
    }

    if (this.directionEffectTime > 0) {
      this.directionEffectTime -= delta;
      const progress = 1 - Math.max(0, this.directionEffectTime) / 0.46;
      this.effectRing.scale.setScalar(0.45 + progress * 2.4);
      this.effectRing.material.opacity = (1 - progress) * 0.8;
      if (this.directionEffectTime <= 0) this.effectArrow.visible = false;
    }

    if (this.squashTime > 0) {
      this.squashTime -= delta;
      const amount = Math.sin(Math.max(0, this.squashTime) / 0.2 * Math.PI) * 0.12;
      this.visual.scale.set(1 + amount * 0.45, 1 - amount, 1 + amount * 0.45);
    } else {
      this.visual.scale.set(1, 1, 1);
    }

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
      particle.points.material.opacity = Math.max(0, 1 - particle.age / particle.duration);
      if (particle.age > particle.duration) this.removeParticle(i);
    }
  }

  removeParticle(index) {
    const particle = this.particles[index];
    this.parent.remove(particle.points);
    particle.points.geometry.dispose();
    particle.points.material.dispose();
    this.particles.splice(index, 1);
  }

  clearEffects() {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) this.removeParticle(index);
    this.hidePreview();
    this.directionEffectTime = 0;
    this.effectArrow.visible = false;
    this.effectRing.material.opacity = 0;
    this.squashTime = 0;
    this.visual.scale.set(1, 1, 1);
    this.hintPulse = 0;
    this.setTargeted(false);
  }

  reset() {
    this.clearEffects();
    this.body.position.set(...this.spawn);
    this.body.quaternion.set(0, 0, 0, 1);
    this.body.velocity.setZero();
    this.body.angularVelocity.setZero();
    this.gravityDirection = new CANNON.Vec3(0, -1, 0);
    this.directionId = 'down';
    this.stolen = false;
    this.updateArrow();
    this.update(0);
  }

  dispose() {
    this.body.removeEventListener('collide', this.onCollide);
    this.clearEffects();
  }
}
