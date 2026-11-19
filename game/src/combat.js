import * as THREE from 'three';

export class CombatSystem {
  constructor(scene, city, textures, rng) {
    this.scene = scene;
    this.city = city;
    this.textures = textures;
    this.rng = rng;

    this.fireTimer = 0;
    this.tracers = [];
    this.muzzleFlashes = [];
    this.sparks = [];
    this.damageFlash = 0;
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
    this.tracers.push({ mesh, life, maxLife: life });
  }

  spawnImpactSpark(pos, color = 0xffa852) {
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
    sp.scale.set(1.4, 1.4, 1);
    this.scene.add(sp);
    this.sparks.push({ mesh: sp, life: 0.18, maxLife: 0.18 });
  }

  raycastTargets(origin, dir, maxRange, targets) {
    let bestT = maxRange;
    let hitTarget = null;
    let hitPos = origin.clone().addScaledVector(dir, maxRange);

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
          hitPos = origin.clone().addScaledVector(dir, bestT);
        }
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
        hitPos = new THREE.Vector3(px, py, pz);
      }
    }

    return { hitTarget, hitPos, dist: bestT };
  }

  firePlayerWeapon(player, targets, police, audio) {
    if (player.vehicle || player.deadTimer > 0) return;
    if (this.fireTimer > 0) return;

    const spec = player.getCurrentWeaponSpec();
    const st = player.getCurrentWeaponState();
    if (st.mag <= 0) {
      this.reloadWeapon(player);
      return;
    }

    st.mag--;
    this.fireTimer = spec.fireRate;
    player.addShake(0.14);
    if (audio) audio.playGunshot(spec.id === 'smg' ? 1.25 : 1.0);

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
    aimDir.x += (this.rng.next() - 0.5) * spec.spread;
    aimDir.y += (this.rng.next() - 0.5) * spec.spread;
    aimDir.z += (this.rng.next() - 0.5) * spec.spread;
    aimDir.normalize();

    this.spawnMuzzleFlash(muzzlePos, 1.55);
    const res = this.raycastTargets(muzzlePos, aimDir, spec.range, targets);
    this.spawnTracer(muzzlePos, res.hitPos, 0xffe48a, 0.13);
    this.spawnImpactSpark(res.hitPos, res.hitTarget ? 0xff4558 : 0xffbe68);

    if (res.hitTarget) {
      res.hitTarget.health -= spec.damage;
      res.hitTarget.hitFlash = 0.2;
      if (res.hitTarget.health <= 0) {
        res.hitTarget.alive = false;
        res.hitTarget.mesh.rotation.x = Math.PI * 0.5;
        res.hitTarget.mesh.position.y = 0.28;
        player.money += res.hitTarget.faction === 'gang' ? 120 : 50;
      }
      if (police && res.hitTarget.faction !== 'gang') {
        police.reportCrime('shoot_officer', player.pos, 1.5);
      }
    } else if (police && police.isCopNearby(player.pos, 75)) {
      police.reportCrime('weapon_fire', player.pos, 0.8);
    }

    if (st.mag === 0) this.reloadWeapon(player);
  }

  reloadWeapon(player) {
    const spec = player.getCurrentWeaponSpec();
    const st = player.getCurrentWeaponState();
    const need = spec.magSize - st.mag;
    const take = Math.min(need, st.reserve);
    st.mag += take;
    st.reserve -= take;
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

    const hits = forceHit !== null ? forceHit : this.rng.chance(0.32);
    if (!hits) {
      dir.x += this.rng.range(-0.14, 0.14);
      dir.y += this.rng.range(-0.07, 0.08);
      dir.z += this.rng.range(-0.14, 0.14);
      dir.normalize();
    }

    const end = start.clone().addScaledVector(dir, Math.min(dist + 4, 65));
    this.spawnMuzzleFlash(start, 1.4);
    this.spawnTracer(start, end, npc.faction === 'gang' ? 0xff7048 : 0x70d4ff, 0.18);

    if (hits && player.deadTimer <= 0) {
      player.damage(9);
      this.damageFlash = 0.7;
      this.spawnImpactSpark(targetPos, 0xff4558);
    }
  }

  update(dt, controls, player, allTargets, police, audio) {
    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt * 2.4);

    if (controls.reload) this.reloadWeapon(player);
    if (controls.fire) this.firePlayerWeapon(player, allTargets, police, audio);

    const decayList = (arr) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const it = arr[i];
        it.life -= dt;
        if (it.life <= 0) {
          this.scene.remove(it.mesh);
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
