export class TouchControls {
  constructor(root) {
    this.root = root;
    this.move = { x: 0, y: 0 };
    this.lookDelta = { x: 0, y: 0 };
    this.actions = new Set();
    this.claimedPointers = new Map();
    this.joyPointer = null;
    this.lookPointer = null;
    this.lastLook = null;
    this.cameraEnabled = true;
    this.active = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    if (!this.active) return;

    root.classList.add('touch-mode');
    const documentRoot = root.ownerDocument;
    const preventGesture = (event) => event.preventDefault();
    documentRoot.addEventListener('gesturestart', preventGesture, { passive: false, capture: true });
    documentRoot.addEventListener('gesturechange', preventGesture, { passive: false, capture: true });
    documentRoot.addEventListener('gestureend', preventGesture, { passive: false, capture: true });
    documentRoot.addEventListener('dblclick', preventGesture, { capture: true });

    const preventMultiTouch = (event) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    documentRoot.addEventListener('touchstart', preventMultiTouch, { passive: false, capture: true });
    documentRoot.addEventListener('touchmove', preventMultiTouch, { passive: false, capture: true });

    let lastTap = null;
    documentRoot.addEventListener('touchend', (event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      const now = performance.now();
      const isRapidRepeat = lastTap
        && now - lastTap.time < 400
        && Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y) < 48;
      if (isRapidRepeat) event.preventDefault();
      lastTap = { time: now, x: touch.clientX, y: touch.clientY };
    }, { passive: false, capture: true });

    this.joystick = root.querySelector('[data-joystick]');
    this.knob = root.querySelector('[data-joystick-knob]');
    const updateJoystick = (event) => {
      const rect = this.joystick.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const max = rect.width * 0.32;
      const length = Math.hypot(dx, dy) || 1;
      const scale = Math.min(1, max / length);
      const x = dx * scale;
      const y = dy * scale;
      this.knob.style.transform = `translate(${x}px, ${y}px)`;
      this.move.x = x / max;
      this.move.y = -y / max;
    };
    this.joystick.addEventListener('pointerdown', (event) => {
      if (this.joyPointer !== null || this.claimedPointers.has(event.pointerId)) return;
      event.preventDefault();
      this.joyPointer = event.pointerId;
      this.claimedPointers.set(event.pointerId, 'move');
      this.joystick.setPointerCapture?.(event.pointerId);
      updateJoystick(event);
    });
    this.joystick.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.joyPointer) return;
      event.preventDefault();
      updateJoystick(event);
    });
    const stopJoystick = (event) => {
      if (event.pointerId !== this.joyPointer) return;
      this.claimedPointers.delete(event.pointerId);
      this.joyPointer = null;
      this.move.x = 0;
      this.move.y = 0;
      this.knob.style.transform = '';
    };
    this.joystick.addEventListener('pointerup', stopJoystick);
    this.joystick.addEventListener('pointercancel', stopJoystick);
    this.joystick.addEventListener('lostpointercapture', stopJoystick);

    this.lookArea = root.querySelector('[data-look-area]');
    this.lookArea.addEventListener('pointerdown', (event) => {
      if (!this.cameraEnabled || this.lookPointer !== null || this.claimedPointers.has(event.pointerId)) return;
      if (event.target.closest('button, [data-no-camera]')) return;
      event.preventDefault();
      this.lookPointer = event.pointerId;
      this.claimedPointers.set(event.pointerId, 'camera');
      this.lastLook = { x: event.clientX, y: event.clientY };
      this.lookArea.setPointerCapture?.(event.pointerId);
    });
    this.lookArea.addEventListener('pointermove', (event) => {
      if (!this.cameraEnabled || event.pointerId !== this.lookPointer || !this.lastLook) return;
      event.preventDefault();
      this.lookDelta.x += event.clientX - this.lastLook.x;
      this.lookDelta.y += event.clientY - this.lastLook.y;
      this.lastLook.x = event.clientX;
      this.lastLook.y = event.clientY;
    });
    const stopLook = (event) => {
      if (event.pointerId !== this.lookPointer) return;
      this.claimedPointers.delete(event.pointerId);
      this.lookPointer = null;
      this.lastLook = null;
      this.lookDelta.x = 0;
      this.lookDelta.y = 0;
    };
    this.lookArea.addEventListener('pointerup', stopLook);
    this.lookArea.addEventListener('pointercancel', stopLook);
    this.lookArea.addEventListener('lostpointercapture', stopLook);

    root.querySelectorAll('button').forEach((button) => {
      const releaseButtonPointer = (event) => {
        if (this.claimedPointers.get(event.pointerId) === 'button') this.claimedPointers.delete(event.pointerId);
      };
      button.addEventListener('pointerdown', (event) => {
        if (!this.claimedPointers.has(event.pointerId)) this.claimedPointers.set(event.pointerId, 'button');
      });
      button.addEventListener('pointerup', releaseButtonPointer);
      button.addEventListener('pointercancel', releaseButtonPointer);
      button.addEventListener('lostpointercapture', releaseButtonPointer);
    });

    root.querySelectorAll('[data-touch-action]').forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        this.actions.add(button.dataset.touchAction);
      });
    });

    window.addEventListener('blur', () => this.reset());
  }

  consumeAction(action) {
    if (!this.actions.has(action)) return false;
    this.actions.delete(action);
    return true;
  }

  consumeLook() {
    const result = { x: this.lookDelta.x, y: this.lookDelta.y };
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
    return result;
  }

  setCameraEnabled(enabled) {
    this.cameraEnabled = enabled;
    if (!enabled) this.cancelLook();
  }

  cancelLook() {
    if (this.lookPointer !== null) {
      this.claimedPointers.delete(this.lookPointer);
      try {
        if (this.lookArea?.hasPointerCapture?.(this.lookPointer)) this.lookArea.releasePointerCapture(this.lookPointer);
      } catch {
        // Pointer capture may already have ended on mobile Safari.
      }
    }
    this.lookPointer = null;
    this.lastLook = null;
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
  }

  reset() {
    this.cancelLook();
    this.move.x = 0;
    this.move.y = 0;
    this.actions.clear();
    if (this.joyPointer !== null) this.claimedPointers.delete(this.joyPointer);
    this.joyPointer = null;
    this.knob && (this.knob.style.transform = '');
    this.claimedPointers.clear();
  }
}
