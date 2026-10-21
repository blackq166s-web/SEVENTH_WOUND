import { clamp } from '../core/math.js';
import { WEAPONS, magSize } from './weapons.js';

const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

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

  // 层数提示（Perk 数量）
  const perks = Object.values(p.perkCounts).reduce((a, b) => a + b, 0);
  ctx.textAlign = 'left';
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText(`PERKS ${perks}`, bx, by + 44);

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

  if (p.reloading > 0) {
    const r = 1 - p.reloading / p.reloadTotal;
    bar(ctx, rx - 130, h - 28, 130, 6, r, '#ffd166', '#ff9f43', 'rgba(255,255,255,0.1)');
    ctx.font = `600 10px ${FONT}`;
    ctx.fillStyle = 'rgba(255,209,102,0.9)';
    ctx.textAlign = 'right';
    ctx.fillText('装填中', rx, h - 38);
  } else if (p.secondary) {
    ctx.font = `600 11px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(`Q 切换 → ${WEAPONS[p.secondary].name}`, rx, h - 26);
  }

  // ---------- 左上：波次 / 击杀 ----------
  ctx.textAlign = 'left';
  ctx.font = `800 13px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(g.mode === 'quest' ? '关卡' : '波次', 26, 28);

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

  // ---------- 中央横幅 ----------
  if (g.banner.t > 0) {
    const a = clamp(g.banner.t / 0.6, 0, 1);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = `900 46px ${FONT}`;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(g.banner.text, w / 2 + 2, h * 0.24 + 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(g.banner.text, w / 2, h * 0.24);
    if (g.banner.sub) {
      ctx.font = `600 14px ${FONT}`;
      ctx.fillStyle = 'rgba(255,120,130,0.95)';
      ctx.fillText(g.banner.sub, w / 2, h * 0.24 + 34);
    }
    ctx.globalAlpha = 1;
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
