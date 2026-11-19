// Keyboard, mouse (pointer lock) and gamepad input, merged into one controls snapshot per tick.
// Every action is looked up through a rebindable map so players can remap keys at runtime
// (and the map persists to localStorage when it is changed).

export const DEFAULT_BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  backward: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  handbrake: ['Space'],
  enterExit: ['KeyF'],
  interact: ['KeyE'],
  reload: ['KeyR'],
  melee: ['KeyQ'],
  horn: ['KeyH'],
  pause: ['KeyP', 'Escape'],
  save: ['KeyK'],
  weapon1: ['Digit1'],
  weapon2: ['Digit2'],
  weapon3: ['Digit3'],
  nextWeapon: ['KeyX'],
  lookBack: ['KeyC'],
};

// Actions that fire once per key press rather than while held.
const PRESS_ACTIONS = new Set(['jump', 'enterExit', 'interact', 'reload', 'melee', 'horn', 'pause', 'save', 'weapon1', 'weapon2', 'weapon3', 'nextWeapon']);

// Standard-mapping gamepad buttons.
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const PAD_BINDINGS = {
  jump: PAD.A,
  enterExit: PAD.Y,
  interact: PAD.X,
  reload: PAD.X,
  melee: PAD.B,
  horn: PAD.LS,
  pause: PAD.START,
  nextWeapon: PAD.RB,
  lookBack: PAD.RS,
  sprint: PAD.LB,
};
const BINDINGS_KEY = 'vice-meridian-bindings-v1';
const DEADZONE = 0.18;
const PAD_LOOK_SPEED = 900; // pseudo-pixels per second at full right-stick deflection

function deadzone(v) {
  const a = Math.abs(v);
  if (a < DEADZONE) return 0;
  return Math.sign(v) * (a - DEADZONE) / (1 - DEADZONE);
}

export class InputController {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.mouseDown = false;
    this.rightMouseDown = false;
    this.justPressed = new Set();
    this.pointerLocked = false;
    this.lockLost = false;
    this.frozen = false;
    this.mouseSensitivity = 1;
    this.invertY = false;
    this.bindings = this.loadBindings();
    this.rebindTarget = null;
    this.onRebind = null;
    this.gamepadIndex = null;
    this.padPrev = [];
    this.padPressed = new Set();
    this.padState = { lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0, buttons: [] };

    this._onKeyDown = (e) => {
      if (this.frozen) return;
      // While rebinding, the next key press becomes the new binding for that action.
      if (this.rebindTarget) {
        e.preventDefault();
        if (e.code !== 'Escape') this.setBinding(this.rebindTarget, e.code);
        const done = this.rebindTarget;
        this.rebindTarget = null;
        if (this.onRebind) this.onRebind(done, e.code);
        return;
      }
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }
    };

    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };

    this._onMouseMove = (e) => {
      if (this.frozen || !this.pointerLocked) return;
      this.mouseDeltaX += (e.movementX || 0) * this.mouseSensitivity;
      this.mouseDeltaY += (e.movementY || 0) * this.mouseSensitivity * (this.invertY ? -1 : 1);
    };

    this._onMouseDown = (e) => {
      if (this.frozen) return;
      if (e.button === 0) {
        this.mouseDown = true;
        this.justPressed.add('Mouse0');
      } else if (e.button === 2) {
        this.rightMouseDown = true;
      }
    };

    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rightMouseDown = false;
    };

    this._onPointerLockChange = () => {
      const wasLocked = this.pointerLocked;
      this.pointerLocked = document.pointerLockElement === this.canvas;
      // Browsers swallow Escape while releasing pointer lock; report it so the game can pause.
      if (wasLocked && !this.pointerLocked) this.lockLost = true;
    };

    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
      this.rightMouseDown = false;
    };

    this._onGamepadConnected = (e) => {
      if (this.gamepadIndex === null) this.gamepadIndex = e.gamepad.index;
    };
    this._onGamepadDisconnected = (e) => {
      if (this.gamepadIndex === e.gamepad.index) this.gamepadIndex = null;
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('gamepadconnected', this._onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this._onGamepadDisconnected);
    if (canvas) canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
  }

  // --- Key rebinding -------------------------------------------------------------------------

  loadBindings() {
    const merged = {};
    for (const [k, v] of Object.entries(DEFAULT_BINDINGS)) merged[k] = [...v];
    try {
      const raw = window.localStorage ? window.localStorage.getItem(BINDINGS_KEY) : null;
      if (raw) {
        const saved = JSON.parse(raw);
        for (const [k, v] of Object.entries(saved)) {
          if (merged[k] && Array.isArray(v) && v.every((c) => typeof c === 'string')) merged[k] = v;
        }
      }
    } catch {
      // Storage unavailable or corrupt: defaults stand.
    }
    return merged;
  }

  saveBindings() {
    try {
      if (window.localStorage) window.localStorage.setItem(BINDINGS_KEY, JSON.stringify(this.bindings));
    } catch {
      // Storage may be disabled (private mode); bindings remain for this session.
    }
  }

  // Replace the primary key for an action, removing that key from any other action first.
  setBinding(action, code) {
    if (!this.bindings[action]) return false;
    for (const [k, list] of Object.entries(this.bindings)) {
      if (k !== action && !(k === 'jump' && action === 'handbrake') && !(k === 'handbrake' && action === 'jump')) {
        this.bindings[k] = list.filter((c) => c !== code);
      }
    }
    const rest = this.bindings[action].slice(1).filter((c) => c !== code);
    this.bindings[action] = [code, ...rest];
    this.saveBindings();
    return true;
  }

  beginRebind(action, onDone = null) {
    if (!this.bindings[action]) return false;
    this.rebindTarget = action;
    this.onRebind = onDone;
    return true;
  }

  resetBindings() {
    this.bindings = {};
    for (const [k, v] of Object.entries(DEFAULT_BINDINGS)) this.bindings[k] = [...v];
    this.saveBindings();
  }

  describeBinding(action) {
    const list = this.bindings[action] || [];
    return list.map((c) => c.replace(/^Key/, '').replace(/^Digit/, '')).join(' / ');
  }

  // --- Pointer lock --------------------------------------------------------------------------

  requestPointerLock() {
    if (this.frozen) return;
    if (this.canvas && this.canvas.requestPointerLock) {
      try {
        const p = this.canvas.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {
        // Ignore browser rejections in headless mode
      }
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  }

  consumeLockLost() {
    const v = this.lockLost;
    this.lockLost = false;
    return v;
  }

  // --- Gamepad -------------------------------------------------------------------------------

  pollGamepad() {
    this.padPressed.clear();
    const st = this.padState;
    st.lx = st.ly = st.rx = st.ry = st.lt = st.rt = 0;
    if (this.frozen || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    let pad = this.gamepadIndex !== null ? pads[this.gamepadIndex] : null;
    if (!pad) {
      for (const p of pads) if (p && p.connected) { pad = p; this.gamepadIndex = p.index; break; }
    }
    if (!pad) return;
    st.lx = deadzone(pad.axes[0] || 0);
    st.ly = deadzone(pad.axes[1] || 0);
    st.rx = deadzone(pad.axes[2] || 0);
    st.ry = deadzone(pad.axes[3] || 0);
    const btn = (i) => (pad.buttons[i] ? pad.buttons[i].value || (pad.buttons[i].pressed ? 1 : 0) : 0);
    st.lt = btn(PAD.LT);
    st.rt = btn(PAD.RT);
    st.buttons = pad.buttons.map((b) => b.pressed);
    st.buttons.forEach((down, i) => {
      if (down && !this.padPrev[i]) this.padPressed.add(i);
    });
    this.padPrev = st.buttons;
  }

  get hasGamepad() {
    return this.gamepadIndex !== null;
  }

  // --- Queries -------------------------------------------------------------------------------

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

  action(name) {
    const codes = this.bindings[name] || [];
    let active = false;
    if (PRESS_ACTIONS.has(name)) {
      // Check every code (no short-circuit) so a press is consumed whichever key made it.
      for (const c of codes) if (this.justPressed.has(c)) active = true;
      if (name !== 'jump') for (const c of codes) this.justPressed.delete(c);
      const padBtn = PAD_BINDINGS[name];
      if (padBtn !== undefined && this.padPressed.has(padBtn)) active = true;
    } else {
      for (const c of codes) if (this.keys.has(c)) active = true;
      const padBtn = PAD_BINDINGS[name];
      if (padBtn !== undefined && this.padState.buttons[padBtn]) active = true;
    }
    return !this.frozen && active;
  }

  consumeMouseDelta(dt = 1 / 60) {
    // Right stick adds to mouse look, scaled to feel like a mouse sweep.
    const dx = this.mouseDeltaX + this.padState.rx * PAD_LOOK_SPEED * dt;
    const dy = this.mouseDeltaY + this.padState.ry * PAD_LOOK_SPEED * 0.6 * dt;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return { dx, dy };
  }

  getControls() {
    this.pollGamepad();
    const pad = this.padState;
    const kbForward = this.action('forward');
    const kbBackward = this.action('backward');
    const kbLeft = this.action('left');
    const kbRight = this.action('right');
    // Analog axes: keyboard gives ±1, the left stick gives a proportional value.
    const moveX = pad.lx !== 0 ? pad.lx : (kbRight ? 1 : 0) - (kbLeft ? 1 : 0);
    const moveY = pad.ly !== 0 ? -pad.ly : (kbForward ? 1 : 0) - (kbBackward ? 1 : 0);
    const jumpPressed = this.action('jump');
    return {
      // Triggers drive only through throttle/brake (vehicles read those); on foot RT fires.
      forward: kbForward || pad.ly < -0.3,
      backward: kbBackward || pad.ly > 0.3,
      left: kbLeft || pad.lx < -0.3,
      right: kbRight || pad.lx > 0.3,
      moveX,
      moveY,
      // Triggers: RT = throttle (or fire on foot), LT = brake/reverse (or aim on foot).
      throttle: Math.max(kbForward ? 1 : 0, pad.rt),
      brake: Math.max(kbBackward ? 1 : 0, pad.lt),
      sprint: this.action('sprint'),
      jump: jumpPressed,
      handbrake: this.action('handbrake') || Boolean(pad.buttons[PAD.A]),
      enterExit: this.action('enterExit'),
      interact: this.action('interact'),
      fire: !this.frozen && (this.mouseDown || pad.rt > 0.5),
      aim: !this.frozen && (this.rightMouseDown || pad.lt > 0.5),
      reload: this.action('reload'),
      melee: this.action('melee'),
      horn: this.action('horn'),
      pause: this.action('pause'),
      save: this.action('save'),
      weapon1: this.action('weapon1'),
      weapon2: this.action('weapon2'),
      weapon3: this.action('weapon3'),
      nextWeapon: this.action('nextWeapon'),
      lookBack: this.action('lookBack'),
      usingGamepad: this.hasGamepad,
    };
  }

  endFrame() {
    this.justPressed.clear();
  }
}
