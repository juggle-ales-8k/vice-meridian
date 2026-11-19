import * as THREE from 'three';
import { CITY, PLAYER_CFG, WEAPONS } from './config.js';
import { clamp, damp, wrapAngle } from './random.js';

function createPlayerMesh() {
  const root = new THREE.Group();

  const legsMat = new THREE.MeshLambertMaterial({ color: 0x222c3c });
  const shirtMat = new THREE.MeshLambertMaterial({ color: 0x1fc7c9 });
  const jacketMat = new THREE.MeshLambertMaterial({ color: 0xf4eee4 });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xd8a178 });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x1b1718 });
  const gunMat = new THREE.MeshLambertMaterial({ color: 0x252830 });

  const legGeo = new THREE.BoxGeometry(0.2, 0.78, 0.22);
  legGeo.translate(0, -0.39, 0);
  const legL = new THREE.Mesh(legGeo, legsMat);
  legL.position.set(-0.14, 0.8, 0);
  legL.castShadow = true;
  const legR = new THREE.Mesh(legGeo, legsMat);
  legR.position.set(0.14, 0.8, 0);
  legR.castShadow = true;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.66, 0.28), jacketMat);
  torso.position.set(0, 1.15, 0);
  torso.castShadow = true;

  const shirtStrip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.3), shirtMat);
  shirtStrip.position.set(0, 1.14, 0.01);

  const armGeo = new THREE.BoxGeometry(0.16, 0.62, 0.16);
  armGeo.translate(0, -0.26, 0);
  const armL = new THREE.Mesh(armGeo, jacketMat);
  armL.position.set(-0.35, 1.4, 0);
  const armR = new THREE.Mesh(armGeo, jacketMat);
  armR.position.set(0.35, 1.4, 0);

  const pistol = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.34), gunMat);
  pistol.position.set(0, -0.5, 0.18);
  armR.add(pistol);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), skinMat);
  head.position.set(0, 1.66, 0);
  head.castShadow = true;

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.32), hairMat);
  hair.position.set(0, 1.82, -0.02);

  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.06), gunMat);
  shades.position.set(0, 1.68, 0.15);

  root.add(legL, legR, torso, shirtStrip, armL, armR, head, hair, shades);
  return { root, legL, legR, armL, armR, pistol };
}

export class PlayerController {
  constructor(scene, city, camera) {
    this.scene = scene;
    this.city = city;
    this.camera = camera;

    const built = createPlayerMesh();
    this.mesh = built.root;
    this.parts = built;
    this.scene.add(this.mesh);

    this.pos = new THREE.Vector3(122, 0.22, -24);
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.camYaw = 0;
    this.camPitch = 0.24;
    this.onGround = true;
    this.walkPhase = 0;
    this.aiming = false;

    this.vehicle = null;
    this.storedGarageType = null;
    this.storedGarageColor = null;

    this.health = PLAYER_CFG.maxHealth;
    this.armour = PLAYER_CFG.maxArmour;
    this.money = 1250;
    this.deadTimer = 0;

    this.weaponIndex = 0;
    this.weaponsState = WEAPONS.map((w) => ({
      id: w.id,
      unlocked: w.unlockedByDefault,
      mag: w.magSize,
      reserve: Math.floor(w.maxReserve * 0.65),
    }));

    this.shake = 0;
    this.shakeClock = 0;
    this.camPos = new THREE.Vector3(122, 5, -34);
    this.camLook = new THREE.Vector3(122, 2, -24);
    this.cameraOverride = null;

    // 0 = on-foot rig, 1 = driving rig; eased over PLAYER_CFG.cameraBlendTime on enter/exit.
    this.camBlend = 0;
    this.lastVehicle = null;
    this.lookBack = false;
    this.busted = false;
    this.bustProgress = 0;
    this.punchTimer = 0;
    this.lastHitTimer = 0;
    this.moving = false;
    this.running = false;
    this.landingSquash = 0;
    this.stats = { distanceDriven: 0, distanceWalked: 0, deaths: 0, arrests: 0 };
  }

  // Select a weapon by id if it is unlocked; returns true when the selection changed.
  selectWeapon(id) {
    const idx = WEAPONS.findIndex((w) => w.id === id);
    if (idx < 0 || !this.weaponsState[idx].unlocked || idx === this.weaponIndex) return false;
    this.weaponIndex = idx;
    return true;
  }

  cycleWeapon() {
    for (let step = 1; step <= WEAPONS.length; step++) {
      const idx = (this.weaponIndex + step) % WEAPONS.length;
      if (this.weaponsState[idx].unlocked) {
        this.weaponIndex = idx;
        return;
      }
    }
  }

  serialize() {
    return {
      x: +this.pos.x.toFixed(2),
      z: +this.pos.z.toFixed(2),
      heading: +this.heading.toFixed(3),
      health: Math.round(this.health),
      armour: Math.round(this.armour),
      money: Math.floor(this.money),
      weaponIndex: this.weaponIndex,
      weapons: this.weaponsState.map((w) => ({ id: w.id, unlocked: w.unlocked, mag: w.mag, reserve: w.reserve })),
      garage: this.storedGarageType ? { type: this.storedGarageType, color: this.storedGarageColor } : null,
    };
  }

  restore(data) {
    if (!data) return;
    if (this.vehicle) this.exitVehicle();
    this.pos.set(data.x, 0.22, data.z);
    this.city.resolveCircleCollisions(this.pos, PLAYER_CFG.radius);
    this.heading = Number.isFinite(data.heading) ? data.heading : 0;
    this.camYaw = this.heading;
    this.health = clamp(Number(data.health) || PLAYER_CFG.maxHealth, 1, PLAYER_CFG.maxHealth);
    this.armour = clamp(Number(data.armour) || 0, 0, PLAYER_CFG.maxArmour);
    this.money = Math.max(0, Number(data.money) || 0);
    if (Array.isArray(data.weapons)) {
      for (const saved of data.weapons) {
        const st = this.weaponsState.find((w) => w.id === saved.id);
        if (!st) continue;
        st.unlocked = Boolean(saved.unlocked);
        st.mag = Math.max(0, saved.mag | 0);
        st.reserve = Math.max(0, saved.reserve | 0);
      }
    }
    if (Number.isInteger(data.weaponIndex) && this.weaponsState[data.weaponIndex] && this.weaponsState[data.weaponIndex].unlocked) {
      this.weaponIndex = data.weaponIndex;
    }
    if (data.garage) {
      this.storedGarageType = data.garage.type;
      this.storedGarageColor = data.garage.color;
    }
    this.deadTimer = 0;
    this.busted = false;
    this.vel.set(0, 0, 0);
    this.mesh.position.copy(this.pos);
    this.mesh.visible = true;
    this.camPos.set(this.pos.x - Math.sin(this.heading) * 5, this.pos.y + 3, this.pos.z - Math.cos(this.heading) * 5);
    this.camLook.copy(this.pos);
  }

  getCurrentWeaponSpec() {
    return WEAPONS[this.weaponIndex];
  }

  getCurrentWeaponState() {
    return this.weaponsState[this.weaponIndex];
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  damage(amount) {
    if (this.deadTimer > 0) return;
    let rem = amount;
    if (this.armour > 0) {
      const absorbed = Math.min(this.armour, rem * PLAYER_CFG.armourAbsorb);
      this.armour = Math.max(0, this.armour - absorbed);
      rem -= absorbed;
    }
    this.health = Math.max(0, this.health - rem);
    this.lastHitTimer = 4;
    this.addShake(0.32);
    if (this.health <= 0) {
      this.deadTimer = 3.2;
      this.busted = false;
      this.stats.deaths++;
      if (this.vehicle) this.exitVehicle();
      // Collapse on the spot.
      this.mesh.rotation.x = -Math.PI * 0.5;
      this.mesh.position.y = this.pos.y + 0.2;
    }
  }

  // Called by the police when officers pin a slow/stationary wanted player.
  arrest() {
    if (this.deadTimer > 0) return;
    this.busted = true;
    this.deadTimer = 3.6;
    this.stats.arrests++;
    if (this.vehicle) this.exitVehicle();
    this.vel.set(0, 0, 0);
    this.parts.armL.rotation.x = -2.9;
    this.parts.armR.rotation.x = -2.9;
  }

  respawnAtHospital() {
    this.pos.set(CITY.hospitalPos.x, 0.22, CITY.hospitalPos.z + 18);
    this.vel.set(0, 0, 0);
    this.health = PLAYER_CFG.maxHealth;
    this.armour = 50;
    this.money = Math.max(0, this.money - 200);
    this.deadTimer = 0;
    this.mesh.visible = true;
    this.mesh.rotation.x = 0;
  }

  // Busted: released from Meridian PD Central, minus bail and every gun's ammunition.
  respawnAtPolice() {
    this.pos.set(CITY.policeHQPos.x, 0.22, CITY.policeHQPos.z + 18);
    this.vel.set(0, 0, 0);
    this.health = PLAYER_CFG.maxHealth;
    this.armour = 0;
    this.money = Math.max(0, this.money - 300);
    for (const st of this.weaponsState) {
      st.mag = 0;
      st.reserve = 0;
    }
    const pistol = this.weaponsState.find((w) => w.id === 'pistol');
    if (pistol) pistol.mag = 6;
    this.deadTimer = 0;
    this.busted = false;
    this.mesh.visible = true;
    this.mesh.rotation.x = 0;
  }

  enterVehicle(v, police, audio) {
    if (this.vehicle || !v) return false;
    this.vehicle = v;
    v.aiMode = 'player';
    this.mesh.visible = false;
    if (!v.stolen) {
      v.stolen = true;
      if (police && police.isCopNearby(v.pos, 65)) {
        police.reportCrime('car_theft', v.pos, 2);
      } else if (v.spec.isPolice && police) {
        police.reportCrime('police_theft', v.pos, 2);
      }
    }
    if (audio) audio.playDoor();
    return true;
  }

  exitVehicle() {
    if (!this.vehicle) return;
    const v = this.vehicle;
    const leftX = Math.cos(v.heading) * (v.spec.width * 0.75 + 0.6);
    const leftZ = -Math.sin(v.heading) * (v.spec.width * 0.75 + 0.6);
    this.pos.set(v.pos.x - leftX, 0.22, v.pos.z - leftZ);
    this.city.resolveCircleCollisions(this.pos, PLAYER_CFG.radius);
    this.heading = v.heading;
    this.vel.set(0, 0, 0);
    v.aiMode = 'parked';
    this.vehicle = null;
    this.mesh.visible = true;
  }

  update(dt, controls, mouseDelta, vehicles, police, audio) {
    if (this.punchTimer > 0) this.punchTimer -= dt;
    if (this.deadTimer > 0) {
      this.deadTimer -= dt;
      if (this.deadTimer <= 0) {
        if (this.busted) this.respawnAtPolice();
        else this.respawnAtHospital();
        if (police) police.resetWanted();
        this.camBlend = 0;
      }
      this.updateCamera(dt);
      return;
    }

    // Mouse / right-stick look
    this.camYaw = wrapAngle(this.camYaw - mouseDelta.dx * 0.0026);
    this.camPitch = clamp(this.camPitch + mouseDelta.dy * 0.0022, -0.25, 0.85);
    this.lookBack = Boolean(controls.lookBack);
    this.aiming = Boolean(controls.aim) && !this.vehicle;

    // Weapon switching: 1 fists, 2 pistol, 3 SMG (if unlocked), X / RB cycles.
    if (controls.weapon1) this.selectWeapon('fists');
    if (controls.weapon2) this.selectWeapon('pistol');
    if (controls.weapon3) this.selectWeapon('smg');
    if (controls.nextWeapon) this.cycleWeapon();

    // Slow health regeneration when out of combat and badly hurt.
    if (this.lastHitTimer > 0) this.lastHitTimer -= dt;
    else if (this.health < PLAYER_CFG.healthRegenBelow) this.health = Math.min(PLAYER_CFG.healthRegenBelow, this.health + PLAYER_CFG.healthRegenRate * dt);

    // Enter / exit vehicle
    if (controls.enterExit) {
      if (this.vehicle) {
        this.exitVehicle();
      } else {
        const near = vehicles.findNearestVehicle(this.pos, PLAYER_CFG.enterVehicleDist);
        if (near) this.enterVehicle(near, police, audio);
      }
    }

    if (this.vehicle) {
      this.stats.distanceDriven += Math.abs(this.vehicle.speed) * dt;
      this.pos.copy(this.vehicle.pos);
      this.heading = this.vehicle.heading;
      // Save stolen car into garage when parked on the garage pad
      const gDist = Math.hypot(this.pos.x - CITY.garagePos.x, this.pos.z - CITY.garagePos.z);
      if (gDist < 5.5 && Math.abs(this.vehicle.speed) < 3.5) {
        this.storedGarageType = this.vehicle.type;
        this.storedGarageColor = this.vehicle.color;
      }
    } else {
      // On-foot movement relative to camera yaw. Analog sticks give proportional walk → run;
      // the keyboard walks, and Shift (or a full stick push + sprint) runs.
      let moveZ = controls.moveY !== undefined ? controls.moveY : (controls.forward ? 1 : 0) - (controls.backward ? 1 : 0);
      let moveX = controls.moveX !== undefined ? controls.moveX : (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
      const mag = Math.min(1, Math.hypot(moveX, moveZ));
      const aimSlow = this.aiming ? 0.6 : 1;
      const speed = (controls.sprint && !this.aiming ? PLAYER_CFG.sprintSpeed : PLAYER_CFG.walkSpeed * Math.max(0.35, mag)) * aimSlow;
      this.running = Boolean(controls.sprint) && mag > 0.1 && !this.aiming;
      if (mag > 1e-3 && mag < 1) {
        moveX /= mag;
        moveZ /= mag;
      }

      const sinY = Math.sin(this.camYaw);
      const cosY = Math.cos(this.camYaw);
      let dirX = sinY * moveZ + cosY * moveX;
      let dirZ = cosY * moveZ - sinY * moveX;
      const len = Math.hypot(dirX, dirZ);
      // Air control is reduced so jumps carry momentum.
      const control = this.onGround ? 1 : 0.25;
      if (len > 0.01) {
        dirX /= len;
        dirZ /= len;
        this.vel.x = damp(this.vel.x, dirX * speed, 18 * control, dt);
        this.vel.z = damp(this.vel.z, dirZ * speed, 18 * control, dt);
        if (!this.aiming) {
          const targetHeading = Math.atan2(dirX, dirZ);
          const diff = wrapAngle(targetHeading - this.heading);
          this.heading = wrapAngle(this.heading + diff * Math.min(1, dt * 12));
        }
        this.walkPhase += dt * (this.running ? 14 : 9 * Math.max(0.5, mag));
      } else if (this.onGround) {
        this.vel.x *= Math.exp(-12 * dt);
        this.vel.z *= Math.exp(-12 * dt);
      }
      this.moving = len > 0.01;

      if (controls.fire || this.aiming) {
        this.heading = this.camYaw;
      }

      if (controls.jump && this.onGround) {
        this.vel.y = PLAYER_CFG.jumpSpeed * (this.running ? 1.08 : 1);
        this.onGround = false;
      }
      this.vel.y -= PLAYER_CFG.gravity * dt;

      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.pos.y += this.vel.y * dt;
      this.stats.distanceWalked += Math.hypot(this.vel.x, this.vel.z) * dt;

      const groundY = 0.22;
      if (this.pos.y <= groundY) {
        if (!this.onGround) {
          const impact = -this.vel.y;
          this.landingSquash = Math.min(0.25, impact * 0.02);
          if (impact > PLAYER_CFG.fallDamageSpeed) this.damage((impact - PLAYER_CFG.fallDamageSpeed) * 6);
          if (audio && audio.playFootstep) audio.playFootstep(1.6);
        }
        this.pos.y = groundY;
        this.vel.y = 0;
        this.onGround = true;
      }
      if (this.landingSquash > 0) this.landingSquash = Math.max(0, this.landingSquash - dt * 1.2);

      this.city.resolveCircleCollisions(this.pos, PLAYER_CFG.radius);

      // Animate character limbs
      this.mesh.position.copy(this.pos);
      this.mesh.position.y -= this.landingSquash * 0.4;
      this.mesh.rotation.y = this.heading;
      const strideAmt = this.running ? 0.8 : 0.55;
      const stride = len > 0.05 && this.onGround ? Math.sin(this.walkPhase) * strideAmt : 0;
      const airPose = this.onGround ? 0 : 0.5;
      this.parts.legL.rotation.x = stride - airPose;
      this.parts.legR.rotation.x = -stride + airPose * 0.4;
      this.parts.armL.rotation.x = this.onGround ? -stride * 0.7 : -2.2;
      const weapon = this.getCurrentWeaponSpec();
      this.parts.pistol.visible = !weapon.melee;
      if (this.punchTimer > 0) {
        // Jab: arm snaps forward then recoils.
        const k = this.punchTimer / 0.28;
        this.parts.armR.rotation.x = -1.6 * Math.sin(k * Math.PI);
      } else if (!weapon.melee && (controls.fire || this.aiming)) {
        this.parts.armR.rotation.x = -1.45;
      } else {
        this.parts.armR.rotation.x = this.onGround ? stride * 0.7 : -2.2;
      }
    }

    if (vehicles.lastImpact > 6) {
      this.addShake(Math.min(0.65, vehicles.lastImpact * 0.02));
      if (audio) audio.playImpact(vehicles.lastImpact);
    }

    this.updateCamera(dt);
  }

  updateCamera(dt) {
    if (this.cameraOverride) {
      this.camera.position.copy(this.cameraOverride.position);
      this.camera.lookAt(this.cameraOverride.lookAt);
      if (this.cameraOverride.fov && this.camera.fov !== this.cameraOverride.fov) {
        this.camera.fov = this.cameraOverride.fov;
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    let desiredPos, desiredLook, targetFov;
    // Ease the rig weight toward the current mode; smoothstep makes the hand-off gentle.
    const blendTarget = this.vehicle ? 1 : 0;
    const blendStep = dt / Math.max(0.05, PLAYER_CFG.cameraBlendTime);
    this.camBlend = blendTarget > this.camBlend ? Math.min(1, this.camBlend + blendStep) : Math.max(0, this.camBlend - blendStep);
    if (this.vehicle) this.lastVehicle = this.vehicle;
    const w = this.camBlend * this.camBlend * (3 - 2 * this.camBlend);

    // On-foot rig (over-the-shoulder, tighter when aiming)
    const footDist = this.aiming ? 3.2 : 4.9;
    const shoulder = this.aiming ? 0.95 : 0.75;
    const yaw = this.camYaw + (this.lookBack && !this.vehicle ? Math.PI : 0);
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const cosP = Math.cos(this.camPitch);
    const sinP = Math.sin(this.camPitch);
    const footPos = new THREE.Vector3(
      this.pos.x - sinY * cosP * footDist + cosY * shoulder,
      this.pos.y + 1.75 + sinP * footDist,
      this.pos.z - cosY * cosP * footDist - sinY * shoulder,
    );
    const footLook = new THREE.Vector3(
      this.pos.x + sinY * 8 + cosY * 0.35,
      this.pos.y + 1.5 - sinP * 2.5,
      this.pos.z + cosY * 8 - sinY * 0.35,
    );
    const footFov = this.aiming ? 50 : 60;

    if (w > 0 && this.lastVehicle) {
      const v = this.lastVehicle;
      const speed = Math.abs(v.speed);
      const backDist = 7.4 + clamp(speed * 0.05, 0, 2.2);
      const height = 2.95 + clamp(speed * 0.015, 0, 0.7);
      const lookAhead = clamp(v.speed * 0.16, -2.5, 8.5);
      const back = this.lookBack ? -1 : 1;
      const fwdX = Math.sin(v.heading) * back;
      const fwdZ = Math.cos(v.heading) * back;

      const drivePos = new THREE.Vector3(
        v.pos.x - fwdX * backDist,
        v.pos.y + height,
        v.pos.z - fwdZ * backDist,
      );
      const driveLook = new THREE.Vector3(
        v.pos.x + fwdX * (4.5 + lookAhead),
        v.pos.y + 1.35,
        v.pos.z + fwdZ * (4.5 + lookAhead),
      );
      const driveFov = 60 + clamp(speed * 0.34, 0, 16);
      desiredPos = footPos.lerp(drivePos, w);
      desiredLook = footLook.lerp(driveLook, w);
      targetFov = footFov + (driveFov - footFov) * w;
    } else {
      desiredPos = footPos;
      desiredLook = footLook;
      targetFov = footFov;
    }

    // While blending, follow tightly so the explicit blend (not the damping) shapes the move.
    const blending = w > 0.001 && w < 0.999;
    const posLambda = blending ? 16 : this.vehicle ? 8.5 : 14;
    this.camPos.x = damp(this.camPos.x, desiredPos.x, posLambda, dt);
    this.camPos.y = damp(this.camPos.y, Math.max(1.1, desiredPos.y), posLambda, dt);
    this.camPos.z = damp(this.camPos.z, desiredPos.z, posLambda, dt);

    this.camLook.x = damp(this.camLook.x, desiredLook.x, 12, dt);
    this.camLook.y = damp(this.camLook.y, desiredLook.y, 12, dt);
    this.camLook.z = damp(this.camLook.z, desiredLook.z, 12, dt);

    // Camera shake decay, driven by an internal clock so it is frame-rate and replay stable.
    this.shakeClock += dt;
    let sx = 0, sy = 0;
    if (this.shake > 0.005) {
      sx = Math.sin(this.shakeClock * 70) * this.shake * 0.32;
      sy = Math.cos(this.shakeClock * 90) * this.shake * 0.24;
      this.shake = Math.max(0, this.shake - dt * 1.8);
    }

    this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
    this.camera.lookAt(this.camLook);

    const newFov = damp(this.camera.fov, targetFov, 5.5, dt);
    if (Math.abs(newFov - this.camera.fov) > 0.02) {
      this.camera.fov = newFov;
      this.camera.updateProjectionMatrix();
    }
  }
}
