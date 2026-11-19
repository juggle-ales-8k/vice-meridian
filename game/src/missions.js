import * as THREE from 'three';
import { CITY } from './config.js';

// Soft radial gradient used for the glowing ground ring under each marker.
function makeGlowRingTexture(colorHex) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const r = (colorHex >> 16) & 255;
  const gg = (colorHex >> 8) & 255;
  const b = colorHex & 255;
  const grad = g.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${r},${gg},${b},0)`);
  grad.addColorStop(0.55, `rgba(${r},${gg},${b},0.55)`);
  grad.addColorStop(0.72, `rgba(${r},${gg},${b},0.9)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function createMarkerMesh(colorHex) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 1.85, 32),
    new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.28;

  // Soft additive glow disc on the ground, pulsing outward.
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 6.4),
    new THREE.MeshBasicMaterial({
      map: makeGlowRingTexture(colorHex),
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.26;

  // Slim light column.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.6, 16, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  beam.position.y = 8.2;

  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55, 0),
    new THREE.MeshBasicMaterial({ color: colorHex }),
  );
  diamond.scale.set(0.8, 1.35, 0.8);
  diamond.position.y = 3.2;

  group.add(glow, ring, beam, diamond);
  return { group, diamond, ring, glow, beam };
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

// MISSION_DEFS indices 0..2 are referenced by the screenshot setups; the story order below
// chains all four into one arc.
export const MISSION_DEFS = [
  {
    id: 'sunset_drop',
    title: 'Sunset Courier',
    giver: 'TESSA MARLOW',
    briefing: 'Rico, run this ledger down to the Marisol Marina drop before Bishop spots our runner. You have ninety seconds.',
    reward: 900,
    objective: 'Deliver the ledger to Marisol Marina',
    targetPos: { x: 196, z: -140 },
    timeLimit: 90,
    kind: 'delivery',
  },
  {
    id: 'coral_heist',
    title: 'Hot Coral',
    giver: 'TESSA MARLOW',
    briefing: 'Bishop parked a custom Coral 88 Spider by Hotel Palmetto. Boost it and stash it in your Old Meridian garage — in one piece.',
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
  {
    id: 'heat_wave',
    title: 'Heat Wave',
    giver: 'TESSA MARLOW',
    briefing: "Bishop tipped off Meridian PD — every cruiser in the bay is coming for you. Stay alive and stay free for forty-five seconds while my people move the cargo.",
    reward: 2000,
    objective: 'Survive the three-star manhunt',
    surviveTime: 45,
    stars: 3,
    kind: 'survive',
  },
];

export const STORY_ORDER = [0, 1, 3, 2];

// Health / armour / cash pickups dotted around both grids; they respawn after a minute.
const PICKUP_SPOTS = [
  { x: -175, z: -93, kind: 'health' },
  { x: -70, z: -52, kind: 'health' },
  { x: -245, z: 0, kind: 'armour' },
  { x: -315, z: -140, kind: 'cash' },
  { x: CITY.waterStartX + CITY.pierLength - 12, z: CITY.pierZ, kind: 'armour' },
  { x: 70, z: 158, kind: 'armour' },
  { x: -140, z: 158, kind: 'cash' },
  { x: 0, z: -175, kind: 'health' },
];
const PICKUP_COLORS = { health: 0x4ce88b, armour: 0x2fb8ff, cash: 0xffd84d };

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

    // Timed objectives (countdown shown in the HUD banner) and survival clocks.
    this.timerRemaining = 0;
    this.surviveElapsed = 0;
    this.retryWindow = 0;
    this.failedDef = null;

    // Toast ("MISSION PASSED", "MISSION FAILED", "GAME SAVED")
    this.toastText = '';
    this.toastTimer = 0;
    this.toastFail = false;

    this.giverMarker = createMarkerMesh(0xffa947);
    this.giverMarker.group.position.set(CITY.fixerPos.x, 0, CITY.fixerPos.z);
    this.scene.add(this.giverMarker.group);

    this.objectiveMarker = createMarkerMesh(0xffb85a);
    this.objectiveMarker.group.visible = false;
    this.scene.add(this.objectiveMarker.group);

    this.objectivePos = new THREE.Vector3(CITY.fixerPos.x, 0, CITY.fixerPos.z);

    this.pickups = [];
    const pickupGeo = new THREE.OctahedronGeometry(0.45, 0);
    for (const spot of PICKUP_SPOTS) {
      const mesh = new THREE.Mesh(pickupGeo, new THREE.MeshBasicMaterial({ color: PICKUP_COLORS[spot.kind] }));
      mesh.position.set(spot.x, 1.1, spot.z);
      this.scene.add(mesh);
      this.pickups.push({ ...spot, mesh, taken: false, respawn: 0 });
    }
  }

  showDialogue(speaker, text, duration = 6.5) {
    this.dialogueSpeaker = speaker;
    this.dialogueText = text;
    this.dialogueTimer = duration;
  }

  showToast(text, fail = false, duration = 3.2) {
    this.toastText = text;
    this.toastFail = fail;
    this.toastTimer = duration;
  }

  getNextMissionDef() {
    return MISSION_DEFS[STORY_ORDER[this.completedCount % STORY_ORDER.length]];
  }

  get storyChapter() {
    return (this.completedCount % STORY_ORDER.length) + 1;
  }

  startMission(def) {
    this.clearEnemies();
    this.activeMission = def;
    this.failedDef = null;
    this.retryWindow = 0;
    this.timerRemaining = 0;
    this.surviveElapsed = 0;
    this.giverMarker.group.visible = false;
    this.objectiveMarker.group.visible = true;
    this.objectiveTag = `CH.${this.storyChapter} · ${def.title.toUpperCase()}`;
    this.showDialogue(def.giver, def.briefing, 7.5);

    if (def.kind === 'delivery') {
      this.stage = 'deliver';
      this.objectivePos.set(def.targetPos.x, 0, def.targetPos.z);
      this.objectiveMarker.group.position.copy(this.objectivePos);
      this.objectiveText = def.objective;
      this.timerRemaining = def.timeLimit || 0;
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
    } else if (def.kind === 'survive') {
      this.stage = 'survive';
      this.police.setStars(Math.max(this.police.stars, def.stars));
      this.timerRemaining = def.surviveTime;
      this.objectiveMarker.group.visible = false;
      this.objectiveText = def.objective;
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

  resetToGiver(tag, text) {
    this.activeMission = null;
    this.targetVehicle = null;
    this.stage = 'idle';
    this.timerRemaining = 0;
    this.objectiveMarker.group.visible = false;
    this.giverMarker.group.visible = true;
    this.objectivePos.set(CITY.fixerPos.x, 0, CITY.fixerPos.z);
    this.objectiveTag = tag;
    this.objectiveText = text;
  }

  completeMission(player, audio) {
    const def = this.activeMission;
    const reward = def.reward;
    player.money += reward;
    this.completedCount++;
    if (player.money >= 1500 && !player.weaponsState[1].unlocked) {
      player.weaponsState[1].unlocked = true;
      this.showDialogue('TESSA MARLOW', `Clean work, Rico. +$${reward}. Unlocked MERIDIAN V-9 SMG (Press 3).`, 7.0);
    } else if (def.kind === 'survive') {
      this.police.resetWanted();
      this.showDialogue('TESSA MARLOW', `Cargo's clear and I called in a favour — MPD stood down. +$${reward}.`, 6.5);
    } else {
      this.showDialogue('TESSA MARLOW', `Contract closed, Rico. Wired $${reward} to your account. Come back for the next job.`, 6.5);
    }
    if (audio) {
      if (audio.playMissionComplete) audio.playMissionComplete();
      else audio.playMissionChime();
    }
    this.showToast('MISSION PASSED', false, 3.5);
    if (this.completedCount % STORY_ORDER.length === 0) {
      this.resetToGiver('STORY COMPLETE', 'Bishop is finished. Tessa has more work on Palmetto Strip (Press E)');
    } else {
      this.resetToGiver('NEXT CONTRACT', `Return to Tessa Marlow for "${this.getNextMissionDef().title}" (Press E)`);
    }
  }

  failMission(reason, audio) {
    const def = this.activeMission;
    if (!def) return;
    this.clearEnemies();
    if (this.targetVehicle && this.targetVehicle.aiMode === 'parked' && this.vehicles.removeVehicle) {
      this.vehicles.removeVehicle(this.targetVehicle);
    }
    if (audio && audio.playMissionFailed) audio.playMissionFailed();
    this.showToast('MISSION FAILED', true, 3.5);
    this.showDialogue(def.giver, `${reason} Press E within ten seconds to try again, or come find me.`, 7);
    this.failedDef = def;
    this.retryWindow = 10;
    this.resetToGiver('MISSION FAILED', `${reason} — Press E to retry "${def.title}"`);
  }

  getPrompt(player) {
    if (this.failedDef && this.retryWindow > 0 && player.deadTimer <= 0) {
      return `Press E — Retry "${this.failedDef.title}" (${Math.ceil(this.retryWindow)})`;
    }
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

  // Bob, spin and pulse the markers; also used in shot mode where update() is not run.
  animateMarkers(time) {
    for (const m of [this.giverMarker, this.objectiveMarker]) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 3.2);
      m.diamond.position.y = 3.2 + Math.sin(time * 2.4) * 0.22;
      m.glow.scale.setScalar(0.9 + pulse * 0.25);
      m.glow.material.opacity = 0.5 + pulse * 0.35;
      m.ring.material.opacity = 0.65 + pulse * 0.3;
    }
    for (const pk of this.pickups) {
      pk.mesh.rotation.y = time * 2 + pk.x * 0.1;
      pk.mesh.position.y = 1.1 + Math.sin(time * 2.6 + pk.z) * 0.18;
    }
  }

  updatePickups(dt, player, audio) {
    for (const pk of this.pickups) {
      if (pk.taken) {
        pk.respawn -= dt;
        if (pk.respawn <= 0) {
          pk.taken = false;
          pk.mesh.visible = true;
        }
        continue;
      }
      if (player.deadTimer > 0 || player.vehicle) continue;
      if (Math.hypot(player.pos.x - pk.x, player.pos.z - pk.z) > 1.6) continue;
      if (pk.kind === 'health') {
        if (player.health >= 100) continue;
        player.health = Math.min(100, player.health + 50);
      } else if (pk.kind === 'armour') {
        if (player.armour >= 100) continue;
        player.armour = Math.min(100, player.armour + 50);
      } else {
        player.money += 250;
      }
      pk.taken = true;
      pk.respawn = 60;
      pk.mesh.visible = false;
      if (audio && audio.playPickup) audio.playPickup();
    }
  }

  serialize() {
    return { completed: this.completedCount };
  }

  restore(data) {
    if (data && Number.isFinite(data.completed)) {
      this.completedCount = Math.max(0, data.completed | 0);
      this.resetToGiver('NEXT CONTRACT', `Meet Tessa Marlow for "${this.getNextMissionDef().title}" (Press E)`);
    }
  }

  update(dt, time, player, controls, combat, audio) {
    // Rotate marker diamonds
    this.giverMarker.diamond.rotation.y = time * 1.8;
    this.objectiveMarker.diamond.rotation.y = time * 2.1;
    this.animateMarkers(time);
    this.updatePickups(dt, player, audio);

    if (this.toastTimer > 0) this.toastTimer -= dt;
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) {
        this.dialogueSpeaker = '';
        this.dialogueText = '';
      }
    }

    if (!this.activeMission) {
      if (this.retryWindow > 0) {
        this.retryWindow -= dt;
        if (controls.interact && this.failedDef && player.deadTimer <= 0) {
          this.startMission(this.failedDef);
          return;
        }
        if (this.retryWindow <= 0) this.failedDef = null;
      }
      const dist = Math.hypot(player.pos.x - CITY.fixerPos.x, player.pos.z - CITY.fixerPos.z);
      if (dist < 6.5 && controls.interact) {
        this.startMission(this.getNextMissionDef());
      }
      return;
    }

    const def = this.activeMission;

    // Any mission fails if Rico is wasted or busted.
    if (player.deadTimer > 0) {
      this.failMission(player.busted ? 'You got busted.' : 'You were wasted.', audio);
      return;
    }

    // Shared countdown for timed objectives.
    if (this.timerRemaining > 0 && def.kind === 'delivery') {
      this.timerRemaining -= dt;
      if (this.timerRemaining <= 0) {
        this.timerRemaining = 0;
        this.failMission('Too slow — the drop window closed.', audio);
        return;
      }
    }

    if (def.kind === 'delivery') {
      const dist = Math.hypot(player.pos.x - def.targetPos.x, player.pos.z - def.targetPos.z);
      if (dist < 6.0) this.completeMission(player, audio);
    } else if (def.kind === 'car_theft') {
      const tv = this.targetVehicle;
      if (tv && (tv.destroyed || (tv.health !== undefined && tv.health <= 0))) {
        this.failMission('The Coral 88 is wrecked.', audio);
        return;
      }
      if (this.stage === 'steal_car') {
        if (tv) {
          this.objectivePos.copy(tv.pos);
          this.objectiveMarker.group.position.set(this.objectivePos.x, 0, this.objectivePos.z);
        }
        if (player.vehicle === tv) {
          this.stage = 'dropoff';
          this.objectivePos.set(def.dropoffPos.x, 0, def.dropoffPos.z);
          this.objectiveMarker.group.position.copy(this.objectivePos);
          this.objectiveText = 'Lose the heat and stash the Coral 88 at your garage';
          this.police.reportCrime('car_theft', player.pos, 2);
          this.showDialogue('TESSA MARLOW', 'MPD spotted the boost! Shake them and bring the Coral 88 to your garage.', 6.0);
        }
      } else if (this.stage === 'dropoff') {
        const dist = Math.hypot(player.pos.x - def.dropoffPos.x, player.pos.z - def.dropoffPos.z);
        if (player.vehicle !== tv) {
          this.objectiveText = 'Get back in the Coral 88';
          this.objectivePos.copy(tv.pos);
          this.objectiveMarker.group.position.set(tv.pos.x, 0, tv.pos.z);
        } else {
          this.objectiveText = this.police.stars > 0 ? 'Lose the heat, then stash the Coral 88 at your garage' : 'Stash the Coral 88 at your garage';
          this.objectivePos.set(def.dropoffPos.x, 0, def.dropoffPos.z);
          this.objectiveMarker.group.position.copy(this.objectivePos);
          if (dist < 6.5 && this.police.stars === 0) this.completeMission(player, audio);
        }
      }
    } else if (def.kind === 'survive') {
      // Hold at least the mission's wanted level while the clock runs.
      if (this.police.stars < def.stars) this.police.setStars(def.stars);
      this.timerRemaining -= dt;
      this.surviveElapsed += dt;
      this.objectiveText = `Survive the manhunt — ${Math.ceil(Math.max(0, this.timerRemaining))}s`;
      if (this.timerRemaining <= 0) {
        this.timerRemaining = 0;
        this.completeMission(player, audio);
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
        if (e.hitFlash > 0) e.hitFlash -= dt;
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
