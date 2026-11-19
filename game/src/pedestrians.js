import * as THREE from 'three';
import { CITY } from './config.js';

const SHIRT_COLORS = [0xff5d7a, 0x3bd8e0, 0xffb84d, 0xf2e9dc, 0x7a65ff, 0x52e088, 0xff784f, 0x2f3b52];
const PANTS_COLORS = [0x1f2634, 0x3b485c, 0xcab99c, 0x29323e, 0x5c4a3d];
const SKIN_TONES = [0xe8bc98, 0xd49b72, 0xb37852, 0x8a5638, 0xf0c9a8];

export class PedestrianManager {
  constructor(scene, city, rng, count = 88) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.count = count;
    this.peds = [];

    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.torsoInst = new THREE.InstancedMesh(unitBox, mat, count);
    this.headInst = new THREE.InstancedMesh(unitBox, mat, count);
    this.legLInst = new THREE.InstancedMesh(unitBox, mat, count);
    this.legRInst = new THREE.InstancedMesh(unitBox, mat, count);

    scene.add(this.torsoInst, this.headInst, this.legLInst, this.legRInst);

    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();

    this.spawnAll();
  }

  spawnAll() {
    this.peds.length = 0;
    const swList = this.city.sidewalkRects;
    for (let i = 0; i < this.count; i++) {
      const rect = this.rng.pick(swList);
      const side = this.rng.int(0, 3);
      const inset = 1.6;
      let x, z, dirX, dirZ;
      if (side === 0) {
        x = this.rng.range(rect.minX + inset, rect.maxX - inset);
        z = rect.minZ + inset;
        dirX = this.rng.chance(0.5) ? 1 : -1;
        dirZ = 0;
      } else if (side === 1) {
        x = this.rng.range(rect.minX + inset, rect.maxX - inset);
        z = rect.maxZ - inset;
        dirX = this.rng.chance(0.5) ? 1 : -1;
        dirZ = 0;
      } else if (side === 2) {
        x = rect.minX + inset;
        z = this.rng.range(rect.minZ + inset, rect.maxZ - inset);
        dirX = 0;
        dirZ = this.rng.chance(0.5) ? 1 : -1;
      } else {
        x = rect.maxX - inset;
        z = this.rng.range(rect.minZ + inset, rect.maxZ - inset);
        dirX = 0;
        dirZ = this.rng.chance(0.5) ? 1 : -1;
      }

      const ped = {
        pos: new THREE.Vector3(x, 0.22, z),
        dirX,
        dirZ,
        heading: Math.atan2(dirX, dirZ),
        speed: this.rng.range(1.4, 2.3),
        phase: this.rng.range(0, Math.PI * 2),
        alive: true,
        fleeing: false,
        crossCooldown: this.rng.range(1, 5),
        shirt: this.rng.pick(SHIRT_COLORS),
        pants: this.rng.pick(PANTS_COLORS),
        skin: this.rng.pick(SKIN_TONES),
        hitTimer: 0,
      };
      this.peds.push(ped);

      this.color.setHex(ped.shirt);
      this.torsoInst.setColorAt(i, this.color);
      this.color.setHex(ped.skin);
      this.headInst.setColorAt(i, this.color);
      this.color.setHex(ped.pants);
      this.legLInst.setColorAt(i, this.color);
      this.legRInst.setColorAt(i, this.color);
    }
    this.torsoInst.instanceColor.needsUpdate = true;
    this.headInst.instanceColor.needsUpdate = true;
    this.legLInst.instanceColor.needsUpdate = true;
    this.legRInst.instanceColor.needsUpdate = true;
    this.syncInstances();
  }

  placePedestrian(index, x, z, heading, dirX, dirZ) {
    if (index < 0 || index >= this.peds.length) return;
    const p = this.peds[index];
    p.pos.set(x, 0.22, z);
    p.heading = heading;
    p.dirX = dirX;
    p.dirZ = dirZ;
    p.alive = true;
    p.fleeing = false;
  }

  update(dt, player, vehicles, police) {
    const wanted = police ? police.stars > 0 : false;
    const pPos = player.pos;

    for (let i = 0; i < this.peds.length; i++) {
      const p = this.peds[i];
      if (!p.alive) {
        if (p.hitTimer > 0) p.hitTimer -= dt;
        continue;
      }

      // React to wanted player or gunfire nearby by fleeing
      const dxP = p.pos.x - pPos.x;
      const dzP = p.pos.z - pPos.z;
      const distSqP = dxP * dxP + dzP * dzP;
      if (wanted && distSqP < 1600) {
        p.fleeing = true;
      } else if (!wanted && distSqP > 2500) {
        p.fleeing = false;
      }

      let moveSpeed = p.speed;
      if (p.fleeing && distSqP > 0.1) {
        const inv = 1 / Math.sqrt(distSqP);
        p.dirX = dxP * inv;
        p.dirZ = dzP * inv;
        moveSpeed = 5.4;
      } else {
        // Occasionally turn at block corners or cross streets at crosswalks
        p.crossCooldown -= dt;
        if (p.crossCooldown <= 0) {
          p.crossCooldown = this.rng.range(4, 10);
          if (this.rng.chance(0.35)) {
            const tmp = p.dirX;
            p.dirX = -p.dirZ;
            p.dirZ = tmp;
          }
        }
      }

      p.pos.x += p.dirX * moveSpeed * dt;
      p.pos.z += p.dirZ * moveSpeed * dt;
      p.heading = Math.atan2(p.dirX, p.dirZ);
      p.phase += dt * moveSpeed * 4.2;

      // Wrap around world edges
      if (p.pos.x > CITY.beachStartX - 2) { p.pos.x = CITY.beachStartX - 3; p.dirX = -Math.abs(p.dirX); }
      if (p.pos.x < -CITY.halfSpanX) { p.pos.x = -CITY.halfSpanX + 2; p.dirX = Math.abs(p.dirX); }
      if (p.pos.z > CITY.halfSpanZ) { p.pos.z = CITY.halfSpanZ - 2; p.dirZ = -Math.abs(p.dirZ); }
      if (p.pos.z < -CITY.halfSpanZ) { p.pos.z = -CITY.halfSpanZ + 2; p.dirZ = Math.abs(p.dirZ); }

      const hitBuilding = this.city.resolveCircleCollisions(p.pos, 0.42);
      if (hitBuilding && !p.fleeing) {
        const tmp = p.dirX;
        p.dirX = -p.dirZ;
        p.dirZ = tmp;
      }

      // Check collision with speeding player vehicle
      if (player.vehicle && Math.abs(player.vehicle.speed) > 6.5) {
        const vx = player.vehicle.pos.x - p.pos.x;
        const vz = player.vehicle.pos.z - p.pos.z;
        if (vx * vx + vz * vz < 3.6) {
          p.alive = false;
          p.hitTimer = 10;
          if (police) police.reportCrime('hit_pedestrian', p.pos, 1);
        }
      }
    }

    this.syncInstances();
  }

  syncInstances() {
    const d = this.dummy;
    for (let i = 0; i < this.peds.length; i++) {
      const p = this.peds[i];
      if (!p.alive) {
        d.position.set(p.pos.x, 0.14, p.pos.z);
        d.rotation.set(Math.PI * 0.5, p.heading, 0);
        d.scale.set(0.46, 0.62, 0.24);
        d.updateMatrix();
        this.torsoInst.setMatrixAt(i, d.matrix);
        d.scale.set(0.01, 0.01, 0.01);
        d.updateMatrix();
        this.headInst.setMatrixAt(i, d.matrix);
        this.legLInst.setMatrixAt(i, d.matrix);
        this.legRInst.setMatrixAt(i, d.matrix);
        continue;
      }

      const swing = Math.sin(p.phase) * 0.42;
      const cosH = Math.cos(p.heading);
      const sinH = Math.sin(p.heading);

      // Torso
      d.position.set(p.pos.x, p.pos.y + 1.12, p.pos.z);
      d.rotation.set(0, p.heading, 0);
      d.scale.set(0.46, 0.64, 0.24);
      d.updateMatrix();
      this.torsoInst.setMatrixAt(i, d.matrix);

      // Head
      d.position.set(p.pos.x, p.pos.y + 1.62, p.pos.z);
      d.rotation.set(0, p.heading, 0);
      d.scale.set(0.27, 0.29, 0.27);
      d.updateMatrix();
      this.headInst.setMatrixAt(i, d.matrix);

      // Legs
      const lx = -0.12 * cosH;
      const lz = 0.12 * sinH;
      d.position.set(p.pos.x + lx, p.pos.y + 0.42, p.pos.z + lz);
      d.rotation.set(swing, p.heading, 0);
      d.scale.set(0.18, 0.78, 0.18);
      d.updateMatrix();
      this.legLInst.setMatrixAt(i, d.matrix);

      d.position.set(p.pos.x - lx, p.pos.y + 0.42, p.pos.z - lz);
      d.rotation.set(-swing, p.heading, 0);
      d.scale.set(0.18, 0.78, 0.18);
      d.updateMatrix();
      this.legRInst.setMatrixAt(i, d.matrix);
    }

    this.torsoInst.instanceMatrix.needsUpdate = true;
    this.headInst.instanceMatrix.needsUpdate = true;
    this.legLInst.instanceMatrix.needsUpdate = true;
    this.legRInst.instanceMatrix.needsUpdate = true;
  }
}
