import { CITY, FIXED_DT } from './config.js';
import { SeededRandom } from './random.js';
import { createTexturePack } from './textures.js';
import { createRenderRig } from './render.js';
import { buildCity } from './city.js';
import { VehicleManager } from './vehicles.js';
import { PedestrianManager } from './pedestrians.js';
import { PlayerController } from './player.js';
import { PoliceManager } from './police.js';
import { CombatSystem } from './combat.js';
import { MissionManager } from './missions.js';
import { HudOverlay } from './hud.js';
import { AudioEngine } from './audio.js';
import { InputController } from './input.js';
import { setupShotScene, stepShotScene } from './shots.js';

function parseParams() {
  const params = new URLSearchParams(window.location.search);
  const rawShot = params.get('shot');
  // Map legacy starter aliases if ever queried, while natively supporting chase|street|drive|mission
  const aliasMap = { start: 'chase', play: 'drive', end: 'mission' };
  const shot = rawShot ? (aliasMap[rawShot] || rawShot) : null;
  const seed = Number.parseInt(params.get('seed') || '42', 10) || 42;
  const advanceT = Math.max(0, Number.parseFloat(params.get('t') || '0') || 0);
  const forceHud = params.get('hud') === '1';
  return { shot, seed, advanceT, forceHud };
}

function boot() {
  const { shot, seed, advanceT, forceHud } = parseParams();
  const isShotMode = Boolean(shot);

  const rng = new SeededRandom(seed);
  const canvas = document.getElementById('viewport');
  const textures = createTexturePack(rng.fork(10));
  const renderRig = createRenderRig(canvas, textures);
  const city = buildCity(renderRig.scene, textures, rng.fork(20));
  const vehicles = new VehicleManager(renderRig.scene, city, textures, rng.fork(30));
  const peds = new PedestrianManager(renderRig.scene, city, rng.fork(40), 86);
  const player = new PlayerController(renderRig.scene, city, renderRig.camera);
  const police = new PoliceManager(renderRig.scene, city, vehicles, rng.fork(50));
  const combat = new CombatSystem(renderRig.scene, city, textures, rng.fork(60));
  const missions = new MissionManager(renderRig.scene, vehicles, police, rng.fork(70));
  const hud = new HudOverlay();
  const audio = new AudioEngine();
  const input = new InputController(canvas);

  // Populate baseline city traffic and starter cars
  vehicles.populateTraffic(24);
  if (!isShotMode) {
    // Park Rico's starter Vantablack GT right near Palmetto Strip
    vehicles.spawnVehicle('sports', 134, -20, Math.PI, { color: 0xff3a5e, aiMode: 'parked' });
    vehicles.spawnVehicle('convertible', 134, -36, 0, { color: 0x23e0d6, aiMode: 'parked' });
    vehicles.spawnVehicle('police', 143.6, 20, Math.PI, { aiMode: 'traffic', laneAxis: 'z', laneDir: -1, laneCoord: 143.6, speed: 13 });
  }

  let simTime = 0;
  let paused = !isShotMode;
  let shotInfo = null;

  const ctx = { city, vehicles, peds, player, police, combat, missions, renderRig };

  const emptyControls = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
    handbrake: false,
    enterExit: false,
    interact: false,
    fire: false,
    reload: false,
    pause: false,
    weapon1: false,
    weapon2: false,
  };

  function stepSimulation(dt, useInput) {
    simTime += dt;
    const controls = useInput ? input.getControls() : emptyControls;
    const mouseDelta = useInput ? input.consumeMouseDelta() : { dx: 0, dy: 0 };

    if (useInput && controls.pause) {
      paused = !paused;
      hud.setOverlay(paused, paused ? 'RESUME' : 'PLAY VICE MERIDIAN');
      hud.setVisible(!paused || forceHud);
      if (!paused) input.requestPointerLock();
      input.endFrame();
      return;
    }

    city.update(simTime);

    if (isShotMode) {
      stepShotScene(shotInfo, dt, ctx);
      // Still tick traffic, pedestrians, lightbars, and particle fades
      vehicles.update(dt, simTime, emptyControls, null);
      peds.update(dt, player, vehicles, police);
      combat.update(dt, emptyControls, player, [], police, null);
      missions.giverMarker.diamond.rotation.y = simTime * 1.8;
      missions.objectiveMarker.diamond.rotation.y = simTime * 2.1;
      player.updateCamera(dt);
    } else {
      const allTargets = [...police.officers, ...missions.enemies];
      vehicles.update(dt, simTime, controls, player.vehicle);
      player.update(dt, controls, mouseDelta, vehicles, police, audio);
      peds.update(dt, player, vehicles, police);
      police.update(dt, simTime, player, combat, audio);
      combat.update(dt, controls, player, allTargets, police, audio);
      missions.update(dt, simTime, player, controls, combat, audio);
      audio.update(dt, player);
    }

    renderRig.updateAtmosphere(player.pos);
    hud.update(simTime, city, player, police, missions, vehicles, combat);

    if (useInput) input.endFrame();
  }

  if (isShotMode) {
    input.frozen = true;
    hud.setShotMode(true);
    hud.setOverlay(false);
    hud.setVisible(true);

    shotInfo = setupShotScene(shot, ctx);

    // Advance simulation deterministically by fixed dt = 1/60 for requested seconds (default small settle if t=0)
    const targetT = advanceT > 0 ? advanceT : 0.4;
    const steps = Math.max(1, Math.round(targetT / FIXED_DT));
    for (let i = 0; i < steps; i++) {
      stepSimulation(FIXED_DT, false);
    }

    renderRig.updateAtmosphere(player.pos);
    player.updateCamera(FIXED_DT);
    hud.update(simTime, city, player, police, missions, vehicles, combat);
    renderRig.renderer.render(renderRig.scene, renderRig.camera);
    window.__VICE_MERIDIAN_READY__ = true;
    return;
  }

  // Interactive mode setup
  hud.setShotMode(false);
  hud.setOverlay(true, 'PLAY VICE MERIDIAN');
  hud.setVisible(forceHud);
  renderRig.updateAtmosphere(player.pos);
  player.updateCamera(FIXED_DT);
  hud.update(simTime, city, player, police, missions, vehicles, combat);

  const startPlay = () => {
    paused = false;
    hud.setOverlay(false);
    hud.setVisible(true);
    audio.unlock();
    input.requestPointerLock();
  };

  hud.playBtn.addEventListener('click', startPlay);
  canvas.addEventListener('click', () => {
    if (!paused && !input.pointerLocked) {
      audio.unlock();
      input.requestPointerLock();
    }
  });

  // Fixed-timestep interactive render loop
  let lastNow = performance.now();
  let accumulator = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min(0.1, (now - lastNow) / 1000);
    lastNow = now;

    if (!paused) {
      accumulator += frameDt;
      while (accumulator >= FIXED_DT) {
        stepSimulation(FIXED_DT, true);
        accumulator -= FIXED_DT;
      }
    } else {
      // Gently orbit camera on the title screen over sun-soaked Palmetto Strip
      simTime += frameDt * 0.45;
      city.update(simTime);
      const orbitAngle = simTime * 0.25;
      const focusX = CITY.fixerPos.x + 8;
      const focusZ = CITY.fixerPos.z;
      renderRig.camera.position.set(
        focusX + Math.cos(orbitAngle) * 34,
        14.5,
        focusZ + Math.sin(orbitAngle) * 34,
      );
      renderRig.camera.lookAt(focusX, 5, focusZ);
      renderRig.updateAtmosphere(player.pos);
    }

    renderRig.renderer.render(renderRig.scene, renderRig.camera);
  }

  requestAnimationFrame(frame);
}

boot();
