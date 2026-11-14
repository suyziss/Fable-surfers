import * as THREE from '../vendor/three.module.js';

// A small, purpose-built toy-character rig. Geometry and materials are shared by
// every instance; animation only changes joint transforms.
const G = new Map();
const M = new Map();
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;

function material(color, roughness = .72, metalness = 0, emissive = 0) {
  const key = `${color}/${roughness}/${metalness}/${emissive}`;
  if (!M.has(key)) M.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: emissive ? 1.2 : 0 }));
  return M.get(key);
}
const palette = {
  coral: material(0xff624f), coralDark: material(0xd23b41),
  cyan: material(0x23d1c0), cyanDark: material(0x118f97),
  cream: material(0xfff0cd), white: material(0xfffcf2),
  navy: material(0x202e4c), navyLight: material(0x354969),
  skin: material(0xdca476), skinDark: material(0xbf805e),
  hair: material(0x362724), ink: material(0x151f32),
  gold: material(0xffd867, .4, .3), silver: material(0xc4deea, .35, .45),
  blue: material(0x527cac), blueDark: material(0x253e66),
  glow: material(0x5effe6, .3, .2, 0x19e6c1),
};

function geometry(key, make) {
  if (!G.has(key)) G.set(key, make());
  return G.get(key);
}
function roundedGeometry(w, h, d, r = .035) {
  r = Math.min(r, w * .4, h * .4, d * .4);
  return geometry(`r${w},${h},${d},${r}`, () => {
    const x = -w / 2 + r, y = -h / 2 + r, ww = w - r * 2, hh = h - r * 2;
    const s = new THREE.Shape();
    const q = Math.min(r, ww * .25, hh * .25);
    s.moveTo(x + q, y);
    s.lineTo(x + ww - q, y); s.quadraticCurveTo(x + ww, y, x + ww, y + q);
    s.lineTo(x + ww, y + hh - q); s.quadraticCurveTo(x + ww, y + hh, x + ww - q, y + hh);
    s.lineTo(x + q, y + hh); s.quadraticCurveTo(x, y + hh, x, y + hh - q);
    s.lineTo(x, y + q); s.quadraticCurveTo(x, y, x + q, y);
    const result = new THREE.ExtrudeGeometry(s, { depth: Math.max(.001, d - r * 2), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 3, steps: 1 });
    result.translate(0, 0, -d / 2 + r);
    return result;
  });
}
function mesh(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}
function box(parent, size, mat, pos = [0, 0, 0], r = .035) {
  return mesh(parent, roundedGeometry(...size, r), mat, ...pos);
}
function sphere(parent, size, mat, pos = [0, 0, 0]) {
  const m = mesh(parent, geometry('sphere', () => new THREE.SphereGeometry(1, 12, 10)), mat, ...pos);
  m.scale.set(...size); return m;
}
function capsule(parent, radius, length, mat, pos = [0, 0, 0]) {
  return mesh(parent, geometry(`c${radius},${length}`, () => new THREE.CapsuleGeometry(radius, Math.max(.001, length - radius * 2), 3, 8)), mat, ...pos);
}
function pivot(parent, x, y, z) {
  const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p;
}
function disk(parent, radius, depth, mat, pos, rot = [Math.PI / 2, 0, 0]) {
  const m = mesh(parent, geometry(`d${radius},${depth}`, () => new THREE.CylinderGeometry(radius, radius, depth, 16)), mat, ...pos);
  m.rotation.set(...rot); return m;
}

function sneaker(parent, guard = false) {
  const shoe = pivot(parent, 0, -.025, -.064);
  box(shoe, [.21, .095, .35], guard ? palette.ink : palette.white, [0, -.015, -.015], .038);
  box(shoe, [.185, .135, .27], guard ? palette.blueDark : palette.coral, [0, .045, .004], .048);
  box(shoe, [.19, .065, .135], guard ? palette.ink : palette.cream, [0, .024, -.113], .025);
  if (!guard) {
    box(shoe, [.18, .045, .045], palette.cyan, [0, .07, .137], .013);
    for (let i = 0; i < 3; i++) box(shoe, [.115, .012, .016], palette.white, [0, .118, -.063 + i * .035], .004);
    box(shoe, [.216, .025, .16], palette.cyanDark, [0, -.035, .046], .009);
  }
  return shoe;
}

function makeLeg(parent, side, guard) {
  const hip = pivot(parent, side * (guard ? .15 : .137), 0, 0);
  capsule(hip, guard ? .13 : .114, .39, guard ? palette.blueDark : palette.navy, [0, -.16, 0]);
  // Sewn outer seams make the dark trousers readable from the chase camera.
  box(hip, [.023, .235, .045], guard ? palette.blue : palette.navyLight, [side * .108, -.175, .018], .008);
  const knee = pivot(hip, 0, -.365, 0);
  capsule(knee, guard ? .103 : .094, .365, guard ? palette.blueDark : palette.navy, [0, -.164, 0]);
  capsule(knee, .099, .1, guard ? palette.blueDark : palette.navyLight, [0, -.295, 0]);
  if (!guard) capsule(knee, .073, .10, palette.cream, [0, -.343, 0]);
  const ankle = pivot(knee, 0, -.367, 0);
  sneaker(ankle, guard);
  return { hip, knee, ankle };
}

function makeArm(parent, side, guard) {
  const shoulder = pivot(parent, side * (guard ? .34 : .296), .425, 0);
  capsule(shoulder, guard ? .117 : .108, .29, guard ? palette.blue : palette.coral, [side * .018, -.105, 0]);
  if (guard) box(shoulder, [.07, .12, .035], palette.gold, [side * .086, -.055, .016], .015);
  const elbow = pivot(shoulder, side * .016, -.255, 0);
  capsule(elbow, .084, .25, guard ? palette.blue : palette.coral, [0, -.102, 0]);
  capsule(elbow, .087, .072, guard ? palette.blueDark : palette.cream, [0, -.204, 0]);
  const hand = sphere(elbow, [.083, .11, .079], palette.skin, [0, -.268, -.006]);
  sphere(elbow, [.039, .052, .044], palette.skinDark, [-side * .058, -.251, -.051]);
  shoulder.rotation.z = side * .07;
  return { shoulder, elbow, hand };
}

function makeHead(parent, guard) {
  const head = pivot(parent, 0, .664, -.014);
  box(head, [guard ? .435 : .405, .397, .344], palette.skin, [0, 0, 0], .094);
  sphere(head, [.056, .087, .064], palette.skin, [-.208, -.014, .006]);
  sphere(head, [.056, .087, .064], palette.skin, [.208, -.014, .006]);
  box(head, [.31, .15, .058], palette.hair, [0, .083, .158], .022);
  // A clearly drawn face also reads in the opening and caught-camera shots.
  for (const side of [-1, 1]) {
    const eyeX = side * .087;
    sphere(head, [.058, .058, .025], palette.white, [eyeX, .025, -.176]);
    sphere(head, [.025, .034, .013], palette.ink, [eyeX - side * .006, .02, -.198]);
    sphere(head, [.007, .009, .005], palette.white, [eyeX - .008, .032, -.21]);
    const brow = box(head, [.096, .027, .023], palette.hair, [eyeX, .101, -.177], .008);
    brow.rotation.z = side * (guard ? -.12 : .09);
    sphere(head, [.043, .016, .012], palette.skinDark, [side * .128, -.058, -.18]);
  }
  sphere(head, [.046, .05, .055], palette.skin, [0, -.037, -.183]);
  if (guard) {
    box(head, [.172, .042, .029], palette.hair, [0, -.098, -.186], .016);
    box(head, [.088, .015, .012], palette.skinDark, [0, -.129, -.187], .003);
  } else {
    const grin = box(head, [.115, .039, .018], palette.cream, [.013, -.113, -.175], .011);
    grin.rotation.z = -.08;
    for (const side of [-1, 1]) sphere(head, [.06, .078, .065], palette.hair, [side * .147, .126, -.132]);
  }
  const cap = pivot(head, 0, .16, .012);
  const dome = mesh(cap, geometry('cap', () => new THREE.SphereGeometry(.238, 16, 10, 0, TAU, 0, Math.PI / 2)), guard ? palette.blueDark : palette.cream, 0, 0, 0);
  dome.scale.set(1, .58, .91);
  disk(cap, .237, .033, guard ? palette.blueDark : palette.coral, [0, .003, 0], [0, 0, 0]).scale.z = .91;
  box(cap, [.345, .043, .218], guard ? palette.ink : palette.coral, [0, -.014, -.198], .028);
  box(cap, [.09, .043, .028], guard ? palette.gold : palette.cyanDark, [0, .038, .206], .008);
  if (guard) disk(cap, .051, .018, palette.gold, [0, .059, -.199]);
  else {
    sphere(cap, [.027, .018, .027], palette.coral, [0, .139, 0]);
    box(cap, [.064, .052, .025], palette.cyan, [0, .051, -.206], .012);
  }
  return head;
}

function makeBackpack(spine) {
  // Raised piping, a contrasting pocket and tiny pull tabs remain legible at
  // gameplay distance and give the rear silhouette a recognisable identity.
  const pack = pivot(spine, 0, .285, .204);
  box(pack, [.405, .445, .2], palette.cyanDark, [0, 0, 0], .072);
  box(pack, [.364, .405, .14], palette.cyan, [0, .011, .064], .063);
  box(pack, [.297, .18, .075], palette.coral, [0, -.105, .148], .033);
  box(pack, [.264, .014, .023], palette.cream, [0, -.044, .189], .004);
  box(pack, [.019, .053, .02], palette.gold, [.095, -.065, .205], .004);
  box(pack, [.045, .095, .025], palette.cream, [0, .12, .143], .012);
  // Bolt-shaped custom badge, built as solid flat geometry.
  const boltShape = new THREE.Shape();
  boltShape.moveTo(.015, .082); boltShape.lineTo(-.062, -.009);
  boltShape.lineTo(-.013, -.009); boltShape.lineTo(-.028, -.08);
  boltShape.lineTo(.06, .017); boltShape.lineTo(.008, .017); boltShape.closePath();
  const bolt = mesh(pack, geometry('bolt', () => new THREE.ShapeGeometry(boltShape)), palette.cream, 0, .048, .145);
  box(pack, [.104, .035, .055], palette.navy, [0, .246, -.017], .013);
  for (const side of [-1, 1]) {
    const strap = box(spine, [.051, .435, .043], palette.cyanDark, [side * .162, .28, -.163], .018);
    strap.rotation.z = -side * .10;
    box(spine, [.067, .06, .017], palette.gold, [side * .165, .162, -.192], .008);
  }
  return pack;
}

function makeBoard(group) {
  const board = pivot(group, 0, .078, -.015);
  board.visible = false;
  box(board, [.57, .079, 1.12], palette.cyan, [0, 0, 0], .029);
  box(board, [.515, .041, 1.02], palette.navy, [0, .052, 0], .016);
  box(board, [.45, .021, .235], palette.coral, [0, .079, -.365], .008);
  box(board, [.455, .019, .21], palette.coral, [0, .079, .371], .007);
  box(board, [.057, .019, .775], palette.cream, [0, .081, -.009], .006);
  for (const side of [-1, 1]) {
    box(board, [.023, .023, .88], palette.glow, [side * .263, -.025, 0], .007);
    box(board, [.11, .088, .15], palette.navy, [side * .17, -.065, .37], .025);
    disk(board, .04, .023, palette.glow, [side * .17, -.066, .456]);
  }
  const jets = [];
  const jetMat = new THREE.MeshBasicMaterial({ color: 0x75fff0, transparent: true, opacity: .58, depthWrite: false });
  for (const side of [-1, 1]) {
    const j = sphere(board, [.04, .035, .21], jetMat, [side * .17, -.067, .61]);
    j.castShadow = false; j.receiveShadow = false; jets.push(j);
  }
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x2dffe1, transparent: true, opacity: .20, depthWrite: false });
  const ring = mesh(board, geometry('board-ring', () => new THREE.TorusGeometry(.30, .017, 5, 36)), ringMat, 0, -.059, 0);
  ring.rotation.x = Math.PI / 2; ring.scale.set(.87, 1.65, 1); ring.castShadow = false;
  return { group: board, jets, ring };
}

function build(guard = false) {
  const group = new THREE.Group();
  group.name = guard ? 'Metro guard' : 'Kai — rail runner';
  const hips = pivot(group, 0, .87, 0);
  const spine = pivot(hips, 0, 0, 0);
  box(spine, [guard ? .57 : .49, .485, .33], guard ? palette.blue : palette.coral, [0, .279, 0], .074);
  box(spine, [guard ? .53 : .47, .085, .325], guard ? palette.blueDark : palette.coralDark, [0, .035, 0], .024);
  capsule(spine, .074, .15, palette.skin, [0, .525, -.012]);
  if (guard) {
    box(spine, [.50, .055, .345], palette.ink, [0, .05, 0], .017);
    box(spine, [.074, .063, .025], palette.gold, [0, .05, -.18], .012);
    for (const side of [-1, 1]) {
      box(spine, [.141, .106, .02], palette.blueDark, [side * .135, .34, -.171], .014);
      box(spine, [.12, .02, .028], palette.gold, [side * .135, .388, -.182], .004);
    }
    box(spine, [.022, .365, .024], palette.blueDark, [0, .283, -.174], .006);
    disk(spine, .04, .014, palette.gold, [-.14, .377, -.194]);
    box(spine, [.08, .15, .052], palette.ink, [.17, .34, .184], .012);
    box(spine, [.015, .105, .017], palette.ink, [.181, .452, .185], .006);
    // Back identification stripe, readable while the guard follows the runner.
    box(spine, [.352, .072, .022], palette.cream, [0, .378, .175], .013);
    for (let i = 0; i < 4; i++) box(spine, [.038, .041, .013], palette.blueDark, [-.095 + i * .065, .378, .194], .005);
  } else {
    // Shirt, collar, hood and two drawstrings.
    box(spine, [.21, .315, .028], palette.cream, [0, .229, -.179], .022);
    for (const side of [-1, 1]) {
      const panel = box(spine, [.16, .395, .042], palette.coral, [side * .16, .286, -.169], .035);
      panel.rotation.z = side * .04;
      capsule(spine, .010, .123, palette.cream, [side * .052, .382, -.202]);
      sphere(spine, [.014, .017, .013], palette.cyanDark, [side * .052, .314, -.202]);
    }
    sphere(spine, [.247, .118, .135], palette.coralDark, [0, .473, .076]);
    box(spine, [.115, .05, .023], palette.cyanDark, [0, .245, -.203], .009);
    makeBackpack(spine);
  }
  const head = makeHead(spine, guard);
  const legs = [-1, 1].map(side => makeLeg(hips, side, guard));
  const arms = [-1, 1].map(side => makeArm(spine, side, guard));
  const board = guard ? null : makeBoard(group);
  group.userData.character = true;
  return { group, hips, spine, head, legs, arms, board };
}

function animator(rig, guard) {
  let phase = 0, elapsed = 0, slide = 0, jump = 0, dead = 0, hover = 0, run = 0;
  let boardEnabled = false;
  const damp = (a, b, dt, rate = 16) => a + (b - a) * (1 - Math.exp(-Math.min(dt, .1) * rate));
  function setBoard(active) { boardEnabled = !!active; if (rig.board) rig.board.group.visible = boardEnabled; }
  function update(dt = .016, state = {}) {
    dt = clamp(Number.isFinite(dt) ? dt : .016, 0, .1);
    elapsed += dt;
    const speed = Math.max(0, state.speed ?? 18);
    phase += dt * (guard ? 10.8 : 11.6) * clamp(.77 + speed / 48, .9, 1.65);
    run = damp(run, state.running ? 1 : 0, dt, 9);
    slide = damp(slide, state.sliding ? 1 : 0, dt, 24);
    jump = damp(jump, state.jumping ? 1 : 0, dt, 16);
    dead = damp(dead, state.dead ? 1 : 0, dt, 12);
    if ('board' in state && !guard) setBoard(state.board);
    hover = damp(hover, boardEnabled ? 1 : 0, dt, 14);
    const walking = run * (1 - slide) * (1 - jump) * (1 - dead) * (1 - hover);
    const lean = clamp(state.laneLean || 0, -1, 1);
    const idle = Math.sin(elapsed * 2.3) * .008 * (1 - run);
    const landing = clamp(state.landing || 0, 0, 1);
    rig.hips.position.y = .87 + Math.abs(Math.sin(phase)) * .042 * walking + idle - slide * .50 + hover * .13 - landing * .045 - dead * .24;
    rig.hips.position.z = slide * .025 + dead * .11;
    rig.hips.rotation.set(0, Math.sin(phase) * .045 * walking - hover * .20, -lean * .115 + dead * .35);
    rig.spine.rotation.set(-.115 * run - 1.425 * slide + .13 * jump - dead * .37, Math.sin(phase) * .045 * walking, -Math.sin(phase) * .027 * walking - lean * .055);
    rig.head.rotation.set(.07 * run + slide * .38 - jump * .09 + dead * .21, -Math.sin(phase) * .033 * walking, Math.sin(elapsed * 1.3) * .012 * (1 - run));
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const cyc = Math.sin(phase + i * Math.PI);
      const leg = rig.legs[i];
      const arm = rig.arms[i];
      leg.hip.rotation.x = cyc * .85 * walking + jump * (i ? .44 : .72) + slide * (i ? 1.48 : 1.42) + hover * .16 + dead * .61;
      leg.hip.rotation.z = side * (.023 + hover * .12 + dead * .13);
      leg.knee.rotation.x = -Math.max(0, -cyc) * 1.30 * walking - jump * (i ? .78 : 1.15) - slide * 2.53 - hover * .38 - dead * .92;
      leg.ankle.rotation.x = -.16 * cyc * walking + slide * .84 + hover * .2;
      arm.shoulder.rotation.x = -cyc * .78 * walking + jump * (i ? .66 : .95) - slide * .34 + hover * .18 + dead * 1.08;
      arm.shoulder.rotation.z = side * (.07 + jump * .30 + hover * .43 + dead * .23);
      arm.elbow.rotation.x = .29 + Math.max(0, -cyc) * .75 * walking + jump * .51 + slide * 1.47 + hover * .21 + dead * .23;
      arm.elbow.rotation.z = side * hover * .17;
    }
    if (rig.board && boardEnabled) {
      rig.board.group.position.y = .075 + Math.sin(elapsed * 8) * .01;
      rig.board.group.rotation.set(Math.sin(elapsed * 4.1) * .014, -hover * .12, -lean * .13);
      rig.board.jets.forEach((jet, i) => { jet.scale.z = .19 + Math.sin(elapsed * 36 + i) * .044 + speed * .002; });
      rig.board.ring.material.opacity = .15 + Math.sin(elapsed * 6) * .045;
    }
  }
  update(1 / 60, {});
  return { group: rig.group, update, setBoard };
}

export function createRunner() { return animator(build(false), false); }
export function createGuard() { return animator(build(true), true); }

