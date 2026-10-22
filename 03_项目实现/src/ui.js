import { DEATH_LINE } from './game/voice.js';
import { synergyWith, RARITY_LABEL } from './game/perks.js';
import { WEAPONS, magSize } from './game/weapons.js';
import { getGunIcon } from './render/sprites.js';

const $ = (id) => document.getElementById(id);

// 刻印三路线（STORY §8）：钢铁=继承前人手艺 / 本能=身体被重铸 / 侵蚀=借地渊之力
const LINE_LABEL = { steel: '钢铁', instinct: '本能', erosion: '侵蚀' };

export class UI {
  constructor(game) {
    this.game = game;
    this.overlay = $('overlay');
    this.panels = {
      menu: $('p-menu'),
      perks: $('p-perks'),
      weapon: $('p-weapon'),
      dead: $('p-dead'),
      pause: $('p-pause'),
      clear: $('p-clear'),
      help: $('p-help')
    };
    this.perkCards = $('perkCards');
    this.weaponNew = $('weaponNew');
    this.weaponCur = $('weaponCur');
    this.weaponChoiceHint = $('weaponChoiceHint');
    this.deadStats = $('deadStats');
    this.clearText = $('clearText');
    this.nextIsLast = false;
    this._bind();
  }

  _bind() {
    const g = this.game;
    const on = (id, fn) => {
      const el = $(id);
      if (el) el.addEventListener('click', (e) => { e.stopPropagation(); g.audio.init(); g.audio.resume(); fn(); });
    };

    on('btnSurvival', () => g.start('survival'));
    on('btnQuest', () => g.start('quest'));
    on('btnHelp', () => this.show('help'));
    on('btnBack', () => this.show('menu'));
    on('btnRetry', () => g.start(g.mode));
    on('btnMenu', () => this.toMenu());
    on('btnMenu2', () => this.toMenu());
    on('btnResume', () => { g.setState('playing'); this.hide(); });
    on('btnQuit', () => this.toMenu());
    on('btnNext', () => this.nextLevel());
    on('btnReroll', () => { if (g.rerollPerks()) this.showPerks(g.perkChoices, g.player); });
    on('btnEquip', () => g.chooseWeapon('equip'));
    on('btnSecondary', () => g.chooseWeapon('secondary'));
    on('btnSalvage', () => g.chooseWeapon('salvage'));
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
    this.overlay.classList.add('on');
    for (const k of Object.keys(this.panels)) {
      this.panels[k].classList.toggle('hidden', k !== name);
    }
    if (name === 'menu') {
      const best = $('bestScore');
      if (best) best.textContent = String(this.game.best);
    }
  }

  hide() {
    this.overlay.classList.remove('on');
    for (const k of Object.keys(this.panels)) this.panels[k].classList.add('hidden');
  }

  showPerks(perks, player) {
    const g = this.game;
    this.perkCards.innerHTML = '';
    perks.forEach((perk, i) => {
      const stacks = player.perkCounts[perk.id] || 0;
      const rarity = perk.rarity || 'common';
      const syn = synergyWith(player, perk);
      const card = document.createElement('button');
      card.className = 'card rar-' + rarity;
      card.style.setProperty('--accent', perk.color);
      card.innerHTML = `
        <span class="key">${i + 1}</span>
        <span class="icon">${perk.icon}</span>
        <span class="tags">
          <span class="ln ${perk.line}">${LINE_LABEL[perk.line] || '残响'}</span>
          <span class="rar ${rarity}">${RARITY_LABEL[rarity] || ''}</span>
        </span>
        <span class="name">${perk.name}</span>
        <span class="desc">${perk.desc}</span>
        ${syn.length ? `<span class="syn">＋协同 ${syn.map((x) => x.name).join(' · ')}</span>` : ''}
        ${stacks > 0 ? `<span class="stacks">已持有 ×${stacks}</span>` : ''}
      `;
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        g.audio.init();
        g.audio.click();
        this.hide();
        g.pickPerk(perk);
      });
      this.perkCards.appendChild(card);
    });
    // 重掷按钮：本局只能用一次，用掉就置灰
    const rr = $('btnReroll');
    if (rr) {
      const used = this.game.rerollUsed;
      rr.disabled = used;
      rr.textContent = used ? '本局已重掷过' : '重掷（R）· 本局一次';
    }
    this.show('perks');
  }

  /**
   * 武器选择面板（S9-A 手动替换）：新武器 vs 当前武器，玩家明确选择。
   * 1 装备 / 2 副武器（槽空时）/ 3 放弃。
   */
  showWeaponChoice(id) {
    const g = this.game;
    const p = g.player;
    const nw = WEAPONS[id];
    const cw = WEAPONS[p.weapon];

    const card = (w, key, wid, extra, accent) => {
      const icon = getGunIcon(wid);
      let iconUrl = '';
      try { iconUrl = icon.canvas.toDataURL('image/png'); } catch (err) { /* 桩环境无 toDataURL，跳过图标 */ }
      const iconHtml = iconUrl ? `<img class="wicon" src="${iconUrl}" alt="" />` : '';
      return `
      <div class="wcard" style="--accent:${accent || w.color || '#fff'}">
        <span class="key">${key}</span>
        ${iconHtml}
        <span class="wname">${w.name}</span>
        <span class="wdesc">${w.desc || ''}</span>
        <span class="wstat">伤害 ${w.dmg} · 射速 ${(1 / (w.rate || 0.1)).toFixed(1)}/s · 弹匣 ${w.mag}</span>
        ${extra || ''}
      </div>`;
    };

    const hasSecondary = p.secondaryUnlocked && !p.secondary;
    this.weaponNew.innerHTML = card(nw, '新', id, '', nw.color);
    this.weaponCur.innerHTML = card(cw, '现', p.weapon, '', cw.color);
    this.weaponChoiceHint.textContent = hasSecondary
      ? '按 1 装备 · 2 放副武器 · 3 放弃'
      : '按 1 装备 · 3 放弃（副武器槽未解锁）';

    const btnSec = $('btnSecondary');
    if (btnSec) btnSec.style.display = hasSecondary ? '' : 'none';

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
    this.show('pause');
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
