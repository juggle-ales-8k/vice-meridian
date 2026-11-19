import * as THREE from 'three';
import { COMBAT_CFG } from './config.js';
import { clamp, lerp } from './random.js';

const _tmpDir = new THREE.Vector3();

export class CombatSystem {
  constructor(scene, city, textures, rng) {
    this.scene = scene;
    this.city = city;
    this.textures = textures;
    this.rng = rng;

    this.fireTimer = 0;
    this.meleeTimer = 0;
    this.tracers = [];
    this.muzzleFlashes = [];
    this.sparks = [];
    this.ragdolls = [];
    this.damageFlash = 0;
    // Accumulated spread ("bloom") from sustained fire; recovers when the trigger is released.
    this.bloom = 0;
    // Hit-marker state read by the HUD: time left and whether the last hit was a kill.
    this.hitMarker = 0;
    this.hitMarkerKill = false;
    this.lastWeaponIndex = -1;
    this.shotsFired = 0;
    this.kills = 0;
    // Optional pedestrian manager so gunfire causes panic and punches can knock civilians down.
    this.peds = null;
  }

  spawnMuzzleFlash(pos, scale = 1.65) {
    const mat = new THREE.SpriteMaterial({
      map: this.textures.sunFlare,
      color: 0xffd37a,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(mat);
    sp.position.copy(pos);
    sp.scale.set(scale, scale, 1);
    this.scene.add(sp);
    this.muzzleFlashes.push({ mesh: sp, life: 0.08, maxLife: 0.08 });
  }

  spawnTracer(start, end, color = 0xffe48a, life = 0.14) {
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    if (len < 0.1) return;
    const geo = new THREE.CylinderGeometry(0.032, 0.032, len, 4);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start).addScaledVector(dir, 0.5);
    mesh.lookAt(end);
    this.scene.add(mesh);
    this.tracers.push({ mesh, life, maxLife: life, geo });
  }

  spawnImpactSpark(pos, color = 0xffa852, size = 1.4) {
    const mat = new THREE.SpriteMaterial({
      map: this.textures.warmGlow,
      color,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(mat);
    sp.position.copy(pos);
    sp.scale.set(size, size, 1);
    this.scene.add(sp);
    this.sparks.push({ mesh: sp, life: 0.18, maxLife: 0.18 });
  }

  raycastTargets(origin, dir, maxRange, targets) {
    let bestT = maxRange;
    let hitTarget = null;
    let hitPos = origin.clone().addScaledVector(dir, maxRange);
    let hitWorld = false;

    // Check against building colliders (2D slab ray)
    for (const c of this.city.colliders) {
      let tmin = 0;
      let tmax = bestT;
      if (Math.abs(dir.x) > 1e-6) {
        const tx1 = (c.minX - origin.x) / dir.x;
        const tx2 = (c.maxX - origin.x) / dir.x;
        tmin = Math.max(tmin, Math.min(tx1, tx2));
        tmax = Math.min(tmax, Math.max(tx1, tx2));
      } else if (origin.x < c.minX || origin.x > c.maxX) {
        continue;
      }
      if (Math.abs(dir.z) > 1e-6) {
        const tz1 = (c.minZ - origin.z) / dir.z;
        const tz2 = (c.maxZ - origin.z) / dir.z;
        tmin = Math.max(tmin, Math.min(tz1, tz2));
        tmax = Math.min(tmax, Math.max(tz1, tz2));
      } else if (origin.z < c.minZ || origin.z > c.maxZ) {
        continue;
      }
      if (tmax >= tmin && tmin > 0.2 && tmin < bestT) {
        const yAt = origin.y + dir.y * tmin;
        if (yAt >= 0 && yAt <= c.maxY + 0.3) {
          bestT = tmin;
          hitTarget = null;
          hitWorld = true;
          hitPos = origin.clone().addScaledVector(dir, bestT);
        }
      }
    }

    // Ground plane: shots aimed downward stop at the street.
    if (dir.y < -1e-4) {
      const tGround = (0.05 - origin.y) / dir.y;
      if (tGround > 0.2 && tGround < bestT) {
        bestT = tGround;
        hitWorld = true;
        hitPos = origin.clone().addScaledVector(dir, bestT);
      }
    }

    // Check against NPC cylinder hitboxes
    for (const t of targets) {
      if (!t.alive) continue;
      const toX = t.pos.x - origin.x;
      const toZ = t.pos.z - origin.z;
      const proj = toX * dir.x + toZ * dir.z;
      if (proj <= 0.3 || proj >= bestT) continue;
      const px = origin.x + dir.x * proj;
      const pz = origin.z + dir.z * proj;
      const py = origin.y + dir.y * proj;
      const distSq = (px - t.pos.x) ** 2 + (pz - t.pos.z) ** 2;
      if (distSq < 0.72 * 0.72 && py >= t.pos.y - 0.2 && py <= t.pos.y + 2.0) {
        bestT = proj;
        hitTarget = t;
        hitWorld = false;
        hitPos = new THREE.Vector3(px, py, pz);
      }
    }

    return { hitTarget, hitPos, dist: bestT, hitWorld };
  }

  // Linear damage falloff between the weapon's falloffStart and its range.
  damageAt(spec, dist) {
    const start = spec.falloffStart ?? spec.range * 0.5;
    const k = clamp((dist - start) / Math.max(1, spec.range - start), 0, 1);
    return spec.damage * lerp(1, spec.minDamageScale ?? 0.45, k);
  }

  // Apply damage to an NPC target and, if it dies, start a tumbling death.
  applyHit(target, amount, dir, player, police) {
    target.health -= amount;
    target.hitFlash = 0.2;
    this.hitMarker = COMBAT_CFG.hitMarkerTime;
    this.hitMarkerKill = false;
    if (target.health <= 0 && target.alive) {
      target.alive = false;
      this.hitMarkerKill = true;
      this.kills++;
      this.startRagdoll(target.mesh, dir, amount);
      if (player) player.money += target.faction === 'gang' ? 120 : 50;
    }
    if (police && target.faction !== 'gang') {
      police.reportCrime('shoot_officer', player ? player.pos : target.pos, 1.5);
    }
  }

  // Ragdoll-ish tumble: the body is pushed along the shot, pitches over with a little
  // twist, bounces once on the pavement and settles flat.
  startRagdoll(mesh, dir, force = 30) {
    if (!mesh) return;
    const push = clamp(force / 10, 1.6, 6);
    const tumbleSign = this.rng.chance(0.5) ? 1 : -1;
    this.ragdolls.push({
      mesh,
      t: 0,
      vx: dir.x * push,
      vz: dir.z * push,
      vy: 2.2,
      y: mesh.position.y,
      baseY: mesh.position.y,
      spin: this.rng.range(-2.4, 2.4),
      fallAxis: tumbleSign,
      startRotX: mesh.rotation.x,
      startRotZ: mesh.rotation.z,
    });
  }

  updateRagdolls(dt) {
    for (let i = this.ragdolls.length - 1; i >= 0; i--) {
      const r = this.ragdolls[i];
      r.t += dt;
      const m = r.mesh;
      r.vy -= 18 * dt;
      r.y += r.vy * dt;
      if (r.y <= r.baseY + 0.06) {
        r.y = r.baseY + 0.06;
        if (r.vy < -1.5) r.vy = -r.vy * 0.28; else r.vy = 0;
        r.vx *= 0.55;
        r.vz *= 0.55;
      }
      m.position.x += r.vx * dt;
      m.position.z += r.vz * dt;
      m.position.y = r.y;
      const fall = clamp(r.t / 0.55, 0, 1);
      const eased = 1 - (1 - fall) * (1 - fall);
      m.rotation.x = r.startRotX + eased * Math.PI * 0.5;
      m.rotation.z = r.startRotZ + eased * 0.35 * r.fallAxis;
      m.rotation.y += r.spin * dt * (1 - fall);
      if (r.t > 1.4) this.ragdolls.splice(i, 1);
    }
  }

  // Melee punch: short-range cone check in front of the player.
  punch(player, targets, police, audio) {
    if (this.meleeTimer > 0 || player.vehicle || player.deadTimer > 0) return false;
    this.meleeTimer = COMBAT_CFG.punchCooldown;
    player.punchTimer = 0.28;
    const fx = Math.sin(player.heading);
    const fz = Math.cos(player.heading);
    let best = null;
    let bestD = COMBAT_CFG.punchRange;
    const consider = (t) => {
      if (!t.alive) return;
      const dx = t.pos.x - player.pos.x;
      const dz = t.pos.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD || d < 1e-3) return;
      if ((dx * fx + dz * fz) / d < 0.5) return;
      best = t;
      bestD = d;
    };
    for (const t of targets) consider(t);
    let pedHit = null;
    if (this.peds && this.peds.peds) {
      for (const p of this.peds.peds) {
        const before = best;
        consider(p);
        if (best !== before) pedHit = p;
      }
    }
    if (!best) {
      if (audio && audio.playWhoosh) audio.playWhoosh();
      return false;
    }
    _tmpDir.set(fx, 0, fz);
    const hitPos = new THREE.Vector3(best.pos.x, best.pos.y + 1.4, best.pos.z);
    this.spawnImpactSpark(hitPos, 0xffffff, 0.9);
    player.addShake(0.08);
    if (audio && audio.playPunch) audio.playPunch();
    if (pedHit === best && this.peds.knockDown) {
      this.peds.knockDown(best, _tmpDir);
      this.hitMarker = COMBAT_CFG.hitMarkerTime;
      this.hitMarkerKill = !best.alive;
      if (police && police.isCopNearby(player.pos, 60)) police.reportCrime('assault', player.pos, 0.6);
    } else {
      this.applyHit(best, COMBAT_CFG.punchDamage, _tmpDir, player, police);
    }
    return true;
  }

  firePlayerWeapon(player, targets, police, audio) {
    if (player.vehicle || player.deadTimer > 0) return;
    const spec = player.getCurrentWeaponSpec();
    if (spec.melee) {
      this.punch(player, targets, police, audio);
      return;
    }
    if (this.fireTimer > 0) return;

    const st = player.getCurrentWeaponState();
    if (st.mag <= 0) {
      this.reloadWeapon(player, audio);
      return;
    }

    st.mag--;
    this.shotsFired++;
    this.fireTimer = spec.fireRate;
    player.addShake(0.08 + (spec.recoil || 0) * 2.2);
    if (audio) audio.playGunshot(spec.id === 'smg' ? 1.25 : 1.0);

    // Recoil kicks the view up a little and lets sustained fire bloom the spread.
    if (spec.recoil) player.camPitch = Math.max(-0.25, player.camPitch - spec.recoil);
    const spread = spec.spread + this.bloom;
    this.bloom = Math.min(COMBAT_CFG.maxBloom, this.bloom + (spec.bloomPerShot || 0.006));

    const muzzlePos = new THREE.Vector3(
      player.pos.x + Math.sin(player.heading) * 0.72 + Math.cos(player.heading) * 0.26,
      player.pos.y + 1.38,
      player.pos.z + Math.cos(player.heading) * 0.72 - Math.sin(player.heading) * 0.26,
    );

    const aimDir = new THREE.Vector3(
      Math.sin(player.camYaw) * Math.cos(player.camPitch),
      -Math.sin(player.camPitch) * 0.65,
      Math.cos(player.camYaw) * Math.cos(player.camPitch),
    );
    aimDir.x += (this.rng.next() - 0.5) * spread;
    aimDir.y += (this.rng.next() - 0.5) * spread;
    aimDir.z += (this.rng.next() - 0.5) * spread;
    aimDir.normalize();

    this.spawnMuzzleFlash(muzzlePos, 1.55);
    const res = this.raycastTargets(muzzlePos, aimDir, spec.range, targets);
    this.spawnTracer(muzzlePos, res.hitPos, 0xffe48a, 0.13);
    this.spawnImpactSpark(res.hitPos, res.hitTarget ? 0xff4558 : 0xffbe68);
    if (this.peds && this.peds.alertGunfire) this.peds.alertGunfire(player.pos, COMBAT_CFG.panicRadius);

    if (res.hitTarget) {
      this.applyHit(res.hitTarget, this.damageAt(spec, res.dist), aimDir, player, police);
    } else {
      if (res.hitWorld && res.hitPos.y > 1.2 && audio && this.rng.chance(0.25)) audio.playGlassBreak(0.5);
      if (police && police.isCopNearby(player.pos, 75)) police.reportCrime('weapon_fire', player.pos, 0.8);
    }

    if (st.mag === 0) this.reloadWeapon(player, audio);
  }

  reloadWeapon(player, audio = null) {
    const spec = player.getCurrentWeaponSpec();
    if (spec.melee) return;
    const st = player.getCurrentWeaponState();
    const need = spec.magSize - st.mag;
    const take = Math.min(need, st.reserve);
    if (take <= 0) return;
    st.mag += take;
    st.reserve -= take;
    this.fireTimer = Math.max(this.fireTimer, spec.reloadTime || 0.9);
    if (audio && audio.playReload) audio.playReload();
  }

  fireNpcShot(npc, player, forceHit = null) {
    const start = new THREE.Vector3(
      npc.pos.x + Math.sin(npc.heading) * 0.65,
      npc.pos.y + 1.35,
      npc.pos.z + Math.cos(npc.heading) * 0.65,
    );
    const targetPos = new THREE.Vector3(player.pos.x, player.pos.y + 1.25, player.pos.z);
    const dir = new THREE.Vector3().subVectors(targetPos, start);
    const dist = dir.length();
    dir.normalize();

    // Accuracy falls off with distance and when the player is moving fast.
    const playerSpeed = player.vehicle ? Math.abs(player.vehicle.speed) : Math.hypot(player.vel.x, player.vel.z);
    const hitChance = COMBAT_CFG.npcBaseAccuracy * clamp(1.35 - dist / 55, 0.25, 1.2) * clamp(1.15 - playerSpeed / 40, 0.4, 1.1);
    const hits = forceHit !== null ? forceHit : this.rng.chance(hitChance);
    if (!hits) {
      dir.x += this.rng.range(-0.14, 0.14);
      dir.y += this.rng.range(-0.07, 0.08);
      dir.z += this.rng.range(-0.14, 0.14);
      dir.normalize();
    }

    const end = start.clone().addScaledVector(dir, Math.min(dist + 4, 65));
    this.spawnMuzzleFlash(start, 1.4);
    this.spawnTracer(start, end, npc.faction === 'gang' ? 0xff7048 : 0x70d4ff, 0.18);
    if (this.peds && this.peds.alertGunfire) this.peds.alertGunfire(npc.pos, COMBAT_CFG.panicRadius * 0.7);

    if (hits && player.deadTimer <= 0) {
      const dmg = Math.round(COMBAT_CFG.npcDamage * clamp(1.2 - dist / 80, 0.5, 1.2));
      player.damage(dmg);
      this.damageFlash = 0.7;
      this.spawnImpactSpark(targetPos, 0xff4558);
    }
  }

  update(dt, controls, player, allTargets, police, audio) {
    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (this.meleeTimer > 0) this.meleeTimer -= dt;
    if (this.hitMarker > 0) this.hitMarker = Math.max(0, this.hitMarker - dt);
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt * 2.4);
    if (!controls.fire) this.bloom = Math.max(0, this.bloom - dt * COMBAT_CFG.bloomRecover);

    if (player.weaponIndex !== this.lastWeaponIndex) {
      if (this.lastWeaponIndex >= 0 && audio && audio.playWeaponSwitch) audio.playWeaponSwitch();
      this.lastWeaponIndex = player.weaponIndex;
      this.bloom = 0;
      this.fireTimer = Math.max(this.fireTimer, 0.18);
    }

    if (controls.reload) this.reloadWeapon(player, audio);
    if (controls.melee) this.punch(player, allTargets, police, audio);
    if (controls.fire) this.firePlayerWeapon(player, allTargets, police, audio);

    this.updateRagdolls(dt);

    const decayList = (arr) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const it = arr[i];
        it.life -= dt;
        if (it.life <= 0) {
          this.scene.remove(it.mesh);
          if (it.geo) it.geo.dispose();
          if (it.mesh.material) it.mesh.material.dispose();
          arr.splice(i, 1);
        } else if (it.mesh.material && 'opacity' in it.mesh.material) {
          it.mesh.material.opacity = Math.max(0, it.life / it.maxLife);
        }
      }
    };
    decayList(this.tracers);
    decayList(this.muzzleFlashes);
    decayList(this.sparks);
  }
}
