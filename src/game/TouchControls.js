export class TouchControls {
  constructor(root) {
    this.move = { x: 0, y: 0 };
    this.lookDelta = { x: 0, y: 0 };
    this.actions = new Set();
    this.active = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    if (!this.active) return;

    root.classList.add('touch-mode');
    const preventGesture = (event) => event.preventDefault();
    root.addEventListener('gesturestart', preventGesture, { passive: false });
    root.addEventListener('gesturechange', preventGesture, { passive: false });
    root.addEventListener('gestureend', preventGesture, { passive: false });
    root.addEventListener('dblclick', preventGesture);
    root.addEventListener('touchmove', (event) => {
      if (event.touches.length > 1) event.preventDefault();
    }, { passive: false });

    const joystick = root.querySelector('[data-joystick]');
    const knob = root.querySelector('[data-joystick-knob]');
    let joyPointer = null;
    const updateJoystick = (event) => {
      const rect = joystick.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const max = rect.width * 0.32;
      const length = Math.hypot(dx, dy) || 1;
      const scale = Math.min(1, max / length);
      const x = dx * scale;
      const y = dy * scale;
      knob.style.transform = `translate(${x}px, ${y}px)`;
      this.move.x = x / max;
      this.move.y = -y / max;
    };
    joystick.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      joyPointer = event.pointerId;
      joystick.setPointerCapture(event.pointerId);
      updateJoystick(event);
    });
    joystick.addEventListener('pointermove', (event) => {
      event.preventDefault();
      if (event.pointerId === joyPointer) updateJoystick(event);
    });
    const stopJoystick = (event) => {
      if (event.pointerId !== joyPointer) return;
      joyPointer = null;
      this.move = { x: 0, y: 0 };
      knob.style.transform = '';
    };
    joystick.addEventListener('pointerup', stopJoystick);
    joystick.addEventListener('pointercancel', stopJoystick);

    const lookArea = root.querySelector('[data-look-area]');
    let lookPointer = null;
    let last = null;
    lookArea.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) return;
      event.preventDefault();
      lookPointer = event.pointerId;
      last = { x: event.clientX, y: event.clientY };
      lookArea.setPointerCapture(event.pointerId);
    });
    lookArea.addEventListener('pointermove', (event) => {
      if (event.pointerId !== lookPointer || !last) return;
      event.preventDefault();
      this.lookDelta.x += event.clientX - last.x;
      this.lookDelta.y += event.clientY - last.y;
      last = { x: event.clientX, y: event.clientY };
    });
    lookArea.addEventListener('pointerup', () => { lookPointer = null; last = null; });

    root.querySelectorAll('[data-touch-action]').forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        this.actions.add(button.dataset.touchAction);
      });
    });
  }

  consumeAction(action) {
    if (!this.actions.has(action)) return false;
    this.actions.delete(action);
    return true;
  }

  consumeLook() {
    const result = { ...this.lookDelta };
    this.lookDelta = { x: 0, y: 0 };
    return result;
  }
}
