import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG, GRAVITY_DIRECTIONS } from './config.js';
import { InputController } from './InputController.js';
import { TouchControls } from './TouchControls.js';
import { UIController } from './UIController.js';
import { ComfortCamera, normalizeCameraSettings } from './ComfortCamera.js';
import { getStageDefinition, STAGE_COUNT } from './stages/stageDefinitions.js';
import { loadStage } from './stages/stageLoader.js';

export class Game {
  constructor(container) {
    this.container = container;
    this.fixedStep = 1 / 60;
    this.maxSubSteps = 4;
    this.lastTime = performance.now() / 1000;
    this.stageTimers = new Set();
    this.transitioning = false;
    this.clear = false;
    this.freePlay = false;
    this.activeBox = null;
    this.heldBox = null;
    this.lastStatusKey = '';
    this.repeatHintArmed = false;
    this.repeatHintBox = null;
    this.repeatHintDelay = 0;
    this.isTouchDevice = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    this.cameraSettings = this.readCameraSettings();
    this.pickerOpen = false;
    this.settingsOpen = false;

    this.moveForward = new THREE.Vector3();
    this.moveRight = new THREE.Vector3();
    this.desiredMovement = new THREE.Vector3();
    this.playerDownForce = new CANNON.Vec3();

    this.scene = new THREE.Scene();
    const viewport = this.getViewportSize();
    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, viewport.width / viewport.height, CONFIG.camera.near, CONFIG.camera.far);
    this.comfortCamera = new ComfortCamera(this.camera, this.isTouchDevice);
    this.comfortCamera.setSettings(this.cameraSettings);
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
    this.input = new InputController(this.renderer.domElement);
    this.ui = new UIController(container, {
      reset: () => this.resetCurrentStage(),
      nextStage: () => this.nextStage(),
      restartAll: () => this.transitionToStage(0),
      freePlay: () => this.enableFreePlay(),
      chooseGravity: (id) => this.chooseGravity(id),
      previewGravity: (id) => this.previewGravity(id),
      clearPreview: () => this.clearGravityPreview(),
      setMotionComfort: (enabled) => this.setMotionComfort(enabled),
      setCameraSensitivity: (value) => this.setCameraSensitivity(value),
      settingsVisibility: (show) => this.setSettingsVisibility(show),
    });
    this.touch = new TouchControls(container);
    this.ui.setCameraSettings(this.cameraSettings);
    this.saveCameraSettings();

    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { this.lastTime = performance.now() / 1000; });

    const progress = this.readProgress();
    this.highestStage = progress.highest;
    this.loadStage(progress.current - 1);
  }

  setupLighting() {
    this.hemisphere = new THREE.HemisphereLight(0xf7fcff, 0xc69568, 2.25);
    this.sun = new THREE.DirectionalLight(0xfff0d2, 3.1);
    this.sun.position.set(-8, 13, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1536, 1536);
    this.sun.shadow.camera.left = -15;
    this.sun.shadow.camera.right = 15;
    this.sun.shadow.camera.top = 15;
    this.sun.shadow.camera.bottom = -15;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 40;
    this.scene.add(this.hemisphere, this.sun);
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

  start() {
    this.renderer.setAnimationLoop(() => this.tick());
  }

  tick() {
    const now = performance.now() / 1000;
    const delta = Math.min(0.05, now - this.lastTime);
    this.lastTime = now;
    if (!this.runtime) return;

    this.updateBoxTarget();
    this.handleInput();
    this.applyPlayerMovement(delta);
    this.boxes.forEach((box) => box.applyGravity());
    this.world.step(this.fixedStep, delta, this.maxSubSteps);
    this.syncObjects(delta);
    this.updateSwitches(delta);
    this.updateDoors(delta);
    this.updateGoal(delta);
    this.updateCamera(delta);
    this.updateInteraction();
    this.updateRepeatHint(delta);
    this.checkBounds();
    this.renderer.render(this.scene, this.camera);
  }

  loadStage(index) {
    this.unloadStage();
    this.currentStageIndex = Math.min(STAGE_COUNT - 1, Math.max(0, index));
    this.stage = getStageDefinition(this.currentStageIndex);
    this.applyTheme(this.stage);
    this.runtime = loadStage({
      scene: this.scene,
      world: this.world,
      stage: this.stage,
      physicsMaterials: { floor: this.floorMaterial, player: this.playerMaterial, box: this.boxMaterial },
      onBoxImpact: (_box, impact) => this.onBoxImpact(impact),
    });
    this.player = this.runtime.player;
    this.boxes = this.runtime.boxes;
    this.switches = this.runtime.switches;
    this.doors = this.runtime.doors;
    this.clear = false;
    this.freePlay = false;
    this.activeBox = null;
    this.heldBox = null;
    this.lastStatusKey = '';
    this.repeatHintArmed = false;
    this.repeatHintBox = null;
    this.repeatHintDelay = 0;
    this.input.reset?.();
    this.touch.reset?.();
    this.pickerOpen = false;
    this.settingsOpen = false;
    this.facePlayerToward(this.stage.doors[0]?.position ?? this.stage.goal.position);
    this.runtime.root.updateMatrixWorld(true);
    this.comfortCamera.setSettings(this.cameraSettings);
    this.comfortCamera.reset(this.stage, this.player.body.position, this.runtime.cameraColliders);
    this.ui.resetTransient();
    this.ui.setStage(this.stage, STAGE_COUNT);
    this.ui.setCameraSettings(this.cameraSettings);
    this.ui.updateStatus(null, null);
    this.refreshCameraInputState();
    this.lastTime = performance.now() / 1000;

    this.highestStage = Math.max(this.highestStage ?? 1, this.stage.id);
    this.saveProgress(this.stage.id, this.highestStage);
  }

  unloadStage() {
    this.clearStageTimers();
    this.comfortCamera?.setColliders([]);
    this.runtime?.dispose();
    this.runtime = null;
    this.player = null;
    this.boxes = [];
    this.switches = [];
    this.doors = [];
  }

  transitionToStage(index) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.refreshCameraInputState();
    this.ui.showFade(true);
    window.setTimeout(() => {
      this.loadStage(index);
      requestAnimationFrame(() => {
        this.ui.showFade(false);
        window.setTimeout(() => {
          this.transitioning = false;
          this.refreshCameraInputState();
        }, 260);
      });
    }, 230);
  }

  nextStage() {
    if (this.currentStageIndex >= STAGE_COUNT - 1) return;
    this.transitionToStage(this.currentStageIndex + 1);
  }

  resetCurrentStage() {
    if (this.transitioning) return;
    this.transitionToStage(this.currentStageIndex);
  }

  handleInput() {
    const lookA = this.input.consumeLook();
    const lookB = this.touch.consumeLook();
    this.comfortCamera.applyLook(lookA, lookB, !this.isCameraInputEnabled());

    if (this.input.consumeAction('KeyR')) this.resetCurrentStage();
    if (this.input.consumeAction('Escape')) {
      this.showGravityPicker(false);
      this.ui.showSettings(false);
      this.clearGravityPreview();
      this.container.querySelector('[data-help]').classList.add('hidden');
    }
    if (this.input.consumeAction('KeyE') || this.touch.consumeAction('steal')) this.trySteal();
    if (this.input.consumeAction('Space') || this.touch.consumeAction('jump')) this.tryJump();

    GRAVITY_DIRECTIONS.forEach((direction) => {
      if (!this.heldBox) return;
      if (this.input.consumeAction(`Digit${direction.key}`) || this.input.consumeAction(`Numpad${direction.key}`)) {
        this.previewGravity(direction.id);
        this.setStageTimeout(() => this.chooseGravity(direction.id), 130);
      }
    });
  }

  applyPlayerMovement(delta) {
    if ((this.clear && !this.freePlay) || this.transitioning) return;
    const keyboard = this.input.getMovement();
    const moveX = THREE.MathUtils.clamp(keyboard.x + this.touch.move.x, -1, 1);
    const moveY = THREE.MathUtils.clamp(keyboard.y + this.touch.move.y, -1, 1);
    const length = Math.hypot(moveX, moveY);
    const speed = keyboard.sprint ? CONFIG.player.sprintSpeed : CONFIG.player.speed;
    const yaw = this.comfortCamera.yaw;
    this.moveForward.set(-Math.sin(yaw), 0, -Math.cos(yaw)).multiplyScalar(moveY);
    this.moveRight.set(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(moveX);
    this.desiredMovement.copy(this.moveForward).add(this.moveRight);
    if (length > 1) this.desiredMovement.normalize();
    this.desiredMovement.multiplyScalar(speed);

    const currentDotDesired = this.player.body.velocity.x * this.desiredMovement.x
      + this.player.body.velocity.z * this.desiredMovement.z;
    const response = length < 0.04
      ? CONFIG.player.deceleration
      : (currentDotDesired < -0.1 ? CONFIG.player.turnAcceleration : CONFIG.player.acceleration);
    this.player.body.velocity.x = THREE.MathUtils.damp(this.player.body.velocity.x, this.desiredMovement.x, response, delta);
    this.player.body.velocity.z = THREE.MathUtils.damp(this.player.body.velocity.z, this.desiredMovement.z, response, delta);
    this.playerDownForce.set(0, -this.player.body.mass * CONFIG.player.gravity, 0);
    this.player.body.applyForce(this.playerDownForce);

    const planarSpeedSq = this.player.body.velocity.x ** 2 + this.player.body.velocity.z ** 2;
    if (planarSpeedSq > 0.08) {
      const targetYaw = Math.atan2(this.player.body.velocity.x, this.player.body.velocity.z);
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
    if ((this.clear && !this.freePlay) || !this.activeBox || !this.activeBox.gravityDirection) return;
    this.heldBox = this.activeBox;
    if (!this.heldBox.steal(this.player.body.position)) return;
    this.ui.updateStatus(this.activeBox, this.heldBox);
    this.ui.bounceSteal();
    this.ui.toast('GRAVITY STOLEN!　重力をぬすんだ！', 'teal');
    this.vibrate(15);
    this.setStageTimeout(() => this.showGravityPicker(true), 180);
  }

  chooseGravity(id) {
    if (!this.heldBox) return;
    const box = this.heldBox;
    if (!box.setGravity(id)) return;
    const direction = GRAVITY_DIRECTIONS.find((item) => item.id === id);
    this.heldBox = null;
    this.showGravityPicker(false);
    this.clearGravityPreview();
    this.ui.updateStatus(box, null);
    this.ui.toast(`${direction.label} 重力を向けた！`, 'gold');
    this.vibrate(15);

    if (this.stage.id === 1 && !this.repeatHintWasSeen()) {
      this.repeatHintArmed = true;
      this.repeatHintBox = box;
      this.repeatHintDelay = 0.65;
    }
  }

  previewGravity(id) {
    if (!this.heldBox) return;
    this.runtime.previewDirection(id, this.heldBox);
  }

  clearGravityPreview() {
    this.runtime?.clearPreview();
  }

  showGravityPicker(show) {
    this.pickerOpen = show;
    if (show) this.touch?.reset();
    this.ui.showPicker(show);
    this.refreshCameraInputState();
  }

  setSettingsVisibility(show) {
    this.settingsOpen = show;
    if (show) {
      this.touch?.reset();
      this.input?.cancelLook();
    }
    this.refreshCameraInputState();
  }

  isCameraInputEnabled() {
    return !this.transitioning
      && !this.pickerOpen
      && !this.settingsOpen
      && (!this.clear || this.freePlay);
  }

  refreshCameraInputState() {
    const enabled = this.isCameraInputEnabled();
    this.input?.setCameraEnabled(enabled);
    this.touch?.setCameraEnabled(enabled);
  }

  setMotionComfort(enabled) {
    this.cameraSettings.motionComfort = Boolean(enabled);
    this.applyCameraSettings();
  }

  setCameraSensitivity(value) {
    this.cameraSettings = normalizeCameraSettings({
      ...this.cameraSettings,
      sensitivity: value,
    }, this.isTouchDevice);
    this.applyCameraSettings();
  }

  applyCameraSettings() {
    this.comfortCamera.setSettings(this.cameraSettings);
    this.ui.setCameraSettings(this.cameraSettings);
    this.saveCameraSettings();
  }

  updateBoxTarget() {
    if (!this.player || !this.boxes.length) return;
    const previous = this.activeBox;
    if (this.heldBox) {
      this.activeBox = this.heldBox;
    } else {
      const playerPosition = this.player.body.position;
      const candidates = this.boxes.map((box) => {
        const distance = box.body.position.distanceTo(playerPosition);
        const recovery = box.isAtCeiling(this.stage.room.height);
        const projected = box.group.position.clone().project(this.camera);
        const visible = projected.z >= -1 && projected.z <= 1;
        return { box, distance, recovery, center: visible ? Math.hypot(projected.x, projected.y) : 99 };
      }).filter((candidate) => candidate.distance <= CONFIG.box.interactionDistance || candidate.recovery);
      candidates.sort((a, b) => Math.abs(a.center - b.center) > 0.08 ? a.center - b.center : a.distance - b.distance);
      this.activeBox = candidates[0]?.box ?? null;
    }

    this.boxes.forEach((box) => box.setTargeted(box === this.activeBox));
    const statusKey = `${this.activeBox?.id ?? 'none'}:${this.activeBox?.directionId ?? 'none'}:${this.heldBox?.id ?? 'none'}`;
    if (previous !== this.activeBox || statusKey !== this.lastStatusKey) {
      this.lastStatusKey = statusKey;
      this.ui.updateStatus(this.activeBox, this.heldBox);
    }
  }

  syncObjects(delta) {
    this.player.group.position.copy(this.player.body.position);
    const visualYaw = this.player.group.rotation.y;
    this.player.group.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), visualYaw);
    this.boxes.forEach((box) => box.update(delta));
  }

  updateSwitches(delta) {
    this.switches.forEach((switchState) => {
      const [x, , z] = switchState.position;
      const triggerRadius = Math.max(switchState.size[0], switchState.size[2]) * 0.62;
      const pressed = this.boxes.some((box) => {
        const horizontal = Math.hypot(box.body.position.x - x, box.body.position.z - z);
        return horizontal < triggerRadius && box.body.position.y - box.size / 2 < 0.58;
      });

      if (pressed) {
        switchState.dwell += delta;
        switchState.release = 0;
      } else {
        switchState.dwell = 0;
        switchState.release += delta;
      }

      const wasActive = switchState.active;
      if (switchState.mode === 'latch') {
        if (switchState.dwell >= 0.14) switchState.active = true;
      } else if (switchState.dwell >= 0.14) {
        switchState.active = true;
      } else if (switchState.release >= 0.3) {
        switchState.active = false;
      }

      const targetY = switchState.active ? 0.04 : 0.15;
      switchState.plate.position.y = THREE.MathUtils.damp(switchState.plate.position.y, targetY, 12, delta);
      switchState.plate.material.color.set(switchState.active ? 0x69d284 : this.stage.palette.switch);
      switchState.plate.material.emissiveIntensity = switchState.active ? 0.62 : 0.18;
      if (!wasActive && switchState.active) {
        switchState.pulse = 0.65;
        this.ui.toast('スイッチ ON!', 'green');
      }
      if (switchState.pulse > 0) {
        switchState.pulse -= delta;
        const progress = 1 - Math.max(0, switchState.pulse) / 0.65;
        switchState.pulseRing.scale.setScalar(1 + progress * 1.5);
        switchState.pulseRing.material.opacity = (1 - progress) * 0.75;
      } else {
        switchState.pulseRing.material.opacity = 0;
      }
    });
  }

  updateDoors(delta) {
    this.doors.forEach((door) => {
      const shouldOpen = door.requires.every((id) => this.switches.find((item) => item.id === id)?.active);
      if (shouldOpen && !door.open) {
        door.open = true;
        this.ui.toast(door.id === 'middle-gate' ? '中間ゲート OPEN!' : '扉が開いた！ OPEN!', 'green');
      } else if (!shouldOpen && door.open) {
        door.open = false;
      }
      const target = door.open ? door.openPosition : door.closedPosition;
      const nextX = THREE.MathUtils.damp(door.body.position.x, target[0], 4.4, delta);
      const nextY = THREE.MathUtils.damp(door.body.position.y, target[1], 4.4, delta);
      const nextZ = THREE.MathUtils.damp(door.body.position.z, target[2], 4.4, delta);
      door.body.position.set(nextX, nextY, nextZ);
      door.body.velocity.setZero();
      door.body.aabbNeedsUpdate = true;
      door.mesh.position.set(nextX, nextY, nextZ);
    });
  }

  updateGoal(delta) {
    const goal = this.runtime.goal;
    goal.group.rotation.y += delta * 0.48;
    goal.beam.material.opacity = 0.12 + Math.sin(performance.now() * 0.003) * 0.04;
    if (this.clear) return;
    const player = this.player.body.position;
    if (Math.hypot(player.x - goal.position[0], player.z - goal.position[2]) < goal.radius && player.y < 2.5) {
      this.clear = true;
      this.freePlay = false;
      const final = this.currentStageIndex === STAGE_COUNT - 1;
      this.highestStage = Math.max(this.highestStage, Math.min(STAGE_COUNT, this.stage.id + 1));
      this.saveProgress(this.stage.id, this.highestStage);
      this.ui.showSettings(false);
      this.ui.showClear(true, { final, stageName: this.stage.name });
      this.ui.setStealState(false);
      this.refreshCameraInputState();
      this.vibrate(50);
    }
  }

  updateCamera(delta) {
    this.comfortCamera.update(this.player.body.position, delta);
  }

  updateInteraction() {
    const interactionsEnabled = !this.clear || this.freePlay;
    const available = Boolean(this.activeBox?.gravityDirection && interactionsEnabled);
    const recovery = Boolean(available
      && this.activeBox.isAtCeiling(this.stage.room.height)
      && this.activeBox.body.position.distanceTo(this.player.body.position) > CONFIG.box.interactionDistance);
    this.ui.showInteraction(available, recovery ? '天井から遠隔回収' : '重力をぬすむ');
    this.ui.setStealState(available, recovery);
  }

  updateRepeatHint(delta) {
    if (!this.repeatHintArmed || !this.repeatHintBox) return;
    this.repeatHintDelay -= delta;
    const speed = this.repeatHintBox.body.velocity.length();
    if (this.repeatHintDelay > 0 || speed > 0.42 || this.repeatHintBox.stolen) return;
    this.repeatHintArmed = false;
    this.ui.toast('もう一度ぬすめるよ！', 'gold');
    this.ui.pulseSteal();
    this.repeatHintBox.pulseHint();
    this.markRepeatHintSeen();
  }

  enableFreePlay() {
    this.freePlay = true;
    this.ui.showClear(false);
    this.player.body.wakeUp();
    this.boxes.forEach((box) => box.body.wakeUp());
    this.refreshCameraInputState();
    this.ui.toast('ステージ5で自由に遊べるよ！', 'green');
  }

  checkBounds() {
    const { width, height, depth } = this.stage.room;
    const player = this.player.body.position;
    if (player.y < -5 || Math.abs(player.x) > width || Math.abs(player.z) > depth) this.resetPlayer();
    this.boxes.forEach((box) => {
      const position = box.body.position;
      if (position.y < -8 || position.y > height + 6 || Math.abs(position.x) > width + 6 || Math.abs(position.z) > depth + 6) box.reset();
    });
  }

  resetPlayer() {
    this.player.body.position.set(...this.player.spawn);
    this.player.body.velocity.setZero();
    this.player.body.angularVelocity.setZero();
    this.player.group.position.set(...this.player.spawn);
    this.facePlayerToward(this.stage.doors[0]?.position ?? this.stage.goal.position);
  }

  facePlayerToward(position) {
    const spawn = this.player.spawn;
    this.player.group.rotation.y = Math.atan2(position[0] - spawn[0], position[2] - spawn[2]);
  }

  onBoxImpact(impact) {
    if (impact >= 4.2) this.vibrate(24);
  }

  vibrate(duration) {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(duration);
    } catch {
      // Vibration is optional and must never interrupt play.
    }
  }

  applyTheme(stage) {
    this.scene.background = new THREE.Color(stage.palette.background);
    this.scene.fog = new THREE.Fog(stage.palette.background, stage.id === 5 ? 20 : 22, stage.id === 5 ? 42 : 38);
    this.hemisphere.color.set(stage.palette.ambient);
    this.hemisphere.groundColor.set(stage.palette.groundLight);
    this.hemisphere.intensity = stage.id === 5 ? 2.75 : 2.25;
    this.sun.color.set(stage.id === 5 ? 0xe5edff : 0xfff0d2);
    this.sun.intensity = stage.id === 5 ? 3.6 : 3.1;
    document.documentElement.style.setProperty('--sky', stage.palette.background);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', stage.palette.background);
  }

  setStageTimeout(callback, delay) {
    const timer = window.setTimeout(() => {
      this.stageTimers.delete(timer);
      callback();
    }, delay);
    this.stageTimers.add(timer);
    return timer;
  }

  clearStageTimers() {
    this.stageTimers.forEach((timer) => clearTimeout(timer));
    this.stageTimers.clear();
  }

  readCameraSettings() {
    try {
      const comfortRaw = localStorage.getItem(CONFIG.storage.motionComfort);
      const sensitivityRaw = localStorage.getItem(CONFIG.storage.cameraSensitivity);
      const motionComfort = comfortRaw === null ? true : comfortRaw !== '0';
      return normalizeCameraSettings({ motionComfort, sensitivity: sensitivityRaw }, this.isTouchDevice);
    } catch {
      return normalizeCameraSettings(null, this.isTouchDevice);
    }
  }

  saveCameraSettings() {
    try {
      localStorage.setItem(CONFIG.storage.motionComfort, this.cameraSettings.motionComfort ? '1' : '0');
      localStorage.setItem(CONFIG.storage.cameraSensitivity, this.cameraSettings.sensitivity);
    } catch {
      // Comfort settings remain active for the current session when storage is unavailable.
    }
  }

  readProgress() {
    try {
      const currentRaw = localStorage.getItem(CONFIG.storage.currentStage);
      const highestRaw = localStorage.getItem(CONFIG.storage.highestStage);
      const current = currentRaw === null ? null : Number(currentRaw);
      const highest = highestRaw === null ? null : Number(highestRaw);
      const valid = (value) => Number.isInteger(value) && value >= 1 && value <= STAGE_COUNT;
      if ((currentRaw !== null && !valid(current)) || (highestRaw !== null && !valid(highest))) throw new Error('invalid progress');
      const safeHighest = valid(highest) ? highest : 1;
      return { current: valid(current) ? current : safeHighest, highest: safeHighest };
    } catch {
      this.saveProgress(1, 1);
      return { current: 1, highest: 1 };
    }
  }

  saveProgress(current, highest) {
    try {
      localStorage.setItem(CONFIG.storage.currentStage, String(current));
      localStorage.setItem(CONFIG.storage.highestStage, String(highest));
    } catch {
      // The game remains playable when storage is unavailable.
    }
  }

  repeatHintWasSeen() {
    try {
      return localStorage.getItem(CONFIG.storage.repeatHintSeen) === '1';
    } catch {
      return false;
    }
  }

  markRepeatHintSeen() {
    try {
      localStorage.setItem(CONFIG.storage.repeatHintSeen, '1');
    } catch {
      // Optional tutorial persistence.
    }
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
