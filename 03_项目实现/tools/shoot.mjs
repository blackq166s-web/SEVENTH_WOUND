// 用真实浏览器验证渲染与交互，并截图。node tools/shoot.mjs
// 截图固定写到本项目的 shots/（与脚本位置绑定，不受执行目录影响）
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/bhw/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.GAME_URL || 'http://127.0.0.1:8124/';
const SHOTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'shots');
const shot = (name) => join(SHOTS, name);

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu']
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(600);
await page.screenshot({ path: shot('v-menu.png') });

// 开局 + 机器人快进到有战斗画面的时刻
await page.goto(URL + '?auto=survival&warm=1500&bot=1', { waitUntil: 'load' });
await page.waitForTimeout(1200);

// 若停在升级界面，先选完技能再截图
for (let i = 0; i < 6; i++) {
  const st = await page.evaluate(() => window.__game.state);
  if (st !== 'levelup') break;
  await page.click('#perkCards .card');
  await page.waitForTimeout(150);
}
await page.screenshot({ path: shot('v-play.png') });

const state = await page.evaluate(() => {
  const g = window.__game;
  return {
    state: g.state,
    time: +g.time.toFixed(1),
    kills: g.kills,
    level: g.player.level,
    enemies: g.enemies.length,
    bullets: g.bullets.length,
    particles: g.particles.list.length,
    hp: Math.round(g.player.hp),
    zoom: g.cam.zoom,
    cam: [Math.round(g.cam.x), Math.round(g.cam.y)],
    player: [Math.round(g.player.x), Math.round(g.player.y)],
    cssSize: [g.vw, g.vh],
    canvasSize: [g.canvas.width, g.canvas.height]
  };
});
console.log('state:', state);

// 升级界面
await page.evaluate(() => {
  const g = window.__game;
  g.gainXp(200);
});
await page.waitForTimeout(400);
await page.screenshot({ path: shot('v-perks.png') });

const perkInfo = await page.evaluate(() => ({
  state: window.__game.state,
  cards: document.querySelectorAll('#perkCards .card').length,
  names: [...document.querySelectorAll('#perkCards .name')].map((n) => n.textContent)
}));
console.log('perks:', perkInfo);

// 选中第一个能力后继续游戏，检查长时间运行稳定性
await page.click('#perkCards .card');
await page.waitForTimeout(300);

for (let i = 0; i < 4; i++) {
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: shot('v-play2.png') });

const state2 = await page.evaluate(() => {
  const g = window.__game;
  return {
    state: g.state,
    time: +g.time.toFixed(1),
    kills: g.kills,
    level: g.player.level,
    enemies: g.enemies.length,
    particles: g.particles.list.length,
    fpsHint: g.time
  };
});
console.log('after:', state2);

// 关卡模式
await page.goto(URL + '?auto=quest&warm=600&bot=1', { waitUntil: 'load' });
await page.waitForTimeout(1200);
await page.screenshot({ path: shot('v-quest.png') });

// 高负载场景：90 秒，检查帧率与粒子/子弹数量
await page.goto(URL + '?auto=survival&warm=2700&bot=1', { waitUntil: 'load' });
await page.waitForTimeout(1000);
for (let i = 0; i < 8; i++) {
  const st = await page.evaluate(() => window.__game.state);
  if (st !== 'levelup') break;
  await page.click('#perkCards .card');
  await page.waitForTimeout(120);
}
const fps = await page.evaluate(
  () =>
    new Promise((res) => {
      let n = 0;
      const t0 = performance.now();
      const tick = () => {
        n++;
        const el = performance.now() - t0;
        if (el < 2000) requestAnimationFrame(tick);
        else res(+(n / (el / 1000)).toFixed(1));
      };
      requestAnimationFrame(tick);
    })
);
const load = await page.evaluate(() => {
  const g = window.__game;
  return {
    state: g.state,
    time: +g.time.toFixed(1),
    wave: g.wave,
    level: g.player.level,
    kills: g.kills,
    enemies: g.enemies.length,
    bullets: g.bullets.length,
    particles: g.particles.list.length,
    pickups: g.pickups.length
  };
});
console.log('高负载:', load, 'FPS:', fps);
await page.screenshot({ path: shot('v-busy.png') });

// 贴墙视角检查
await page.evaluate(() => {
  const g = window.__game;
  g.player.x = g.W / 2;
  g.player.y = 30;
  g.player.hp = g.player.maxHp;
  g.cam.snapTo(g.player.x, g.player.y);
});
await page.waitForTimeout(400);
await page.screenshot({ path: shot('v-wall.png') });

console.log(logs.length ? '页面错误:\n' + logs.join('\n') : 'NO_PAGE_ERRORS');
await browser.close();
