import * as THREE from 'three';
import { CITY } from './config.js';

function createMarkerMesh(colorHex) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 2.0, 24),
    new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.28;

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 1.35, 16, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  beam.position.y = 8.2;

  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.75, 0),
    new THREE.MeshBasicMaterial({ color: colorHex }),
  );
  diamond.position.y = 3.2;

  group.add(ring, beam, diamond);
  return { group, diamond };
}

function createEnemyMesh() {
  const root = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xb82e46 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1d2028 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xcf946e });
  const gun = new THREE.MeshLambertMaterial({ color: 0x1e222a });

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.78, 0.24), pants);
  legs.position.y = 0.4;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.66, 0.28), jacket);
  torso.position.y = 1.12;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), skin);
  head.position.y = 1.64;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.54, 0.16), jacket);
  arm.position.set(0.32, 1.26, 0.22);
  arm.rotation.x = -1.35;
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.55), gun);
  rifle.position.set(0.32, 1.28, 0.6);

  root.add(legs, torso, head, arm, rifle);
  return root;
}

export const MISSION_DEFS = [
  {
    id: 'sunset_drop',
    title: 'Sunset Courier',
    giver: 'TESSA MARLOW',
    briefing: 'Rico, run this ledger down Palmetto Strip to the Caleta Marina drop before Bishop spots our runner.',
    reward: 900,
    objective: 'Deliver the ledger to Marisol Marina',
    targetPos: { x: 196, z: -140 },
    kind: 'delivery',
  },
  {
    id: 'coral_heist',
    title: 'Hot Coral',
    giver: 'TESSA MARLOW',
    briefing: 'Bishop parked a custom Coral 88 Spider by Hotel Palmetto. Boost it and stash it in your Old Meridian garage.',
    reward: 1600,
    objective: 'Steal the Coral 88 Spider and deliver it to your garage',
    carSpawn: { x: 148, z: -85, heading: Math.PI },
    dropoffPos: { x: CITY.garagePos.x, z: CITY.garagePos.z },
    kind: 'car_theft',
  },
  {
    id: 'pier4_reckoning',
    title: 'Pier 4 Reckoning',
    giver: 'TESSA MARLOW',
    briefing: "Bishop's crew hijacked our cargo at Pier 4 Freight. Clear all five gunmen out of Dockside.",
    reward: 2500,
    objective: "Eliminate Bishop's crew",
    arenaCenter: { x: 105, z: 175 },
    kind: 'shootout',
    enemySpawns: [
      { x: 96, z: 176 },
      { x: 112, z: 178 },
      { x: 103, z: 186 },
      { x: 117, z: 170 },
      { x: 91, z: 185 },
    ],
  },
];

export class MissionManager {
  constructor(scene, vehicles, police, rng) {
    this.scene = scene;
    this.vehicles = vehicles;
    this.police = police;
    this.rng = rng;

    this.completedCount = 0;
    this.activeMission = null;
    this.stage = 'idle';
    this.targetVehicle = null;
    this.enemies = [];

    this.objectiveText = 'Meet Tessa Marlow at Palmetto Strip (Press E)';
    this.objectiveTag = 'NEXT CONTRACT';
    this.dialogueSpeaker = '';
    this.dialogueText = '';
    this.dialogueTimer = 0;

    this.giverMarker = createMarkerMesh(0xffa947);
    this.giverMarker.group.position.set(CITY.fixerPos.x, 0, CITY.fixerPos.z);
    this.scene.add(this.giverMarker.group);

    this.objectiveMarker = createMarkerMesh(0x47f0ff);
    this.objectiveMarker.group.visible = false;
    this.scene.add(this.objectiveMarker.group);

    this.objectivePos = new THREE.Vector3(CITY.fixerPos.x, 0, CITY.fixerPos.z);
  }

  showDialogue(speaker, text, duration = 6.5) {
    this.dialogueSpeaker = speaker;
    this.dialogueText = text;
    this.dialogueTimer = duration;
  }

  getNextMissionDef() {
    return MISSION_DEFS[this.completedCount % MISSION_DEFS.length];
  }

  startMission(def) {
    this.clearEnemies();
    this.activeMission = def;
    this.giverMarker.group.visible = false;
    this.objectiveMarker.group.visible = true;
    this.objectiveTag = def.title.toUpperCase();
    this.showDialogue(def.giver, def.briefing, 7.5);

    if (def.kind === 'delivery') {
      this.stage = 'deliver';
      this.objectivePos.set(def.targetPos.x, 0, def.targetPos.z);
      this.objectiveMarker.group.position.copy(this.objectivePos);
      this.objectiveText = def.objective;
    } else if (def.kind === 'car_theft') {
      this.stage = 'steal_car';
      this.targetVehicle = this.vehicles.spawnVehicle('convertible', def.carSpawn.x, def.carSpawn.z, def.carSpawn.heading, {
        color: 0xff5c4d,
        aiMode: 'parked',
      });
      this.objectivePos.set(def.carSpawn.x, 0, def.carSpawn.z);
      this.objectiveMarker.group.position.copy(this.objectivePos);
      this.objectiveText = 'Steal the Coral 88 Spider near Hotel Palmetto';
    } else if (def.kind === 'shootout') {
      this.stage = 'eliminate';
      this.objectivePos.set(def.arenaCenter.x, 0, def.arenaCenter.z);
      this.objectiveMarker.group.position.copy(this.objectivePos);
      for (let i = 0; i < def.enemySpawns.length; i++) {
        const sp = def.enemySpawns[i];
        this.spawnEnemy(sp.x, sp.z);
      }
      this.updateShootoutText();
    }
  }

  spawnEnemy(x, z, opts = {}) {
    const mesh = createEnemyMesh();
    mesh.position.set(x, 0.22, z);
    this.scene.add(mesh);
    const enemy = {
      id: `crew_${this.enemies.length + 1}`,
      mesh,
      pos: new THREE.Vector3(x, 0.22, z),
      heading: opts.heading ?? 0,
      health: opts.health ?? 65,
      alive: opts.alive !== undefined ? opts.alive : true,
      fireCooldown: this.rng.range(0.5, 1.3),
      faction: 'gang',
      hitFlash: 0,
    };
    if (!enemy.alive) {
      mesh.rotation.x = Math.PI * 0.5;
      mesh.position.y = 0.28;
    }
    this.enemies.push(enemy);
    return enemy;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies.length = 0;
  }

  updateShootoutText() {
    const total = this.enemies.length || 5;
    const dead = this.enemies.filter((e) => !e.alive).length;
    this.objectiveText = `Eliminate Bishop's crew ${dead}/${total}`;
  }

  completeMission(player, audio) {
    const reward = this.activeMission.reward;
    player.money += reward;
    this.completedCount++;
    if (player.money >= 1500 && !player.weaponsState[1].unlocked) {
      player.weaponsState[1].unlocked = true;
      this.showDialogue('TESSA MARLOW', `Clean work, Rico. +$${reward}. Unlocked MERIDIAN V-9 SMG (Press 2).`, 7.0);
    } else {
      this.showDialogue('TESSA MARLOW', `Contract closed, Rico. Wired $${reward} to your account. Come back for the next job.`, 6.5);
    }
    if (audio) audio.playMissionChime();
    this.activeMission = null;
    this.targetVehicle = null;
    this.stage = 'idle';
    this.objectiveMarker.group.visible = false;
    this.giverMarker.group.visible = true;
    this.objectivePos.set(CITY.fixerPos.x, 0, CITY.fixerPos.z);
    this.objectiveTag = 'NEXT CONTRACT';
    this.objectiveText = 'Return to Tessa Marlow on Palmetto Strip (Press E)';
  }

  getPrompt(player) {
    if (!this.activeMission) {
      const dist = Math.hypot(player.pos.x - CITY.fixerPos.x, player.pos.z - CITY.fixerPos.z);
      if (dist < 6.5) {
        const next = this.getNextMissionDef();
        return `Press E — Start "${next.title}" ($${next.reward})`;
      }
    }
    if (!player.vehicle) {
      const near = this.vehicles.findNearestVehicle(player.pos, 4.6);
      if (near) return `Press F — Enter ${near.spec.name}`;
    } else {
      const gDist = Math.hypot(player.pos.x - CITY.garagePos.x, player.pos.z - CITY.garagePos.z);
      if (gDist < 6.5) return `Garage — Stored ${player.vehicle.spec.name}`;
    }
    return '';
  }

  update(dt, time, player, controls, combat, audio) {
    // Rotate marker diamonds
    this.giverMarker.diamond.rotation.y = time * 1.8;
    this.objectiveMarker.diamond.rotation.y = time * 2.1;

    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) {
        this.dialogueSpeaker = '';
        this.dialogueText = '';
      }
    }

    if (!this.activeMission) {
      const dist = Math.hypot(player.pos.x - CITY.fixerPos.x, player.pos.z - CITY.fixerPos.z);
      if (dist < 6.5 && controls.interact) {
        this.startMission(this.getNextMissionDef());
      }
      return;
    }

    const def = this.activeMission;
    if (def.kind === 'delivery') {
      const dist = Math.hypot(player.pos.x - def.targetPos.x, player.pos.z - def.targetPos.z);
      if (dist < 6.0) this.completeMission(player, audio);
    } else if (def.kind === 'car_theft') {
      if (this.stage === 'steal_car') {
        if (this.targetVehicle) {
          this.objectivePos.copy(this.targetVehicle.pos);
          this.objectiveMarker.group.position.set(this.objectivePos.x, 0, this.objectivePos.z);
        }
        if (player.vehicle === this.targetVehicle) {
          this.stage = 'dropoff';
          this.objectivePos.set(def.dropoffPos.x, 0, def.dropoffPos.z);
          this.objectiveMarker.group.position.copy(this.objectivePos);
          this.objectiveText = 'Lose the heat and stash the Coral 88 at your garage';
          this.police.reportCrime('car_theft', player.pos, 2);
          this.showDialogue('TESSA MARLOW', 'MPD spotted the boost! Shake them and bring the Coral 88 to your garage.', 6.0);
        }
      } else if (this.stage === 'dropoff') {
        const dist = Math.hypot(player.pos.x - def.dropoffPos.x, player.pos.z - def.dropoffPos.z);
        if (dist < 6.5 && player.vehicle === this.targetVehicle) {
          this.completeMission(player, audio);
        }
      }
    } else if (def.kind === 'shootout') {
      let aliveCount = 0;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        aliveCount++;
        const dx = player.pos.x - e.pos.x;
        const dz = player.pos.z - e.pos.z;
        const dist = Math.hypot(dx, dz);
        e.heading = Math.atan2(dx, dz);
        e.mesh.rotation.y = e.heading;
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0 && dist < 55 && player.deadTimer <= 0) {
          e.fireCooldown = this.rng.range(0.85, 1.7);
          combat.fireNpcShot(e, player);
        }
      }
      this.updateShootoutText();
      if (aliveCount === 0 && this.enemies.length > 0) {
        this.completeMission(player, audio);
      }
    }
  }
}
