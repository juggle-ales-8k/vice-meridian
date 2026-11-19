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
};

export const WEAPONS = [
  {
    id: 'pistol',
    name: '9MM CORAL',
    damage: 34,
    fireRate: 0.24,
    range: 85,
    spread: 0.015,
    magSize: 15,
    maxReserve: 120,
    unlockedByDefault: true,
    unlockCost: 0,
  },
  {
    id: 'smg',
    name: 'MERIDIAN V-9',
    damage: 24,
    fireRate: 0.1,
    range: 75,
    spread: 0.032,
    magSize: 32,
    maxReserve: 224,
    unlockedByDefault: false,
    unlockCost: 1500,
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
};

export const POLICE_CFG = {
  maxStars: 5,
  decayTime: 18,
  escapeRadius: 95,
  maxPursuitCars: 4,
  maxOfficers: 5,
};

export function getDistrictName(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) return d.name;
  }
  return 'MARISOL METRO';
}
