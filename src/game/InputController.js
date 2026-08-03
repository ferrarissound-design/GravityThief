export class InputController {
  constructor(element) {
    this.element = element;
    this.keys = new Set();
    this.lookDelta = { x: 0, y: 0 };
    this.actions = new Set();
    this.dragging = false;
    this.lastPointer = { x: 0, y: 0 };

    window.addEventListener('keydown', (event) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (!event.repeat) this.actions.add(event.code);
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());

    element.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch') return;
      this.dragging = true;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      element.setPointerCapture?.(event.pointerId);
    });
    element.addEventListener('pointermove', (event) => {
      if (!this.dragging || event.pointerType === 'touch') return;
      this.lookDelta.x += event.clientX - this.lastPointer.x;
      this.lookDelta.y += event.clientY - this.lastPointer.y;
      this.lastPointer = { x: event.clientX, y: event.clientY };
    });
    element.addEventListener('pointerup', () => { this.dragging = false; });
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
    const value = { ...this.lookDelta };
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
    return value;
  }
}
