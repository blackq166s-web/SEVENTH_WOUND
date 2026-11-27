import { DEATH_LINE } from './game/voice.js';
import { synergyWith, RARITY_LABEL, PERKS } from './game/perks.js';
import { WEAPONS, magSize, isStage2 } from './game/weapons.js';
import { swapWeapon, weaponStackCount } from './game/player.js';
import { ENEMY_TYPES } from './game/enemies.js';
import { getGunIcon, getSpriteDataUrl, getPerkIcon } from './render/sprites.js';

const $ = (id) => document.getElementById(id);
let lastTouchTap = null;

function bindTap(element, activate) {
  let touch = null;
  element.addEventListener('pointerdown', (e) => {
    lastTouchTap = null;
    touch = e.pointerType === 'touch' ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
  });
  element.addEventListener('pointercancel', (e) => { if (touch?.id === e.pointerId) touch = null; });
  element.addEventListener('pointerup', (e) => {
    if (touch?.id !== e.pointerId) return;
    const distance = Math.hypot(e.clientX - touch.x, e.clientY - touch.y);
    touch = null;
    // 记录触点，避免浏览器把合成 click 分配给刚重绘的刻印卡。
    lastTouchTap = { id: e.pointerId, x: e.clientX, y: e.clientY, time: e.timeStamp };
    if (element.disabled || distance > 12) return;
    if (!element.contains(document.elementFromPoint(e.clientX, e.clientY))) return;
    activate(e);
  });
  element.addEventListener('click', (e) => {
    if (lastTouchTap && e.detail > 0) {
      const samePointer = e.pointerType === 'touch' && e.pointerId === lastTouchTap.id;
      const legacyTouch = !e.pointerType && e.timeStamp - lastTouchTap.time < 500
        && Math.hypot(e.clientX - lastTouchTap.x, e.clientY - lastTouchTap.y) <= 2;
      if (samePointer || legacyTouch) return;
    }
    activate(e);
  });
}

function bindStick(element, onChange) {
  const knob = element.firstElementChild;
  let active = null;

  function release() {
    if (active === null) return;
    // 清空游戏输入。浏览器在抬手或取消时释放捕获，让旧触点停留在摇杆上。
    active = null;
    knob.style.transform = '';
    onChange(0, 0);
  }

  function move(e) {
    if (e.pointerId !== active) return;
    const bounds = element.getBoundingClientRect();
    const dx = e.clientX - (bounds.left + bounds.width / 2);
    const dy = e.clientY - (bounds.top + bounds.height / 2);
    const distance = Math.hypot(dx, dy);
    const radius = bounds.width / 3;
    const limit = Math.min(radius, distance);
    const nx = dx / (distance || 1);
    const ny = dy / (distance || 1);
    const strength = Math.max(0, (limit / radius - 0.15) / 0.85);
    knob.style.transform = 'translate(' + nx * limit + 'px, ' + ny * limit + 'px)';
    onChange(nx * strength, ny * strength);
  }

  element.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || active !== null) return;
    e.preventDefault();
    active = e.pointerId;
    element.setPointerCapture(active);
    move(e);
  });
  element.addEventListener('pointermove', move);
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    element.addEventListener(name, (e) => { if (e.pointerId === active) release(); });
  }
  return release;
}

// 刻印三路线（STORY §8）：钢铁=继承前人手艺 / 本能=身体被重铸 / 侵蚀=借地渊之力
const LINE_LABEL = { steel: '钢铁', instinct: '本能', erosion: '侵蚀' };

export class UI {
  constructor(game) {
    this.game = game;
    this.overlay = $('overlay');
    this.touchControls = $('touchControls');
    this.coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    this.portrait = false;
    this.panelName = 'menu';
    this.displayedPanel = 'menu';
    this.safeTop = this.safeLeft = this.safeRight = this.safeBottom = 0;
    this.panels = {
      menu: $('p-menu'),
      perks: $('p-perks'),
      weapon: $('p-weapon'),
      dead: $('p-dead'),
      pause: $('p-pause'),
      clear: $('p-clear'),
      codex: $('p-codex')
    };
    this.perkCards = $('perkCards');
    this.weaponNew = $('weaponNew');
    this.weaponCur = $('weaponCur');
    this.deadStats = $('deadStats');
    this.clearText = $('clearText');
    this.codexGrid = $('codexGrid');
    this.codexTab = 'enemy';
    this.nextIsLast = false;
    this._bind();
    this.setTouchLayout(this.coarsePointer);
    this.releaseSticks = [
      bindStick($('touchMove'), (x, y) => { game.input.touchMove.x = x; game.input.touchMove.y = y; }),
      bindStick($('touchAim'), (x, y) => game.input.setTouchAim(x, y))
    ];
  }

  _bind() {
    const g = this.game;
    const on = (id, fn) => {
      const el = $(id);
      if (el) bindTap(el, (e) => { e.stopPropagation(); g.audio.init(); g.audio.resume(); fn(e); });
    };

    on('btnSurvival', (e) => this.start('survival', e));
    on('btnCodex', () => this.showCodex('enemy'));
    on('btnCodexBack', () => this.show('menu'));
    on('btnRetry', (e) => this.start(g.mode, e));
    on('btnMenu', () => this.toMenu());
    on('btnMenu2', () => this.toMenu());
    on('btnResume', () => g.resume());
    on('btnQuit', () => this.toMenu());
    on('btnNext', () => this.nextLevel());
    on('btnReroll', () => g.rerollPerks());
    const equip = () => g.chooseWeapon('equip');
    const keep = () => g.chooseWeapon('salvage');
    on('weaponNew', equip);
    on('btnEquip', equip);
    on('btnSecondary', () => g.chooseWeapon('secondary'));
    on('weaponCur', keep);
    on('btnSalvage', keep);
    on('btnMuteTouch', () => { g.audio.toggleMute(); this.updatePauseButtons(); });
    on('btnLockTouch', () => { g.toggleWeaponLock(g.player); this.updatePauseButtons(); });
    on('btnSwapTouch', () => { swapWeapon(g, g.player); g.resume(); });
    on('touchPause', () => g.pause());

    // 图鉴标签切换
    on('tabEnemy', () => this.showCodex('enemy'));
    on('tabWeapon', () => this.showCodex('weapon'));
    on('tabPerk', () => this.showCodex('perk'));
  }

  setTouchLayout(enabled) {
    this.game.input.touchMode = enabled;
    document.body.classList.toggle('touch-layout', enabled);
    this.syncPanel();
  }

  setViewport(width, height) {
    const style = getComputedStyle(document.documentElement);
    this.safeTop = parseFloat(style.getPropertyValue('--safe-top')) || 0;
    this.safeLeft = parseFloat(style.getPropertyValue('--safe-left')) || 0;
    this.safeRight = parseFloat(style.getPropertyValue('--safe-right')) || 0;
    this.safeBottom = parseFloat(style.getPropertyValue('--safe-bottom')) || 0;
    const portrait = height > width;
    if (this.portrait === portrait) return;
    this.portrait = portrait;
    document.body.classList.toggle('portrait-view', portrait);
    if (this.game.input.touchMode) this.releaseTouch();
  }

  start(mode, e) {
    this.setTouchLayout(this.coarsePointer || e.pointerType === 'touch');
    if (this.game.input.touchMode && document.fullscreenEnabled && !document.fullscreenElement) {
      // 保留点按产生的用户激活。浏览器拒绝全屏时仍可开局。
      document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
    }
    this.game.start(mode);
  }

  releaseTouch() {
    for (const release of this.releaseSticks) release();
    if (this.game.input.touchMode) this.game.input.clear();
  }

  toMenu() {
    this.game.setState('menu');
    this.game.audio.init();
    this.show('menu');
    const best = $('bestScore');
    if (best) best.textContent = String(this.game.best);
  }

  nextLevel() {
    const g = this.game;
    if (this.nextIsLast) {
      g.start('quest');
      return;
    }
    g.enemies.length = 0;
    g.bullets.length = 0;
    g.pickups.length = 0;
    g.player.x = g.W / 2;
    g.player.y = g.H / 2;
    g.player.hp = Math.min(g.player.maxHp, g.player.hp + 35);
    g.cam.snapTo(g.player.x, g.player.y);
    g.loadQuest(g.questIndex + 1);
    g.setState('playing');
    this.hide();
  }

  show(name) {
    this.panelName = name;
    if (this.game.input.touchMode) this.releaseTouch();
    this.syncPanel();
    if (name === 'menu') {
      const best = $('bestScore');
      if (best) best.textContent = String(this.game.best);
    }
  }

  hide() {
    this.panelName = null;
    this.syncPanel();
  }

  syncPanel() {
    const name = this.panelName;
    if (name === this.displayedPanel) return;
    this.displayedPanel = name;
    this.overlay.classList.toggle('on', name !== null);
    for (const k of Object.keys(this.panels)) this.panels[k].classList.toggle('hidden', k !== name);
    const controlsVisible = name === null && this.game.input.touchMode;
    this.touchControls.classList.toggle('active', controlsVisible);
    this.touchControls.inert = !controlsVisible;
  }

  /**
   * 图鉴（S14）：三个标签页——地渊造物 / 武器 / 刻印。
   * 复用 PNG 角色精灵 + 武器图标，数据驱动，与选择面板同一套极简卡片语言。
   */
  showCodex(tab = 'enemy') {
    this.codexTab = tab;
    // 标签高亮
    const tabs = { enemy: $('tabEnemy'), weapon: $('tabWeapon'), perk: $('tabPerk') };
    for (const [key, el] of Object.entries(tabs)) {
      if (el) el.classList.toggle('on', key === tab);
    }

    if (tab === 'enemy') this.renderCodexEnemies();
    else if (tab === 'weapon') this.renderCodexWeapons();
    else this.renderCodexPerks();

    this.show('codex');
  }

  renderCodexEnemies() {
    this.codexGrid.innerHTML = '';
    const order = ['zombie', 'runner', 'spider', 'lizard', 'alien', 'brute'];
    for (const key of order) {
      const e = ENEMY_TYPES[key];
      const url = getSpriteDataUrl(key);
      const cell = document.createElement('div');
      cell.className = 'codex-cell';
      cell.style.setProperty('--accent', e.blood || '#7ce7ff');
      cell.innerHTML = `
        ${url ? `<img class="c-icon" src="${url}" alt="" />` : `<span class="c-icon badge">${e.name[0]}</span>`}
        <span class="c-name">${e.name}</span>
        <span class="c-line">${e.isBoss ? '守 门 人' : '地 渊 造 物'}</span>
        <span class="c-threat">${e.threat || ''}</span>
        <span class="c-lore">${e.lore || ''}</span>
      `;
      this.codexGrid.appendChild(cell);
    }
  }

  renderCodexWeapons() {
    this.codexGrid.innerHTML = '';
    const order = ['pistol', 'whistle', 'rifle', 'smg', 'shotgun', 'catechism', 'flamer', 'plasma', 'acidbag', 'bonesaw', 'lightning', 'gauss', 'rocket', 'minigun', 'cryo', 'hymn', 'laser'];
    for (const id of order) {
      const w = WEAPONS[id];
      const icon = getGunIcon(id);
      let url = '';
      try { url = icon.canvas.toDataURL('image/png'); } catch (err) { /* 桩环境 */ }
      // 射程（S21）：子弹存活时间 × 速度；激光贯穿全屏
      const range = w.kind === 'beam' ? '全屏贯穿' : `${Math.round((w.life || 1) * (w.speed || 900))}px`;
      const cell = document.createElement('div');
      cell.className = 'codex-cell';
      cell.style.setProperty('--accent', w.color || '#fff');
      cell.innerHTML = `
        ${url ? `<img class="c-icon" src="${url}" alt="" />` : `<span class="c-icon badge">${w.name[0]}</span>`}
        <span class="c-name">${w.name}</span>
        <span class="c-line">第 ${w.tier} 阶 · 射程 ${range}</span>
        <span class="c-threat">${w.desc || ''}</span>
        <span class="c-lore">伤害 ${w.dmg} · 弹匣 ${w.mag}</span>
        <span class="c-lore" style="color:rgba(255,209,102,0.75)">二阶段：${w.s2 ? w.s2.s2desc : '—'}</span>
      `;
      this.codexGrid.appendChild(cell);
    }
  }

  renderCodexPerks() {
    this.codexGrid.innerHTML = '';
    for (const perk of PERKS) {
      const icon = getPerkIcon(perk.id);
      let iconUrl = '';
      try { iconUrl = icon.canvas.toDataURL('image/png'); } catch (err) { /* 桩环境 */ }
      const cell = document.createElement('div');
      cell.className = 'codex-cell';
      cell.style.setProperty('--accent', perk.color || '#7ce7ff');
      cell.innerHTML = `
        ${iconUrl ? `<img class="c-icon" src="${iconUrl}" alt="" />` : `<span class="c-icon badge">${perk.icon || perk.name[0]}</span>`}
        <span class="c-name">${perk.name}</span>
        <span class="c-line">${LINE_LABEL[perk.line] || '残响'}${perk.max ? ' · 叠 ' + perk.max : ''}</span>
        <span class="c-lore">${perk.desc}</span>
      `;
      this.codexGrid.appendChild(cell);
    }
  }

  showPerks(perks, player) {
    const g = this.game;
    this.perkCards.innerHTML = '';
    perks.forEach((perk, i) => {
      const stacks = player.perkCounts[perk.id] || 0;
      const rarity = perk.rarity || 'common';
      const syn = synergyWith(player, perk);
      const icon = getPerkIcon(perk.id);
      let iconUrl = '';
      try { iconUrl = icon.canvas.toDataURL('image/png'); } catch (err) { /* 桩环境 */ }
      const card = document.createElement('button');
      card.className = 'card rar-' + rarity;
      card.setAttribute('aria-keyshortcuts', String(i + 1));
      card.style.setProperty('--accent', perk.color);
      card.innerHTML = `
        ${iconUrl ? `<img class="picon" src="${iconUrl}" alt="" />` : `<span class="icon">${perk.icon}</span>`}
        <span class="name">${perk.name}</span>
        <span class="desc">${perk.desc}</span>
        ${syn.length ? `<span class="syn">＋协同 ${syn.map((x) => x.name).join(' · ')}</span>` : ''}
        <span class="tags">
          <span class="ln ${perk.line}">${LINE_LABEL[perk.line] || '残响'}</span>
          <span class="rar ${rarity}">${RARITY_LABEL[rarity] || ''}</span>
          ${stacks > 0 ? `<span class="stacks">已持有 ×${stacks}</span>` : ''}
        </span>
      `;
      bindTap(card, (e) => {
        e.stopPropagation();
        g.audio.init();
        g.audio.click();
        g.pickPerk(perk);
      });
      this.perkCards.appendChild(card);
    });
    // 重掷按钮：本局只能用一次，用掉就置灰
    const rr = $('btnReroll');
    if (rr) {
      const used = this.game.rerollUsed;
      rr.disabled = used;
      rr.textContent = used ? '本局已重掷过' : '重掷 · 本局一次';
    }
    this.show('perks');
  }

  /**
   * 武器选择面板（S9-A 手动替换）：新武器 vs 当前武器，玩家明确选择。
   * 1 替换 / 2 副武器（槽空时）/ 3 保留。
   */
  showWeaponChoice(id) {
    const g = this.game;
    const p = g.player;

    // 射程（S21）：子弹存活时间 × 飞行速度；激光为贯穿全屏
    const rangeOf = (w) => {
      if (w.kind === 'beam') return '全屏贯穿';
      const px = (w.life || 1) * (w.speed || 900);
      return `${Math.round(px)}px`;
    };
    // 二阶段状态（S21）
    const stageOf = (wid) => {
      const stacks = weaponStackCount(p, wid);
      if (isStage2(p, wid)) return { text: `二阶段 · ${WEAPONS[wid].s2.s2desc}`, cls: 's2' };
      if (stacks >= 1) return { text: `再捡 1 把觉醒二阶段`, cls: 's2hint' };
      return null;
    };

    const renderCard = (element, wid, label, action) => {
      const w = WEAPONS[wid];
      const icon = getGunIcon(wid);
      let iconUrl = '';
      try { iconUrl = icon.canvas.toDataURL('image/png'); } catch (err) { /* 桩环境无 toDataURL，跳过图标 */ }
      const iconHtml = iconUrl ? `<img class="wicon" src="${iconUrl}" alt="" />` : '';
      const s2 = stageOf(wid);
      element.style.setProperty('--accent', w.color || '#fff');
      element.setAttribute('aria-label', action + w.name);
      element.innerHTML = `
        <span class="key">${label}</span>
        ${iconHtml}
        <span class="wname">${w.name}</span>
        <span class="wdesc">${w.desc || ''}</span>
        <span class="wstat">伤害 ${w.dmg} · 射速 ${(1 / (w.rate || 0.1)).toFixed(1)}/s · 弹匣 ${w.mag}</span>
        <span class="wstat">射程 ${rangeOf(w)}</span>
        ${s2 ? `<span class="wstage ${s2.cls}">${s2.text}</span>` : ''}`;
    };

    renderCard(this.weaponCur, p.weapon, '当前', '保留 ');
    renderCard(this.weaponNew, id, '新拾取', '替换为 ');
    $('btnSecondary').hidden = !p.secondaryUnlocked || !!p.secondary;
    this.show('weapon');
  }

  showDead(s) {
    // 死亡独白走 DOM：死亡面板会盖住画布，画上去就看不见了
    const dv = $('deadVoice');
    if (dv) dv.textContent = DEATH_LINE;
    const rows = [
      ['残留时长', fmtTime(s.time)],
      ['击杀', String(s.kills)],
      ['残响等级', String(s.level)],
      ['最高侵蚀', String(s.maxErosion || 0)],
      ['潮汐', String(s.wave)],
      ['残响量', String(s.score)],
      ['最深残留', String(s.best)]
    ];
    this.deadStats.innerHTML = rows
      .map(([k, v]) => `<div class="srow"><span>${k}</span><b>${v}</b></div>`)
      .join('');
    this.show('dead');
  }

  showPause() {
    this.updatePauseButtons();
    this.show('pause');
  }

  updatePauseButtons() {
    if (!this.game.input.touchMode) return;
    const muted = this.game.audio.muted;
    const locked = !!this.game.player?.weaponLocked;
    const mute = $('btnMuteTouch');
    const lock = $('btnLockTouch');
    $('btnSwapTouch').hidden = !this.game.player?.secondary;
    mute.textContent = muted ? '取消静音' : '静音';
    mute.setAttribute('aria-pressed', String(muted));
    lock.textContent = locked ? '解锁武器' : '锁定武器';
    lock.setAttribute('aria-pressed', String(locked));
  }

  showClear(def, index, isLast, s) {
    this.nextIsLast = isLast;
    this.clearText.innerHTML = isLast
      ? `<b>${def.name}</b> 已清理 —— 六层回廊到头了，下面就是竞技场。<br/><span class="dim">残响量 ${s.score} · 击杀 ${s.kills} · 等级 ${s.level}</span>`
      : `<b>${def.name}</b> 已清空。<br/><span class="dim">残响量 ${s.score} · 击杀 ${s.kills} · 生命 ${Math.ceil(this.game.player.hp)}</span>`;
    const btn = $('btnNext');
    if (btn) btn.textContent = isLast ? '再入地渊' : '继续下潜';
    this.show('clear');
  }
}

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
