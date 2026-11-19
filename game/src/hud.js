import { CITY, getDistrictName } from './config.js';

export class HudOverlay {
  constructor() {
    this.root = document.getElementById('hud');
    this.stars = Array.from(document.querySelectorAll('#wanted-row .star'));
    this.moneyEl = document.getElementById('money-box');
    this.weaponNameEl = document.getElementById('weapon-name');
    this.weaponAmmoEl = document.getElementById('weapon-ammo');
    this.districtEl = document.getElementById('district-badge');
    this.objBanner = document.getElementById('objective-banner');
    this.objTag = document.getElementById('objective-tag');
    this.objText = document.getElementById('objective-text');
    this.healthFill = document.getElementById('health-fill');
    this.armourFill = document.getElementById('armour-fill');
    this.speedoBox = document.getElementById('speedo-box');
    this.speedoCar = document.getElementById('speedo-car');
    this.speedoVal = document.getElementById('speedo-val');
    this.speedoGear = document.getElementById('speedo-gear');
    this.speedoRpm = document.getElementById('speedo-rpm-fill');
    this.dialogueBox = document.getElementById('dialogue-box');
    this.dialogueSpeaker = document.getElementById('dialogue-speaker');
    this.dialogueText = document.getElementById('dialogue-text');
    this.crosshair = document.getElementById('crosshair');
    this.promptToast = document.getElementById('prompt-toast');
    this.controlsHint = document.getElementById('controls-hint');
    this.damageFlash = document.getElementById('damage-flash');
    this.wastedBanner = document.getElementById('wasted-banner');
    this.overlay = document.getElementById('overlay');
    this.playBtn = document.getElementById('play-btn');

    this.minimapCanvas = document.getElementById('minimap');
    this.minimapCtx = this.minimapCanvas.getContext('2d');
  }

  setVisible(show) {
    this.root.classList.toggle('visible', Boolean(show));
  }

  setOverlay(show, title = null) {
    this.overlay.classList.toggle('hidden', !show);
    if (title) this.playBtn.textContent = title;
  }

  setShotMode(isShot) {
    this.controlsHint.style.display = isShot ? 'none' : 'block';
  }

  drawMinimap(city, player, police, missions, vehicles) {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const scale = 0.56; // pixels per world meter

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Circular clip
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 1, 0, Math.PI * 2);
    ctx.clip();

    // Base land background
    ctx.fillStyle = '#182130';
    ctx.fillRect(0, 0, w, h);

    const px = player.pos.x;
    const pz = player.pos.z;
    const toMapX = (wx) => cx + (wx - px) * scale;
    const toMapY = (wz) => cy + (wz - pz) * scale;

    // Beach & Ocean on the east edge
    const beachX = toMapX(CITY.beachStartX);
    const waterX = toMapX(CITY.waterStartX);
    ctx.fillStyle = '#73654d';
    ctx.fillRect(beachX, 0, Math.max(0, waterX - beachX), h);
    ctx.fillStyle = '#0e5c78';
    ctx.fillRect(waterX, 0, w - waterX + 40, h);

    // City blocks
    ctx.fillStyle = '#29344a';
    for (const b of city.blocks) {
      const bx = toMapX(b.x - b.half);
      const bz = toMapY(b.z - b.half);
      const size = CITY.blockSize * scale;
      ctx.fillRect(bx, bz, size, size);
    }

    // Roads
    ctx.fillStyle = '#4c5870';
    const rw = CITY.roadWidth * scale;
    for (const rx of city.roadCentersX) {
      ctx.fillRect(toMapX(rx) - rw * 0.5, 0, rw, h);
    }
    for (const rz of city.roadCentersZ) {
      ctx.fillRect(0, toMapY(rz) - rw * 0.5, w, rw);
    }

    // Traffic blips (subtle light dots)
    ctx.fillStyle = 'rgba(235, 224, 200, 0.45)';
    for (const v of vehicles.vehicles) {
      if (v === player.vehicle || v.spec.isPolice) continue;
      const vx = toMapX(v.pos.x);
      const vz = toMapY(v.pos.z);
      ctx.fillRect(vx - 1.5, vz - 1.5, 3, 3);
    }

    // Mission objective / fixer blip
    if (missions && missions.objectivePos) {
      const mx = toMapX(missions.objectivePos.x);
      const mz = toMapY(missions.objectivePos.z);
      const dx = mx - cx;
      const dy = mz - cy;
      const dist = Math.hypot(dx, dy);
      const maxR = cx - 10;
      const clampedX = dist > maxR ? cx + (dx / dist) * maxR : mx;
      const clampedY = dist > maxR ? cy + (dy / dist) * maxR : mz;

      ctx.beginPath();
      ctx.arc(clampedX, clampedY, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = missions.activeMission ? '#42f2ff' : '#ffb347';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#101622';
      ctx.stroke();
    }

    // Police & enemy blips
    if (police) {
      const blips = police.getBlips();
      for (const b of blips) {
        const bx = toMapX(b.x);
        const bz = toMapY(b.z);
        ctx.beginPath();
        ctx.arc(bx, bz, 4.2, 0, Math.PI * 2);
        ctx.fillStyle = b.kind === 'enemy' ? '#ff9d3b' : '#ff3352';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
    }
    if (missions && missions.enemies) {
      for (const e of missions.enemies) {
        if (!e.alive) continue;
        const ex = toMapX(e.pos.x);
        const ez = toMapY(e.pos.z);
        ctx.beginPath();
        ctx.arc(ex, ez, 4.0, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4b5c';
        ctx.fill();
      }
    }

    // Player arrow at center
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-player.heading + Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fillStyle = '#fff8ee';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#141022';
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  update(time, city, player, police, missions, vehicles, combat) {
    // Wanted stars with red/blue strobe when active
    const stars = police ? police.stars : 0;
    const flashPhase = Math.floor(time * 5) % 2 === 0;
    for (let i = 0; i < this.stars.length; i++) {
      const el = this.stars[i];
      el.classList.remove('active', 'flash-red', 'flash-blue');
      if (i < stars) {
        el.classList.add('active');
        if (stars >= 2) el.classList.add(flashPhase ? 'flash-red' : 'flash-blue');
      }
    }

    // Money, weapon, district
    this.moneyEl.textContent = `$${Math.floor(player.money).toLocaleString('en-US')}`;
    const wSpec = player.getCurrentWeaponSpec();
    const wState = player.getCurrentWeaponState();
    this.weaponNameEl.textContent = wSpec.name;
    this.weaponAmmoEl.textContent = `${wState.mag} / ${wState.reserve}`;
    this.districtEl.textContent = getDistrictName(player.pos.x, player.pos.z);

    // Health & armour bars
    this.healthFill.style.width = `${Math.max(0, Math.min(100, player.health))}%`;
    this.armourFill.style.width = `${Math.max(0, Math.min(100, player.armour))}%`;

    // Objective banner
    if (missions && missions.objectiveText) {
      this.objBanner.classList.add('active');
      this.objTag.textContent = missions.objectiveTag || 'OBJECTIVE';
      this.objText.textContent = missions.objectiveText;
    } else {
      this.objBanner.classList.remove('active');
    }

    // Dialogue box
    if (missions && missions.dialogueText) {
      this.dialogueBox.classList.add('active');
      this.dialogueSpeaker.textContent = missions.dialogueSpeaker;
      this.dialogueText.textContent = missions.dialogueText;
    } else {
      this.dialogueBox.classList.remove('active');
    }

    // Speedometer when driving
    if (player.vehicle) {
      const mph = Math.round(Math.abs(player.vehicle.speed) * 2.237);
      const gear = player.vehicle.speed < -0.5 ? 'R' : Math.min(6, Math.max(1, Math.floor(mph / 20) + 1));
      const rpm = Math.min(100, 18 + ((mph % 24) / 24) * 76 + (mph > 80 ? 18 : 0));
      this.speedoBox.classList.add('active');
      this.speedoCar.textContent = player.vehicle.spec.name;
      this.speedoVal.textContent = String(mph);
      this.speedoGear.textContent = String(gear);
      this.speedoRpm.style.width = `${Math.round(rpm)}%`;
      this.crosshair.classList.remove('active');
    } else {
      this.speedoBox.classList.remove('active');
      this.crosshair.classList.add('active');
    }

    // Interaction prompt
    const prompt = missions ? missions.getPrompt(player) : '';
    if (prompt) {
      this.promptToast.textContent = prompt;
      this.promptToast.classList.add('active');
    } else {
      this.promptToast.classList.remove('active');
    }

    // Damage vignette & flatlined overlay
    this.damageFlash.style.opacity = combat ? String(combat.damageFlash.toFixed(2)) : '0';
    this.wastedBanner.classList.toggle('active', player.deadTimer > 0);

    // Minimap
    this.drawMinimap(city, player, police, missions, vehicles);
  }
}
