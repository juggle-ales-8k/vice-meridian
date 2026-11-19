import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, { repeatX = 1, repeatY = 1, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// Shared asphalt base: aggregate speckle, tar-sealed cracks, a patched repair square and oil
// stains. Everything is drawn from the seeded stream so it is identical run to run.
function paintAsphalt(ctx, rng, size, base = '#252630') {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 10; i++) {
    const x = Math.floor(rng.next() * size);
    const y = Math.floor(rng.next() * size);
    const v = 30 + Math.floor(rng.next() * 28);
    ctx.fillStyle = `rgb(${v},${v},${v + 6})`;
    ctx.fillRect(x, y, 2, 2);
  }
  // Patch repair: slightly darker, crisper rectangle
  const px = rng.range(size * 0.15, size * 0.6);
  const py = rng.range(size * 0.1, size * 0.7);
  ctx.fillStyle = 'rgba(16,16,22,0.35)';
  ctx.fillRect(px, py, rng.range(24, 60), rng.range(18, 44));
  // Oil stains down the middle of lanes
  for (let i = 0; i < 5; i++) {
    const ox = rng.pick([size * 0.25, size * 0.75]) + rng.range(-10, 10);
    const oy = rng.range(0, size);
    const g = ctx.createRadialGradient(ox, oy, 1, ox, oy, rng.range(6, 14));
    g.addColorStop(0, 'rgba(8,8,14,0.35)');
    g.addColorStop(1, 'rgba(8,8,14,0)');
    ctx.fillStyle = g;
    ctx.fillRect(ox - 16, oy - 16, 32, 32);
  }
  // Hairline cracks sealed with tar
  ctx.strokeStyle = 'rgba(12,12,18,0.55)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    let x = rng.next() * size;
    let y = rng.next() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 3 + Math.floor(rng.next() * 4);
    for (let s = 0; s < segs; s++) {
      x += rng.range(-14, 14);
      y += rng.range(4, 18);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

export function createAsphaltTexture(rng) {
  const c = makeCanvas(256, 256);
  paintAsphalt(c.getContext('2d'), rng, 256);
  return toTexture(c, { repeatX: 4, repeatY: 4 });
}

export function createRoadTexture(rng) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  paintAsphalt(ctx, rng, 256);
  // Subtle damp reflection streaks down the lanes
  const sheen = ctx.createLinearGradient(0, 0, 256, 0);
  sheen.addColorStop(0.0, 'rgba(255,155,95,0.0)');
  sheen.addColorStop(0.24, 'rgba(255,155,95,0.09)');
  sheen.addColorStop(0.5, 'rgba(60,210,235,0.04)');
  sheen.addColorStop(0.76, 'rgba(255,155,95,0.09)');
  sheen.addColorStop(1.0, 'rgba(255,155,95,0.0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, 256, 256);

  // Double yellow center line
  ctx.fillStyle = '#ebb43d';
  ctx.fillRect(123, 0, 4, 256);
  ctx.fillRect(130, 0, 4, 256);

  // Dashed white lane dividers
  ctx.fillStyle = 'rgba(244,238,225,0.85)';
  for (let y = 12; y < 256; y += 52) {
    ctx.fillRect(62, y, 4, 26);
    ctx.fillRect(190, y, 4, 26);
  }

  // Outer white edge lines
  ctx.fillStyle = 'rgba(230,224,210,0.7)';
  ctx.fillRect(10, 0, 4, 256);
  ctx.fillRect(242, 0, 4, 256);

  return toTexture(c, { repeatX: 1, repeatY: 1 });
}

export function createIntersectionTexture(rng) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  paintAsphalt(ctx, rng, 256, '#262732');

  // Stop lines just inside each crosswalk
  ctx.fillStyle = 'rgba(245,238,224,0.8)';
  ctx.fillRect(40, 40, 176, 4);
  ctx.fillRect(40, 212, 176, 4);

  // Crosswalk stripes on all 4 approaches
  ctx.fillStyle = 'rgba(245,238,224,0.86)';
  for (let i = 28; i <= 216; i += 24) {
    ctx.fillRect(i, 10, 12, 26);
    ctx.fillRect(i, 220, 12, 26);
    ctx.fillRect(10, i, 26, 12);
    ctx.fillRect(220, i, 26, 12);
  }
  return toTexture(c, { repeatX: 1, repeatY: 1 });
}

export function createSidewalkTexture(rng) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c5b8a6';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 1600; i++) {
    const x = Math.floor(rng.next() * 256);
    const y = Math.floor(rng.next() * 256);
    const v = 175 + Math.floor(rng.next() * 35);
    ctx.fillStyle = `rgb(${v},${v - 10},${v - 22})`;
    ctx.fillRect(x, y, 3, 3);
  }
  ctx.strokeStyle = 'rgba(80,70,62,0.45)';
  ctx.lineWidth = 2;
  for (let g = 0; g <= 256; g += 64) {
    ctx.beginPath();
    ctx.moveTo(g, 0);
    ctx.lineTo(g, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, g);
    ctx.lineTo(256, g);
    ctx.stroke();
  }
  return toTexture(c, { repeatX: 6, repeatY: 6 });
}

export function createBuildingFacadeTexture(rng, style = 'deco') {
  const c = makeCanvas(256, 512);
  const ctx = c.getContext('2d');

  if (style === 'glass') {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#366988');
    g.addColorStop(0.55, '#598aa4');
    g.addColorStop(1, '#2d4c66');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 512);
  } else if (style === 'warehouse') {
    ctx.fillStyle = '#5e656f';
    ctx.fillRect(0, 0, 256, 512);
    for (let x = 0; x < 256; x += 16) {
      ctx.fillStyle = x % 32 === 0 ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(x, 0, 8, 512);
    }
  } else {
    ctx.fillStyle = style === 'motel' ? '#f2dec8' : '#e9d6c0';
    ctx.fillRect(0, 0, 256, 512);
    for (let y = 0; y < 512; y += 64) {
      ctx.fillStyle = 'rgba(0,0,0,0.09)';
      ctx.fillRect(0, y, 256, 4);
    }
  }

  const cols = style === 'warehouse' ? 4 : style === 'glass' ? 8 : 6;
  const rows = style === 'warehouse' ? 4 : 12;
  const padX = style === 'glass' ? 5 : 8;
  const padY = style === 'glass' ? 6 : 10;
  const cellW = 256 / cols;
  const cellH = 512 / rows;

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = rng.next();
      const x = col * cellW + padX;
      const y = r * cellH + padY;
      const w = cellW - padX * 2;
      const h = cellH - padY * 2;

      if (style === 'glass') {
        if (lit < 0.28) ctx.fillStyle = '#ffcb7d';
        else if (lit < 0.45) ctx.fillStyle = '#8ef0f5';
        else ctx.fillStyle = '#1d3b52';
      } else if (style === 'warehouse') {
        ctx.fillStyle = lit < 0.35 ? '#ffd48a' : '#252b34';
      } else {
        if (lit < 0.32) ctx.fillStyle = '#ffd180';
        else if (lit < 0.44) ctx.fillStyle = '#7de6eb';
        else ctx.fillStyle = '#29354a';
      }
      ctx.fillRect(x, y, w, h);

      // Golden hour horizon reflection glint on glass panes
      ctx.fillStyle = 'rgba(255,190,120,0.18)';
      ctx.fillRect(x, y, w, h * 0.35);
    }
  }

  // Ground-floor awning band
  if (style !== 'warehouse') {
    ctx.fillStyle = style === 'glass' ? '#1c2b3c' : '#2e384b';
    ctx.fillRect(0, 456, 256, 56);
    ctx.fillStyle = style === 'motel' ? '#ff5886' : '#3be0e8';
    ctx.fillRect(0, 452, 256, 6);
  }

  return toTexture(c, { repeatX: 1, repeatY: 1 });
}

export function createEmissiveWindowTexture(rng, style = 'deco') {
  const c = makeCanvas(256, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 256, 512);

  const cols = style === 'warehouse' ? 4 : style === 'glass' ? 8 : 6;
  const rows = style === 'warehouse' ? 4 : 12;
  const padX = style === 'glass' ? 6 : 9;
  const padY = style === 'glass' ? 7 : 11;
  const cellW = 256 / cols;
  const cellH = 512 / rows;

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const roll = rng.next();
      if (roll > 0.36) continue;
      ctx.fillStyle = roll < 0.25 ? '#ffbe6b' : '#5de8f2';
      ctx.fillRect(col * cellW + padX, r * cellH + padY, cellW - padX * 2, cellH - padY * 2);
    }
  }

  return toTexture(c, { repeatX: 1, repeatY: 1 });
}

export function createSignTexture(title, subtitle, bg, fg, accent) {
  const c = makeCanvas(512, 160);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 160);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 144);

  ctx.fillStyle = fg;
  ctx.font = '900 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, 66, 470);

  ctx.fillStyle = accent;
  ctx.font = '700 26px sans-serif';
  ctx.fillText(subtitle, 256, 118, 470);

  return toTexture(c, { repeatX: 1, repeatY: 1 });
}

export function createWaterTexture(rng) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, '#0f6f85');
  g.addColorStop(0.5, '#1999a8');
  g.addColorStop(1, '#0d5e73');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Swell banding: two crossing sine wave trains shade crests lighter and troughs darker,
  // which reads like a cheap normal map once the texture scrolls.
  const img = ctx.getImageData(0, 0, 256, 256);
  const d = img.data;
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const a = Math.sin((x * 2 + y) * ((Math.PI * 2) / 128));
      const b = Math.sin((y * 3 - x) * ((Math.PI * 2) / 256) * 2);
      const shade = (a * 0.6 + b * 0.4) * 14;
      const i = (y * 256 + x) * 4;
      d[i] = Math.max(0, Math.min(255, d[i] + shade * 0.6));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + shade));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + shade * 0.9));
    }
  }
  ctx.putImageData(img, 0, 0);

  for (let i = 0; i < 240; i++) {
    const x = rng.next() * 256;
    const y = rng.next() * 256;
    const w = 14 + rng.next() * 34;
    ctx.fillStyle = rng.chance(0.35) ? 'rgba(255,205,140,0.22)' : 'rgba(155,245,255,0.18)';
    ctx.fillRect(x, y, w, 2);
  }
  return toTexture(c, { repeatX: 18, repeatY: 22 });
}

// Running-bond brick with mortar lines and per-brick tone variation.
export function createBrickTexture(rng) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b9a99a';
  ctx.fillRect(0, 0, 256, 256);
  const bw = 32;
  const bh = 12;
  for (let row = 0; row < 256 / bh + 1; row++) {
    const off = row % 2 === 0 ? 0 : bw / 2;
    for (let x = -bw; x < 256 + bw; x += bw) {
      const r = 150 + Math.floor(rng.next() * 50);
      const g = 70 + Math.floor(rng.next() * 30);
      const b = 52 + Math.floor(rng.next() * 22);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + off + 1, row * bh + 1, bw - 2, bh - 2);
      if (rng.chance(0.15)) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x + off + 1, row * bh + bh * 0.5, bw - 2, bh * 0.5 - 1);
      }
    }
  }
  return toTexture(c, { repeatX: 1, repeatY: 1 });
}

// Brick facade for the West Annex: brick field with sash windows and a shopfront band.
export function createBrickFacadeTexture(rng) {
  const c = makeCanvas(256, 512);
  const ctx = c.getContext('2d');
  const brick = createBrickTexture(rng).image;
  ctx.drawImage(brick, 0, 0);
  ctx.drawImage(brick, 0, 256);
  for (let r = 0; r < 8; r++) {
    for (let col = 0; col < 4; col++) {
      const x = col * 64 + 14;
      const y = r * 56 + 12;
      ctx.fillStyle = '#e8dccb';
      ctx.fillRect(x - 3, y - 3, 42, 40);
      const lit = rng.next();
      ctx.fillStyle = lit < 0.3 ? '#ffd180' : '#2b3446';
      ctx.fillRect(x, y, 36, 34);
      ctx.fillStyle = '#e8dccb';
      ctx.fillRect(x, y + 15, 36, 3);
    }
  }
  ctx.fillStyle = '#2a2f3a';
  ctx.fillRect(0, 456, 256, 56);
  ctx.fillStyle = '#ffb347';
  ctx.fillRect(0, 452, 256, 6);
  return toTexture(c, { repeatX: 1, repeatY: 1 });
}

// Glass curtain wall: reflective sky gradient split by a mullion grid, with sun glints.
export function createCurtainWallTexture(rng) {
  const c = makeCanvas(256, 512);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#5f8fb3');
  g.addColorStop(0.45, '#9cc0d4');
  g.addColorStop(0.6, '#f0b98a');
  g.addColorStop(1, '#3b5c78');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 512);
  // Panel tone variation
  for (let y = 0; y < 512; y += 32) {
    for (let x = 0; x < 256; x += 32) {
      ctx.fillStyle = `rgba(${rng.chance(0.5) ? '255,220,180' : '20,40,60'},${(rng.next() * 0.12).toFixed(3)})`;
      ctx.fillRect(x, y, 32, 32);
    }
  }
  // Diagonal reflection sweep
  ctx.fillStyle = 'rgba(255,240,220,0.12)';
  ctx.beginPath();
  ctx.moveTo(40, 0);
  ctx.lineTo(120, 0);
  ctx.lineTo(10, 512);
  ctx.lineTo(-70, 512);
  ctx.closePath();
  ctx.fill();
  // Mullions & transoms
  ctx.fillStyle = '#1f2a36';
  for (let x = 0; x <= 256; x += 32) ctx.fillRect(x - 1, 0, 3, 512);
  for (let y = 0; y <= 512; y += 32) ctx.fillRect(0, y - 1, 256, 2);
  return toTexture(c, { repeatX: 1, repeatY: 1 });
}

export function createSandTexture(rng) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8c796';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    const v = rng.next();
    ctx.fillStyle = v < 0.5 ? 'rgba(255,240,210,0.35)' : v < 0.85 ? 'rgba(180,140,95,0.25)' : 'rgba(120,95,70,0.3)';
    ctx.fillRect(rng.next() * 256, rng.next() * 256, 1.5, 1.5);
  }
  // Wind ripples
  ctx.strokeStyle = 'rgba(170,130,85,0.18)';
  ctx.lineWidth = 2;
  for (let y = 6; y < 256; y += 14) {
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 8) {
      const yy = y + Math.sin((x / 256) * Math.PI * 4 + y * 0.3) * 3;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  return toTexture(c, { repeatX: 6, repeatY: 80 });
}

export function createGrassTexture(rng) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5a8f45';
  ctx.fillRect(0, 0, 256, 256);
  // Mowing stripes
  for (let x = 0; x < 256; x += 32) {
    ctx.fillStyle = (x / 32) % 2 === 0 ? 'rgba(255,255,200,0.07)' : 'rgba(0,30,0,0.06)';
    ctx.fillRect(x, 0, 32, 256);
  }
  for (let i = 0; i < 3000; i++) {
    const g = 110 + Math.floor(rng.next() * 70);
    ctx.fillStyle = `rgba(${g - 50},${g},${g - 80},0.6)`;
    ctx.fillRect(rng.next() * 256, rng.next() * 256, 1, 3);
  }
  return toTexture(c, { repeatX: 4, repeatY: 4 });
}

export function createPlankTexture(rng) {
  const c = makeCanvas(256, 128);
  const ctx = c.getContext('2d');
  for (let x = 0; x < 256; x += 16) {
    const v = rng.range(0.85, 1.1);
    ctx.fillStyle = `rgb(${Math.floor(164 * v)},${Math.floor(123 * v)},${Math.floor(85 * v)})`;
    ctx.fillRect(x, 0, 16, 128);
    ctx.fillStyle = 'rgba(40,25,15,0.6)';
    ctx.fillRect(x, 0, 1.5, 128);
    ctx.fillStyle = 'rgba(30,20,10,0.5)';
    ctx.fillRect(x + 7, rng.range(10, 110), 2, 2);
  }
  return toTexture(c, { repeatX: 12, repeatY: 1 });
}

// Hero storefront fascia: shop name over a lit shop window strip.
export function createStorefrontTexture() {
  const c = makeCanvas(512, 140);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 140);
  g.addColorStop(0, '#f6e7cf');
  g.addColorStop(1, '#e2c9a6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 140);
  ctx.fillStyle = '#1d6e72';
  ctx.fillRect(0, 0, 512, 10);
  ctx.fillRect(0, 130, 512, 10);
  ctx.fillStyle = '#16323a';
  ctx.font = '900 64px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HOTEL PALMETTO', 256, 62, 476);
  ctx.fillStyle = '#c2523a';
  ctx.font = '700 22px sans-serif';
  ctx.fillText('EST. 1958 · OCEANFRONT SUITES · BAR', 256, 112, 476);
  return toTexture(c, { repeatX: 1, repeatY: 1 });
}

// Vertical neon blade sign: glowing tube letters on a dark panel.
export function createNeonBladeTexture() {
  const c = makeCanvas(128, 416);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#120c1e';
  ctx.fillRect(0, 0, 128, 416);
  ctx.strokeStyle = '#ff3b9a';
  ctx.lineWidth = 6;
  ctx.shadowColor = '#ff3b9a';
  ctx.shadowBlur = 16;
  ctx.strokeRect(10, 10, 108, 396);
  ctx.font = '900 62px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#3bf0ff';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#c9fbff';
  const word = 'BAR';
  for (let i = 0; i < word.length; i++) ctx.fillText(word[i], 64, 70 + i * 82);
  ctx.shadowColor = '#ffb347';
  ctx.fillStyle = '#ffe2a8';
  ctx.font = '800 30px sans-serif';
  ctx.fillText('24H', 64, 360);
  ctx.shadowBlur = 0;
  return toTexture(c, { repeatX: 1, repeatY: 1 });
}

export function createAwningTexture() {
  const c = makeCanvas(128, 32);
  const ctx = c.getContext('2d');
  for (let x = 0; x < 128; x += 16) {
    ctx.fillStyle = (x / 16) % 2 === 0 ? '#2fc6c8' : '#f6efe2';
    ctx.fillRect(x, 0, 16, 32);
  }
  return toTexture(c, { repeatX: 1, repeatY: 1 });
}

export function createGlowSpriteTexture(innerColor, outerColor) {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, innerColor);
  g.addColorStop(0.32, outerColor);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Golden-hour sky. The dome's UV maps canvas row 0 to the zenith, the middle row to the horizon and
// the bottom row to the nadir, so the warm bands are packed just above the middle.
export function createSkyTexture() {
  const c = makeCanvas(64, 512);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.0, '#4f78a6');
  g.addColorStop(0.16, '#6f93b8');
  g.addColorStop(0.3, '#a9b9c4');
  g.addColorStop(0.38, '#e4c9a6');
  g.addColorStop(0.44, '#f7b77c');
  g.addColorStop(0.475, '#fb9a4c');
  g.addColorStop(0.5, '#ec8634');
  g.addColorStop(0.53, '#d98a4c');
  g.addColorStop(0.62, '#b67a54');
  g.addColorStop(1.0, '#6e4a36');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 512);

  // Thin sunlit cloud streaks in the warm band, drawn from a fixed pattern (no randomness)
  for (let i = 0; i < 9; i++) {
    const y = 150 + ((i * 37) % 80);
    const a = 0.06 + (i % 3) * 0.025;
    ctx.fillStyle = `rgba(255,226,186,${a.toFixed(3)})`;
    ctx.fillRect(0, y, 64, 2 + (i % 2));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Soft ring used for lens-flare ghosts: transparent centre, warm rim, faint outer falloff.
export function createFlareRingTexture() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,220,170,0.10)');
  g.addColorStop(0.62, 'rgba(255,200,140,0.18)');
  g.addColorStop(0.8, 'rgba(255,186,120,0.55)');
  g.addColorStop(0.88, 'rgba(255,160,90,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Long horizontal streak for the anamorphic sun glare.
export function createStreakTexture() {
  const c = makeCanvas(256, 32);
  const ctx = c.getContext('2d');
  const gx = ctx.createLinearGradient(0, 0, 256, 0);
  gx.addColorStop(0, 'rgba(255,170,90,0)');
  gx.addColorStop(0.5, 'rgba(255,236,200,1)');
  gx.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, 256, 32);
  ctx.globalCompositeOperation = 'destination-in';
  const gy = ctx.createLinearGradient(0, 0, 0, 32);
  gy.addColorStop(0, 'rgba(0,0,0,0)');
  gy.addColorStop(0.5, 'rgba(0,0,0,1)');
  gy.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, 256, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Glitter for the sun path on the sea: short bright dashes that thin out toward both ends of the
// strip (u runs across the path, v runs from the shore out to the horizon).
export function createSunPathTexture(rng) {
  const c = makeCanvas(128, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 128, 512);
  const base = ctx.createLinearGradient(0, 0, 128, 0);
  base.addColorStop(0, 'rgba(255,150,70,0)');
  base.addColorStop(0.5, 'rgba(255,170,90,0.35)');
  base.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 900; i++) {
    const v = rng.next();
    const spread = 0.5 - Math.abs(rng.next() - 0.5) * (0.35 + v * 0.65);
    const x = (rng.chance(0.5) ? spread : 1 - spread) * 128;
    const y = v * 512;
    const a = 0.35 + rng.next() * 0.65;
    ctx.fillStyle = `rgba(255,${200 + Math.floor(rng.next() * 50)},${140 + Math.floor(rng.next() * 80)},${a.toFixed(3)})`;
    ctx.fillRect(x - 3, y, 3 + rng.next() * 7, 1 + rng.next() * 1.5);
  }
  // Fade both ends so the strip has no hard edge
  ctx.globalCompositeOperation = 'multiply';
  const fade = ctx.createLinearGradient(0, 0, 0, 512);
  fade.addColorStop(0, '#000000');
  fade.addColorStop(0.12, '#ffffff');
  fade.addColorStop(0.8, '#ffffff');
  fade.addColorStop(1, '#000000');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 128, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createTexturePack(rng) {
  return {
    road: createRoadTexture(rng.fork(101)),
    intersection: createIntersectionTexture(rng.fork(102)),
    sidewalk: createSidewalkTexture(rng.fork(103)),
    water: createWaterTexture(rng.fork(104)),
    sky: createSkyTexture(),
    flareRing: createFlareRingTexture(),
    sunStreak: createStreakTexture(),
    sunPath: createSunPathTexture(rng.fork(105)),
    sunFlare: createGlowSpriteTexture('rgba(255,250,220,1)', 'rgba(255,155,70,0.45)'),
    redGlow: createGlowSpriteTexture('rgba(255,95,110,1)', 'rgba(255,20,40,0.4)'),
    blueGlow: createGlowSpriteTexture('rgba(120,210,255,1)', 'rgba(25,115,255,0.4)'),
    warmGlow: createGlowSpriteTexture('rgba(255,235,175,0.95)', 'rgba(255,155,60,0.32)'),
    cyanGlow: createGlowSpriteTexture('rgba(155,255,255,0.95)', 'rgba(40,220,240,0.34)'),
    asphalt: createAsphaltTexture(rng.fork(106)),
    sand: createSandTexture(rng.fork(107)),
    grass: createGrassTexture(rng.fork(108)),
    planks: createPlankTexture(rng.fork(109)),
    brick: createBrickTexture(rng.fork(110)),
    storefront: createStorefrontTexture(),
    neonBlade: createNeonBladeTexture(),
    awning: createAwningTexture(),
    facades: {
      deco: createBuildingFacadeTexture(rng.fork(201), 'deco'),
      glass: createBuildingFacadeTexture(rng.fork(202), 'glass'),
      stucco: createBuildingFacadeTexture(rng.fork(203), 'stucco'),
      warehouse: createBuildingFacadeTexture(rng.fork(204), 'warehouse'),
      motel: createBuildingFacadeTexture(rng.fork(205), 'motel'),
      brick: createBrickFacadeTexture(rng.fork(206)),
      curtain: createCurtainWallTexture(rng.fork(207)),
    },
    emissives: {
      deco: createEmissiveWindowTexture(rng.fork(301), 'deco'),
      glass: createEmissiveWindowTexture(rng.fork(302), 'glass'),
      stucco: createEmissiveWindowTexture(rng.fork(303), 'stucco'),
      warehouse: createEmissiveWindowTexture(rng.fork(304), 'warehouse'),
      motel: createEmissiveWindowTexture(rng.fork(305), 'motel'),
      brick: createEmissiveWindowTexture(rng.fork(306), 'warehouse'),
      curtain: createEmissiveWindowTexture(rng.fork(307), 'glass'),
    },
    signs: [
      createSignTexture('HOTEL PALMETTO', 'OCEANFRONT SUITES', '#18142b', '#ff6fa5', '#42f2ff'),
      createSignTexture('CLUB SOLSTICE', 'OPEN TIL DAWN', '#161028', '#52f6ff', '#ff5492'),
      createSignTexture('CORAL MOTORS', 'EXOTICS · CUSTOMS', '#1c1522', '#ffd166', '#ff6b4a'),
      createSignTexture('MARISOL PAWN', 'CASH · GOLD · GEAR', '#18242c', '#72ff9e', '#ffc857'),
      createSignTexture('CAFE MERIDIAN', 'ESPRESSO · 24 HRS', '#221528', '#ff9b54', '#58f2e8'),
      createSignTexture('PIER 4 FREIGHT', 'DOCKSIDE CARGO', '#1e252e', '#f2e8cf', '#ff8c42'),
    ],
  };
}
