import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

export function buildCity(scene, textures, rng) {
  const group = new THREE.Group();
  scene.add(group);

  const pitch = CITY.pitch;
  const cols = CITY.gridCols;
  const rows = CITY.gridRows;
  const startX = -(cols * pitch) * 0.5;
  const startZ = -(rows * pitch) * 0.5;

  const roadCentersX = [];
  const roadCentersZ = [];
  for (let c = 0; c <= cols; c++) roadCentersX.push(startX + c * pitch);
  for (let r = 0; r <= rows; r++) roadCentersZ.push(startZ + r * pitch);

  const colliders = [];
  const blocks = [];
  const intersections = [];
  const sidewalkRects = [];
  const dockCovers = [];

  // Base ground slab under the whole urban area
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x2a2932 });
  const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(0, -0.08, 0);
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // Beach sand strip on the east side
  const sandMat = new THREE.MeshLambertMaterial({ color: PALETTE.sand });
  const sandMesh = new THREE.Mesh(new THREE.PlaneGeometry(70, 960), sandMat);
  sandMesh.rotation.x = -Math.PI / 2;
  sandMesh.position.set(CITY.beachStartX + 18, -0.02, 0);
  sandMesh.receiveShadow = true;
  group.add(sandMesh);

  // Coastal boardwalk promenade separating coastal boulevard from the sand
  const boardMat = new THREE.MeshLambertMaterial({ color: 0xb78b62 });
  const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.24, 520), boardMat);
  boardwalk.position.set(CITY.coastalRoadX + CITY.roadWidth * 0.5 + 3.1, 0.12, 0);
  boardwalk.receiveShadow = true;
  group.add(boardwalk);

  // Ocean water plane (east of beach) + harbor water (south of dockside)
  const waterMat = new THREE.MeshLambertMaterial({
    map: textures.water,
    color: 0x26b2be,
    emissive: 0x093545,
    emissiveIntensity: 0.45,
  });
  const oceanMesh = new THREE.Mesh(new THREE.PlaneGeometry(CITY.waterExtent, 1500), waterMat);
  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.set(CITY.waterStartX + CITY.waterExtent * 0.5, -0.25, 0);
  group.add(oceanMesh);

  // Golden sun reflection strip on the ocean surface
  const sunStripMat = new THREE.MeshBasicMaterial({
    color: 0xffb366,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sunStrip = new THREE.Mesh(new THREE.PlaneGeometry(360, 48), sunStripMat);
  sunStrip.rotation.x = -Math.PI / 2;
  sunStrip.position.set(CITY.waterStartX + 200, -0.18, -110);
  sunStrip.rotation.z = -0.35;
  group.add(sunStrip);

  // Foam shoreline strip
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xe6fbff, transparent: true, opacity: 0.7 });
  const foamMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1100), foamMat);
  foamMesh.rotation.x = -Math.PI / 2;
  foamMesh.position.set(CITY.waterStartX + 1.2, -0.14, 0);
  group.add(foamMesh);

  // Road network: instanced straight road segments and intersections
  const roadSegLen = CITY.blockSize;
  const roadW = CITY.roadWidth;

  const nsRoadTex = textures.road.clone();
  nsRoadTex.needsUpdate = true;
  nsRoadTex.repeat.set(1, 3.2);
  const nsRoadMat = new THREE.MeshLambertMaterial({ map: nsRoadTex });

  const ewRoadTex = textures.road.clone();
  ewRoadTex.needsUpdate = true;
  ewRoadTex.repeat.set(1, 3.2);
  const ewRoadMat = new THREE.MeshLambertMaterial({ map: ewRoadTex });

  const interMat = new THREE.MeshLambertMaterial({ map: textures.intersection });

  const nsGeo = new THREE.PlaneGeometry(roadW, roadSegLen);
  nsGeo.rotateX(-Math.PI / 2);
  const nsCount = roadCentersX.length * rows;
  const nsMesh = new THREE.InstancedMesh(nsGeo, nsRoadMat, nsCount);
  nsMesh.receiveShadow = true;

  const ewGeo = new THREE.PlaneGeometry(roadW, roadSegLen);
  ewGeo.rotateX(-Math.PI / 2);
  ewGeo.rotateY(Math.PI / 2);
  const ewCount = roadCentersZ.length * cols;
  const ewMesh = new THREE.InstancedMesh(ewGeo, ewRoadMat, ewCount);
  ewMesh.receiveShadow = true;

  const interGeo = new THREE.PlaneGeometry(roadW, roadW);
  interGeo.rotateX(-Math.PI / 2);
  const interCount = roadCentersX.length * roadCentersZ.length;
  const interMesh = new THREE.InstancedMesh(interGeo, interMat, interCount);
  interMesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let idx = 0;
  for (let c = 0; c < roadCentersX.length; c++) {
    for (let r = 0; r < rows; r++) {
      dummy.position.set(roadCentersX[c], 0.02, roadCentersZ[r] + pitch * 0.5);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      nsMesh.setMatrixAt(idx++, dummy.matrix);
    }
  }
  idx = 0;
  for (let r = 0; r < roadCentersZ.length; r++) {
    for (let c = 0; c < cols; c++) {
      dummy.position.set(roadCentersX[c] + pitch * 0.5, 0.02, roadCentersZ[r]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      ewMesh.setMatrixAt(idx++, dummy.matrix);
    }
  }
  idx = 0;
  for (let c = 0; c < roadCentersX.length; c++) {
    for (let r = 0; r < roadCentersZ.length; r++) {
      const ix = roadCentersX[c];
      const iz = roadCentersZ[r];
      dummy.position.set(ix, 0.03, iz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      interMesh.setMatrixAt(idx++, dummy.matrix);
      intersections.push({
        x: ix,
        z: iz,
        col: c,
        row: r,
        phaseOffset: (c + r) % 2 === 0 ? 0 : 7,
      });
    }
  }
  group.add(nsMesh, ewMesh, interMesh);

  // Sidewalks & raised curbs for each block
  const swMat = new THREE.MeshLambertMaterial({ map: textures.sidewalk });
  const curbMat = new THREE.MeshLambertMaterial({ color: 0x998e80 });
  const swGeo = new THREE.BoxGeometry(CITY.blockSize, 0.22, CITY.blockSize);
  const swMesh = new THREE.InstancedMesh(swGeo, swMat, cols * rows);
  swMesh.receiveShadow = true;

  // Building instances grouped by facade style so draw calls stay tiny
  const styleBuckets = {
    deco: [],
    glass: [],
    stucco: [],
    warehouse: [],
    motel: [],
  };
  const trimInstances = [];
  const roofInstances = [];
  const palmPositions = [];
  const lampPositions = [];
  const trafficLightPositions = [];
  const signSpecs = [];

  let bIdx = 0;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const bx = roadCentersX[c] + pitch * 0.5;
      const bz = roadCentersZ[r] + pitch * 0.5;

      dummy.position.set(bx, 0.11, bz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      swMesh.setMatrixAt(bIdx++, dummy.matrix);

      const blockInfo = {
        col: c,
        row: r,
        x: bx,
        z: bz,
        half: CITY.blockSize * 0.5,
      };
      blocks.push(blockInfo);
      sidewalkRects.push({
        minX: bx - CITY.blockSize * 0.5,
        maxX: bx + CITY.blockSize * 0.5,
        minZ: bz - CITY.blockSize * 0.5,
        maxZ: bz + CITY.blockSize * 0.5,
      });

      const isDockBlock = r === rows - 1 && c >= 2;
      const isCoastalBlock = c === cols - 1;
      const isDowntown = c >= 1 && c <= 3 && r >= 1 && r <= 3;

      // Palm trees along block edges facing boulevards
      const edgeOff = CITY.blockSize * 0.5 - 2.1;
      for (const offset of [-16, 0, 16]) {
        if (isCoastalBlock || r <= 3 || rng.chance(0.55)) {
          palmPositions.push({ x: bx + edgeOff, z: bz + offset, lean: rng.range(-0.14, 0.14), h: rng.range(7.2, 11.2), rot: rng.range(0, Math.PI * 2) });
        }
        if (c === cols - 2 || rng.chance(0.45)) {
          palmPositions.push({ x: bx - edgeOff, z: bz + offset, lean: rng.range(-0.14, 0.14), h: rng.range(7.0, 10.6), rot: rng.range(0, Math.PI * 2) });
        }
      }

      // Streetlights at block corners
      const lampOff = CITY.blockSize * 0.5 - 1.2;
      lampPositions.push({ x: bx + lampOff, z: bz + lampOff, rot: Math.PI * 0.75 });
      lampPositions.push({ x: bx - lampOff, z: bz - lampOff, rot: -Math.PI * 0.25 });

      // Traffic lights at alternate corners
      if ((c + r) % 2 === 0) {
        trafficLightPositions.push({ x: bx + lampOff, z: bz - lampOff, rot: 0, interCol: c + 1, interRow: r });
        trafficLightPositions.push({ x: bx - lampOff, z: bz + lampOff, rot: Math.PI, interCol: c, interRow: r + 1 });
      }

      // Dockside freight yard (open arena for mission shootout with containers + warehouse)
      if (isDockBlock && c === 4) {
        // Leave central yard open for the Pier 4 shootout, place warehouse at north edge and shipping containers as cover
        const whW = 36;
        const whD = 12;
        const whH = 11;
        const whZ = bz - 15;
        styleBuckets.warehouse.push({ x: bx, y: whH * 0.5 + 0.22, z: whZ, sx: whW, sy: whH, sz: whD, color: 0x77808a });
        colliders.push({ minX: bx - whW * 0.5, maxX: bx + whW * 0.5, minZ: whZ - whD * 0.5, maxZ: whZ + whD * 0.5, maxY: whH });
        signSpecs.push({ x: bx, y: 7.5, z: whZ + whD * 0.5 + 0.25, rotY: 0, w: 12, h: 3.4, signIndex: 5 });

        const crates = [
          { x: bx - 10, z: bz + 4, w: 7.5, h: 2.8, d: 2.8, color: 0xc24938 },
          { x: bx + 9, z: bz + 5, w: 7.5, h: 2.8, d: 2.8, color: 0x26748a },
          { x: bx - 2, z: bz + 14, w: 8.0, h: 2.8, d: 2.8, color: 0xd98f32 },
          { x: bx + 14, z: bz - 2, w: 2.8, h: 2.8, d: 7.5, color: 0x356978 },
          { x: bx - 15, z: bz + 13, w: 2.8, h: 2.8, d: 7.2, color: 0xa83c34 },
        ];
        for (const cr of crates) {
          dockCovers.push(cr);
          colliders.push({
            minX: cr.x - cr.w * 0.5,
            maxX: cr.x + cr.w * 0.5,
            minZ: cr.z - cr.d * 0.5,
            maxZ: cr.z + cr.d * 0.5,
            maxY: cr.h,
          });
        }
        continue;
      }

      // Garage lot on Caleta/Old Meridian block
      if (c === 1 && r === 3) {
        const gW = 24;
        const gD = 16;
        const gH = 7.5;
        styleBuckets.warehouse.push({ x: bx - 7, y: gH * 0.5 + 0.22, z: bz - 10, sx: gW, sy: gH, sz: gD, color: 0x626b78 });
        colliders.push({ minX: bx - 7 - gW * 0.5, maxX: bx - 7 + gW * 0.5, minZ: bz - 10 - gD * 0.5, maxZ: bz - 10 + gD * 0.5, maxY: gH });
        signSpecs.push({ x: bx - 7, y: 6.2, z: bz - 10 + gD * 0.5 + 0.25, rotY: 0, w: 10.5, h: 3.0, signIndex: 2 });
        continue;
      }

      // Hospital plaza block
      if (c === 2 && r === 2) {
        const hW = 26;
        const hD = 22;
        const hH = 22;
        styleBuckets.deco.push({ x: bx, y: hH * 0.5 + 0.22, z: bz - 4, sx: hW, sy: hH, sz: hD, color: 0xf4eee6 });
        trimInstances.push({ x: bx, y: hH + 0.45, z: bz - 4, sx: hW + 0.8, sy: 0.7, sz: hD + 0.8, color: 0xff4558 });
        colliders.push({ minX: bx - hW * 0.5, maxX: bx + hW * 0.5, minZ: bz - 4 - hD * 0.5, maxZ: bz - 4 + hD * 0.5, maxY: hH });
        continue;
      }

      // Subdivide regular block into 2x2 building plots
      const subOffset = 11.2;
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
          const px = bx + sx * subOffset;
          const pz = bz + sz * subOffset;
          const w = rng.range(15.5, 19.8);
          const d = rng.range(15.5, 19.8);

          let paletteEntry;
          let h;
          if (isDockBlock) {
            paletteEntry = PALETTE.buildingPalettes[6];
            h = rng.range(8, 15);
          } else if (isCoastalBlock) {
            paletteEntry = rng.pick([PALETTE.buildingPalettes[0], PALETTE.buildingPalettes[1], PALETTE.buildingPalettes[7], PALETTE.buildingPalettes[2]]);
            h = rng.range(15, 34);
          } else if (isDowntown) {
            paletteEntry = rng.pick([PALETTE.buildingPalettes[2], PALETTE.buildingPalettes[3], PALETTE.buildingPalettes[0]]);
            h = rng.range(28, 62);
          } else {
            paletteEntry = rng.pick(PALETTE.buildingPalettes);
            h = rng.range(11, 28);
          }

          styleBuckets[paletteEntry.style].push({
            x: px,
            y: h * 0.5 + 0.22,
            z: pz,
            sx: w,
            sy: h,
            sz: d,
            color: paletteEntry.wall,
          });

          // Neon/Art-Deco roofline trim band
          trimInstances.push({
            x: px,
            y: h + 0.45,
            z: pz,
            sx: w + 0.5,
            sy: 0.65,
            sz: d + 0.5,
            color: paletteEntry.trim,
          });

          // Rooftop penthouse / HVAC box on taller towers
          if (h > 20) {
            roofInstances.push({
              x: px + rng.range(-2, 2),
              y: h + 2.4,
              z: pz + rng.range(-2, 2),
              sx: w * 0.44,
              sy: 3.8,
              sz: d * 0.44,
              color: 0x3b4454,
            });
          }

          // Storefront neon signs facing the main boulevards
          if ((isCoastalBlock || c === cols - 2) && sx === 1 && rng.chance(0.75)) {
            signSpecs.push({
              x: px + w * 0.5 + 0.22,
              y: 5.4,
              z: pz,
              rotY: Math.PI / 2,
              w: Math.min(w * 0.72, 11),
              h: 3.0,
              signIndex: rng.int(0, 4),
            });
          } else if (sz === 1 && rng.chance(0.32)) {
            signSpecs.push({
              x: px,
              y: 5.2,
              z: pz + d * 0.5 + 0.22,
              rotY: 0,
              w: Math.min(w * 0.68, 10),
              h: 2.8,
              signIndex: rng.int(0, 4),
            });
          }

          colliders.push({
            minX: px - w * 0.5,
            maxX: px + w * 0.5,
            minZ: pz - d * 0.5,
            maxZ: pz + d * 0.5,
            maxY: h,
          });
        }
      }
    }
  }
  group.add(swMesh);

  // Add coastal boardwalk palms along the beach side of the coastal highway
  for (let z = -220; z <= 220; z += 18) {
    palmPositions.push({
      x: CITY.coastalRoadX + CITY.roadWidth * 0.5 + 3.2,
      z,
      lean: rng.range(-0.18, 0.18),
      h: rng.range(8.5, 12.5),
      rot: rng.range(0, Math.PI * 2),
    });
  }

  // Create one InstancedMesh per building style
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const colorObj = new THREE.Color();
  for (const [style, list] of Object.entries(styleBuckets)) {
    if (list.length === 0) continue;
    const mat = new THREE.MeshLambertMaterial({
      map: textures.facades[style],
      emissive: new THREE.Color(0xffffff),
      emissiveMap: textures.emissives[style],
      emissiveIntensity: style === 'glass' ? 0.65 : 0.48,
    });
    const inst = new THREE.InstancedMesh(unitBox, mat, list.length);
    inst.receiveShadow = true;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(b.sx, b.sy, b.sz);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      colorObj.setHex(b.color);
      inst.setColorAt(i, colorObj);
    }
    inst.instanceColor.needsUpdate = true;
    group.add(inst);
  }

  // Neon roofline trims (emissive basic material for punchy sunset pop)
  if (trimInstances.length > 0) {
    const trimMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const trimInst = new THREE.InstancedMesh(unitBox, trimMat, trimInstances.length);
    for (let i = 0; i < trimInstances.length; i++) {
      const t = trimInstances[i];
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(t.sx, t.sy, t.sz);
      dummy.updateMatrix();
      trimInst.setMatrixAt(i, dummy.matrix);
      colorObj.setHex(t.color);
      trimInst.setColorAt(i, colorObj);
    }
    trimInst.instanceColor.needsUpdate = true;
    group.add(trimInst);
  }

  // Rooftop mechanical boxes
  if (roofInstances.length > 0) {
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x454f60 });
    const roofInst = new THREE.InstancedMesh(unitBox, roofMat, roofInstances.length);
    for (let i = 0; i < roofInstances.length; i++) {
      const rf = roofInstances[i];
      dummy.position.set(rf.x, rf.y, rf.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(rf.sx, rf.sy, rf.sz);
      dummy.updateMatrix();
      roofInst.setMatrixAt(i, dummy.matrix);
    }
    group.add(roofInst);
  }

  // Dockside shipping containers (cover geometry)
  if (dockCovers.length > 0) {
    const crateMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const crateInst = new THREE.InstancedMesh(unitBox, crateMat, dockCovers.length);
    crateInst.castShadow = true;
    crateInst.receiveShadow = true;
    for (let i = 0; i < dockCovers.length; i++) {
      const cr = dockCovers[i];
      dummy.position.set(cr.x, cr.h * 0.5 + 0.22, cr.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(cr.w, cr.h, cr.d);
      dummy.updateMatrix();
      crateInst.setMatrixAt(i, dummy.matrix);
      colorObj.setHex(cr.color);
      crateInst.setColorAt(i, colorObj);
    }
    crateInst.instanceColor.needsUpdate = true;
    group.add(crateInst);
  }

  // Storefront neon signs
  for (const s of signSpecs) {
    const mat = new THREE.MeshBasicMaterial({ map: textures.signs[s.signIndex] });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat);
    mesh.position.set(s.x, s.y, s.z);
    mesh.rotation.y = s.rotY;
    group.add(mesh);
  }

  // Instanced palm trees (curved-feel trunks + star of drooping fronds)
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.34, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a573d });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, palmPositions.length);

  const frondGeo = new THREE.BoxGeometry(0.42, 0.08, 3.6);
  frondGeo.translate(0, 0, 1.75);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f7d46 });
  const frondsPerPalm = 6;
  const frondInst = new THREE.InstancedMesh(frondGeo, frondMat, palmPositions.length * frondsPerPalm);

  let fIdx = 0;
  for (let i = 0; i < palmPositions.length; i++) {
    const p = palmPositions[i];
    dummy.position.set(p.x, 0.22, p.z);
    dummy.rotation.set(p.lean, p.rot, p.lean * 0.5);
    dummy.scale.set(1, p.h, 1);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);

    const topX = p.x + Math.sin(p.lean * 0.5) * p.h * 0.5;
    const topZ = p.z + Math.sin(p.lean) * p.h * 0.5;
    const topY = 0.22 + p.h * 0.96;

    for (let f = 0; f < frondsPerPalm; f++) {
      const yaw = p.rot + (f / frondsPerPalm) * Math.PI * 2;
      dummy.position.set(topX, topY, topZ);
      dummy.rotation.set(0.32, yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      frondInst.setMatrixAt(fIdx++, dummy.matrix);
    }
  }
  group.add(trunkInst, frondInst);

  // Instanced streetlights + warm bulb caps
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.14, 7.6, 6);
  poleGeo.translate(0, 3.8, 0);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3b404e });
  const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length);

  const bulbGeo = new THREE.BoxGeometry(0.65, 0.22, 0.65);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd280 });
  const bulbInst = new THREE.InstancedMesh(bulbGeo, bulbMat, lampPositions.length);

  for (let i = 0; i < lampPositions.length; i++) {
    const lp = lampPositions[i];
    dummy.position.set(lp.x, 0.22, lp.z);
    dummy.rotation.set(0, lp.rot, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poleInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(lp.x, 7.8, lp.z);
    dummy.updateMatrix();
    bulbInst.setMatrixAt(i, dummy.matrix);
  }
  group.add(poleInst, bulbInst);

  // Traffic lights with dynamic signal heads
  const tlPostGeo = new THREE.CylinderGeometry(0.11, 0.14, 6.2, 6);
  tlPostGeo.translate(0, 3.1, 0);
  const tlPostInst = new THREE.InstancedMesh(tlPostGeo, poleMat, trafficLightPositions.length);

  const tlBoxGeo = new THREE.BoxGeometry(0.55, 1.5, 0.45);
  const tlBoxMat = new THREE.MeshLambertMaterial({ color: 0x1e2028 });
  const tlBoxInst = new THREE.InstancedMesh(tlBoxGeo, tlBoxMat, trafficLightPositions.length);

  const tlLampGeo = new THREE.BoxGeometry(0.6, 0.42, 0.5);
  const tlLampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tlLampInst = new THREE.InstancedMesh(tlLampGeo, tlLampMat, trafficLightPositions.length);

  for (let i = 0; i < trafficLightPositions.length; i++) {
    const tl = trafficLightPositions[i];
    dummy.position.set(tl.x, 0.22, tl.z);
    dummy.rotation.set(0, tl.rot, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    tlPostInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tl.x, 5.8, tl.z);
    dummy.updateMatrix();
    tlBoxInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tl.x, 5.8, tl.z);
    dummy.updateMatrix();
    tlLampInst.setMatrixAt(i, dummy.matrix);
    colorObj.setHex(0x4cff88);
    tlLampInst.setColorAt(i, colorObj);
  }
  tlLampInst.instanceColor.needsUpdate = true;
  group.add(tlPostInst, tlBoxInst, tlLampInst);

  // Distant silhouette skyline ring on the west and north edges for dramatic depth
  const skylineCount = 44;
  const skylineMat = new THREE.MeshLambertMaterial({
    color: 0x3b3556,
    emissive: 0x2c1f3f,
    emissiveIntensity: 0.45,
  });
  const skylineInst = new THREE.InstancedMesh(unitBox, skylineMat, skylineCount);
  for (let i = 0; i < skylineCount; i++) {
    const angle = Math.PI * 0.48 + (i / (skylineCount - 1)) * Math.PI * 1.15;
    const dist = rng.range(360, 480);
    const sx = rng.range(18, 38);
    const sz = rng.range(18, 38);
    const sy = rng.range(45, 138);
    dummy.position.set(Math.cos(angle) * dist - 40, sy * 0.5, Math.sin(angle) * dist);
    dummy.rotation.set(0, rng.range(0, Math.PI * 0.5), 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    skylineInst.setMatrixAt(i, dummy.matrix);
  }
  group.add(skylineInst);

  // Garage glowing floor marker pad
  const garagePad = new THREE.Mesh(
    new THREE.RingGeometry(3.2, 4.1, 24),
    new THREE.MeshBasicMaterial({ color: 0x42f2ff, side: THREE.DoubleSide }),
  );
  garagePad.rotation.x = -Math.PI / 2;
  garagePad.position.set(CITY.garagePos.x, 0.28, CITY.garagePos.z);
  group.add(garagePad);

  // Signal helper: true = NS green, false = EW green
  const lightCycle = 14;
  function isNorthSouthGreen(time, col, row) {
    const phase = (time + ((col + row) % 2) * (lightCycle * 0.5)) % lightCycle;
    return phase < lightCycle * 0.5;
  }

  function update(time) {
    // Animate ocean subtle drift
    textures.water.offset.x = (time * 0.015) % 1;
    textures.water.offset.y = (time * 0.022) % 1;

    // Update traffic light colors
    for (let i = 0; i < trafficLightPositions.length; i++) {
      const tl = trafficLightPositions[i];
      const nsGreen = isNorthSouthGreen(time, tl.interCol, tl.interRow);
      colorObj.setHex(nsGreen ? 0x42ff88 : 0xff4558);
      tlLampInst.setColorAt(i, colorObj);
    }
    tlLampInst.instanceColor.needsUpdate = true;
  }

  function resolveCircleCollisions(pos, radius) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        if (distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          pos.x += (dx / dist) * push;
          pos.z += (dz / dist) * push;
        } else {
          // Inside box: push out along nearest face
          const dl = Math.abs(pos.x - c.minX);
          const dr = Math.abs(c.maxX - pos.x);
          const dt = Math.abs(pos.z - c.minZ);
          const db = Math.abs(c.maxZ - pos.z);
          const m = Math.min(dl, dr, dt, db);
          if (m === dl) pos.x = c.minX - radius;
          else if (m === dr) pos.x = c.maxX + radius;
          else if (m === dt) pos.z = c.minZ - radius;
          else pos.z = c.maxZ + radius;
        }
        return true;
      }
    }
    // World bounds (keep out of deep ocean and far perimeter)
    let hitBound = false;
    if (pos.x > CITY.waterStartX - 2) { pos.x = CITY.waterStartX - 2; hitBound = true; }
    if (pos.x < -CITY.halfSpanX - 18) { pos.x = -CITY.halfSpanX - 18; hitBound = true; }
    if (pos.z > CITY.halfSpanZ + 18) { pos.z = CITY.halfSpanZ + 18; hitBound = true; }
    if (pos.z < -CITY.halfSpanZ - 18) { pos.z = -CITY.halfSpanZ - 18; hitBound = true; }
    return hitBound;
  }

  return {
    group,
    roadCentersX,
    roadCentersZ,
    blocks,
    intersections,
    colliders,
    sidewalkRects,
    dockCovers,
    isNorthSouthGreen,
    resolveCircleCollisions,
    update,
  };
}
