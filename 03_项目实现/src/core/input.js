// 键鼠和触控输入
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, rdown: false, clicked: false, rclicked: false };
    this.touchMode = false;
    this.touchMove = { x: 0, y: 0 };
    this.touchAim = null;
    this.touchFiring = false;
    this._bind();
  }

  _bind() {
    const block = new Set([
      'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab',
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyR', 'KeyE', 'KeyP', 'ShiftLeft', 'ShiftRight'
    ]);
    window.addEventListener('keydown', (e) => {
      if (block.has(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.clear());

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
      if (e.button === 2) { this.mouse.rdown = true; this.mouse.rclicked = true; }
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') return;
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rdown = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isDown(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  press(code) { this.pressed.add(code); }

  get firing() { return this.touchMode ? this.touchFiring : this.mouse.down; }

  setTouchAim(x, y) {
    this.touchFiring = x !== 0 || y !== 0;
    if (this.touchFiring) this.touchAim = Math.atan2(y, x);
  }

  clear() {
    this.keys.clear();
    this.mouse.down = false;
    this.mouse.rdown = false;
    this.endFrame();
  }

  /** 取用一次按键（消费掉，避免一帧内多次触发） */
  tap(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  moveVector() {
    if (this.touchMode) return this.touchMove;
    let x = 0, y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    if (x || y) {
      const l = Math.hypot(x, y);
      x /= l; y /= l;
    }
    return { x, y };
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
    this.mouse.rclicked = false;
  }
}
