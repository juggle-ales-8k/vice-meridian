import { CITY, FIXED_DT, PED_CFG, SAVE_CFG, TRAFFIC_CFG } from './config.js';
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

// Game flow states. Shot mode bypasses the machine entirely and renders one frame.
export const GameState = Object.freeze({
  TITLE: 'title',
  PLAYING: 'playing',
  PAUSED: 'paused',
  WASTED: 'wasted',
  BUSTED: 'busted',
});

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

// --- Save / load (localStorage) -------------------------------------------------------------

function storage() {
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function readSave() {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(SAVE_CFG.key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || !data.player || !Number.isFinite(data.player.x) || !Number.isFinite(data.player.z)) return null;
    return data;
  } catch {
    return null;
  }
}

function writeSave(ctx) {
  const ls = storage();
  if (!ls) return false;
  const { player, police, missions } = ctx;
  const data = {
    v: 1,
    player: player.serialize(),
    wanted: police.stars,
    missions: missions.serialize ? missions.serialize() : null,
  };
  try {
    ls.setItem(SAVE_CFG.key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function applySave(ctx, data) {
  const { player, police, missions } = ctx;
  player.restore(data.player);
  if (data.wanted > 0) police.setStars(Math.min(5, data.wanted | 0));
  if (data.missions && missions.restore) missions.restore(data.missions);
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
  const peds = new PedestrianManager(renderRig.scene, city, rng.fork(40), PED_CFG.count);
  const player = new PlayerController(renderRig.scene, city, renderRig.camera);
  const police = new PoliceManager(renderRig.scene, city, vehicles, rng.fork(50));
  const combat = new CombatSystem(renderRig.scene, city, textures, rng.fork(60));
  const missions = new MissionManager(renderRig.scene, vehicles, police, rng.fork(70));
  const hud = new HudOverlay();
  const audio = new AudioEngine();
  const input = new InputController(canvas);
  combat.peds = peds;

  // Populate baseline city traffic and starter cars
  const trafficCount = Math.min(TRAFFIC_CFG.maxCount, Math.round(TRAFFIC_CFG.baseCount * TRAFFIC_CFG.density));
  vehicles.populateTraffic(trafficCount);
  if (!isShotMode) {
    // Park Rico's starter Vantablack GT right near Palmetto Strip
    vehicles.spawnVehicle('sports', 134, -20, Math.PI, { color: 0xff3a5e, aiMode: 'parked' });
    vehicles.spawnVehicle('convertible', 134, -36, 0, { color: 0x23e0d6, aiMode: 'parked' });
    vehicles.spawnVehicle('police', 143.6, 20, Math.PI, { aiMode: 'traffic', laneAxis: 'z', laneDir: -1, laneCoord: 143.6, speed: 13 });
    if (police.spawnPatrols) police.spawnPatrols();
  }

  let simTime = 0;
  let state = isShotMode ? GameState.PLAYING : GameState.TITLE;
  let shotInfo = null;
  let autosaveTimer = SAVE_CFG.autosaveSeconds;

  const ctx = { city, vehicles, peds, player, police, combat, missions, renderRig, textures };

  const emptyControls = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    moveX: 0,
    moveY: 0,
    throttle: 0,
    brake: 0,
    sprint: false,
    jump: false,
    handbrake: false,
    enterExit: false,
    interact: false,
    fire: false,
    aim: false,
    reload: false,
    melee: false,
    horn: false,
    pause: false,
    save: false,
    weapon1: false,
    weapon2: false,
    weapon3: false,
    nextWeapon: false,
    lookBack: false,
  };

  function saveNow(announce) {
    const ok = writeSave(ctx);
    if (announce && missions.showToast) missions.showToast(ok ? 'GAME SAVED' : 'SAVE UNAVAILABLE', !ok, 1.6);
    hud.setContinueAvailable(Boolean(readSave()));
  }

  function setState(next) {
    if (state === next) return;
    const prev = state;
    state = next;
    switch (next) {
      case GameState.PLAYING:
        hud.setOverlay(false);
        hud.setVisible(true);
        audio.unlock();
        if (audio.setMuted) audio.setMuted(false);
        // Drop input that belongs to the menu: the lock release caused by pausing and any key
        // press still queued from the resume action.
        input.consumeLockLost();
        input.endFrame();
        input.requestPointerLock();
        // Coming back from a death or arrest: persist the respawned state.
        if (prev === GameState.WASTED || prev === GameState.BUSTED) saveNow(false);
        break;
      case GameState.PAUSED:
        hud.setOverlayCopy('PAUSED', 'Marisol Bay holds its breath. Press P, Esc or the button to jump back in. Progress autosaves every 30 seconds.');
        hud.setOverlay(true, 'RESUME');
        hud.setVisible(forceHud);
        if (audio.setMuted) audio.setMuted(true);
        input.exitPointerLock();
        break;
      case GameState.WASTED:
      case GameState.BUSTED:
        hud.setVisible(true);
        break;
      default:
        hud.setOverlay(true, 'PLAY VICE MERIDIAN');
        hud.setVisible(forceHud);
    }
  }

  function stepSimulation(dt, useInput) {
    simTime += dt;
    const controls = useInput ? input.getControls() : emptyControls;
    const mouseDelta = useInput ? input.consumeMouseDelta(dt) : { dx: 0, dy: 0 };

    if (useInput && (controls.pause || input.consumeLockLost()) && state !== GameState.WASTED && state !== GameState.BUSTED) {
      setState(GameState.PAUSED);
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
      if (missions.animateMarkers) missions.animateMarkers(simTime);
      player.updateCamera(dt);
    } else {
      const allTargets = [...police.officers, ...missions.enemies];
      vehicles.update(dt, simTime, controls, player.vehicle);
      player.update(dt, controls, mouseDelta, vehicles, police, audio);
      peds.update(dt, player, vehicles, police);
      police.update(dt, simTime, player, combat, audio);
      combat.update(dt, controls, player, allTargets, police, audio);
      missions.update(dt, simTime, player, controls, combat, audio);
      audio.update(dt, player, police);
      if (controls.horn && player.vehicle) {
        audio.playHorn();
        if (peds.alertGunfire) peds.alertGunfire(player.pos, 18);
      }
      if (controls.save) saveNow(true);

      // Death / arrest transitions are driven by the player's respawn timer.
      if (player.deadTimer > 0) {
        setState(player.busted ? GameState.BUSTED : GameState.WASTED);
      } else if (state === GameState.WASTED || state === GameState.BUSTED) {
        setState(GameState.PLAYING);
      }

      autosaveTimer -= dt;
      if (autosaveTimer <= 0 && state === GameState.PLAYING) {
        autosaveTimer = SAVE_CFG.autosaveSeconds;
        saveNow(false);
      }
    }

    renderRig.updateAtmosphere(player.pos, simTime);
    hud.update(simTime, city, player, police, missions, vehicles, combat);

    if (useInput) input.endFrame();
  }

  if (isShotMode) {
    input.frozen = true;
    hud.hideLoading(true);
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

    renderRig.updateAtmosphere(player.pos, simTime);
    player.updateCamera(FIXED_DT);
    hud.update(simTime, city, player, police, missions, vehicles, combat);
    renderRig.render();
    // Frame stats for budget checks (draw calls cover every pass of the final frame).
    window.__VICE_MERIDIAN_STATS__ = {
      calls: renderRig.renderer.info.render.calls,
      triangles: renderRig.renderer.info.render.triangles,
      post: renderRig.postEnabled,
    };
    window.__VICE_MERIDIAN_READY__ = true;
    return;
  }

  // Interactive mode setup
  renderRig.dayCycle = true;
  hud.setShotMode(false);
  hud.setOverlay(true, 'PLAY VICE MERIDIAN');
  hud.setVisible(forceHud);
  hud.setContinueAvailable(Boolean(readSave()));
  renderRig.updateAtmosphere(player.pos, simTime);
  player.updateCamera(FIXED_DT);
  hud.update(simTime, city, player, police, missions, vehicles, combat);
  hud.hideLoading(false);

  const startPlay = () => {
    if (state === GameState.TITLE || state === GameState.PAUSED) setState(GameState.PLAYING);
  };
  const continueSaved = () => {
    const data = readSave();
    if (data) applySave(ctx, data);
    setState(GameState.PLAYING);
  };

  hud.playBtn.addEventListener('click', startPlay);
  if (hud.continueBtn) hud.continueBtn.addEventListener('click', continueSaved);
  // Clicking anywhere on the title screen (outside the buttons) also starts and unlocks audio.
  hud.overlay.addEventListener('click', (e) => {
    if (e.target === hud.overlay) startPlay();
  });
  window.addEventListener('keydown', (e) => {
    const resumeKey = e.code === 'Enter' || e.code === 'NumpadEnter' || ((e.code === 'KeyP' || e.code === 'Escape') && state === GameState.PAUSED && !input.pointerLocked);
    if (resumeKey && (state === GameState.TITLE || state === GameState.PAUSED)) {
      startPlay();
      // The same key press is also queued in the input controller; drop it so the first
      // simulation tick does not read it as "pause" again.
      input.endFrame();
    }
  });
  canvas.addEventListener('click', () => {
    if (state === GameState.PLAYING && !input.pointerLocked) {
      audio.unlock();
      input.requestPointerLock();
    }
  });
  // Save on tab close so progress is never lost.
  window.addEventListener('beforeunload', () => {
    if (state !== GameState.TITLE) writeSave(ctx);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === GameState.PLAYING) setState(GameState.PAUSED);
  });

  // Fixed-timestep interactive render loop
  let lastNow = performance.now();
  let accumulator = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min(0.1, (now - lastNow) / 1000);
    lastNow = now;

    const simulating = state === GameState.PLAYING || state === GameState.WASTED || state === GameState.BUSTED;
    if (simulating) {
      accumulator += frameDt;
      while (accumulator >= FIXED_DT) {
        stepSimulation(FIXED_DT, true);
        accumulator -= FIXED_DT;
      }
    } else if (state === GameState.TITLE) {
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
      renderRig.updateAtmosphere(player.pos, simTime);
    } else {
      // Paused: hold the last gameplay frame (camera stays where the player left it).
      accumulator = 0;
    }

    renderRig.render();
  }

  requestAnimationFrame(frame);
}

boot();
