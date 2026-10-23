// 发布打包：把 src/ 下的 ES Module 内联成一个单文件 HTML（双击即玩，file:// 可用）。
//
// 这不是"构建"：开发时仍然直接跑 index.html + src/，一个构建步骤都不需要。
// 本脚本只在发版时产出发布物，原因只有一个——ES Module 在 file:// 下会被 CORS 拦住，
// 想做成"一个文件发给别人就能玩"，必须把模块内联。
//
// 运行： node tools/pack.mjs
// 产物： release/SEVENTH-WOUND-<version>.html  +  release/运行说明.txt
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { posix } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT_DIR = join(ROOT, 'release');
const ENTRY = 'main.js';

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;

// ---------- 1. 版本一致性 ----------
const rawHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
const vMatch = rawHtml.match(/id="verLine">v([\d.]+)</);
if (!vMatch) throw new Error('index.html 里找不到 id="verLine">vX.Y.Z< 的版本号');
if (vMatch[1] !== VERSION) {
  throw new Error(`版本号不一致：index.html = v${vMatch[1]}，package.json = ${VERSION}`);
}

const SCRIPT_TAG = '<script type="module" src="./src/main.js"></script>';
if (!rawHtml.includes(SCRIPT_TAG)) {
  throw new Error('index.html 里找不到入口 <script type="module" src="./src/main.js">');
}

// ---------- 2. 解析模块 ----------
const IMPORT_LINE = /^import\s+(.+?)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/;
const EXPORT_LINE = /^export\s+(const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/;

/** 把 import 子句转成"从模块对象取绑定"的代码 */
function parseImportClause(clause, key, fromKey, meta) {
  const c = clause.trim();
  if (c.startsWith('* as ')) {
    const name = c.slice(5).trim();
    return `const ${name} = __mods[${JSON.stringify(key)}];`;
  }
  if (c.startsWith('{')) {
    const inner = c.replace(/^\{|\}$/g, '');
    const parts = inner
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/\s+as\s+/, ': '));
    // meta: 记录被引用的名字，反查模块是否真的导出（防止打包出"静默 undefined"）
    for (const p of parts) {
      const imported = p.split(':')[0].trim();
      if (!meta[key].exports.includes(imported)) {
        throw new Error(`${fromKey} 引用了 ${key} 未导出的名字：${imported}`);
      }
    }
    return `const { ${parts.join(', ')} } = __mods[${JSON.stringify(key)}];`;
  }
  throw new Error(`${fromKey} 使用了不支持的 import 形式：${clause}`);
}

const meta = Object.create(null);
const order = [];

function load(key) {
  if (meta[key]) return;
  const file = join(SRC, key);
  if (!existsSync(file)) throw new Error(`找不到模块：${key}`);
  const raw = readFileSync(file, 'utf8');

  if (/\bimport\.meta\b/.test(raw)) throw new Error(`${key} 用了 import.meta，单文件内联不支持`);
  if (/^\s*import\s*\(/m.test(raw)) throw new Error(`${key} 用了动态 import()，单文件内联不支持`);

  const lines = raw.split('\n');
  const imports = [];
  const exportsList = [];
  const body = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^import\s/.test(line)) {
      const m = line.match(IMPORT_LINE);
      if (!m) throw new Error(`${key}:${i + 1} 的 import 不是单行写法（打包要求 import 一行写完）`);
      const spec = m[2];
      const depKey = posix.normalize(posix.join(posix.dirname(key), spec));
      load(depKey); // 先递归，保证依赖先求值
      imports.push({ clause: m[1], key: depKey, line: i + 1 });
      continue;
    }

    if (line.startsWith('export ')) {
      const m = line.match(EXPORT_LINE);
      if (!m) throw new Error(`${key}:${i + 1} 的导出形式不支持：${line.slice(0, 40)}`);
      exportsList.push(m[2]);
      body.push(line.slice('export '.length));
      continue;
    }

    body.push(line);
  }

  meta[key] = { key, imports, exports: exportsList, body: body.join('\n') };
  order.push(key);
}

load(ENTRY);

// ---------- 3. 拼装 ----------
const chunks = [];
chunks.push('/* SEVENTH WOUND — 单文件发布版（由 tools/pack.mjs 生成，别手改） */');
chunks.push('const __mods = Object.create(null);');

for (const key of order) {
  const mod = meta[key];
  const head = mod.imports.map((im) => '  ' + parseImportClause(im.clause, im.key, key, meta));
  chunks.push('');
  chunks.push(`__mods[${JSON.stringify(key)}] = (function () {`);
  chunks.push('  \'use strict\';');
  chunks.push(...head);
  chunks.push(mod.body.replace(/^/gm, '  '));
  chunks.push(`  return { ${mod.exports.join(', ')} };`);
  chunks.push('})();');
}

const bundle = chunks.join('\n');

// ---------- 3.5 精灵 PNG 内联（S8） ----------
// 开发模式下 loadPngSprites() 走 assets/sprites/<key>.png；
// 单文件里没有 assets 目录，这里把 PNG 转 base64 注入 window.__SPRITE_ASSETS__。
const SPRITE_KEYS = ['player', 'zombie', 'runner', 'spider', 'lizard', 'alien', 'brute'];
const ASSET_DIR = join(ROOT, 'assets', 'sprites');
const assetEntries = [];
for (const key of SPRITE_KEYS) {
  const f = join(ASSET_DIR, `${key}.png`);
  if (!existsSync(f)) {
    console.warn(`  警告：缺少精灵 ${key}.png，该角色将回落到代码绘制`);
    continue;
  }
  const b64 = readFileSync(f).toString('base64');
  assetEntries.push(`  ${JSON.stringify(key)}: 'data:image/png;base64,${b64}'`);
}
const assetBoot = assetEntries.length
  ? `window.__SPRITE_ASSETS__ = {\n${assetEntries.join(',\n')}\n};`
  : '';

// ---------- 3.6 武器图标 PNG 内联（S12） ----------
const WEAPON_ICON_KEYS = [
  'pistol', 'rifle', 'smg', 'shotgun', 'flamer', 'plasma', 'gauss', 'rocket', 'minigun',
  'whistle', 'catechism', 'acidbag', 'bonesaw', 'cryo', 'hymn', 'lightning', 'laser'
];
const WEAPON_ICON_DIR = join(ROOT, 'assets', 'weapon-icons');
const wIconEntries = [];
for (const key of WEAPON_ICON_KEYS) {
  const f = join(WEAPON_ICON_DIR, `${key}.png`);
  if (!existsSync(f)) {
    console.warn(`  警告：缺少武器图标 ${key}.png，该枪将回落到矢量图标`);
    continue;
  }
  const b64 = readFileSync(f).toString('base64');
  wIconEntries.push(`  ${JSON.stringify(key)}: 'data:image/png;base64,${b64}'`);
}
const wIconBoot = wIconEntries.length
  ? `window.__WEAPON_ICON_ASSETS__ = {\n${wIconEntries.join(',\n')}\n};`
  : '';

const outHtml = rawHtml.replace(
  SCRIPT_TAG,
  ['<script>', assetBoot, wIconBoot, '(function () {', bundle, '})();', '</script>'].join('\n')
);

// 自检：单文件里不该再有任何外链模块或相对资源
const leftovers = [
  [/<script[^>]+src=/, '<script src= 外链'],
  [/<link[^>]+href="\.\//, '相对路径样式表'],
  [/\bfrom\s+['"]\.\//, "残留 import './'"]
].filter(([re]) => re.test(outHtml));
if (leftovers.length) throw new Error('单文件里仍有外部依赖：' + leftovers.map((x) => x[1]).join('、'));

// ---------- 4. 写盘 ----------
mkdirSync(OUT_DIR, { recursive: true });
const outName = `SEVENTH-WOUND-${VERSION}.html`;
const outFile = join(OUT_DIR, outName);
writeFileSync(outFile, outHtml, 'utf8');

const readme = `SEVENTH WOUND · 第七道伤   v${VERSION}
========================================

双击 ${outName} 就能玩。
单文件：不装东西、不联网、不开服务；整个游戏（含美术与音效）都是代码现场生成的。

建议
  Chrome / Edge 打开，窗口建议 1280x720 以上。
  第一次点击或按键后才会出声（浏览器要求先有交互）。

操作
  WASD 移动 · 鼠标瞄准 · 按住左键射击
  R 装填 · Q 切副武器 · ESC 暂停 · M 静音
  升级时按 1 2 3 选刻印（三选一，可连续升级连续选）

两个模式
  竞技场 · 无尽潮汐   每 24 秒一次潮汐，每 5 次潮汐守层者苏醒
  下潜 · 六层回廊     6 关递进，清完六层回到竞技场

调试参数（接在地址栏后面）
  ?seed=xxx                        固定随机序列：同一 seed 每次跑出一模一样的数据
  ?auto=survival&warm=600&bot=1    自动开局并快进 600 帧（截图 / 自动化用）

存档
  最高分存在浏览器本地。若浏览器在 file:// 下禁用了本地存储，
  「最深残留」会一直是 0，不影响游戏。
`;
writeFileSync(join(OUT_DIR, '运行说明.txt'), readme, 'utf8');

const totalSrc = order.reduce((n, k) => n + readFileSync(join(SRC, k), 'utf8').length, 0);
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

console.log(`版本      : v${VERSION}`);
console.log(`模块      : ${order.length} 个（${order.join(', ')}）`);
console.log(`源码体积  : ${kb(totalSrc)}`);
console.log(`精灵内联  : ${assetEntries.length}/7 张 PNG（base64）`);
console.log(`图标内联  : ${wIconEntries.length}/17 张武器 PNG（base64）`);
console.log(`产物      : release/${outName}（${kb(outHtml.length)}）+ release/运行说明.txt`);
console.log('PACK_OK 单文件无外部依赖，可直接双击打开');
