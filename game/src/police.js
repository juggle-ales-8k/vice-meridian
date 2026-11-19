import * as THREE from 'three';
import { CITY, POLICE_CFG } from './config.js';
import { clamp, wrapAngle } from './random.js';

function createOfficerMesh(uniformColor = 0x1e2c48, accentColor = 0x4ca8ff) {
  const root = new THREE.Group();
  const suitMat = new THREE.MeshLambertMaterial({ color: uniformColor });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xd9a27b });
  const capMat = new THREE.MeshLambertMaterial({ color: accentColor });
  const gunMat = new THREE.MeshLambertMaterial({ color: 0x1d2028 });

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.78, 0.24), suitMat);
  legs.position.y = 0.4;
  legs.castShadow = true;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.66, 0.28), suitMat);
  torso.position.y = 1.12;
  torso.castShadow = true;

  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.04), new THREE.MeshBasicMaterial({ color: 0xffd058 }));
  badge.position.set(0.12, 1.24, 0.15);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), skinMat);
  head.position.y = 1.64;

  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.34), capMat);
  cap.position.set(0, 1.82, 0.03);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.52, 0.15), suitMat);
  armR.position.set(0.32, 1.28, 0.2);
  armR.rotation.x = -1.35;

  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.36), gunMat);
  gun.position.set(0.32, 1.3, 0.54);

  root.add(legs, torso, badge, head, cap, armR, gun);
  return root;
}

export class PoliceManager {
  constructor(scene, city, vehicles, rng) {
    this.scene = scene;
    this.city = city;
    this.vehicles = vehicles;
    this.rng = rng;

    this.stars = 0;
    this.heat = 0;
    this.escapeTimer = 0;
    this.spawnTimer = 0;

    this.pursuitCars = [];
    this.officers = [];
  }

  reportCrime(kind, pos, severity = 1) {
    this.heat = Math.min(POLICE_CFG.maxStars, this.heat + severity * 0.9);
    const nextStars = clamp(Math.ceil(this.heat), 0, POLICE_CFG.maxStars);
    if (nextStars > this.stars) this.stars = nextStars;
    this.escapeTimer = 0;
  }

  setStars(n) {
    this.stars = clamp(n, 0, POLICE_CFG.maxStars);
    this.heat = this.stars;
    this.escapeTimer = 0;
  }

  resetWanted() {
    this.stars = 0;
    this.heat = 0;
    this.escapeTimer = 0;
    for (const c of this.pursuitCars) {
      c.sirenActive = false;
      c.aiMode = 'traffic';
    }
    this.pursuitCars.length = 0;
    for (const o of this.officers) this.scene.remove(o.mesh);
    this.officers.length = 0;
  }

  isCopNearby(pos, radius = 65) {
    const rSq = radius * radius;
    for (const v of this.vehicles.vehicles) {
      if (!v.spec.isPolice) continue;
      if ((v.pos.x - pos.x) ** 2 + (v.pos.z - pos.z) ** 2 < rSq) return true;
    }
    for (const o of this.officers) {
      if (!o.alive) continue;
      if ((o.pos.x - pos.x) ** 2 + (o.pos.z - pos.z) ** 2 < rSq) return true;
    }
    return false;
  }

  spawnPursuitCruiser(playerPos, forcedPos = null, forcedHeading = null) {
    let x, z, heading;
    if (forcedPos) {
      x = forcedPos.x;
      z = forcedPos.z;
      heading = forcedHeading ?? 0;
    } else {
      // Pick a road spot ~75m away from the player
      const roadX = this.rng.pick(this.city.roadCentersX);
      const offsetZ = (this.rng.chance(0.5) ? 1 : -1) * this.rng.range(58, 86);
      x = roadX + 3.4;
      z = clamp(playerPos.z + offsetZ, -CITY.halfSpanZ + 10, CITY.halfSpanZ - 10);
      heading = Math.atan2(playerPos.x - x, playerPos.z - z);
    }

    const car = this.vehicles.spawnVehicle('police', x, z, heading, {
      aiMode: 'police',
      sirenActive: true,
      speed: 22,
    });
    this.pursuitCars.push(car);
    return car;
  }

  spawnOfficer(x, z, opts = {}) {
    const mesh = createOfficerMesh(opts.uniformColor ?? 0x1b2b4a, opts.accentColor ?? 0x3ba8ff);
    mesh.position.set(x, 0.22, z);
    this.scene.add(mesh);
    const officer = {
      id: `cop_${this.officers.length + 1}`,
      mesh,
      pos: new THREE.Vector3(x, 0.22, z),
      heading: opts.heading ?? 0,
      health: opts.health ?? 75,
      alive: true,
      fireCooldown: this.rng.range(0.5, 1.4),
      inCover: Boolean(opts.inCover),
      faction: opts.faction ?? 'police',
      hitFlash: 0,
    };
    this.officers.push(officer);
    return officer;
  }

  getBlips() {
    const list = [];
    for (const c of this.pursuitCars) {
      list.push({ x: c.pos.x, z: c.pos.z, kind: 'police' });
    }
    for (const o of this.officers) {
      if (o.alive) list.push({ x: o.pos.x, z: o.pos.z, kind: o.faction === 'gang' ? 'enemy' : 'police' });
    }
    return list;
  }

  update(dt, time, player, combat, audio) {
    if (this.stars === 0) {
      if (audio) audio.setSirenActive(false);
      return;
    }

    const desiredCars = Math.min(POLICE_CFG.maxPursuitCars, this.stars);
    this.spawnTimer -= dt;
    if (this.pursuitCars.length < desiredCars && this.spawnTimer <= 0) {
      this.spawnPursuitCruiser(player.pos);
      this.spawnTimer = 4.2;
    }

    let nearestDistSq = Infinity;

    // Update pursuing police cruisers
    for (let i = this.pursuitCars.length - 1; i >= 0; i--) {
      const car = this.pursuitCars[i];
      if (car === player.vehicle) {
        this.pursuitCars.splice(i, 1);
        continue;
      }
      car.sirenActive = true;
      const dx = player.pos.x - car.pos.x;
      const dz = player.pos.z - car.pos.z;
      const distSq = dx * dx + dz * dz;
      nearestDistSq = Math.min(nearestDistSq, distSq);

      const dist = Math.sqrt(distSq);
      const targetHeading = Math.atan2(dx, dz);
      const diff = wrapAngle(targetHeading - car.heading);
      car.heading = wrapAngle(car.heading + clamp(diff, -2.5 * dt, 2.5 * dt));
      car.steerAngle = clamp(diff * 0.8, -0.45, 0.45);

      const playerSpeed = player.vehicle ? Math.abs(player.vehicle.speed) : 0;
      const desiredSpeed = dist > 14 ? Math.max(24, playerSpeed + 7) : 10;
      const maxS = car.spec.maxSpeed;
      car.speed += clamp(desiredSpeed - car.speed, -26 * dt, 22 * dt);
      car.speed = clamp(car.speed, 0, maxS);
      car.braking = dist < 12 && car.speed > 10;
      car.vel.set(Math.sin(car.heading) * car.speed, 0, Math.cos(car.heading) * car.speed);

      // Deploy an on-foot officer if close to an on-foot player
      if (!player.vehicle && dist < 24 && this.officers.length < POLICE_CFG.maxOfficers) {
        this.spawnOfficer(car.pos.x + 2.5, car.pos.z + 1.2);
      }
    }

    // Update on-foot officers
    for (const o of this.officers) {
      if (!o.alive) continue;
      if (o.hitFlash > 0) {
        o.hitFlash -= dt;
      }
      const dx = player.pos.x - o.pos.x;
      const dz = player.pos.z - o.pos.z;
      const dist = Math.hypot(dx, dz);
      nearestDistSq = Math.min(nearestDistSq, dist * dist);
      o.heading = Math.atan2(dx, dz);
      o.mesh.rotation.y = o.heading;

      if (!o.inCover && dist > 18 && dist < 85) {
        o.pos.x += (dx / dist) * 4.4 * dt;
        o.pos.z += (dz / dist) * 4.4 * dt;
        this.city.resolveCircleCollisions(o.pos, 0.45);
        o.mesh.position.copy(o.pos);
      }

      o.fireCooldown -= dt;
      if (o.fireCooldown <= 0 && dist < 55 && player.deadTimer <= 0) {
        o.fireCooldown = this.rng.range(0.75, 1.5);
        if (combat) {
          combat.fireNpcShot(o, player);
        }
      }
    }

    // Siren audio proximity
    if (audio) {
      audio.setSirenActive(nearestDistSq < 120 * 120, Math.sqrt(nearestDistSq));
    }

    // Wanted decay when player escapes search radius
    if (nearestDistSq > POLICE_CFG.escapeRadius * POLICE_CFG.escapeRadius) {
      this.escapeTimer += dt;
      if (this.escapeTimer >= POLICE_CFG.decayTime) {
        this.stars = Math.max(0, this.stars - 1);
        this.heat = this.stars;
        this.escapeTimer = 0;
        if (this.stars === 0) this.resetWanted();
      }
    } else {
      this.escapeTimer = 0;
    }
  }
}
