// 最小 DOM / Canvas 桩：让 node 里能直接跑 Game（无需浏览器）
// 供 tools/smoke.mjs 与 tools/determinism.mjs 共用。
// 必须在 import 任何 src/ 模块之前调用 installDom()。

const noop = () => {};

export function makeCtx(canvas) {
  const target = {
    canvas,
    measureText: () => ({ width: 12 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({ setTransform: noop }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    save: noop,
    restore: noop
  };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

export function makeCanvas(w = 300, h = 150) {
  const c = { width: w, height: h, style: {} };
  c.getContext = () => (c._ctx || (c._ctx = makeCtx(c)));
  return c;
}

export class El {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.style = { setProperty: noop };
    this._cls = new Set();
    this.classList = {
      add: (c) => this._cls.add(c),
      remove: (c) => this._cls.delete(c),
      toggle: (c, on) => { if (on) this._cls.add(c); else this._cls.delete(c); },
      contains: (c) => this._cls.has(c)
    };
    this.innerHTML = '';
    this.textContent = '';
  }
  addEventListener() {}
  removeEventListener() {}
  appendChild(c) { this.children.push(c); return c; }
  setAttribute() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
  focus() {}
}

export function installDom() {
  const elements = new Map();
  globalThis.document = {
    createElement: (tag) => (tag === 'canvas' ? makeCanvas() : new El(tag)),
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, new El());
      return elements.get(id);
    },
    addEventListener: noop,
    hidden: false,
    body: new El('body')
  };

  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    addEventListener: noop,
    removeEventListener: noop
  };

  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v))
  };
  globalThis.performance = { now: () => Date.now() };
  globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 16);

  return { elements, store };
}

export const STEP = 1 / 60;
