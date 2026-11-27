import { clamp } from '../core/math.js';
import { WEAPONS, magSize } from './weapons.js';
import { getGunIcon } from '../render/sprites.js';

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

function clockText(t) {
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(Math.floor(t % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
}

function drawMobileStatus(ctx, g, w, hpRatio) {
  const p = g.player;
  const { safeTop: top, safeLeft, safeRight } = g.ui;
  const left = safeLeft + 14;
  const right = w - safeRight - 66;
  const width = clamp((w - safeLeft - safeRight) * 0.31, 92, 116);
  const low = hpRatio < 0.3;

  ctx.textAlign = 'left';
  ctx.font = `800 13px ${FONT}`;
  ctx.fillStyle = '#f4f5f8';
  const wave = g.mode === 'quest' ? (g.questName || '') : `潮汐 ${g.wave}`;
  ctx.fillText(wave, left, top + 19, width - 37);
  ctx.textAlign = 'right';
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = 'rgba(235,239,247,0.72)';
  ctx.fillText(clockText(g.time), left + width, top + 19);

  bar(ctx, left, top + 31, width, 13, hpRatio, low ? '#ff3b4d' : '#b41833', low ? '#ff8a72' : '#dc3451');
  bar(ctx, left, top + 48, width, 4, p.xp / p.xpNext, '#2fb4ff', '#7ce7ff', 'rgba(255,255,255,0.13)');
  ctx.textAlign = 'left';
  ctx.font = `700 10px ${FONT}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(`${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`, left + 6, top + 37.5);
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = 'rgba(235,239,247,0.72)';
  ctx.fillText(`Lv.${p.level}  ·  ${g.score} 分`, left, top + 63);

  ctx.font = `600 10px ${FONT}`;
  if (p.shield > 0) {
    ctx.fillStyle = '#b8e7ff';
    ctx.fillText(`护盾 ${Math.ceil(p.shield)}`, left, top + 78);
  }
  if (p.erosion > 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = p.erosion >= 70 ? '#ff9c8a' : '#d5b0ef';
    ctx.fillText(`侵蚀 ${Math.round(p.erosion)}`, left + width, top + 78);
  }

  const def = WEAPONS[p.weapon];
  const name = def.name.split(' · ').pop() + (p.weaponLocked ? ' 🔒' : '');
  const icon = getGunIcon(p.weapon, { bare: true });
  ctx.textAlign = 'right';
  ctx.font = `700 11px ${FONT}`;
  ctx.fillStyle = def.color || '#fff';
  const nameWidth = ctx.measureText(name).width;
  ctx.drawImage(icon.canvas, right - nameWidth - 23, top + 10, 18, 18);
  ctx.fillText(name, right, top + 19);

  const cap = '/ ' + magSize(p.weapon, p.stats);
  ctx.fillStyle = 'rgba(235,239,247,0.66)';
  ctx.fillText(cap, right, top + 41);
  const capWidth = ctx.measureText(cap).width;
  ctx.font = `800 22px ${FONT}`;
  ctx.fillStyle = p.reloading > 0 ? 'rgba(255,255,255,0.55)' : '#fff';
  ctx.fillText(String(Math.ceil(p.ammo)), right - capWidth - 5, top + 39);

  ctx.font = `600 10px ${FONT}`;
  if (p.secondary) {
    ctx.fillStyle = 'rgba(235,239,247,0.70)';
    ctx.fillText('副 · ' + WEAPONS[p.secondary].name.split(' · ').pop(), right, top + 58);
  }
  if (p.reloading > 0) {
    const y = top + (p.secondary ? 73 : 59);
    bar(ctx, right - 44, y - 2, 44, 4, 1 - p.reloading / p.reloadTotal, '#ffd166', '#ff9f43');
    ctx.fillStyle = '#ffd166';
    ctx.fillText('装填', right - 49, y);
  }
}

function drawDesktopStatus(ctx, g, w, h, hpRatio) {
  const p = g.player;
  const bx = 26, by = h - 74, bw = 268;
  const low = hpRatio < 0.3;
  bar(ctx, bx, by, bw, 18, hpRatio, low ? '#ff3b4d' : '#e01b3c', low ? '#ff8a72' : '#ff5f6d');
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`, bx + 10, by + 9);

  // 护盾条（有护盾时才显示，压在血条上方一层淡蓝）
  if (p.shield > 0) {
    const shRatio = p.shield / p.maxHp;
    bar(ctx, bx, by - 8, bw, 6, Math.min(1, shRatio), '#7cc8f0', '#b8ecff', 'rgba(120,200,255,0.08)');
    ctx.font = `700 10px ${FONT}`;
    ctx.fillStyle = 'rgba(168,224,255,0.85)';
    ctx.fillText(`护盾 ${Math.ceil(p.shield)}`, bx + 10, by - 5);
  }

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
  const lockTag = p.weaponLocked ? ' 🔒' : '';
  const mainName = `${wDef.name}${lockTag}`;
  const mainW = ctx.measureText(mainName).width;
  const mainIcon = getGunIcon(p.weapon, { bare: true });   // 纯剪影：不加底板/边框
  const icoSize = 46;
  const iconY = h - 84;
  const ammoY = h - 50;
  const secondaryY = h - 26;
  ctx.drawImage(mainIcon.canvas, rx - mainW - icoSize - 3, iconY - icoSize / 2, icoSize, icoSize);
  ctx.fillText(mainName, rx, iconY);

  ctx.font = `800 40px ${FONT}`;
  ctx.fillStyle = p.reloading > 0 ? 'rgba(255,255,255,0.35)' : '#fff';
  ctx.fillText(String(Math.ceil(p.ammo)), rx - 44, ammoY);
  ctx.font = `700 16px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('/ ' + cap, rx, ammoY + 6);

  // 副武器常显：装在副武器槽里的枪必须一直看得见，
  // 否则"捡了三连发却没反应"会被当成 bug（原来装填时这一行会被藏掉）
  if (p.secondary) {
    ctx.font = `600 11px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    const secText = `Q 切换 → ${WEAPONS[p.secondary].name}`;
    const secW = ctx.measureText(secText).width;
    const secIcon = getGunIcon(p.secondary, { bare: true });
    const secIco = 26;
    ctx.drawImage(secIcon.canvas, rx - secW - secIco - 3, secondaryY - secIco / 2, secIco, secIco);
    ctx.fillText(secText, rx, secondaryY);
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
  ctx.fillText(g.mode === 'quest' ? '层' : '潮汐', bx, 28);

  ctx.font = `800 26px ${FONT}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(g.mode === 'quest' ? (g.questName || '') : String(g.wave), bx, 52);

  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText(`${clockText(g.time)}   击杀 ${g.kills}`, bx, 74);

  // ---------- 右上：分数 ----------
  ctx.textAlign = 'right';
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('SCORE', rx, 26);
  ctx.font = `800 24px ${FONT}`;
  ctx.fillStyle = '#ffd166';
  ctx.fillText(String(g.score), rx, 50);
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText(`${g.enemies.length} 敌人在场`, rx, 74);
}

function drawDesktopToast(ctx, tst, modeText, w, alpha) {
  const col = TIER_COLORS_HUD[tst.tier] || TIER_COLORS_HUD[1];
  ctx.font = `900 22px ${FONT}`;
  const nameText = tst.name;
  const nameW = ctx.measureText(nameText).width;
  ctx.font = `700 11px ${FONT}`;
  const tagW = 46;
  const modeW = ctx.measureText(modeText).width;
  const toastIcon = getGunIcon(tst.id, { bare: true });
  const toastIco = 38;
  const wBox = Math.min(w - 60, toastIco + nameW + tagW + modeW + 92);
  const yb = 92;
  const x0 = w / 2 - wBox / 2;

  // 底板
  ctx.fillStyle = 'rgba(8,10,12,0.82)';
  ctx.beginPath();
  ctx.roundRect(x0, yb - 23, wBox, 46, 9);
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.globalAlpha = alpha * 0.9;
  ctx.lineWidth = 1.6;
  ctx.shadowColor = col;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.roundRect(x0 + 0.8, yb - 22.2, wBox - 1.6, 44.4, 9);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = alpha;

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

  // 枪械矢量图标
  ctx.drawImage(toastIcon.canvas, x0 + 16 + tagW, yb - toastIco / 2, toastIco, toastIco);

  // 武器名
  ctx.font = `900 22px ${FONT}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(nameText, x0 + 18 + tagW + toastIco, yb);

  // 结果
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(modeText, x0 + 16 + tagW + toastIco + nameW + 12, yb);
}

export function drawHud(ctx, g, w, h) {
  const p = g.player;
  if (!p) return;
  const touch = g.input.touchMode;
  const hpRatio = p.hp / p.maxHp;
  ctx.save();
  ctx.textBaseline = 'middle';
  if (touch) drawMobileStatus(ctx, g, w, hpRatio);
  else drawDesktopStatus(ctx, g, w, h, hpRatio);

  const safeWidth = touch ? w - g.ui.safeLeft - g.ui.safeRight : w;
  const noticeBelowHud = touch && (g.ui.portrait || safeWidth < 520);
  const noticeX = touch ? g.ui.safeLeft + safeWidth / 2 : w / 2;
  const noticeY = touch ? g.ui.safeTop + (noticeBelowHud ? 102 : 27) : h * 0.24;
  const noticeWidth = noticeBelowHud ? safeWidth - 32 : Math.min(280, safeWidth - 360);

  // ---------- 中央横幅（潮汐 / 层间卡 / 层主条共用这一条通道） ----------
  if (g.banner.t > 0) {
    const b = g.banner;
    const total = b.total || 2.6;
    const elapsed = total - b.t;
    // 淡入 0.28s + 淡出 0.5s；不再"啪"地弹出来
    const a = Math.min(clamp(elapsed / 0.28, 0, 1), clamp(b.t / 0.5, 0, 1));
    const cy = noticeY;
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';

    if (b.kicker && !touch) {
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

    ctx.font = `900 ${touch ? 18 : 46}px ${FONT}`;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(b.text, noticeX + 2, cy + 2, touch ? noticeWidth : w);
    ctx.fillStyle = '#fff';
    ctx.fillText(b.text, noticeX, cy, touch ? noticeWidth : w);
    if (b.sub && !touch) {
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
    const modeText = tst.mode === 'secondary' ? '已放入副武器槽'
      : tst.mode === 'salvage' ? '已放弃 · 转为补给'
        : tst.mode === 'ammo' ? '弹药补满' : '已装备';
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    if (touch) {
      ctx.font = `700 12px ${FONT}`;
      ctx.textAlign = 'center';
      const y = noticeY + (g.banner.t > 0 ? 24 : 0);
      const message = tst.name + ' · ' + modeText;
      const width = Math.min(ctx.measureText(message).width + 22, noticeWidth);
      ctx.fillStyle = 'rgba(6,7,9,0.66)';
      ctx.beginPath();
      ctx.roundRect(noticeX - width / 2, y - 11, width, 22, 11);
      ctx.fill();
      ctx.fillStyle = '#f0f2f8';
      ctx.fillText(message, noticeX, y, width - 16);
    } else {
      drawDesktopToast(ctx, tst, modeText, w, Math.max(0, a));
    }
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

  // ---------- 冲刺冷却（S1-D2）：血条左上方独立小圈，避免与血条重叠 ----------
  if (p.dashCd > 0 && !touch) {
    const cx = 24, cy = h - 112, R = 11;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 3;
    ctx.stroke();
    // 冷却弧（从顶部顺时针）
    const prog = 1 - p.dashCd / 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
    ctx.strokeStyle = 'rgba(160,214,255,0.9)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  // ---------- 受击方向提示（S1-D3）：屏幕中央一闪的方向弧 ----------
  if (p.hurtFlash > 0.4 && (p.hurtDirX || p.hurtDirY)) {
    const a = Math.atan2(p.hurtDirY, p.hurtDirX);
    const alpha = (p.hurtFlash - 0.4) * 1.5;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(a);
    if (touch) ctx.scale(0.8, 0.8);
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = 'rgba(255,70,60,0.7)';
    ctx.beginPath();
    ctx.moveTo(46, -13);
    ctx.lineTo(72, 0);
    ctx.lineTo(46, 13);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
