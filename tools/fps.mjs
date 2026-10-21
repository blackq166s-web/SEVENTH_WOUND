import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/bhw/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const measure = () => p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; const el = performance.now() - t0; if (el < 2000) requestAnimationFrame(tick); else res(+(n / (el / 1000)).toFixed(1)); }; requestAnimationFrame(tick); }));
await p.goto('http://127.0.0.1:8124/', { waitUntil: 'load' });
await p.waitForTimeout(500);
console.log('菜单(空渲染):', await measure());
await p.goto('http://127.0.0.1:8124/?auto=survival&warm=5400&bot=1', { waitUntil: 'load' });
await p.waitForTimeout(800);
for (let i = 0; i < 8; i++) { if (await p.evaluate(() => window.__game.state) !== 'levelup') break; await p.click('#perkCards .card'); await p.waitForTimeout(100); }
console.log('战斗(5400帧后):', await measure(), await p.evaluate(() => ({ e: window.__game.enemies.length, p: window.__game.particles.list.length, s: window.__game.state })));
await b.close();
