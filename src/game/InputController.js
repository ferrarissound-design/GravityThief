export class InputController {
  constructor(element) {
    this.element = element;
    this.keys = new Set();
    this.lookDelta = { x: 0, y: 0 };
    this.actions = new Set();
    this.dragging = false;
    this.cameraEnabled = true;
    this.pointerId = null;
    this.lastPointer = { x: 0, y: 0 };

    window.addEventListener('keydown', (event) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (!event.repeat) this.actions.add(event.code);
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.reset());

    element.addEventListener('pointerdown', (event) => {
      if (!this.cameraEnabled || event.pointerType === 'touch' || this.dragging) return;
      this.dragging = true;
      this.pointerId = event.pointerId;
      this.lastPointer.x = event.clientX;
      this.lastPointer.y = event.clientY;
      element.setPointerCapture?.(event.pointerId);
    });
    element.addEventListener('pointermove', (event) => {
      if (!this.cameraEnabled || !this.dragging || event.pointerId !== this.pointerId) return;
      this.lookDelta.x += event.clientX - this.lastPointer.x;
      this.lookDelta.y += event.clientY - this.lastPointer.y;
      this.lastPointer.x = event.clientX;
      this.lastPointer.y = event.clientY;
    });
    const stopDrag = (event) => {
      if (event.pointerId !== this.pointerId) return;
      this.dragging = false;
      this.pointerId = null;
      this.lookDelta.x = 0;
      this.lookDelta.y = 0;
    };
    element.addEventListener('pointerup', stopDrag);
    element.addEventListener('pointercancel', stopDrag);
    element.addEventListener('lostpointercapture', stopDrag);
    element.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  getMovement() {
    return {
      x: (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0),
      y: (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0),
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
    };
  }

  consumeAction(code) {
    if (!this.actions.has(code)) return false;
    this.actions.delete(code);
    return true;
  }

  consumeLook() {
    const value = { x: this.lookDelta.x, y: this.lookDelta.y };
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
    return value;
  }

  setCameraEnabled(enabled) {
    this.cameraEnabled = enabled;
    if (!enabled) this.cancelLook();
  }

  cancelLook() {
    this.dragging = false;
    this.pointerId = null;
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
  }

  reset() {
    this.keys.clear();
    this.actions.clear();
    this.cancelLook();
  }
}
