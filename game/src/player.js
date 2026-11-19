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
    this.camPos = new THREE.Vector3(122, 5, -34);
    this.camLook = new THREE.Vector3(122, 2, -24);
    this.cameraOverride = null;
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
      const absorbed = Math.min(this.armour, rem * 0.7);
      this.armour = Math.max(0, this.armour - absorbed);
      rem -= absorbed;
    }
    this.health = Math.max(0, this.health - rem);
    this.addShake(0.32);
    if (this.health <= 0) {
      this.deadTimer = 3.2;
      if (this.vehicle) this.exitVehicle();
    }
  }

  respawnAtHospital() {
    this.pos.set(CITY.hospitalPos.x, 0.22, CITY.hospitalPos.z + 18);
    this.vel.set(0, 0, 0);
    this.health = PLAYER_CFG.maxHealth;
    this.armour = 50;
    this.money = Math.max(0, this.money - 200);
    this.deadTimer = 0;
    this.mesh.visible = true;
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
    if (this.deadTimer > 0) {
      this.deadTimer -= dt;
      if (this.deadTimer <= 0) {
        this.respawnAtHospital();
        if (police) police.resetWanted();
      }
      this.updateCamera(dt);
      return;
    }

    // Mouse look
    this.camYaw = wrapAngle(this.camYaw - mouseDelta.dx * 0.0026);
    this.camPitch = clamp(this.camPitch + mouseDelta.dy * 0.0022, -0.25, 0.85);

    // Weapon switching
    if (controls.weapon1) this.weaponIndex = 0;
    if (controls.weapon2 && this.weaponsState[1].unlocked) this.weaponIndex = 1;

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
      this.pos.copy(this.vehicle.pos);
      this.heading = this.vehicle.heading;
      // Save stolen car into garage when parked on the garage pad
      const gDist = Math.hypot(this.pos.x - CITY.garagePos.x, this.pos.z - CITY.garagePos.z);
      if (gDist < 5.5 && Math.abs(this.vehicle.speed) < 3.5) {
        this.storedGarageType = this.vehicle.type;
        this.storedGarageColor = this.vehicle.color;
      }
    } else {
      // On-foot movement relative to camera yaw
      const moveZ = (controls.forward ? 1 : 0) - (controls.backward ? 1 : 0);
      const moveX = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
      const speed = controls.sprint ? PLAYER_CFG.sprintSpeed : PLAYER_CFG.walkSpeed;

      const sinY = Math.sin(this.camYaw);
      const cosY = Math.cos(this.camYaw);
      let dirX = sinY * moveZ + cosY * moveX;
      let dirZ = cosY * moveZ - sinY * moveX;
      const len = Math.hypot(dirX, dirZ);
      if (len > 0.01) {
        dirX /= len;
        dirZ /= len;
        this.vel.x = dirX * speed;
        this.vel.z = dirZ * speed;
        const targetHeading = Math.atan2(dirX, dirZ);
        const diff = wrapAngle(targetHeading - this.heading);
        this.heading = wrapAngle(this.heading + diff * Math.min(1, dt * 12));
        this.walkPhase += dt * (controls.sprint ? 14 : 9);
      } else {
        this.vel.x *= Math.exp(-12 * dt);
        this.vel.z *= Math.exp(-12 * dt);
      }

      if (controls.fire) {
        this.heading = this.camYaw;
      }

      if (controls.jump && this.onGround) {
        this.vel.y = PLAYER_CFG.jumpSpeed;
        this.onGround = false;
      }
      this.vel.y -= PLAYER_CFG.gravity * dt;

      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.pos.y += this.vel.y * dt;

      const groundY = 0.22;
      if (this.pos.y <= groundY) {
        this.pos.y = groundY;
        this.vel.y = 0;
        this.onGround = true;
      }

      this.city.resolveCircleCollisions(this.pos, PLAYER_CFG.radius);

      // Animate character limbs
      this.mesh.position.copy(this.pos);
      this.mesh.rotation.y = this.heading;
      const stride = len > 0.05 ? Math.sin(this.walkPhase) * 0.55 : 0;
      this.parts.legL.rotation.x = stride;
      this.parts.legR.rotation.x = -stride;
      this.parts.armL.rotation.x = -stride * 0.7;
      this.parts.armR.rotation.x = controls.fire || this.aiming ? -1.45 : stride * 0.7;
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
    if (this.vehicle) {
      const v = this.vehicle;
      const speed = Math.abs(v.speed);
      const backDist = 7.4 + clamp(speed * 0.05, 0, 2.2);
      const height = 2.95 + clamp(speed * 0.015, 0, 0.7);
      const lookAhead = clamp(v.speed * 0.16, -2.5, 8.5);
      const fwdX = Math.sin(v.heading);
      const fwdZ = Math.cos(v.heading);

      desiredPos = new THREE.Vector3(
        v.pos.x - fwdX * backDist,
        v.pos.y + height,
        v.pos.z - fwdZ * backDist,
      );
      desiredLook = new THREE.Vector3(
        v.pos.x + fwdX * (4.5 + lookAhead),
        v.pos.y + 1.35,
        v.pos.z + fwdZ * (4.5 + lookAhead),
      );
      targetFov = 60 + clamp(speed * 0.34, 0, 16);
    } else {
      const dist = 4.9;
      const shoulder = 0.75;
      const sinY = Math.sin(this.camYaw);
      const cosY = Math.cos(this.camYaw);
      const cosP = Math.cos(this.camPitch);
      const sinP = Math.sin(this.camPitch);

      desiredPos = new THREE.Vector3(
        this.pos.x - sinY * cosP * dist + cosY * shoulder,
        this.pos.y + 1.75 + sinP * dist,
        this.pos.z - cosY * cosP * dist - sinY * shoulder,
      );
      desiredLook = new THREE.Vector3(
        this.pos.x + sinY * 8 + cosY * 0.35,
        this.pos.y + 1.5 - sinP * 2.5,
        this.pos.z + cosY * 8 - sinY * 0.35,
      );
      targetFov = 60;
    }

    const posLambda = this.vehicle ? 8.5 : 14;
    this.camPos.x = damp(this.camPos.x, desiredPos.x, posLambda, dt);
    this.camPos.y = damp(this.camPos.y, Math.max(1.1, desiredPos.y), posLambda, dt);
    this.camPos.z = damp(this.camPos.z, desiredPos.z, posLambda, dt);

    this.camLook.x = damp(this.camLook.x, desiredLook.x, 12, dt);
    this.camLook.y = damp(this.camLook.y, desiredLook.y, 12, dt);
    this.camLook.z = damp(this.camLook.z, desiredLook.z, 12, dt);

    // Camera shake decay
    let sx = 0, sy = 0;
    if (this.shake > 0.005) {
      sx = Math.sin(performance.now() * 0.07) * this.shake * 0.32;
      sy = Math.cos(performance.now() * 0.09) * this.shake * 0.24;
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
