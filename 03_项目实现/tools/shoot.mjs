// 用真实浏览器验证渲染与交互，并截图。node tools/shoot.mjs
// 截图固定写到本项目的 shots/（与脚本位置绑定，不受执行目录影响）
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/bhw/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.GAME_URL || 'http://127.0.0.1:8124/';
const SHOTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'shots');
const shot = (name) => join(SHOTS, name);

async function assertMenuTitle(page, wrapped) {
  const layout = await page.evaluate(() => {
    const words = Array.from(document.querySelectorAll('#p-menu .logo span'), word => word.getBoundingClientRect());
    const buttons = document.querySelector('#p-menu .btns').getBoundingClientRect();
    const wrapped = words[0].top !== words[1].top;
    const centers = wrapped
      ? words.map(word => word.x + word.width / 2)
      : [(words[0].left + words[1].right) / 2];
    return { wrapped, centers, buttonCenter: buttons.x + buttons.width / 2, pageCenter: innerWidth / 2 };
  });
  assert.equal(layout.wrapped, wrapped);
  assert.ok(Math.abs(layout.buttonCenter - layout.pageCenter) <= 1, '主菜单按钮应居中');
  for (const center of layout.centers) {
    assert.ok(Math.abs(center - layout.buttonCenter) <= 1, '标题每行应与主菜单按钮同轴');
  }
}

async function assertWeaponChoices(page, touch = false) {
  const openChoice = secondaryUnlocked => page.evaluate(secondaryUnlocked => {
    const g = window.__game;
    g.player.weapon = 'pistol';
    g.player.weaponStacks = { pistol: 1 };
    g.player.weaponStage2 = {};
    g.player.secondaryUnlocked = secondaryUnlocked;
    g.player.secondary = null;
    g.openWeaponChoice('catechism');
  }, secondaryUnlocked);
  const select = selector => {
    const item = page.locator(selector);
    return touch ? item.tap() : item.click();
  };

  await openChoice(false);
  const [current, next, keep, replace] = await Promise.all(
    ['#weaponCur', '#weaponNew', '#btnSalvage', '#btnEquip'].map(selector => page.locator(selector).boundingBox())
  );
  const center = box => box.x + box.width / 2;
  for (const prop of ['y', 'width', 'height']) {
    assert.ok(Math.abs(current[prop] - next[prop]) <= 1, '两张武器卡应等宽等高且顶部对齐');
  }
  assert.ok(Math.abs(keep.y - replace.y) <= 1 && Math.abs(keep.width - replace.width) <= 1, '保留和替换应在同一行各占一半');
  assert.ok(keep.x < replace.x);
  assert.ok(Math.abs((center(keep) + center(replace)) / 2 - (center(current) + center(next)) / 2) <= 1);
  assert.equal(await page.locator('#btnSecondary').isVisible(), false);
  await page.screenshot({ path: shot(touch ? 'v-mobile-weapon-choice.png' : 'v-weapon-choice.png'), scale: 'css' });

  for (const [selector, weapon] of [
    ['#weaponCur', 'pistol'],
    ['#weaponNew', 'catechism'],
    ['#btnSalvage', 'pistol'],
    ['#btnEquip', 'catechism']
  ]) {
    await openChoice(false);
    await select(selector);
    await page.waitForFunction(weapon => {
      const g = window.__game;
      return g.state === 'playing' && g.player.weapon === weapon;
    }, weapon);
  }

  await openChoice(true);
  await select('#btnSecondary');
  await page.waitForFunction(() => {
    const g = window.__game;
    return g.state === 'playing' && g.player.weapon === 'pistol' && g.player.secondary === 'catechism';
  });
}

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
for (const [width, height, wrapped] of [[1920, 1080, false], [1280, 720, false], [320, 640, true]]) {
  await page.setViewportSize({ width, height });
  await assertMenuTitle(page, wrapped);
  if (width !== 1920) await page.screenshot({ path: shot('v-title-' + width + '.png') });
}
await page.setViewportSize({ width: 1440, height: 900 });
console.log('MENU_TITLE_ALIGNMENT_OK');

await page.locator('#btnSurvival').click();
await assertWeaponChoices(page);
console.log('WEAPON_CHOICE_DESKTOP_OK');

// 开局 + 机器人快进到有战斗画面的时刻
await page.goto(URL + '?auto=survival&warm=1500&bot=1', { waitUntil: 'load' });
await page.waitForTimeout(1200);

// 机器人可能停在升级或捡枪面板，处理选择后再截图。
for (let i = 0; i < 6; i++) {
  const st = await page.evaluate(() => window.__game.state);
  if (st === 'levelup') await page.click('#perkCards .card');
  else if (st === 'weaponchoice') await page.click('#btnSalvage');
  else break;
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
  if (g.state === 'weaponchoice') g.chooseWeapon('salvage');
  if (g.state === 'dead') g.start('survival');
  g.gainXp(200);
});
await page.locator('#p-perks').waitFor();
await page.waitForTimeout(400);
await page.mouse.move(0, 0);
assert.equal(await page.locator('#perkCards .key').count(), 0);
const tagBottoms = await page.locator('#perkCards .tags').evaluateAll(tags => tags.map(tag => tag.getBoundingClientRect().bottom));
assert.equal(tagBottoms.length, 3);
assert.ok(Math.max(...tagBottoms) - Math.min(...tagBottoms) <= 1, '残响卡标签应底部对齐');
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

try {
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3
  });
  mobile.on('pageerror', (e) => logs.push('mobile pageerror: ' + e.message));
  await mobile.goto(URL + '?seed=touch-regression', { waitUntil: 'load' });
  await mobile.locator('#p-menu .rotate-hint').waitFor();
  assert.equal(await mobile.locator('#btnSurvival').isDisabled(), true);
  await assertMenuTitle(mobile, true);
  await mobile.screenshot({ path: shot('v-mobile-menu.png'), scale: 'css' });
  await mobile.setViewportSize({ width: 667, height: 375 });
  await mobile.locator('#btnSurvival').tap();
  await mobile.locator('#touchControls.active').waitFor();
  const cdp = await mobile.context().newCDPSession(mobile);
  const touch = (type, touchPoints = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const center = async (selector, id) => {
    const box = await mobile.locator(selector).boundingBox();
    return { id, x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const left = await center('#touchMove', 1);
  const right = await center('#touchAim', 2);
  const moved = { ...left, x: left.x + 40 };
  const aimed = { ...right, x: right.x - 40 };
  await touch('touchStart', [left, right]);
  await touch('touchMove', [moved, aimed]);
  await mobile.waitForFunction(() => {
    const g = window.__game;
    return g.player.vx > 40 && g.stats.shots > 0;
  });
  await mobile.screenshot({ path: shot('v-mobile-combat.png'), scale: 'css' });
  await touch('touchEnd', [moved]);
  assert.equal(await mobile.evaluate(() => window.__game.input.firing), true);

  // 按着射击时出现两次升级，旧触点不能选卡，一次新点按只选一张。
  await touch('touchMove', [{ ...aimed, x: aimed.x - 200, y: aimed.y - 110 }]);
  await mobile.evaluate(() => window.__game.gainXp(30));
  await touch('touchEnd');
  await mobile.locator('#p-perks').waitFor();
  assert.equal(await mobile.locator('#perkCards .key').count(), 0);
  assert.equal(await mobile.evaluate(() => window.__game.player.pendingLevels), 2);
  assert.equal(await mobile.evaluate(() => window.__game.input.firing), false);
  await mobile.locator('#btnReroll').tap();
  await mobile.waitForFunction(() => document.getElementById('btnReroll').disabled);
  await mobile.screenshot({ path: shot('v-mobile-perks.png'), scale: 'css' });
  await mobile.evaluate(() => {
    const overlay = document.getElementById('overlay');
    window.overlayObserver = new MutationObserver(() => { window.overlayChanged = true; });
    window.overlayObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  });
  await mobile.locator('#perkCards .card').first().tap();
  const afterPick = await mobile.evaluate(() => {
    window.overlayObserver.disconnect();
    return {
      pending: window.__game.player.pendingLevels,
      changed: !!window.overlayChanged,
      animation: getComputedStyle(document.getElementById('overlay')).animationName
    };
  });
  assert.deepEqual(afterPick, { pending: 1, changed: false, animation: 'none' });
  await mobile.locator('#perkCards .card').first().tap();

  await mobile.setViewportSize({ width: 375, height: 667 });
  await mobile.locator('#p-pause .rotate-hint').waitFor();
  assert.equal(await mobile.locator('#btnResume').isDisabled(), true);
  await mobile.screenshot({ path: shot('v-mobile-rotate.png'), scale: 'css' });
  await mobile.setViewportSize({ width: 667, height: 375 });
  await mobile.locator('#btnResume').tap();
  assert.equal(await mobile.evaluate(() => window.__game.state), 'playing');
  assert.equal(await mobile.evaluate(() => window.__game.input.firing), false);

  // 矮视口模拟浏览器工具栏占用空间，危险按钮不能覆盖装填或换枪。
  await mobile.setViewportSize({ width: 667, height: 265 });
  await mobile.waitForFunction(() => window.__game.vh === 265);
  await mobile.evaluate(() => {
    const p = window.__game.player;
    p.secondary = 'rifle';
    p.secondaryAmmo = 30;
    p.ammo = 4;
  });
  await mobile.locator('#touchSwap').waitFor();
  const buttons = ['#touchReload', '#touchSwap', '#touchDash'];
  const rects = await Promise.all(buttons.map(id => mobile.locator(id).boundingBox()));
  for (const [index, a] of rects.entries()) {
    assert.ok(a.width >= 44 && a.height >= 44);
    for (const b of rects.slice(index + 1)) {
      const overlaps = a.x < b.x + b.width && b.x < a.x + a.width
        && a.y < b.y + b.height && b.y < a.y + a.height;
      assert.equal(overlaps, false);
    }
  }
  await mobile.screenshot({ path: shot('v-mobile-short.png'), scale: 'css' });
  await mobile.locator('#touchReload').tap();
  await mobile.waitForFunction(() => window.__game.player.reloading > 0);
  assert.equal(await mobile.evaluate(() => window.__game.player.dashCd), 0);
  await assertWeaponChoices(mobile, true);
  console.log('WEAPON_CHOICE_TOUCH_OK');
  console.log('PERK_CARD_LAYOUT_OK');
  console.log('MOBILE_SHORT_VIEWPORT_OK');
  console.log('MOBILE_TOUCH_OK');
  console.log(logs.length ? '页面错误:\n' + logs.join('\n') : 'NO_PAGE_ERRORS');
  if (logs.length) process.exitCode = 1;
} finally {
  await browser.close();
}
