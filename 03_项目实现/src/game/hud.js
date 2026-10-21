import { clamp } from '../core/math.js';
import { WEAPONS, magSize } from './weapons.js';

const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

// 与 game.js 的 TIER_COLORS 同一套语义：箱子/提示都按等级上色
const TIER_COLORS_HUD = {
  1: 'rgba(168,196,224,0.9)',
  2: 'rgba(255,209,102,0.95)',
  3: 'rgba(124,231,255,0.95)',
  4: 'rgba(255,77,94,0.95)'
};

function bar(ctx, x, y, w, h, ratio, c1, c2, bg = 'rgba(0,0,0,0.55)') {
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  const ww = Math.max(0, (w - 2) * clamp(ratio, 0, 1));
  if (ww > 1) {
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, ww, h - 2, (h - 2) / 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, h / 2);
  ctx.stroke();
}

export function drawHud(ctx, g, w, h) {
  const p = g.player;
  if (!p) return;

  ctx.save();
  ctx.textBaseline = 'middle';

  // ---------- 左下：生命 + 经验 ----------
  const bx = 26, by = h - 74, bw = 268;

  // 生命
  const hpRatio = p.hp / p.maxHp;
  const low = hpRatio < 0.3;
  bar(ctx, bx, by, bw, 18, hpRatio, low ? '#ff3b4d' : '#e01b3c', low ? '#ff8a72' : '#ff5f6d');
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`, bx + 10, by + 9);

  // 等级徽标
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `700 11px ${FONT}`;
  ctx.fillText('等级', bx + bw - 8, by - 14);
  ctx.fillStyle = '#ffd166';
  ctx.font = `800 16px ${FONT}`;
  ctx.fillText(String(p.level), bx + bw - 8, by - 30);

  // 经验
  const xpRatio = p.xp / p.xpNext;
  bar(ctx, bx, by + 24, bw, 7, xpRatio, '#2fb4ff', '#7ce7ff', 'rgba(255,255,255,0.08)');

  // 侵蚀条（P4-3）：没有侵蚀刻印时整条不出现，避免开局多一条空条
  const er = clamp(p.erosion || 0, 0, 100);
  if (er > 0) {
    const hot = er >= 70;
    bar(ctx, bx, by + 34, bw, 5, er / 100, '#6b2b93', hot ? '#ff2d3f' : '#c8202b', 'rgba(255,255,255,0.07)');
    ctx.textAlign = 'right';
    ctx.font = `700 10px ${FONT}`;
    ctx.fillStyle = hot ? '#ff8a72' : 'rgba(196,160,220,0.8)';
    ctx.fillText(`侵蚀 ${Math.round(er)}`, bx + bw, by + 48);
  }

  // 层数提示（Perk 数量）
  const perks = Object.values(p.perkCounts).reduce((a, b) => a + b, 0);
  ctx.textAlign = 'left';
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText(`PERKS ${perks}`, bx, by + 48);

  // ---------- 右下：武器 ----------
  const wDef = WEAPONS[p.weapon];
  const cap = magSize(p.weapon, p.stats);
  const rx = w - 26;
  ctx.textAlign = 'right';

  ctx.font = `800 15px ${FONT}`;
  ctx.fillStyle = wDef.color || '#fff';
  ctx.fillText(wDef.name.toUpperCase(), rx, h - 84);

  ctx.font = `800 40px ${FONT}`;
  ctx.fillStyle = p.reloading > 0 ? 'rgba(255,255,255,0.35)' : '#fff';
  ctx.fillText(String(p.ammo), rx - 44, h - 50);
  ctx.font = `700 16px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('/ ' + cap, rx, h - 44);

  // 副武器常显：装在副武器槽里的枪必须一直看得见，
  // 否则"捡了三连发却没反应"会被当成 bug（原来装填时这一行会被藏掉）
  if (p.secondary) {
    ctx.font = `600 11px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fillText(`Q 切换 → ${WEAPONS[p.secondary].name}`, rx, h - 26);
  }

  if (p.reloading > 0) {
    const r = 1 - p.reloading / p.reloadTotal;
    const barY = p.secondary ? h - 15 : h - 28;
    bar(ctx, rx - 130, barY, 130, 6, r, '#ffd166', '#ff9f43', 'rgba(255,255,255,0.1)');
    ctx.font = `600 10px ${FONT}`;
    ctx.fillStyle = 'rgba(255,209,102,0.9)';
    ctx.textAlign = 'right';
    ctx.fillText('装填中', rx - 136, barY + 3);
  }

  // ---------- 左上：波次 / 击杀 ----------
  ctx.textAlign = 'left';
  ctx.font = `800 13px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(g.mode === 'quest' ? '层' : '潮汐', 26, 28);

  ctx.font = `800 26px ${FONT}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(g.mode === 'quest' ? (g.questName || '') : String(g.wave), 26, 52);

  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  const t = g.time;
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(Math.floor(t % 60)).padStart(2, '0');
  ctx.fillText(`${mm}:${ss}   击杀 ${g.kills}`, 26, 74);

  // ---------- 右上：分数 ----------
  ctx.textAlign = 'right';
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('SCORE', w - 26, 26);
  ctx.font = `800 24px ${FONT}`;
  ctx.fillStyle = '#ffd166';
  ctx.fillText(String(g.score), w - 26, 50);

  // ---------- 敌人计数 ----------
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText(`${g.enemies.length} 敌人在场`, w - 26, 74);

  // ---------- 中央横幅（潮汐 / 层间卡 / 层主条共用这一条通道） ----------
  if (g.banner.t > 0) {
    const b = g.banner;
    const total = b.total || 2.6;
    const elapsed = total - b.t;
    // 淡入 0.28s + 淡出 0.5s；不再"啪"地弹出来
    const a = Math.min(clamp(elapsed / 0.28, 0, 1), clamp(b.t / 0.5, 0, 1));
    const cy = h * 0.24;
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';

    if (b.kicker) {
      ctx.font = `800 13px ${FONT}`;
      ctx.fillStyle = 'rgba(255,146,158,0.95)';
      ctx.fillText(b.kicker, w / 2, cy - 40);
      // 眉批两侧的细线，做出"章节卡"的仪式感
      const kw = ctx.measureText(b.kicker).width;
      ctx.strokeStyle = 'rgba(255,146,158,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w / 2 - kw / 2 - 34, cy - 40);
      ctx.lineTo(w / 2 - kw / 2 - 10, cy - 40);
      ctx.moveTo(w / 2 + kw / 2 + 10, cy - 40);
      ctx.lineTo(w / 2 + kw / 2 + 34, cy - 40);
      ctx.stroke();
    }

    ctx.font = `900 46px ${FONT}`;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(b.text, w / 2 + 2, cy + 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(b.text, w / 2, cy);
    if (b.sub) {
      ctx.font = `600 14px ${FONT}`;
      ctx.fillStyle = 'rgba(255,120,130,0.95)';
      ctx.fillText(b.sub, w / 2, cy + 34);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- 拾取武器的大提示（S6-F） ----------
  if (g.toast) {
    const tst = g.toast;
    const a = Math.min(1, (tst.total - tst.t) / 0.14, tst.t / 0.45);
    const col = TIER_COLORS_HUD[tst.tier] || TIER_COLORS_HUD[1];
    const modeText = tst.mode === 'secondary' ? '副武器槽 · 按 Q 切换'
      : tst.mode === 'ammo' ? '弹药补满'
        : tst.mode === 'swap' ? '同级替换'
          : tst.mode === 'salvage' ? '弱于当前 · 转为补给' : '已装备';
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.textBaseline = 'middle';

    ctx.font = `900 22px ${FONT}`;
    const nameW = ctx.measureText(tst.name).width;
    ctx.font = `700 11px ${FONT}`;
    const tagW = 46;
    const modeW = ctx.measureText(modeText).width;
    const wBox = Math.min(w - 60, nameW + tagW + modeW + 82);
    const yb = 92;
    const x0 = w / 2 - wBox / 2;

    // 底板
    ctx.fillStyle = 'rgba(8,10,12,0.82)';
    ctx.beginPath();
    ctx.roundRect(x0, yb - 23, wBox, 46, 9);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.globalAlpha = Math.max(0, a) * 0.9;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = col;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.roundRect(x0 + 0.8, yb - 22.2, wBox - 1.6, 44.4, 9);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = Math.max(0, a);

    // 等级色条
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(x0 + 1, yb - 22, 5, 44, 2.5);
    ctx.fill();

    // 「拾取」
    ctx.textAlign = 'left';
    ctx.font = `800 11px ${FONT}`;
    ctx.fillStyle = col;
    ctx.fillText('拾 取', x0 + 16, yb);

    // 武器名
    ctx.font = `900 22px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(tst.name, x0 + 18 + tagW, yb);

    // 结果
    ctx.font = `700 12px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(modeText, x0 + 16 + tagW + nameW + 12, yb);
    ctx.restore();
  }

  // ---------- 低血预警 ----------
  if (hpRatio < 0.35) {
    const pulse = 0.18 + Math.sin(g.time * 6) * 0.06;
    const gd = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.62);
    gd.addColorStop(0, 'rgba(180,0,20,0)');
    gd.addColorStop(1, `rgba(180,0,20,${pulse * (1 - hpRatio / 0.35)})`);
    ctx.fillStyle = gd;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();
}
