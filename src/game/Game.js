import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG, GRAVITY_DIRECTIONS } from './config.js';
import { createRoom } from './createRoom.js';
import { createPlayer } from './createPlayer.js';
import { GravityBox } from './GravityBox.js';
import { InputController } from './InputController.js';
import { TouchControls } from './TouchControls.js';
import { UIController } from './UIController.js';

export class Game {
  constructor(container) {
    this.container = container;
    this.fixedStep = 1 / 60;
    this.maxSubSteps = 4;
    this.lastTime = performance.now() / 1000;
    this.cameraYaw = 0;
    this.cameraPitch = 0.16;
    this.cameraDistance = 6.5;
    this.doorOpen = false;
    this.clear = false;
    this.freePlay = false;
    this.switchPressed = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xccefff);
    this.scene.fog = new THREE.Fog(0xccefff, 18, 36);

    const viewport = this.getViewportSize();
    this.camera = new THREE.PerspectiveCamera(58, viewport.width / viewport.height, 0.1, 80);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(viewport.width, viewport.height, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.appendChild(this.renderer.domElement);

    this.setupLighting();
    this.setupPhysics();
    this.room = createRoom(this.scene, this.world, this.floorMaterial);
    this.player = createPlayer(this.scene, this.world, this.playerMaterial);
    this.box = new GravityBox(this.scene, this.world, this.boxMaterial);
    this.createSwitch();
    this.createGoal();

    this.input = new InputController(this.renderer.domElement);
    this.ui = new UIController(container, {
      reset: () => this.reset(),
      chooseGravity: (id) => this.chooseGravity(id),
    });
    this.touch = new TouchControls(container);

    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { this.lastTime = performance.now() / 1000; });
    this.reset();
  }

  setupLighting() {
    this.scene.add(new THREE.HemisphereLight(0xf7fcff, 0xc69568, 2.25));
    const sun = new THREE.DirectionalLight(0xfff0d2, 3.1);
    sun.position.set(-8, 13, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -14;
    sun.shadow.camera.right = 14;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 36;
    this.scene.add(sun);
  }

  setupPhysics() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.floorMaterial = new CANNON.Material('room');
    this.playerMaterial = new CANNON.Material('player');
    this.boxMaterial = new CANNON.Material('gravity-box');
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.floorMaterial, this.playerMaterial, { friction: 0.12, restitution: 0 }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.floorMaterial, this.boxMaterial, { friction: 0.34, restitution: 0.04 }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.playerMaterial, this.boxMaterial, { friction: 0.18, restitution: 0 }));
  }

  createSwitch() {
    const [x, y, z] = CONFIG.switch.position;
    const [w, h, d] = CONFIG.switch.size;
    this.switchGroup = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.58, w * 0.64, 0.18, 28),
      new THREE.MeshStandardMaterial({ color: 0xa94b3d, roughness: 0.62 }),
    );
    base.receiveShadow = true;
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.5, w * 0.54, h, 28),
      new THREE.MeshStandardMaterial({ color: 0xff6a4d, emissive: 0x7f1c12, emissiveIntensity: 0.22, roughness: 0.45 }),
    );
    plate.name = 'switchPlate';
    plate.position.y = 0.15;
    plate.castShadow = true;
    this.switchGroup.add(base, plate);
    this.switchGroup.position.set(x, y, z);
    this.scene.add(this.switchGroup);
    this.switchPlate = plate;
  }

  createGoal() {
    const [x, y, z] = CONFIG.goal.position;
    const ringMaterial = new THREE.MeshStandardMaterial({ color: 0xffd56b, emissive: 0xb77919, emissiveIntensity: 0.72, roughness: 0.35 });
    this.goalGroup = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(CONFIG.goal.radius, CONFIG.goal.radius, 0.08, 48), new THREE.MeshStandardMaterial({ color: 0xffed9c, emissive: 0x90711e, emissiveIntensity: 0.4, transparent: true, opacity: 0.9 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(CONFIG.goal.radius * 0.72, 0.13, 14, 48), ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.14;
    this.goalBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.35, 3.7, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xffedab, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }));
    this.goalBeam.position.y = 1.85;
    this.goalGroup.add(disc, ring, this.goalBeam);
    this.goalGroup.position.set(x, y, z);
    this.scene.add(this.goalGroup);
  }

  start() {
    this.renderer.setAnimationLoop(() => this.tick());
  }

  tick() {
    const now = performance.now() / 1000;
    const delta = Math.min(0.05, now - this.lastTime);
    this.lastTime = now;

    this.handleInput();
    this.applyPlayerMovement(delta);
    this.box.applyGravity();
    this.world.step(this.fixedStep, delta, this.maxSubSteps);
    this.syncObjects(delta);
    this.updateSwitch(delta);
    this.updateDoor(delta);
    this.updateGoal(delta);
    this.updateCamera(delta);
    this.updateInteraction();
    this.checkBounds();
    this.renderer.render(this.scene, this.camera);
  }

  handleInput() {
    const lookA = this.input.consumeLook();
    const lookB = this.touch.consumeLook();
    this.cameraYaw -= (lookA.x + lookB.x) * 0.006;
    this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + (lookA.y + lookB.y) * 0.004, -0.08, 0.78);

    if (this.input.consumeAction('KeyR')) this.reset();
    if (this.input.consumeAction('Escape')) {
      this.ui.showPicker(false);
      this.container.querySelector('[data-help]').classList.add('hidden');
    }
    if (this.input.consumeAction('KeyE') || this.touch.consumeAction('steal')) this.trySteal();
    if (this.input.consumeAction('Space') || this.touch.consumeAction('jump')) this.tryJump();

    GRAVITY_DIRECTIONS.forEach((direction) => {
      if (this.input.consumeAction(`Digit${direction.key}`) || this.input.consumeAction(`Numpad${direction.key}`)) {
        if (this.box.stolen) this.chooseGravity(direction.id);
      }
    });
  }

  applyPlayerMovement(delta) {
    if (this.clear && !this.freePlay) return;
    const keyboard = this.input.getMovement();
    const moveX = THREE.MathUtils.clamp(keyboard.x + this.touch.move.x, -1, 1);
    const moveY = THREE.MathUtils.clamp(keyboard.y + this.touch.move.y, -1, 1);
    const length = Math.hypot(moveX, moveY);
    const speed = keyboard.sprint ? CONFIG.player.sprintSpeed : CONFIG.player.speed;
    const forward = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    const desired = forward.multiplyScalar(moveY).add(right.multiplyScalar(moveX));
    if (length > 1) desired.normalize();
    desired.multiplyScalar(speed);
    const blend = 1 - Math.exp(-CONFIG.player.acceleration * delta);
    this.player.body.velocity.x = THREE.MathUtils.lerp(this.player.body.velocity.x, desired.x, blend);
    this.player.body.velocity.z = THREE.MathUtils.lerp(this.player.body.velocity.z, desired.z, blend);
    this.player.body.applyForce(new CANNON.Vec3(0, -this.player.body.mass * CONFIG.player.gravity, 0));

    if (desired.lengthSq() > 0.08) {
      const targetYaw = Math.atan2(desired.x, desired.z);
      let diff = targetYaw - this.player.group.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.player.group.rotation.y += diff * Math.min(1, delta * 12);
    }
  }

  isGrounded() {
    const from = this.player.body.position.vadd(new CANNON.Vec3(0, 0.04, 0));
    const to = this.player.body.position.vadd(new CANNON.Vec3(0, -this.player.halfHeight - 0.2, 0));
    const result = new CANNON.RaycastResult();
    this.world.raycastClosest(from, to, { skipBackfaces: true, collisionFilterMask: 1 }, result);
    return result.hasHit;
  }

  tryJump() {
    if ((this.clear && !this.freePlay) || !this.isGrounded()) return;
    this.player.body.velocity.y = CONFIG.player.jumpSpeed;
    this.player.body.wakeUp();
  }

  trySteal() {
    if ((this.clear && !this.freePlay) || this.distanceToBox() > CONFIG.box.interactionDistance) return;
    if (!this.box.gravityDirection) {
      this.ui.toast('この箱はもう無重力だ', 'soft');
      return;
    }
    if (this.box.steal()) {
      this.ui.updateStatus(this.box.directionId, this.box.stolen);
      this.ui.toast('重力を盗んだ！', 'teal');
      window.setTimeout(() => this.ui.showPicker(true), 240);
    }
  }

  chooseGravity(id) {
    if (!this.box.stolen) return;
    const direction = GRAVITY_DIRECTIONS.find((item) => item.id === id);
    this.box.setGravity(id);
    this.ui.showPicker(false);
    this.ui.updateStatus(this.box.directionId, this.box.stolen);
    this.ui.toast(`${direction.label} 重力をセット`, 'gold');
  }

  distanceToBox() {
    return this.player.body.position.distanceTo(this.box.body.position);
  }

  syncObjects(delta) {
    this.player.group.position.copy(this.player.body.position);
    // Keep the visual robot upright while the collider remains fixed.
    const visualYaw = this.player.group.rotation.y;
    this.player.group.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), visualYaw);
    this.box.update(delta);
  }

  updateSwitch(delta) {
    if (this.switchPressed) return;
    const box = this.box.body.position;
    const [x, , z] = CONFIG.switch.position;
    const horizontal = Math.hypot(box.x - x, box.z - z);
    const onPlate = horizontal < 1.38 && box.y < 1.25;
    if (!onPlate) return;
    this.switchPressed = true;
    this.doorOpen = true;
    this.switchPlate.position.y = 0.04;
    this.switchPlate.material.color.set(0x78d987);
    this.switchPlate.material.emissive.set(0x227b3b);
    this.ui.toast('扉が開いた！', 'green');
  }

  updateDoor(delta) {
    const targetY = this.doorOpen ? CONFIG.room.height + 1.5 : CONFIG.door.position[1];
    const current = this.room.door.body.position.y;
    const next = THREE.MathUtils.damp(current, targetY, 4.2, delta);
    this.room.door.body.position.y = next;
    this.room.door.body.velocity.setZero();
    this.room.door.body.aabbNeedsUpdate = true;
    this.room.door.mesh.position.y = next;
  }

  updateGoal(delta) {
    this.goalGroup.rotation.y += delta * 0.48;
    this.goalBeam.material.opacity = 0.12 + Math.sin(performance.now() * 0.003) * 0.04;
    if (this.clear || !this.doorOpen) return;
    const [x, , z] = CONFIG.goal.position;
    const player = this.player.body.position;
    if (Math.hypot(player.x - x, player.z - z) < CONFIG.goal.radius && player.y < 2.5) {
      this.clear = true;
      this.freePlay = false;
      this.ui.showClear(true);
    }
  }

  updateCamera(delta) {
    const target = new THREE.Vector3(this.player.body.position.x, this.player.body.position.y + 0.28, this.player.body.position.z);
    const horizontal = Math.cos(this.cameraPitch) * this.cameraDistance;
    const desired = new THREE.Vector3(
      target.x + Math.sin(this.cameraYaw) * horizontal,
      target.y + Math.sin(this.cameraPitch) * this.cameraDistance + 0.65,
      target.z + Math.cos(this.cameraYaw) * horizontal,
    );
    const roomLimitX = CONFIG.room.width / 2 - 0.45;
    const roomLimitZ = CONFIG.room.depth / 2 - 0.45;
    desired.x = THREE.MathUtils.clamp(desired.x, -roomLimitX, roomLimitX);
    desired.y = THREE.MathUtils.clamp(desired.y, 0.55, CONFIG.room.height - 0.35);
    desired.z = THREE.MathUtils.clamp(desired.z, -roomLimitZ, roomLimitZ);
    const smooth = 1 - Math.exp(-8 * delta);
    this.camera.position.lerp(desired, smooth);
    this.camera.lookAt(target);
  }

  updateInteraction() {
    const close = this.distanceToBox() <= CONFIG.box.interactionDistance;
    this.ui.showInteraction(close && !this.box.stolen && Boolean(this.box.gravityDirection) && !this.clear);
  }

  checkBounds() {
    const player = this.player.body.position;
    const box = this.box.body.position;
    if (player.y < -5 || Math.abs(player.x) > 20 || Math.abs(player.z) > 25 || box.y < -8 || Math.abs(box.x) > 24 || Math.abs(box.z) > 28) {
      this.reset();
    }
  }

  reset() {
    this.clear = false;
    this.freePlay = false;
    this.doorOpen = false;
    this.switchPressed = false;
    this.player.body.position.set(...CONFIG.player.spawn);
    this.player.body.velocity.setZero();
    this.player.body.angularVelocity.setZero();
    this.player.group.position.set(...CONFIG.player.spawn);
    this.box.reset();
    this.room.door.body.position.set(...CONFIG.door.position);
    this.room.door.body.velocity.setZero();
    this.room.door.mesh.position.set(...CONFIG.door.position);
    this.switchPlate.position.y = 0.15;
    this.switchPlate.material.color.set(0xff6a4d);
    this.switchPlate.material.emissive.set(0x7f1c12);
    this.ui?.reset();
    this.ui?.updateStatus(this.box.directionId, this.box.stolen);
  }

  resize() {
    const viewport = this.getViewportSize();
    this.camera.aspect = viewport.width / viewport.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(viewport.width, viewport.height, false);
  }

  getViewportSize() {
    const bounds = this.container.getBoundingClientRect();
    return {
      width: Math.max(1, Math.round(bounds.width)),
      height: Math.max(1, Math.round(bounds.height)),
    };
  }
}
