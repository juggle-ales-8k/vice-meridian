export class InputController {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.mouseDown = false;
    this.justPressed = new Set();
    this.pointerLocked = false;
    this.frozen = false;

    this._onKeyDown = (e) => {
      if (this.frozen) return;
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };

    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };

    this._onMouseMove = (e) => {
      if (this.frozen || !this.pointerLocked) return;
      this.mouseDeltaX += e.movementX || 0;
      this.mouseDeltaY += e.movementY || 0;
    };

    this._onMouseDown = (e) => {
      if (this.frozen) return;
      if (e.button === 0) {
        this.mouseDown = true;
        this.justPressed.add('Mouse0');
      }
    };

    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouseDown = false;
    };

    this._onPointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
  }

  requestPointerLock() {
    if (this.frozen) return;
    if (this.canvas && this.canvas.requestPointerLock) {
      try {
        this.canvas.requestPointerLock();
      } catch {
        // Ignore browser rejections in headless mode
      }
    }
  }

  isDown(code) {
    return !this.frozen && this.keys.has(code);
  }

  consumePress(code) {
    if (this.frozen) return false;
    if (this.justPressed.has(code)) {
      this.justPressed.delete(code);
      return true;
    }
    return false;
  }

  consumeMouseDelta() {
    const dx = this.mouseDeltaX;
    const dy = this.mouseDeltaY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return { dx, dy };
  }

  getControls() {
    return {
      forward: this.isDown('KeyW') || this.isDown('ArrowUp'),
      backward: this.isDown('KeyS') || this.isDown('ArrowDown'),
      left: this.isDown('KeyA') || this.isDown('ArrowLeft'),
      right: this.isDown('KeyD') || this.isDown('ArrowRight'),
      sprint: this.isDown('ShiftLeft') || this.isDown('ShiftRight'),
      jump: this.consumePress('Space'),
      handbrake: this.isDown('Space'),
      enterExit: this.consumePress('KeyF'),
      interact: this.consumePress('KeyE'),
      fire: !this.frozen && this.mouseDown,
      reload: this.consumePress('KeyR'),
      pause: this.consumePress('KeyP') || this.consumePress('Escape'),
      weapon1: this.consumePress('Digit1'),
      weapon2: this.consumePress('Digit2'),
    };
  }

  endFrame() {
    this.justPressed.clear();
  }
}
