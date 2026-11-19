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

    this.wantedDecay = document.getElementById('wanted-decay');
    this.wantedDecayFill = document.getElementById('wanted-decay-fill');
    this.objTimer = document.getElementById('objective-timer');
    this.missionToast = document.getElementById('mission-toast');
    this.hitmarker = document.getElementById('hitmarker');
    this.bustedBanner = document.getElementById('busted-banner');
    this.wastedCount = document.getElementById('wasted-count');
    this.bustedCount = document.getElementById('busted-count');
    this.continueBtn = document.getElementById('continue-btn');
    this.loading = document.getElementById('loading');
    // Last values written to the DOM, so unchanged text is never re-assigned each frame.
    this._cache = new Map();
    this.minimapZoom = 0.56;
  }

  _text(el, value) {
    if (!el) return;
    if (this._cache.get(el) === value) return;
    this._cache.set(el, value);
    el.textContent = value;
  }

  // Hide the loading veil. In shot mode it must vanish instantly (no fade) so the
  // deterministic frame is never captured mid-transition.
  hideLoading(instant = false) {
    if (!this.loading) return;
    if (instant) this.loading.style.display = 'none';
    else this.loading.classList.add('done');
  }

  setContinueAvailable(available) {
    if (this.continueBtn) this.continueBtn.classList.toggle('active', Boolean(available));
  }

  setOverlayCopy(kicker, sub) {
    const k = document.getElementById('title-kicker');
    const s = document.getElementById('title-sub');
    if (k && kicker) k.textContent = kicker;
    if (s && sub) s.textContent = sub;
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
    // Zoom out smoothly at speed so the driver sees further ahead.
    const spd = player.vehicle ? Math.abs(player.vehicle.speed) : 0;
    const targetZoom = 0.56 - Math.min(0.22, spd * 0.005);
    this.minimapZoom += (targetZoom - this.minimapZoom) * 0.08;
    const scale = this.minimapZoom; // pixels per world meter

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

    // West Annex: its blocks, short N-S streets and the staggered E-W streets.
    if (city.annex) {
      const a = city.annex;
      ctx.fillStyle = '#2c3348';
      const size = CITY.blockSize * scale;
      for (const bx of a.blockX) {
        for (const bz of a.blockZ) ctx.fillRect(toMapX(bx - CITY.blockSize * 0.5), toMapY(bz - CITY.blockSize * 0.5), size, size);
      }
      ctx.fillStyle = '#4c5870';
      for (const rx of a.roadX) ctx.fillRect(toMapX(rx) - rw * 0.5, toMapY(a.minZ), rw, (a.maxZ - a.minZ) * scale);
      for (const rz of a.roadZ) ctx.fillRect(toMapX(a.minX), toMapY(rz) - rw * 0.5, (a.maxX - a.minX) * scale, rw);
    }

    // Parks in green, the pier as a pale plank strip.
    if (city.parks) {
      ctx.fillStyle = '#2f5a3a';
      for (const p of city.parks) ctx.fillRect(toMapX(p.x - p.half), toMapY(p.z - p.half), p.half * 2 * scale, p.half * 2 * scale);
    }
    if (city.pier) {
      const pr = city.pier;
      ctx.fillStyle = '#a88d6a';
      ctx.fillRect(toMapX(pr.x0), toMapY(pr.z - pr.halfW), (pr.x1 - pr.x0) * scale, pr.halfW * 2 * scale);
    }

    // Landmark icons: hospital (red cross) and garage (cyan square).
    const hx = toMapX(CITY.hospitalPos.x);
    const hz = toMapY(CITY.hospitalPos.z);
    ctx.fillStyle = '#ff4558';
    ctx.fillRect(hx - 1.5, hz - 4.5, 3, 9);
    ctx.fillRect(hx - 4.5, hz - 1.5, 9, 3);
    ctx.strokeStyle = '#42f2ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(toMapX(CITY.garagePos.x) - 4, toMapY(CITY.garagePos.z) - 4, 8, 8);

    // Pickups (health / armour / cash) from the mission system.
    if (missions && missions.pickups) {
      for (const pk of missions.pickups) {
        if (pk.taken) continue;
        ctx.fillStyle = pk.kind === 'health' ? '#4ce88b' : pk.kind === 'armour' ? '#2fb8ff' : '#ffd84d';
        ctx.beginPath();
        const ux = toMapX(pk.x);
        const uz = toMapY(pk.z);
        ctx.moveTo(ux, uz - 4);
        ctx.lineTo(ux + 4, uz);
        ctx.lineTo(ux, uz + 4);
        ctx.lineTo(ux - 4, uz);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Roadblocks (police barricades) as white/red bars.
    if (police && police.roadblocks) {
      for (const rb of police.roadblocks) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(toMapX(rb.x) - 5, toMapY(rb.z) - 2, 10, 4);
        ctx.fillStyle = '#ff3352';
        ctx.fillRect(toMapX(rb.x) - 1.5, toMapY(rb.z) - 2, 3, 4);
      }
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

    // Wanted-level decay bar: drains while the player is out of police sight.
    const decay = police && police.getDecayFraction ? police.getDecayFraction() : 0;
    if (this.wantedDecay) {
      this.wantedDecay.classList.toggle('active', stars > 0);
      this.wantedDecayFill.style.width = `${Math.round((1 - decay) * 100)}%`;
    }

    // Money, weapon, district
    this._text(this.moneyEl, `$${Math.floor(player.money).toLocaleString('en-US')}`);
    const wSpec = player.getCurrentWeaponSpec();
    const wState = player.getCurrentWeaponState();
    this._text(this.weaponNameEl, wSpec.name);
    this._text(this.weaponAmmoEl, wSpec.melee ? '—' : `${wState.mag} / ${wState.reserve}`);
    this._text(this.districtEl, getDistrictName(player.pos.x, player.pos.z));

    // Health & armour bars
    this.healthFill.style.width = `${Math.max(0, Math.min(100, player.health))}%`;
    this.armourFill.style.width = `${Math.max(0, Math.min(100, player.armour))}%`;

    // Objective banner (+ countdown for timed objectives)
    if (missions && missions.objectiveText) {
      this.objBanner.classList.add('active');
      this._text(this.objTag, missions.objectiveTag || 'OBJECTIVE');
      this._text(this.objText, missions.objectiveText);
      const tr = missions.timerRemaining;
      if (tr !== undefined && tr !== null && tr > 0) {
        const m = Math.floor(tr / 60);
        const s = Math.floor(tr % 60);
        this._text(this.objTimer, `${m}:${String(s).padStart(2, '0')}`);
        this.objTimer.style.color = tr < 10 ? '#ff4558' : '#ffcf5c';
      } else {
        this._text(this.objTimer, '');
      }
    } else {
      this.objBanner.classList.remove('active');
    }

    // Mission passed / failed toast
    if (this.missionToast && missions) {
      const show = missions.toastTimer > 0 && Boolean(missions.toastText);
      this.missionToast.classList.toggle('active', show);
      this.missionToast.classList.toggle('fail', Boolean(missions.toastFail));
      if (show) this._text(this.missionToast, missions.toastText);
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

    // Damage vignette: hit flashes plus a slow pulse while health is critical.
    const flash = combat ? combat.damageFlash : 0;
    const lowHp = player.health > 0 && player.health < 30 ? (0.18 + 0.12 * Math.sin(time * 5)) * (1 - player.health / 30) + 0.1 : 0;
    this.damageFlash.style.opacity = Math.min(1, Math.max(flash, lowHp)).toFixed(2);

    // Hit marker
    if (this.hitmarker && combat) {
      this.hitmarker.style.opacity = combat.hitMarker > 0 ? '1' : '0';
      this.hitmarker.classList.toggle('kill', Boolean(combat.hitMarkerKill));
    }

    // Wasted / Busted overlays with respawn countdown
    const wasted = player.deadTimer > 0 && !player.busted;
    const busted = player.deadTimer > 0 && Boolean(player.busted);
    this.wastedBanner.classList.toggle('active', wasted);
    if (this.bustedBanner) this.bustedBanner.classList.toggle('active', busted);
    const countText = player.deadTimer > 0 ? `RESPAWNING IN ${Math.ceil(player.deadTimer)}` : '';
    this._text(this.wastedCount, wasted ? countText : '');
    this._text(this.bustedCount, busted ? countText : '');

    // Minimap
    this.drawMinimap(city, player, police, missions, vehicles);
  }
}
