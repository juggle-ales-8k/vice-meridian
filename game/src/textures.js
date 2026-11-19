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

export function createRoadTexture(rng) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#252630';
  ctx.fillRect(0, 0, 256, 256);

  // Asphalt aggregate & subtle golden-hour sheen strips
  for (let i = 0; i < 2600; i++) {
    const x = Math.floor(rng.next() * 256);
    const y = Math.floor(rng.next() * 256);
    const v = 30 + Math.floor(rng.next() * 28);
    ctx.fillStyle = `rgb(${v},${v},${v + 6})`;
    ctx.fillRect(x, y, 2, 2);
  }
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
  ctx.fillStyle = '#262732';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 2000; i++) {
    const x = Math.floor(rng.next() * 256);
    const y = Math.floor(rng.next() * 256);
    const v = 32 + Math.floor(rng.next() * 24);
    ctx.fillStyle = `rgb(${v},${v},${v + 5})`;
    ctx.fillRect(x, y, 2, 2);
  }

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
  ctx.fillText(title, 256, 66);

  ctx.fillStyle = accent;
  ctx.font = '700 26px sans-serif';
  ctx.fillText(subtitle, 256, 118);

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

  for (let i = 0; i < 240; i++) {
    const x = rng.next() * 256;
    const y = rng.next() * 256;
    const w = 14 + rng.next() * 34;
    ctx.fillStyle = rng.chance(0.35) ? 'rgba(255,205,140,0.22)' : 'rgba(155,245,255,0.18)';
    ctx.fillRect(x, y, w, 2);
  }
  return toTexture(c, { repeatX: 18, repeatY: 22 });
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

export function createSkyTexture() {
  const c = makeCanvas(64, 512);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.0, '#16244d');
  g.addColorStop(0.24, '#2c3d72');
  g.addColorStop(0.46, '#7a4576');
  g.addColorStop(0.64, '#d9665e');
  g.addColorStop(0.76, '#ff9852');
  g.addColorStop(0.84, '#ffd789');
  g.addColorStop(0.92, '#df8d66');
  g.addColorStop(1.0, '#362238');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 512);
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
    sunFlare: createGlowSpriteTexture('rgba(255,250,220,1)', 'rgba(255,155,70,0.45)'),
    redGlow: createGlowSpriteTexture('rgba(255,95,110,1)', 'rgba(255,20,40,0.4)'),
    blueGlow: createGlowSpriteTexture('rgba(120,210,255,1)', 'rgba(25,115,255,0.4)'),
    warmGlow: createGlowSpriteTexture('rgba(255,235,175,0.95)', 'rgba(255,155,60,0.32)'),
    cyanGlow: createGlowSpriteTexture('rgba(155,255,255,0.95)', 'rgba(40,220,240,0.34)'),
    facades: {
      deco: createBuildingFacadeTexture(rng.fork(201), 'deco'),
      glass: createBuildingFacadeTexture(rng.fork(202), 'glass'),
      stucco: createBuildingFacadeTexture(rng.fork(203), 'stucco'),
      warehouse: createBuildingFacadeTexture(rng.fork(204), 'warehouse'),
      motel: createBuildingFacadeTexture(rng.fork(205), 'motel'),
    },
    emissives: {
      deco: createEmissiveWindowTexture(rng.fork(301), 'deco'),
      glass: createEmissiveWindowTexture(rng.fork(302), 'glass'),
      stucco: createEmissiveWindowTexture(rng.fork(303), 'stucco'),
      warehouse: createEmissiveWindowTexture(rng.fork(304), 'warehouse'),
      motel: createEmissiveWindowTexture(rng.fork(305), 'motel'),
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
