// 独白系统（STORY §9 独白原则：短、平、不解释，全部是陆沉自己嘟囔）
//
// 铁律（IMPLEMENT_PLAN §5）：独白不暂停 update、不阻塞输入、不改固定步长。
// 这里只维护一条队列和几个计时器，不碰任何游戏状态；渲染也只是画字。

const TYPE_SPEED = 26;   // 打字机速度：字/秒
const HOLD = 2.5;        // 打完停留（秒）
const FADE_IN = 0.18;
const FADE_OUT = 0.45;
const MAX_CHARS = 24;    // 单行上限：超过就换行写，别做长句（smoke 会校验）

export const MONO = {
  // 开局 0–30s：只交代"我在哪"，不解释怎么来的
  start: [
    '醒过来就在这儿了。',
    '枪还热着。谁刚死的？'
  ],
  // 30–90s：第一次拿到刻印，暗示残响在接管身体
  firstLevelUp: [
    '手比脑子快。这一枪不是我打的。'
  ],
  // 每次层主："它在等我"
  firstBoss: [
    '它身上那些伤……是枪伤。',
    '……七道。'
  ],
  // 首次低血
  firstLowHp: [
    '别在这儿躺下。'
  ],
  // 死亡：不走画布（死亡面板是 DOM，会盖住画布），由 ui.js 填进面板
  death: [
    '……还没完。'
  ]
};

/** 死亡面板引用的那句独白 */
export const DEATH_LINE = MONO.death[0];

export class Voice {
  constructor() {
    this.queue = [];
    this.cur = null;
    this.age = 0;
    this.seen = new Set();
  }

  /**
   * 播一组独白。同名只播一次（每局重置见 reset）。
   * @returns {boolean} 是否真的入队（用于断言与调试）
   */
  say(key) {
    if (this.seen.has(key)) return false;
    const lines = MONO[key];
    if (!lines || lines.length === 0) return false;
    this.seen.add(key);
    for (const text of lines) this.queue.push(text);
    if (!this.cur) this._next();
    return true;
  }

  /** 只压测试用：直接塞一句任意文本 */
  push(text) {
    this.queue.push(String(text));
    if (!this.cur) this._next();
    return this.queue.length;
  }

  _next() {
    this.cur = this.queue.length > 0 ? { text: this.queue.shift() } : null;
    this.age = 0;
  }

  /** 时长只跟字数有关，跟帧率无关，回放可复现 */
  get typeDuration() {
    return this.cur ? this.cur.text.length / TYPE_SPEED : 0;
  }

  get life() {
    return this.typeDuration + HOLD;
  }

  get visibleChars() {
    if (!this.cur) return 0;
    return Math.min(this.cur.text.length, Math.floor(this.age * TYPE_SPEED));
  }

  get alpha() {
    if (!this.cur) return 0;
    const fadeIn = Math.min(1, this.age / FADE_IN);
    const left = this.life - this.age;
    const fadeOut = Math.min(1, left / FADE_OUT);
    return Math.max(0, Math.min(fadeIn, fadeOut));
  }

  get active() {
    return !!this.cur;
  }

  update(dt) {
    if (!this.cur) return;
    this.age += dt;
    if (this.age >= this.life) this._next();
  }

  reset() {
    this.queue.length = 0;
    this.cur = null;
    this.age = 0;
    this.seen.clear();
  }
}

const FONT = '500 17px "Segoe UI", system-ui, -apple-system, "Microsoft YaHei", sans-serif';
const CARET_FONT = '700 15px "Segoe UI", system-ui, sans-serif';

export function drawVoice(ctx, g, w, h) {
  const v = g.voice;
  if (!v || !v.cur) return;
  // 只在真正进行中的战斗里露脸：暂停/升级/结算/死亡都有 DOM 面板盖着
  if (g.state !== 'playing') return;

  const a = v.alpha;
  if (a <= 0.01) return;

  const full = v.cur.text;
  const shown = full.slice(0, v.visibleChars);
  const y = h - 104;

  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = FONT;

  // 暗底衬条：混战里字必须压得住血迹和敌人
  const tw = ctx.measureText(full).width;
  const bw = Math.min(w - 120, tw + 52);
  ctx.fillStyle = 'rgba(6,7,9,0.45)';
  ctx.beginPath();
  ctx.roundRect(w / 2 - bw / 2, y - 17, bw, 34, 17);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillText(shown, w / 2 + 1, y + 1);
  ctx.fillStyle = 'rgba(228,234,242,0.95)';
  ctx.fillText(shown, w / 2, y);

  // 打字光标：字没打完时在末尾闪
  if (v.visibleChars < full.length) {
    const caretX = w / 2 + tw / 2 + 6;
    ctx.fillStyle = `rgba(255,120,130,${0.35 + Math.sin(g.time * 12) * 0.25})`;
    ctx.font = CARET_FONT;
    ctx.fillText('▌', caretX, y);
  }

  ctx.restore();
}

export const VOICE_LIMITS = { MAX_CHARS, TYPE_SPEED, HOLD };
