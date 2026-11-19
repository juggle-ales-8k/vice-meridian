import * as THREE from 'three';
import { PALETTE } from './config.js';

export function createRenderRig(canvas, textures) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(PALETTE.fogColor, 0.00205);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.25, 1600);

  // Sky dome
  const skyGeo = new THREE.SphereGeometry(950, 24, 16);
  const skyMat = new THREE.MeshBasicMaterial({
    map: textures.sky,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyDome);

  // Golden-hour sun direction (low over the horizon for warm key light and long shadows)
  const sunDir = new THREE.Vector3(0.45, 0.22, -0.86).normalize();

  // Sun disc + additive lens flare sprites
  const sunGroup = new THREE.Group();
  const sunCoreMat = new THREE.SpriteMaterial({
    map: textures.sunFlare,
    color: 0xfff0c2,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const sunCore = new THREE.Sprite(sunCoreMat);
  sunCore.scale.set(170, 170, 1);
  sunGroup.add(sunCore);

  const sunHaloMat = new THREE.SpriteMaterial({
    map: textures.warmGlow,
    color: 0xff8c48,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    fog: false,
  });
  const sunHalo = new THREE.Sprite(sunHaloMat);
  sunHalo.scale.set(420, 260, 1);
  sunGroup.add(sunHalo);
  scene.add(sunGroup);

  // Primary lights: one HemisphereLight + one shadow-casting DirectionalLight
  const hemiLight = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 0.92);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(PALETTE.sunColor, 2.25);
  sunLight.position.copy(sunDir).multiplyScalar(190);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 20;
  sunLight.shadow.camera.far = 420;
  const s = 95;
  sunLight.shadow.camera.left = -s;
  sunLight.shadow.camera.right = s;
  sunLight.shadow.camera.top = s;
  sunLight.shadow.camera.bottom = -s;
  sunLight.shadow.bias = -0.0008;
  scene.add(sunLight);
  scene.add(sunLight.target);

  function updateAtmosphere(anchorPos) {
    skyDome.position.set(anchorPos.x, 0, anchorPos.z);
    sunGroup.position.set(
      anchorPos.x + sunDir.x * 780,
      Math.max(52, sunDir.y * 780),
      anchorPos.z + sunDir.z * 780,
    );
    sunLight.position.set(
      anchorPos.x + sunDir.x * 160,
      sunDir.y * 160 + 25,
      anchorPos.z + sunDir.z * 160,
    );
    sunLight.target.position.set(anchorPos.x, 0, anchorPos.z);
    sunLight.target.updateMatrixWorld();
  }

  function resize() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  window.addEventListener('resize', resize);

  return {
    renderer,
    scene,
    camera,
    sunDir,
    sunLight,
    hemiLight,
    updateAtmosphere,
    resize,
  };
}
