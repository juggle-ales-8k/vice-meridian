export const FIXED_DT = 1 / 60;

export const CITY = {
  gridCols: 6,
  gridRows: 6,
  blockSize: 54,
  roadWidth: 16,
  sidewalkWidth: 4.5,
  get pitch() {
    return this.blockSize + this.roadWidth;
  },
  get halfSpanX() {
    return (this.gridCols * this.pitch) * 0.5;
  },
  get halfSpanZ() {
    return (this.gridRows * this.pitch) * 0.5;
  },
  coastalRoadX: 210,
  beachStartX: 224,
  waterStartX: 256,
  waterExtent: 640,
  docksZ: 170,
  hospitalPos: { x: -70, z: -70 },
  garagePos: { x: -135, z: 35 },
  fixerPos: { x: 132, z: -28 },
  policeHQPos: { x: -70, z: 70 },
  // Pier out over the ocean from the beach; its deck is walkable and drivable.
  pierZ: -20,
  pierLength: 72,
  // Grid cell that becomes the city park (lawn, fountain, broadleaf trees).
  parkBlock: { col: 0, row: 1 },
  // Largest building plot side; plots sit 22.4 m apart, so this guarantees ≥3.4 m service alleys.
  maxPlotSize: 19,
  maxBillboards: 8,
};

// Golden-hour lighting keyframes. render.js blends between them by `timeOfDay` (0..1);
// the default 0.62 is the late-afternoon look all four screenshots are tuned for.
export const TIME_OF_DAY = {
  default: 0.62,
  dayLengthSeconds: 900,
  keys: [
    { t: 0.0, sky: 0x101830, fog: 0x2a2440, sun: 0x6a7cff, hemiSky: 0x3a3f70, sunIntensity: 0.35 },
    { t: 0.3, sky: 0xffc59a, fog: 0xf2b08a, sun: 0xffe2b8, hemiSky: 0xffe2c4, sunIntensity: 1.25 },
    { t: 0.5, sky: 0x9fd2ff, fog: 0xc8dcea, sun: 0xfff4e0, hemiSky: 0xe8f2ff, sunIntensity: 1.5 },
    { t: 0.62, sky: 0xff8a4c, fog: 0xe68466, sun: 0xffb870, hemiSky: 0xffc694, sunIntensity: 1.35 },
    { t: 0.8, sky: 0x7d4476, fog: 0x8a4a6a, sun: 0xff7a52, hemiSky: 0xb0708c, sunIntensity: 0.7 },
    { t: 1.0, sky: 0x101830, fog: 0x2a2440, sun: 0x6a7cff, hemiSky: 0x3a3f70, sunIntensity: 0.35 },
  ],
};

export const TRAFFIC_CFG = {
  // Ambient cars per main-grid road segment; 24 at the default density of 1.
  density: 1.0,
  baseCount: 24,
  maxCount: 40,
  classWeights: { sedan: 4, taxi: 2, van: 2, pickup: 2, compact: 2, sports: 1, convertible: 1, muscle: 1, police: 0 },
  // Speed (m/s) at which a moving car makes pedestrians in front of it scatter.
  scareSpeed: 9,
  scareRadius: 14,
};

export const PED_CFG = {
  count: 86,
  panicDuration: 6,
  panicSpeed: 5.4,
  idleChance: 0.18,
  headTurnRate: 1.6,
};

export const COMBAT_CFG = {
  hitMarkerTime: 0.22,
  maxBloom: 0.09,
  bloomRecover: 0.12,
  punchRange: 1.9,
  punchDamage: 22,
  punchCooldown: 0.42,
  panicRadius: 38,
  npcBaseAccuracy: 0.32,
  npcDamage: 9,
};

// Wanted heat model. Each crime adds heat; stars are the thresholds the heat has crossed.
// Heat cools only while no officer can see the player.
export const WANTED_CFG = {
  heatPerStar: [0, 1, 3, 6, 10, 15],
  coolRateOutOfSight: 0.35,
  sightRadius: 60,
  roadblockStars: 3,
  officersOnFootStars: 2,
  maxRoadblocks: 2,
  bustSpeed: 1.2,
  bustRadius: 3.0,
  bustTime: 2.2,
};

export const SAVE_CFG = {
  key: 'vice-meridian-save-v1',
  autosaveSeconds: 30,
};

export const PALETTE = {
  skyZenith: '#1d2d5c',
  skyMid: '#7d4476',
  skyHorizon: '#ff8a4c',
  skyGlow: '#ffd485',
  fogColor: 0xe68466,
  sunColor: 0xffb870,
  hemiSky: 0xffc694,
  hemiGround: 0x26354d,
  asphalt: '#24252e',
  sidewalk: '#bfb3a4',
  sand: 0xe8c796,
  oceanDeep: 0x0b586e,
  oceanShallow: 0x169aa8,
  neonPink: 0xff3b9a,
  neonCyan: 0x3bf0ff,
  neonAmber: 0xff9e3b,
  neonLime: 0x6dff88,
  buildingPalettes: [
    { wall: 0xf4dcc4, trim: 0x30cfd0, style: 'deco' },
    { wall: 0xf0c2b2, trim: 0xff6b8b, style: 'deco' },
    { wall: 0x9ac4d6, trim: 0x264860, style: 'glass' },
    { wall: 0x7da4be, trim: 0x1c354c, style: 'glass' },
    { wall: 0xe5d3bc, trim: 0xc26e4b, style: 'stucco' },
    { wall: 0xd7c8b6, trim: 0x51606e, style: 'stucco' },
    { wall: 0x6b727d, trim: 0xd97d3a, style: 'warehouse' },
    { wall: 0xf7e3cf, trim: 0x4ad8c4, style: 'motel' },
  ],
};

export const DISTRICTS = [
  { name: 'PALMETTO STRIP', minX: 80, maxX: 240, minZ: -240, maxZ: 70 },
  { name: 'MARISOL BAY', minX: 200, maxX: 480, minZ: -320, maxZ: 320 },
  { name: 'DOCKSIDE', minX: -240, maxX: 220, minZ: 95, maxZ: 280 },
  { name: 'CALETA HEIGHTS', minX: -240, maxX: 80, minZ: -240, maxZ: -10 },
  { name: 'OLD MERIDIAN', minX: -240, maxX: 80, minZ: -10, maxZ: 95 },
];

export const VEHICLE_SPECS = {
  sports: {
    id: 'sports',
    name: 'VANTABLACK GT',
    maxSpeed: 50,
    accel: 34,
    brake: 42,
    turnRate: 2.35,
    grip: 7.4,
    length: 4.5,
    width: 2.04,
    height: 1.24,
    convertible: false,
    colors: [0xff3a5e, 0xff8828, 0x16d2d8, 0x222634, 0xf2d044],
  },
  convertible: {
    id: 'convertible',
    name: 'CORAL 88 SPIDER',
    maxSpeed: 47,
    accel: 31,
    brake: 40,
    turnRate: 2.45,
    grip: 7.1,
    length: 4.45,
    width: 2.0,
    height: 1.18,
    convertible: true,
    colors: [0xff5c4d, 0x23e0d6, 0xffbe3b, 0xf6f0e4],
  },
  sedan: {
    id: 'sedan',
    name: 'SOLARIS LX',
    maxSpeed: 34,
    accel: 22,
    brake: 34,
    turnRate: 2.1,
    grip: 8.2,
    length: 4.55,
    width: 1.94,
    height: 1.44,
    convertible: false,
    colors: [0xd9d2c5, 0x456982, 0x8e3a48, 0x3b4554, 0xc79558],
  },
  police: {
    id: 'police',
    name: 'MPD INTERCEPTOR',
    maxSpeed: 45,
    accel: 30,
    brake: 40,
    turnRate: 2.3,
    grip: 8.0,
    length: 4.65,
    width: 2.02,
    height: 1.48,
    convertible: false,
    isPolice: true,
    colors: [0x151a26],
  },
  taxi: {
    id: 'taxi',
    name: 'BAYLINE CAB',
    maxSpeed: 33,
    accel: 21,
    brake: 33,
    turnRate: 2.15,
    grip: 8.1,
    length: 4.55,
    width: 1.94,
    height: 1.46,
    convertible: false,
    isTaxi: true,
    colors: [0xf4b928],
  },
  van: {
    id: 'van',
    name: 'HARBORBOX 350',
    maxSpeed: 28,
    accel: 16,
    brake: 29,
    turnRate: 1.75,
    grip: 7.0,
    length: 5.1,
    width: 2.14,
    height: 2.15,
    convertible: false,
    colors: [0xe6e2d8, 0x3e6272, 0x9c483e, 0x4d5a60],
  },
  pickup: {
    id: 'pickup',
    name: 'CALETA RANGER',
    maxSpeed: 32,
    accel: 20,
    brake: 32,
    turnRate: 1.9,
    grip: 7.6,
    length: 4.95,
    width: 2.08,
    height: 1.66,
    convertible: false,
    colors: [0xb8382c, 0x2d5c63, 0xd49c42, 0x343a46],
  },
  compact: {
    id: 'compact',
    name: 'PIXIE HATCH',
    maxSpeed: 30,
    accel: 24,
    brake: 36,
    turnRate: 2.6,
    grip: 8.6,
    length: 3.7,
    width: 1.8,
    height: 1.5,
    convertible: false,
    colors: [0x9be3d0, 0xffd1dc, 0xf2e86d, 0x7fb2ff, 0xffffff],
  },
  muscle: {
    id: 'muscle',
    name: 'BRAWLER 455',
    maxSpeed: 46,
    accel: 36,
    brake: 33,
    turnRate: 1.95,
    grip: 6.2,
    length: 4.9,
    width: 2.06,
    height: 1.3,
    convertible: false,
    colors: [0x1f3b8c, 0xd8462b, 0x111316, 0xf2b705],
  },
};

export const WEAPONS = [
  {
    id: 'pistol',
    name: '9MM CORAL',
    damage: 34,
    fireRate: 0.24,
    range: 85,
    falloffStart: 30,
    minDamageScale: 0.5,
    spread: 0.015,
    bloomPerShot: 0.008,
    recoil: 0.018,
    reloadTime: 0.9,
    magSize: 15,
    maxReserve: 120,
    unlockedByDefault: true,
    unlockCost: 0,
    hotkey: 2,
  },
  {
    id: 'smg',
    name: 'MERIDIAN V-9',
    damage: 24,
    fireRate: 0.1,
    range: 75,
    falloffStart: 18,
    minDamageScale: 0.35,
    spread: 0.032,
    bloomPerShot: 0.005,
    recoil: 0.011,
    reloadTime: 1.3,
    magSize: 32,
    maxReserve: 224,
    unlockedByDefault: false,
    unlockCost: 1500,
    hotkey: 3,
  },
  {
    id: 'fists',
    name: 'BARE KNUCKLE',
    melee: true,
    damage: 22,
    fireRate: 0.42,
    range: 1.9,
    spread: 0,
    recoil: 0,
    magSize: 0,
    maxReserve: 0,
    unlockedByDefault: true,
    unlockCost: 0,
    hotkey: 1,
  },
];

export const PLAYER_CFG = {
  walkSpeed: 6.2,
  sprintSpeed: 10.6,
  jumpSpeed: 7.4,
  gravity: 21.0,
  radius: 0.48,
  height: 1.78,
  maxHealth: 100,
  maxArmour: 100,
  enterVehicleDist: 4.6,
  // Seconds for the camera to blend between on-foot and driving rigs.
  cameraBlendTime: 0.6,
  footCam: { dist: 5.2, height: 2.3, lookHeight: 1.5 },
  driveCam: { dist: 9.5, height: 3.6, lookHeight: 1.2 },
  armourAbsorb: 0.66,
  healthRegenBelow: 30,
  healthRegenRate: 1.5,
  fallDamageSpeed: 14,
};

export const POLICE_CFG = {
  maxStars: 5,
  decayTime: 18,
  escapeRadius: 95,
  maxPursuitCars: 4,
  maxOfficers: 5,
  patrolCars: 3,
  patrolSpeed: 11,
};

export function getDistrictName(x, z) {
  if (x < -CITY.halfSpanX - 8) return 'WEST ANNEX';
  if (x > CITY.waterStartX - 4 && Math.abs(z - CITY.pierZ) < 5) return 'MERIDIAN PIER';
  for (const d of DISTRICTS) {
    if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) return d.name;
  }
  return 'MARISOL METRO';
}

// Blend the TIME_OF_DAY keyframes at t (0..1) into plain numbers/hex colours.
export function sampleTimeOfDay(t) {
  const keys = TIME_OF_DAY.keys;
  const tt = ((t % 1) + 1) % 1;
  let a = keys[0];
  let b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (tt >= keys[i].t && tt <= keys[i + 1].t) {
      a = keys[i];
      b = keys[i + 1];
      break;
    }
  }
  const k = b.t > a.t ? (tt - a.t) / (b.t - a.t) : 0;
  const mix = (ca, cb) => {
    const r = Math.round(((ca >> 16) & 255) * (1 - k) + ((cb >> 16) & 255) * k);
    const g = Math.round(((ca >> 8) & 255) * (1 - k) + ((cb >> 8) & 255) * k);
    const bl = Math.round((ca & 255) * (1 - k) + (cb & 255) * k);
    return (r << 16) | (g << 8) | bl;
  };
  return {
    sky: mix(a.sky, b.sky),
    fog: mix(a.fog, b.fog),
    sun: mix(a.sun, b.sun),
    hemiSky: mix(a.hemiSky, b.hemiSky),
    sunIntensity: a.sunIntensity + (b.sunIntensity - a.sunIntensity) * k,
  };
}

// Weighted vehicle class picker for ambient traffic.
export function pickTrafficClass(rng) {
  const entries = Object.entries(TRAFFIC_CFG.classWeights).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng.next() * total;
  for (const [id, w] of entries) {
    roll -= w;
    if (roll <= 0) return id;
  }
  return entries[entries.length - 1][0];
}
