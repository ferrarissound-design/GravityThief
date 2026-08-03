import * as THREE from 'three';
import { CONFIG } from './config.js';

const VALID_SENSITIVITY = new Set(['low', 'normal', 'high']);

export function normalizeCameraSettings(settings, isTouchDevice) {
  return {
    motionComfort: settings?.motionComfort !== false,
    sensitivity: VALID_SENSITIVITY.has(settings?.sensitivity)
      ? settings.sensitivity
      : (isTouchDevice ? 'low' : 'normal'),
  };
}

export class ComfortCamera {
  constructor(camera, isTouchDevice = false) {
    this.camera = camera;
    this.isTouchDevice = isTouchDevice;
    this.settings = normalizeCameraSettings(null, isTouchDevice);
    this.colliders = [];
    this.yaw = 0;
    this.pitch = CONFIG.camera.pitch.comfortMinimum;
    this.baseDistance = CONFIG.camera.distance.comfortDesktop;
    this.stageDistance = 0;
    this.armLength = this.baseDistance;

    this.target = new THREE.Vector3();
    this.rawTarget = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.desiredPosition = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.intersections = [];
    this.camera.up.set(0, 1, 0);
    this.camera.fov = CONFIG.camera.fov;
    this.camera.near = CONFIG.camera.near;
    this.camera.far = CONFIG.camera.far;
    this.camera.updateProjectionMatrix();
  }

  setSettings(settings) {
    this.settings = normalizeCameraSettings(settings, this.isTouchDevice);
  }

  setColliders(colliders) {
    this.colliders = colliders.filter(Boolean);
  }

  reset(stage, playerPosition, colliders = []) {
    this.setColliders(colliders);
    this.yaw = stage.camera.yaw;
    this.pitch = THREE.MathUtils.clamp(
      this.settings.motionComfort
        ? Math.max(stage.camera.pitch, CONFIG.camera.pitch.comfortMinimum)
        : stage.camera.pitch,
      CONFIG.camera.pitch.min,
      CONFIG.camera.pitch.max,
    );
    this.stageDistance = stage.camera.distance;
    this.baseDistance = this.getConfiguredDistance(this.stageDistance);
    this.target.set(
      playerPosition.x,
      playerPosition.y + CONFIG.camera.lookAtHeight,
      playerPosition.z,
    );
    this.rawTarget.copy(this.target);
    this.armLength = this.getIdealOffsetLength();
    this.update(playerPosition, 1 / 60, true);
  }

  applyLook(mouseDelta, touchDelta, blocked = false) {
    if (blocked) return;
    const mode = this.settings.motionComfort ? 'comfort' : 'standard';
    const scale = CONFIG.camera.sensitivity.scale[this.settings.sensitivity];
    const mouse = CONFIG.camera.sensitivity.mouse[mode];
    const touch = CONFIG.camera.sensitivity.touch[mode];
    this.yaw -= (mouseDelta?.x ?? 0) * mouse.yaw * scale;
    this.yaw -= (touchDelta?.x ?? 0) * touch.yaw * scale;
    this.pitch += (mouseDelta?.y ?? 0) * mouse.pitch * scale;
    this.pitch += (touchDelta?.y ?? 0) * touch.pitch * scale;
    this.pitch = THREE.MathUtils.clamp(this.pitch, CONFIG.camera.pitch.min, CONFIG.camera.pitch.max);
  }

  update(playerPosition, delta, snap = false) {
    const safeDelta = THREE.MathUtils.clamp(delta, 0, 0.05);
    const comfort = this.settings.motionComfort;
    const horizontalSpeed = comfort
      ? CONFIG.camera.follow.horizontalComfort
      : CONFIG.camera.follow.horizontalStandard;
    const verticalSpeed = comfort
      ? CONFIG.camera.follow.verticalComfort
      : CONFIG.camera.follow.verticalStandard;
    const verticalDeadZone = comfort
      ? CONFIG.camera.follow.verticalDeadZoneComfort
      : CONFIG.camera.follow.verticalDeadZoneStandard;

    this.rawTarget.set(
      playerPosition.x,
      playerPosition.y + CONFIG.camera.lookAtHeight,
      playerPosition.z,
    );

    if (snap) {
      this.target.copy(this.rawTarget);
    } else {
      this.target.x = THREE.MathUtils.damp(this.target.x, this.rawTarget.x, horizontalSpeed, safeDelta);
      this.target.z = THREE.MathUtils.damp(this.target.z, this.rawTarget.z, horizontalSpeed, safeDelta);
      const verticalError = this.rawTarget.y - this.target.y;
      if (Math.abs(verticalError) > verticalDeadZone) {
        const easedTargetY = this.rawTarget.y - Math.sign(verticalError) * verticalDeadZone;
        this.target.y = THREE.MathUtils.damp(this.target.y, easedTargetY, verticalSpeed, safeDelta);
      }
    }

    this.baseDistance = this.getConfiguredDistance(this.stageDistance);
    this.computeIdealOffset();
    const idealLength = this.offset.length();
    this.direction.copy(this.offset).multiplyScalar(1 / Math.max(idealLength, 0.0001));
    const allowedLength = this.getCollisionLength(idealLength);

    if (snap) {
      this.armLength = allowedLength;
    } else {
      const closing = allowedLength < this.armLength;
      const response = closing
        ? CONFIG.camera.collision.approachSpeed
        : (comfort ? CONFIG.camera.collision.returnSpeedComfort : CONFIG.camera.collision.returnSpeedStandard);
      this.armLength = THREE.MathUtils.damp(this.armLength, allowedLength, response, safeDelta);
      if (closing) this.armLength = Math.min(this.armLength, allowedLength + 0.08);
    }

    this.desiredPosition.copy(this.direction).multiplyScalar(this.armLength).add(this.target);
    this.camera.position.copy(this.desiredPosition);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target);
    this.camera.rotation.z = 0;
  }

  getConfiguredDistance(stageDistance) {
    const distanceKey = this.settings.motionComfort
      ? (this.isTouchDevice ? 'comfortMobile' : 'comfortDesktop')
      : (this.isTouchDevice ? 'standardMobile' : 'standardDesktop');
    return Math.max(Number(stageDistance) || 0, CONFIG.camera.distance[distanceKey]);
  }

  computeIdealOffset() {
    const horizontal = Math.cos(this.pitch) * this.baseDistance;
    const heightMode = this.settings.motionComfort ? 'comfort' : 'standard';
    this.offset.set(
      Math.sin(this.yaw) * horizontal,
      Math.sin(this.pitch) * this.baseDistance + CONFIG.camera.heightOffset[heightMode],
      Math.cos(this.yaw) * horizontal,
    );
    return this.offset;
  }

  getIdealOffsetLength() {
    return this.computeIdealOffset().length();
  }

  getCollisionLength(idealLength) {
    if (!this.colliders.length) return idealLength;
    this.intersections.length = 0;
    this.raycaster.set(this.target, this.direction.copy(this.offset).normalize());
    this.raycaster.near = 0.05;
    this.raycaster.far = idealLength;
    this.raycaster.intersectObjects(this.colliders, false, this.intersections);
    const hit = this.intersections[0];
    if (!hit) return idealLength;
    return THREE.MathUtils.clamp(
      hit.distance - CONFIG.camera.collision.padding,
      CONFIG.camera.collision.minDistance,
      idealLength,
    );
  }

  getState() {
    return {
      yaw: this.yaw,
      pitch: this.pitch,
      armLength: this.armLength,
      target: this.target.clone(),
      position: this.camera.position.clone(),
      roll: this.camera.rotation.z,
      fov: this.camera.fov,
    };
  }
}
