import * as THREE from '../vendor/three.module.js';

// A deliberately small material vocabulary keeps the whole city feeling hand-painted.
const PALETTE = {
  navy: 0x18364f, deep: 0x102c40, blue: 0x477b9b, teal: 0x27b5b8,
  mint: 0x93d9cf, coral: 0xf07669, salmon: 0xf6a18b, ochre: 0xf5c45d,
  cream: 0xffe8c7, white: 0xfff9ec, asphalt: 0x687986, stone: 0x9ea7a3,
  rail: 0xb0bbc0, wood: 0x735b50, green: 0x379d74, leaf: 0x68c381,
};
const materials = new Map();
const geometry = new Map();
const textures = new Map();
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
const unitSphere = new THREE.IcosahedronGeometry(1, 1);
const unitPlane = new THREE.PlaneGeometry(1, 1);
const dummy = new THREE.Object3D();

function mat(color, roughness = 0.76, metalness = 0) {
  const key = `${color}/${roughness}/${metalness}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  return materials.get(key);
}
function glow(color, intensity = 0.8) {
  const key = `glow-${color}-${intensity}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.3 }));
  return materials.get(key);
}
function box(group, sx, sy, sz, x, y, z, material, rz = 0) {
  const mesh = new THREE.Mesh(unitBox, material);
  mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.rotation.z = rz;
  mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
}
function cyl(group, radius, height, x, y, z, material, rz = 0) {
  const mesh = new THREE.Mesh(unitCylinder, material);
  mesh.position.set(x, y, z); mesh.scale.set(radius, height, radius); mesh.rotation.z = rz;
  mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
}
function plane(group, sx, sy, x, y, z, material, ry = 0) {
  const mesh = new THREE.Mesh(unitPlane, material);
  mesh.position.set(x, y, z); mesh.scale.set(sx, sy, 1); mesh.rotation.y = ry;
  group.add(mesh); return mesh;
}
function seeded(seed) {
  let a = (seed * 1664525 + 1013904223) >>> 0;
  return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return (a >>> 0) / 4294967296; };
}

// All the little sleepers, windows, sills and railings share a handful of draw calls.
class Batch {
  constructor(group) { this.group = group; this.batches = new Map(); }
  add(geo, material, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    const key = `${geo.uuid}/${material.uuid}`;
    if (!this.batches.has(key)) this.batches.set(key, { geo, material, matrices: [] });
    dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(rx, ry, rz); dummy.updateMatrix();
    this.batches.get(key).matrices.push(dummy.matrix.clone());
  }
  box(material, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) { this.add(unitBox, material, x, y, z, sx, sy, sz, rx, ry, rz); }
  cylinder(material, x, y, z, radius, height, rz = 0) { this.add(unitCylinder, material, x, y, z, radius, height, radius, 0, 0, rz); }
  sphere(material, x, y, z, sx, sy = sx, sz = sx) { this.add(unitSphere, material, x, y, z, sx, sy, sz); }
  finish() {
    for (const { geo, material, matrices } of this.batches.values()) {
      const mesh = new THREE.InstancedMesh(geo, material, matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.computeBoundingSphere(); this.group.add(mesh);
    }
  }
}

function canvasTexture(key, width, height, draw) {
  if (textures.has(key)) return textures.get(key);
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4; textures.set(key, texture); return texture;
}
function decalMaterial(key, texture) {
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  return materials.get(key);
}
function label(text, background = '#18364f', foreground = '#fff2d3', key = text) {
  return canvasTexture(`label-${key}-${background}`, 512, 128, (c, w, h) => {
    c.fillStyle = background; c.fillRect(0, 0, w, h);
    c.strokeStyle = foreground; c.lineWidth = 4; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = foreground; c.font = '900 63px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, w / 2, h / 2 + 3, w - 44);
  });
}
function graffiti(variant = 0) {
  return canvasTexture(`graffiti-${variant}`, 1024, 384, (c, w, h) => {
    const random = seeded(31 + variant * 711);
    const colors = ['#ffca57', '#64e5d1', '#ff7088', '#aeb7fa'];
    const words = ['RUSH', 'WILD', 'FLOW', 'SUNSET', 'FRESH'];
    for (let i = 0; i < 65; i++) {
      c.globalAlpha = .25 + random() * .35; c.fillStyle = colors[(i + variant) % 4];
      c.beginPath(); c.arc(70 + random() * 875, 50 + random() * 280, 4 + random() * 29, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1; c.save(); c.translate(w / 2, h / 2); c.rotate(-.055); c.transform(1, 0, -.14, 1, 0, 0);
    const word = words[variant % words.length];
    c.font = `900 ${word.length > 4 ? 228 : 274}px Arial`; c.lineJoin = 'round'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.strokeStyle = '#153146'; c.lineWidth = 31; c.strokeText(word, 0, 4, 855);
    c.strokeStyle = '#fff0d2'; c.lineWidth = 16; c.strokeText(word, 0, 0, 855);
    const gradient = c.createLinearGradient(0, -120, 0, 140); gradient.addColorStop(0, colors[variant % 4]); gradient.addColorStop(.5, '#fdf4d5'); gradient.addColorStop(.52, colors[(variant + 1) % 4]); gradient.addColorStop(1, colors[(variant + 2) % 4]);
    c.fillStyle = gradient; c.fillText(word, 0, 0, 855);
    c.strokeStyle = '#153146'; c.lineWidth = 3; c.strokeText(word, 0, 0, 855);
    c.restore();
    c.strokeStyle = '#fff5dc'; c.lineWidth = 5; c.beginPath(); c.moveTo(100, 340); c.quadraticCurveTo(560, 280, 917, 327); c.stroke();
  });
}
function warningTexture() {
  return canvasTexture('warning', 512, 256, (c, w, h) => {
    c.fillStyle = '#ffd064'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#26394a';
    for (let x = -256; x < 700; x += 128) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 65, 0); c.lineTo(x + 320, h); c.lineTo(x + 255, h); c.closePath(); c.fill(); }
    c.strokeStyle = '#ffe9ae'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
  });
}
function signMaterial(text, bg, fg) {
  const key = `sign-${text}-${bg}-${fg}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ map: label(text, bg, fg), roughness: .8, emissive: 0xffffff, emissiveIntensity: .06 }));
  return materials.get(key);
}
function roundedSection(width, height, radius, depth) {
  const key = `round-${width}-${height}-${depth}`;
  if (!geometry.has(key)) {
    const x = -width / 2, y = 0, shape = new THREE.Shape();
    shape.moveTo(x + radius, y); shape.lineTo(x + width - radius, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + height - radius); shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    shape.lineTo(x + radius, y + height); shape.quadraticCurveTo(x, y + height, x, y + height - radius);
    shape.lineTo(x, y + radius); shape.quadraticCurveTo(x, y, x + radius, y);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .05, bevelThickness: .05, curveSegments: 4 });
    geo.translate(0, 0, -depth / 2); geometry.set(key, geo);
  }
  return geometry.get(key);
}

export function createTrain(length = 15, variant = 0) {
  const group = new THREE.Group(); group.name = 'Metro carriage';
  const v = Math.abs(variant) % 4;
  const colors = [PALETTE.teal, PALETTE.coral, PALETTE.ochre, 0x7298cf];
  const color = mat(colors[v], .43, .12), navy = mat(PALETTE.navy, .52, .2);
  const cream = mat(PALETTE.cream, .49, .08), steel = mat(0x91a9b2, .37, .68);
  const glass = mat(0x193e56, .16, .36), highlight = mat(0x70bccb, .3, .2);
  const body = new THREE.Mesh(roundedSection(2.62, 2.63, .38, length - .12), color);
  body.position.y = .39; body.castShadow = true; body.receiveShadow = true; group.add(body);
  box(group, 2.45, .23, length - .65, 0, .34, 0, navy);
  const roof = new THREE.Mesh(roundedSection(2.47, .3, .14, length - .35), cream); roof.position.y = 2.8; roof.castShadow = true; group.add(roof);
  const batch = new Batch(group);
  // Low skirts, double waist stripe, doors and framed windows are visible from the roof too.
  for (const side of [-1, 1]) {
    batch.box(cream, side * 1.319, 1.16, 0, .025, .17, length - .43);
    batch.box(navy, side * 1.321, .96, 0, .03, .055, length - .55);
    batch.box(navy, side * 1.23, .49, 0, .08, .22, length - .5);
    const windows = Math.max(4, Math.floor((length - 1.4) / 1.55));
    for (let i = 0; i < windows; i++) {
      const z = -length / 2 + 1.15 + i * (length - 2.3) / (windows - 1);
      if (i === 2 || i === windows - 3) {
        batch.box(cream, side * 1.323, 1.75, z, .035, 1.83, 1.13);
        batch.box(navy, side * 1.347, 1.74, z, .026, 1.72, 1.01);
        batch.box(color, side * 1.365, 1.7, z, .025, 1.55, .92);
        for (const dz of [-.255, .255]) {
          batch.box(glass, side * 1.381, 2.12, z + dz, .027, .68, .36);
          batch.box(highlight, side * 1.397, 2.36, z + dz - .09, .012, .12, .11);
          batch.box(steel, side * 1.389, 1.46, z + dz * .35, .04, .19, .025);
        }
        batch.box(steel, side * 1.39, 1.72, z, .02, 1.6, .024);
      } else {
        batch.box(cream, side * 1.325, 2.12, z, .036, 1.03, 1.15);
        batch.box(navy, side * 1.351, 2.12, z, .035, .94, 1.06);
        batch.box(glass, side * 1.373, 2.13, z, .025, .78, .9);
        batch.box(highlight, side * 1.389, 2.39, z - .26, .012, .12, .26);
        batch.box(steel, side * 1.39, 1.88, z, .018, .023, .94);
      }
    }
    for (const z of [-length * .32, length * .32]) {
      batch.box(navy, side * .99, .27, z, .3, .31, 1.95);
      for (const dz of [-.61, .61]) {
        batch.cylinder(mat(0x253444, .6, .35), side * 1.15, .22, z + dz, .32, .18, Math.PI / 2);
        batch.cylinder(steel, side * 1.251, .22, z + dz, .15, .025, Math.PI / 2);
      }
    }
    if (length >= 8) {
      const deco = decalMaterial(`graffiti-mat-${v}`, graffiti(v));
      plane(group, length * .42, .74, side * 1.397, .83, length * -.14, deco, side * Math.PI / 2);
    }
  }
  for (const end of [-1, 1]) {
    const z = end * (length / 2 + .002);
    box(group, 2.04, 1.15, .045, 0, 2.14, z, navy);
    box(group, 1.84, .93, .047, 0, 2.16, z + end * .027, glass);
    box(group, .072, .99, .058, 0, 2.16, z + end * .055, cream);
    box(group, 1.66, .13, .018, 0, 2.51, z + end * .061, highlight);
    box(group, 2.17, .22, .044, 0, 1.24, z + end * .025, cream);
    box(group, 2.0, .17, .13, 0, .63, z, navy);
    box(group, .39, .2, .39, 0, .37, z + end * .14, steel);
    for (const x of [-.92, .92]) {
      box(group, .35, .25, .065, x, 1.47, z + end * .029, navy);
      box(group, .23, .12, .07, x, 1.48, z + end * .064, glow(end > 0 ? 0xfff2b1 : 0xff4d55, 1.05));
      box(group, .11, .075, .035, x, 1.01, z + end * .043, glow(0xff7959, .45));
    }
    const route = signMaterial(`0${v + 1}  SUNSET`, '#132e40', '#ffde7c');
    plane(group, 1.29, .2, 0, 2.77, z + end * .07, route, end < 0 ? Math.PI : 0);
    // Twin windshield wipers.
    box(group, .032, .42, .025, -.4, 1.96, z + end * .063, navy, -.49);
    box(group, .032, .42, .025, .42, 1.96, z + end * .063, navy, -.49);
  }
  for (const z of [-length * .25, length * .25]) {
    batch.box(steel, 0, 3.09, z, 1.48, .105, 1.65);
    for (let i = 0; i < 7; i++) batch.box(navy, 0, 3.15, z - .63 + i * .21, 1.23, .018, .065);
  }
  batch.finish(); return group;
}

export function createBarrier(type) {
  const group = new THREE.Group(); group.name = `Obstacle: ${type}`;
  const navy = mat(PALETTE.navy), yellow = mat(PALETTE.ochre), cream = mat(PALETTE.white);
  const stripe = decalMaterial('warning-mat', warningTexture());
  if (type === 'low') {
    for (const x of [-1.05, 1.05]) {
      box(group, .19, .77, .25, x, .385, 0, navy);
      box(group, .48, .085, .71, x, .042, 0, navy);
      cyl(group, .075, .075, x, .87, 0, glow(0xffc966, .8));
    }
    box(group, 2.49, .43, .35, 0, .62, 0, yellow);
    for (const side of [-1, 1]) plane(group, 2.35, .35, 0, .62, side * .179, stripe, side < 0 ? Math.PI : 0);
    for (const x of [-.96, .96]) box(group, .11, .16, .017, x, .62, .196, cream);
  } else if (type === 'high') {
    for (const x of [-1.21, 1.21]) {
      box(group, .2, 2.53, .29, x, 1.265, 0, navy);
      box(group, .39, .1, .62, x, .05, 0, navy);
      box(group, .21, .69, .31, x, .61, 0, yellow);
      cyl(group, .085, .16, x, 2.61, 0, glow(0xffcd68, .8));
    }
    box(group, 2.57, .17, .38, 0, 2.47, 0, yellow);
    box(group, 2.31, 1.18, .31, 0, 1.69, 0, mat(PALETTE.coral));
    for (const side of [-1, 1]) {
      plane(group, 2.29, .21, 0, 1.21, side * .161, stripe, side < 0 ? Math.PI : 0);
      plane(group, 1.86, .46, 0, 1.83, side * .162, signMaterial('SLIDE  ↓', '#f07669', '#fff4db'), side < 0 ? Math.PI : 0);
    }
    box(group, 2.35, .12, .4, 0, 1.11, 0, navy);
  } else {
    const red = mat(0xda665c);
    box(group, 2.49, 2.63, .81, 0, 1.315, 0, red);
    box(group, 2.62, .12, .93, 0, 2.66, 0, navy);
    for (const x of [-1.11, 1.11]) box(group, .13, 2.58, .91, x, 1.29, 0, navy);
    for (let i = 0; i < 5; i++) box(group, 2.17, .04, .022, 0, .36 + i * .47, .42, mat(0xaf4f48));
    for (const side of [-1, 1]) {
      plane(group, 2.17, .3, 0, .57, side * .463, stripe, side < 0 ? Math.PI : 0);
      plane(group, 1.55, .5, 0, 1.75, side * .463, signMaterial('NO ENTRY', '#18364f', '#fff1d0'), side < 0 ? Math.PI : 0);
    }
  }
  return group;
}

export function createRamp(length = 8) {
  const group = new THREE.Group(); group.name = 'Train roof access ramp';
  const half = length / 2, w = 1.325, h = 3.1;
  const key = `ramp-wedge-${length}`;
  if (!geometry.has(key)) {
    const vertices = new Float32Array([
      -w, 0, half, w, 0, half, w, h, -half, -w, 0, half, w, h, -half, -w, h, -half,
      -w, 0, half, -w, h, -half, -w, 0, -half, w, 0, half, w, 0, -half, w, h, -half,
      -w, 0, -half, -w, h, -half, w, h, -half, -w, 0, -half, w, h, -half, w, 0, -half,
    ]);
    const wedge = new THREE.BufferGeometry(); wedge.setAttribute('position', new THREE.BufferAttribute(vertices, 3)); wedge.computeVertexNormals();
    wedge.addGroup(0, 6, 0); wedge.addGroup(6, 12, 1);
    geometry.set(key, wedge);
  }
  const geo = geometry.get(key);
  const mesh = new THREE.Mesh(geo, [mat(0xb2b3a2, .86, .15), mat(PALETTE.navy)]); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  const angle = Math.atan(h / length), slopeLength = Math.hypot(length, h);
  for (const x of [-1.24, 1.24]) {
    const edge = box(group, .14, .065, slopeLength, x, h / 2 + .042, 0, mat(PALETTE.ochre)); edge.rotation.x = angle;
  }
  for (let i = 1; i <= Math.floor(length / .57); i++) {
    const z = half - i * .57, y = ((half - z) / length) * h;
    const rib = box(group, 2.32, .035, .08, 0, y + .035, z, mat(0x657a81, .75, .25)); rib.rotation.x = angle;
  }
  for (const x of [-1.335, 1.335]) {
    for (let i = 1; i < 4; i++) {
      const z = half - (length * i / 4), height = h * i / 4;
      box(group, .035, height, .11, x, height / 2, z, mat(PALETTE.ochre));
    }
  }
  // Arrow painted directly on the inclined deck, visible well before the ramp.
  const arrowTex = canvasTexture('ramp-arrow', 256, 512, (c, width, height) => {
    c.fillStyle = '#fff7d4'; c.beginPath(); c.moveTo(128, 30); c.lineTo(232, 210); c.lineTo(166, 210); c.lineTo(166, 466); c.lineTo(90, 466); c.lineTo(90, 210); c.lineTo(24, 210); c.closePath(); c.fill();
  });
  const arrow = new THREE.Mesh(unitPlane, decalMaterial('ramp-arrow-mat', arrowTex));
  arrow.scale.set(.87, 2.3, 1); arrow.rotation.x = -Math.PI / 2 + angle; arrow.position.set(0, h / 2 + .07, 0); group.add(arrow);
  return group;
}

function addTree(batch, x, z, variation = 0) {
  const y = .3, height = 2.4 + variation * .5;
  batch.cylinder(mat(0x926b53), x, y + height * .5, z, .16, height);
  batch.cylinder(mat(0x926b53), x + .28, y + height * .7, z, .09, 1, -.48);
  const green = mat(PALETTE.green), leaf = mat(PALETTE.leaf), sun = mat(0x99d68c);
  batch.sphere(green, x, y + height + .4, z, 1.03, 1.05, 1.07);
  batch.sphere(leaf, x - .53, y + height + .29, z + .28, .82, .79, .77);
  batch.sphere(leaf, x + .42, y + height + .69, z - .18, .88, .85, .83);
  batch.sphere(sun, x - .27, y + height + 1.04, z + .07, .58, .49, .65);
}

function addPalm(batch, x, z, height = 7) {
  batch.cylinder(mat(0xb99064), x, height / 2, z, .2, height);
  for (let i = 0; i < 9; i++) batch.cylinder(mat(0x9d7858), x, height * .1 + i * height * .086, z, .211, .06);
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7;
    batch.add(unitSphere, mat(i % 2 ? 0x499c69 : 0x64b678), x + Math.sin(angle) * 1.16, height + .1, z + Math.cos(angle) * 1.16, .43, .25, 1.8, -.22, angle, 0);
  }
  batch.sphere(mat(0x277b5b), x, height + .23, z, .52, .48, .5);
}

function addBuilding(group, batch, random, side, z, index, block) {
  const navy = mat(PALETTE.navy), cream = mat(PALETTE.cream), trim = mat(0xf8d9b8);
  const shades = [PALETTE.coral, 0x66b5bd, 0xf2bd6f, 0xd59a9c, 0xa6c8b9, 0xf3d9af];
  const color = mat(shades[(index + block * 2 + (side > 0 ? 1 : 0)) % shades.length]);
  const height = 7.2 + Math.floor(random() * 4) * 2.35;
  const depth = 4.8 + random() * 2.7, width = 10.25 + random() * .5;
  const face = 9.1 + random() * .8, x = side * (face + depth / 2);
  batch.box(color, x, height / 2, z, depth, height, width);
  batch.box(trim, side * (face - .08), .36, z, .23, .71, width + .05);
  batch.box(trim, x, height + .16, z, depth + .4, .28, width + .43);
  batch.box(navy, x, height + .33, z, depth - .2, .095, width - .2);
  batch.box(color, x + side * .75, height + .62, z - 2.5, depth * .56, .7, 3.35);
  const floors = Math.floor((height - 1.1) / 2.25);
  for (let floor = 0; floor < floors; floor++) {
    const y = 1.72 + floor * 2.23;
    if (floor > 0) batch.box(trim, side * (face - .085), y - .95, z, .18, .095, width);
    for (let column = -2; column <= 2; column++) {
      const zz = z + column * 1.96;
      const window = random() > .26 ? mat(0x335b6d, .5, .12) : mat(0xc39a69);
      batch.box(cream, side * (face - .115), y, zz, .12, 1.52, 1.3);
      batch.box(window, side * (face - .19), y + .04, zz, .04, 1.27, 1.05);
      batch.box(mat(0x719caf), side * (face - .218), y + .39, zz - .25, .018, .43, .39);
      batch.box(trim, side * (face - .25), y - .69, zz, .3, .105, 1.4);
      batch.box(cream, side * (face - .228), y + .04, zz, .025, 1.24, .045);
      if ((column + floor + index) % 4 === 0 && floor > 0) {
        batch.box(navy, side * (face - .54), y - .63, zz, .88, .13, 1.75);
        batch.box(navy, side * (face - .98), y - .18, zz, .045, .07, 1.72);
        for (let rail = -2; rail <= 2; rail++) batch.box(navy, side * (face - .98), y - .39, zz + rail * .34, .04, .5, .04);
        batch.box(mat(0xbf7c58), side * (face - .77), y - .43, zz + .47, .29, .3, .47);
        batch.sphere(mat(PALETTE.leaf), side * (face - .77), y - .17, zz + .46, .25, .22, .35);
      }
      if (column === 2 && floor % 2 === 1) {
        batch.box(mat(0xd7ddd2), side * (face - .4), y - .49, zz + .57, .42, .43, .69);
        for (let v = 0; v < 3; v++) batch.box(navy, side * (face - .62), y - .59 + v * .1, zz + .57, .012, .024, .47);
      }
    }
  }
  // Store awnings and a readable neighborhood identity at street level.
  const awning = mat(index % 2 ? 0xe67462 : 0x368f9f);
  batch.box(awning, side * (face - .78), 2.79, z, 1.45, .15, 4.25, 0, 0, side * .12);
  for (let i = -3; i <= 3; i++) batch.box(cream, side * (face - .8), 2.77, z + i * .55, 1.49, .035, .24, 0, 0, side * .12);
  const names = ['SUNSET MARKET', 'VINYL & CO', 'COFFEE CLUB', 'STUDIO 23', 'FRESH DAILY', 'METRO CAFE'];
  plane(group, 3.77, .57, side * (face - .205), 3.31, z, signMaterial(names[(index + block) % names.length], index % 2 ? '#237e88' : '#d46759', '#fff0ce'), -side * Math.PI / 2);
  if ((index + block) % 3 === 0) {
    const roofY = height + 1.05;
    batch.cylinder(mat(0xa47959), x, roofY, z + 2.8, 1.0, 1.57);
    batch.cylinder(navy, x, roofY + .82, z + 2.8, 1.04, .12);
    for (const dx of [-.65, .65]) batch.box(navy, x + dx, height + .24, z + 2.8, .1, .75, .1);
    batch.box(navy, x, roofY + 1.29, z + 2.8, .07, .75, .07);
  } else {
    batch.box(mat(0xb3c5bc), x, height + .59, z + 2.85, 1.6, .7, 1.6);
    for (let i = 0; i < 5; i++) batch.box(navy, x, height + .95, z + 2.25 + i * .3, 1.25, .025, .075);
  }
}

export function createSegment(index = 0) {
  index = ((Math.trunc(index) % 997) + 997) % 997;
  const group = new THREE.Group(); group.name = `Sunset rail district ${index}`;
  const random = seeded(index * 581 + 93), batch = new Batch(group);
  const navy = mat(PALETTE.navy), cream = mat(PALETTE.cream), wood = mat(PALETTE.wood), steel = mat(PALETTE.rail, .38, .7);
  // All recurring pieces end exactly on the segment boundary (36 m).
  batch.box(mat(0xa9b3ac), 0, -.23, 0, 12.1, .44, 36);
  batch.box(mat(0x889594), 0, -.01, 0, 10.72, .04, 36);
  for (const lane of [-3.3, 0, 3.3]) {
    batch.box(mat(0x89928c), lane, .005, 0, 2.35, .065, 36);
    for (let z = -17.6; z < 18; z += .85) {
      batch.box(wood, lane, .055, z, 2.51, .13, .23);
      for (const x of [-.77, .77]) batch.box(mat(0x546574, .7, .35), lane + x, .105, z, .31, .06, .3);
    }
    for (const x of [-.77, .77]) {
      batch.box(steel, lane + x, .155, 0, .13, .13, 36);
      batch.box(mat(0xd9d9c8, .26, .8), lane + x, .22, 0, .16, .025, 36);
    }
  }
  // Loose ballast catches the light without relying on noisy textures.
  const stones = [mat(0x7c8c8e), mat(0xa6ada5), mat(0x929e98)];
  for (let i = 0; i < 83; i++) {
    const x = -5.3 + random() * 10.6, z = -18 + random() * 36;
    batch.sphere(stones[i % 3], x, .04, z, .08 + random() * .08, .055, .09 + random() * .1);
  }
  for (const side of [-1, 1]) {
    batch.box(mat(0xd9c8ac), side * 7.58, .06, 0, 3.45, .36, 36);
    batch.box(mat(0xf2d9b2), side * 5.86, .21, 0, .19, .53, 36);
    // A low retaining wall means scenery is readable and lanes remain unobstructed.
    batch.box(mat(index % 2 ? 0xd89b87 : 0xdfb795), side * 6.36, .55, 0, .36, 1.08, 36);
    batch.box(cream, side * 6.36, 1.115, 0, .46, .12, 36);
    for (let z = -16.5; z < 18; z += 3) {
      batch.box(mat(0xcf9e83), side * 6.13, .53, z, .02, .65, .045);
      batch.box(navy, side * 6.36, 1.58, z, .065, 1.04, .065);
    }
    for (const y of [1.34, 1.9]) batch.box(navy, side * 6.36, y, 0, .045, .045, 36);
    for (let z = -17.5; z < 18; z += .59) batch.box(navy, side * 6.36, 1.61, z, .026, .59, .026);
    for (const z of [-12, 0, 12]) {
      addBuilding(group, batch, random, side, z, index + 10, Math.floor((z + 12) / 12));
    }
    const graffitiVariant = (index + (side > 0 ? 2 : 0)) % 5;
    plane(group, 4.6, .88, side * 6.169, .58, -7 + (index % 3) * 5, decalMaterial(`graffiti-wall-${graffitiVariant}`, graffiti(graffitiVariant)), -side * Math.PI / 2);
    addTree(batch, side * 7.74, -6.2, random());
    addTree(batch, side * 7.67, 7.0, random());
    if (index % 2 === 0) addPalm(batch, side * 8.3, 15.7, 6.3 + random() * 2.1);
    // Benches, litter bins, fire hydrants, crates, drain covers and planters.
    for (const z of [-11, 11.5]) {
      batch.box(mat(0xb97f54), side * 7.33, .72, z, .65, .12, 1.72);
      batch.box(mat(0xb97f54), side * 7.6, 1.0, z, .08, .6, 1.72);
      for (const dz of [-.62, .62]) batch.box(navy, side * 7.31, .39, z + dz, .45, .51, .085);
    }
    batch.cylinder(mat(0x438d90), side * 7.3, .57, 3.0, .3, .83);
    batch.cylinder(navy, side * 7.3, 1.0, 3.0, .33, .085);
    batch.cylinder(mat(PALETTE.coral), side * 7.01, .45, -2.8, .13, .6);
    batch.sphere(mat(PALETTE.coral), side * 7.01, .78, -2.8, .17);
    batch.box(navy, side * 5.48, .045, 8.2, .43, .045, .83);
    for (let i = 0; i < 6; i++) batch.box(steel, side * 5.48, .073, 7.9 + i * .12, .35, .016, .029);
    // Slender warm lamps and colorful pennants frame the railway.
    const poleZ = side > 0 ? -15 : 3;
    batch.cylinder(mat(0x4b6475, .5, .45), side * 5.91, 3.16, poleZ, .077, 6.25);
    batch.box(navy, side * 5.91, .42, poleZ, .26, .82, .27);
    batch.box(navy, side * 5.5, 6.27, poleZ, .97, .09, .11);
    batch.box(mat(PALETTE.ochre), side * 5.06, 6.19, poleZ, .51, .12, .31);
    batch.box(glow(0xffe1a2, .45), side * 5.06, 6.118, poleZ, .37, .015, .23);
    const bannerColor = index % 2 ? '#2d939b' : '#ec826c';
    plane(group, .68, 1.49, side * 5.77, 4.84, poleZ + .05, signMaterial(index % 2 ? 'GO!' : '23', bannerColor, '#fff0ce'));
    // Utility cabinets and cable trunking along the ground.
    batch.box(mat(0x73989e), side * 5.4, .53, -16.1, .62, 1.02, .65);
    batch.box(cream, side * 5.4, .95, -15.766, .31, .13, .013);
    for (let i = 0; i < 4; i++) batch.box(navy, side * 5.4, .4 + i * .11, -15.766, .4, .04, .014);
    batch.box(mat(0x596b6d), side * 5.46, .14, 0, .09, .15, 36);
  }
  // The occasional overhead catenary portal adds a strong sense of forward movement.
  if (index % 2 === 0) {
    const z = -9.5;
    for (const side of [-1, 1]) {
      batch.box(mat(0x6c8892, .56, .3), side * 5.67, 4.1, z, .17, 8.2, .19);
      batch.box(mat(PALETTE.ochre), side * 5.67, .8, z, .19, 1.56, .22);
      batch.box(navy, side * 5.67, 1.1, z, .201, .22, .231);
    }
    batch.box(mat(0x6c8892), 0, 8.11, z, 11.52, .18, .18);
    batch.box(mat(0x6c8892), 0, 7.53, z, 11.35, .12, .12);
    for (let i = -5; i < 6; i++) batch.box(mat(0x6c8892), i, 7.81, z, .07, .66, .065, 0, 0, i % 2 ? .68 : -.68);
    for (const x of [-3.3, 0, 3.3]) {
      batch.box(navy, x, 7.2, z, .045, .75, .045);
      batch.cylinder(mat(0xd5bb91), x, 7.01, z, .14, .24);
    }
  }
  for (const x of [-3.3, 0, 3.3]) batch.box(mat(0x617785), x, 6.87, 0, .018, .018, 36);
  batch.finish(); return group;
}

export function createBackdrop() {
  const group = new THREE.Group(); group.name = 'Hazy seaside skyline';
  const batch = new Batch(group), random = seeded(88);
  // Far scenery uses low contrast so the interactive track reads immediately.
  for (let i = 0; i < 44; i++) {
    const x = (i - 22) * 8.4, height = 12 + random() * 29, depth = 6 + random() * 8;
    batch.box(mat([0xabc4c8, 0xb8cdcb, 0xbacbd4, 0xc3d5cf][i % 4]), x, height / 2 - 2, -155 - random() * 43, 6 + random() * 5, height, depth);
    if (i % 5 === 0) batch.box(mat(0xa8c1c8), x, height - 1, -155 - i, .25, 9, .25);
  }
  const cloud = mat(0xfff4de);
  for (let i = 0; i < 13; i++) {
    const x = -105 + i * 18, y = 36 + random() * 13, z = -124 - random() * 45;
    batch.sphere(cloud, x, y, z, 9, 2.6, 3.5);
    batch.sphere(cloud, x - 3.3, y + 1.3, z, 4.8, 3.1, 3.1);
    batch.sphere(cloud, x + 4, y + .9, z, 5.3, 2.9, 3.2);
  }
  batch.finish(); return group;
}

