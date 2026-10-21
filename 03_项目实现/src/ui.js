const $ = (id) => document.getElementById(id);

export class UI {
  constructor(game) {
    this.game = game;
    this.overlay = $('overlay');
    this.panels = {
      menu: $('p-menu'),
      perks: $('p-perks'),
      dead: $('p-dead'),
      pause: $('p-pause'),
      clear: $('p-clear'),
      help: $('p-help')
    };
    this.perkCards = $('perkCards');
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
      const card = document.createElement('button');
      card.className = 'card';
      card.style.setProperty('--accent', perk.color);
      card.innerHTML = `
        <span class="key">${i + 1}</span>
        <span class="icon">${perk.icon}</span>
        <span class="name">${perk.name}</span>
        <span class="desc">${perk.desc}</span>
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
    this.show('perks');
  }

  showDead(s) {
    const rows = [
      ['残留时长', fmtTime(s.time)],
      ['击杀', String(s.kills)],
      ['残响等级', String(s.level)],
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
