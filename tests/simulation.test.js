import assert from 'node:assert/strict';
import { Simulation, STEP, LANE_WIDTH, TRAIN_HEIGHT } from '../js/simulation.js';

// Run with: node tests/simulation.test.js
// These are deterministic gameplay scenarios using the public simulation API.
// No browser, rendering context, network, or third-party test runner is needed.
const results = [];
function test(name, fn) {
  const started = performance.now();
  try {
    fn();
    const ms = Math.round(performance.now() - started);
    console.log(`PASS ${name} (${ms} ms)`);
    results.push({ name, passed: true });
  } catch (error) {
    console.error(`FAIL ${name}: ${error.stack}`);
    results.push({ name, passed: false });
  }
}
function emptyRun(seed = 1234) {
  const sim = new Simulation(seed);
  sim.start(); sim.entities = []; sim.nextChunk = 1e9; sim.events = [];
  return sim;
}
function seconds(sim, duration, onStep) {
  for (let i = 0; i < Math.ceil(duration / STEP); i++) {
    if (sim.mode !== 'running') break;
    sim.update(STEP); onStep?.(sim);
  }
}
function untilDistance(sim, distance, onStep) {
  let frames = 0;
  while (sim.distance < distance && sim.mode === 'running') {
    if (++frames > 2_000_000) throw new Error('Scenario did not reach its distance limit');
    sim.update(STEP); onStep?.(sim);
  }
}
function collisionAt(type, { x = 0, y = 0, slide = 0 } = {}) {
  const sim = emptyRun();
  sim.player.x = x; sim.player.y = y; sim.player.grounded = false; sim.player.slide = slide;
  sim.add(type, 0, 0, { length: .7 });
  sim.update(0);
  return sim.mode === 'dead';
}
const obstacles = new Set(['train', 'block', 'low', 'high', 'ramp']);
function openLane(sim, chunk) {
  const base = chunk * 96;
  const occupied = new Set(sim.entities.filter(e => !e.removed && obstacles.has(e.type) && e.s >= base + 16 && e.s <= base + 81).map(e => e.lane));
  const candidates = [-1, 0, 1].filter(lane => !occupied.has(lane));
  assert.equal(candidates.length, 1, `Chunk ${chunk} must expose one clear lane`);
  return candidates[0];
}
const routeChoices = new WeakMap();
function followOpenRoute(sim) {
  const chunk = Math.floor((sim.distance + 10) / 96);
  // Observe the next block before entering it; remember the choice after old
  // obstacles are garbage-collected, just as a player remembers the route.
  if (!routeChoices.has(sim)) routeChoices.set(sim, new Map());
  const choices = routeChoices.get(sim);
  if (!choices.has(chunk)) choices.set(chunk, openLane(sim, chunk));
  const target = choices.get(chunk);
  if (sim.player.lane < target) sim.action('right');
  if (sim.player.lane > target) sim.action('left');
  sim.events.length = 0; // The client consumes this event queue every frame.
}

test('ready/start/reset and deterministic initial track', () => {
  const a = new Simulation(55), b = new Simulation(55);
  assert.equal(a.mode, 'ready');
  a.action('jump'); a.update(1);
  assert.equal(a.distance, 0);
  assert.equal(a.player.y, 0);
  assert.deepEqual(a.entities, b.entities);
  a.start(); seconds(a, .25);
  assert(a.distance > 4);
  a.start();
  assert.equal(a.distance, 0); assert.equal(a.coins, 0);
  assert.equal(a.boards, 3); assert.equal(a.mode, 'running');
  assert.deepEqual(a.entities, b.entities);
});

test('lane changes respond immediately, ease smoothly, and stay in three lanes', () => {
  const sim = emptyRun(); sim.action('right');
  assert.equal(sim.player.lane, 1);
  sim.update(STEP);
  assert(sim.player.x > 0 && sim.player.x < LANE_WIDTH);
  seconds(sim, .25);
  assert(Math.abs(sim.player.x - LANE_WIDTH) < .06);
  sim.action('right'); assert.equal(sim.player.lane, 1);
  sim.action('left'); sim.action('left'); sim.action('left');
  assert.equal(sim.player.lane, -1);
  seconds(sim, .4); assert(Math.abs(sim.player.x + LANE_WIDTH) < .02);
});

test('jump has useful height, responsive takeoff, and clean landing', () => {
  const sim = emptyRun(); sim.action('jump'); sim.update(STEP);
  assert(sim.player.y > .08); assert(!sim.player.grounded);
  let apex = sim.player.y, airborne = 1;
  seconds(sim, 1.1, s => { apex = Math.max(apex, s.player.y); if (!s.player.grounded) airborne++; });
  assert(apex > 2.25 && apex < 2.5, `Unexpected apex ${apex}`);
  assert(airborne * STEP > .75 && airborne * STEP < .9);
  assert.equal(sim.player.y, 0); assert.equal(sim.player.vy, 0);
  assert(sim.player.grounded); assert.equal(sim.events.filter(e => e.type === 'land').length, 1);
});

test('low hurdles require jumping; high bars require sliding', () => {
  const standingLow = emptyRun(); standingLow.add('low', 0, 7); seconds(standingLow, 1);
  assert.equal(standingLow.mode, 'dead');
  const jumping = emptyRun(); jumping.add('low', 0, 7); jumping.action('jump'); seconds(jumping, 1);
  assert.equal(jumping.mode, 'running'); assert(jumping.events.some(e => e.type === 'dodge'));
  const standingHigh = emptyRun(); standingHigh.add('high', 0, 7); seconds(standingHigh, 1);
  assert.equal(standingHigh.mode, 'dead');
  const sliding = emptyRun(); sliding.add('high', 0, 7); sliding.action('slide'); seconds(sliding, 1);
  assert.equal(sliding.mode, 'running'); assert.equal(sliding.player.slide, 0);
  assert(sliding.events.some(e => e.type === 'dodge'));
  const wrongAction = emptyRun(); wrongAction.add('high', 0, 7); wrongAction.action('jump'); seconds(wrongAction, 1);
  assert.equal(wrongAction.mode, 'dead');
});

test('slide cancels jump and gives a responsive fast descent', () => {
  const sim = emptyRun(); sim.action('jump'); seconds(sim, .2);
  assert(sim.player.y > 1.5);
  sim.action('slide'); sim.update(STEP);
  assert(sim.player.vy < -14); assert(sim.player.slide > .8);
  seconds(sim, .25); assert(sim.player.grounded); assert.equal(sim.player.y, 0);
  sim.action('jump'); sim.update(STEP);
  assert.equal(sim.player.slide, 0); assert(sim.player.y > 0);
});

test('collision envelopes match hurdle clearance, roof height, and lane edges', () => {
  assert(collisionAt('low', { y: .80 }));
  assert(!collisionAt('low', { y: .90 }));
  assert(collisionAt('high'));
  assert(!collisionAt('high', { slide: .5 }));
  assert(collisionAt('high', { y: .4, slide: .5 }));
  assert(collisionAt('train', { y: TRAIN_HEIGHT - .3 }));
  assert(!collisionAt('train', { y: TRAIN_HEIGHT }));
  assert(collisionAt('block', { y: 2.4 }));
  assert(!collisionAt('block', { y: 2.7 }));
  assert(collisionAt('low', { x: 1.35 }));
  assert(!collisionAt('low', { x: 1.45 }));
  assert(!collisionAt('train', { x: LANE_WIDTH }));
});

test('coin pickup happens once, increments score, and respects lane/height', () => {
  const sim = emptyRun(); sim.add('coin', 0, 3, { y: 1.05 });
  sim.add('coin', 1, 3, { y: 1.05 }); sim.add('coin', 0, 3, { y: 4.15 });
  seconds(sim, .5);
  assert.equal(sim.coins, 1); assert.equal(sim.combo, 1);
  assert.equal(sim.events.filter(e => e.type === 'coin').length, 1);
  assert.equal(sim.score, Math.floor(sim.distance * 10 + 25));
  seconds(sim, 1); assert.equal(sim.coins, 1);
});

test('magnet pickup attracts both adjacent lanes and expires', () => {
  const sim = emptyRun(); sim.add('magnet', 0, 2, { y: 1.2 });
  sim.add('coin', -1, 9, { y: 1.05 }); sim.add('coin', 1, 10, { y: 4.15 });
  seconds(sim, .2);
  assert(sim.magnetTime > 12); assert.equal(sim.coins, 2);
  assert.equal(sim.events.filter(e => e.type === 'coin' && e.magnet).length, 2);
  seconds(sim, 13.2); assert.equal(sim.magnetTime, 0);
  sim.add('coin', 1, sim.distance + 3, { y: 1.05 });
  seconds(sim, .4); assert.equal(sim.coins, 2);
});

test('hoverboard absorbs one hit, grants recovery, then later collision kills', () => {
  const sim = emptyRun(); sim.action('board');
  assert.equal(sim.boards, 2); assert.equal(sim.boardTime, 22);
  sim.action('board'); assert.equal(sim.boards, 2);
  sim.add('low', 0, 5); sim.add('block', 0, 55);
  untilDistance(sim, 10);
  assert.equal(sim.mode, 'running'); assert.equal(sim.boardTime, 0);
  assert(sim.invincible > 1); assert.equal(sim.events.filter(e => e.type === 'shield').length, 1);
  untilDistance(sim, 60);
  assert.equal(sim.mode, 'dead'); assert.equal(sim.events.filter(e => e.type === 'crash').length, 1);
  const afterDeath = sim.distance; seconds(sim, 2); assert.equal(sim.distance, afterDeath);
});

test('board pickup/restock and timed expiration work without collisions', () => {
  const sim = emptyRun(); sim.action('board'); sim.add('boardPickup', 0, 3, { y: 1.2 });
  seconds(sim, .3); assert.equal(sim.boards, 3);
  seconds(sim, 22); assert.equal(sim.boardTime, 0);
  untilDistance(sim, 501); assert.equal(sim.boards, 4);
  sim.boards = 9; sim.add('boardPickup', 0, sim.distance + 3, { y: 1.2 });
  seconds(sim, .4); assert.equal(sim.boards, 9);
});

function roofRun() {
  const sim = emptyRun();
  sim.add('ramp', 0, 12, { length: 10 });
  sim.add('train', 0, 28, { length: 22 });
  sim.add('train', 0, 54, { length: 22 });
  return sim;
}
test('ramp is continuous, reaches train roof, and supports jumping the gap', () => {
  const sim = roofRun();
  let highestStep = 0, previousY = 0;
  untilDistance(sim, 34, s => { highestStep = Math.max(highestStep, s.player.y - previousY); previousY = s.player.y; });
  assert.equal(sim.mode, 'running'); assert.equal(sim.player.y, TRAIN_HEIGHT);
  assert(sim.player.grounded); assert(highestStep < .1, `Ramp teleported vertically by ${highestStep}`);
  untilDistance(sim, 36); sim.action('jump');
  let apex = sim.player.y;
  untilDistance(sim, 58, s => { apex = Math.max(apex, s.player.y); });
  assert.equal(sim.mode, 'running'); assert(apex > 5.3);
  assert.equal(sim.player.y, TRAIN_HEIGHT); assert(sim.player.grounded);
  const noJump = roofRun(); untilDistance(noJump, 58);
  assert.equal(noJump.mode, 'dead', 'A roof gap should require an action');
});

test('entering the high side of a ramp collides instead of teleporting onto it', () => {
  const sim = emptyRun();
  sim.player.lane = 1; sim.player.x = LANE_WIDTH;
  sim.add('ramp', 0, 12, { length: 10 });
  untilDistance(sim, 11);
  assert.equal(sim.player.y, 0);
  sim.action('left');
  let highest = 0;
  seconds(sim, .4, s => { highest = Math.max(highest, s.player.y); });
  assert.equal(sim.mode, 'dead', 'The solid raised side of a ramp should block ground-level lane entry');
  assert(highest < .25, `Ground-level side entry teleported the runner to height ${highest}`);
  assert(sim.events.some(e => e.type === 'crash' && e.entity.type === 'ramp'));
});

test('moving trains continue approaching until normal behind-player despawn', () => {
  const sim = emptyRun(); const train = sim.add('train', 1, 80, { length: 20, moving: true, travel: 0 });
  seconds(sim, 1);
  assert(train.s < 74 && train.s > 72); assert(train.travel > 6);
  seconds(sim, 3);
  const afterFourSeconds = train.s;
  assert(sim.entities.includes(train), 'Train should still be alongside the visible route');
  seconds(sim, .4);
  assert.equal(sim.mode, 'running'); assert(train.travel > 30.5);
  assert(afterFourSeconds - train.s > 2.6, 'Train visibly stopped after travelling 28 metres');
  assert(Math.abs(train.travel - (80 - train.s)) < 1e-8);
  untilDistance(sim, 120);
  assert(!sim.entities.includes(train), 'A passed train was not removed behind the player');
});

test('speed grows gradually and has a stable upper limit', () => {
  const sim = emptyRun(); const initial = sim.speed;
  untilDistance(sim, 350); assert(sim.speed > initial + 1.9 && sim.speed < initial + 2.2);
  untilDistance(sim, 2600); assert.equal(sim.speed, 31);
  untilDistance(sim, 3000); assert.equal(sim.speed, 31);
});

test('many generated chunks leave an adjacent, unobstructed route and transition time', () => {
  for (let seed = 1; seed <= 32; seed++) {
    const sim = new Simulation(seed); sim.entities = []; sim.safeLane = 1; sim.randomState = seed;
    let previousSafe = 1;
    for (let chunk = 1; chunk <= 160; chunk++) {
      sim.entities = []; sim.generateChunk(chunk);
      const safe = openLane(sim, chunk), base = chunk * 96;
      assert(Math.abs(safe - previousSafe) <= 1, `Route jumps across two lanes, seed ${seed}, chunk ${chunk}`);
      const hazards = sim.entities.filter(e => obstacles.has(e.type));
      for (const hazard of hazards) {
        assert.notEqual(hazard.lane, safe);
        // At the minimum runner speed, a train starting 110 m away closes the
        // front-edge gap at 17+7 m/s. Faster running moves this contact farther
        // into the block. Include body clearance and a conservative step margin.
        const earliest = hazard.moving
          ? hazard.s - 110 + (110 - hazard.length / 2 - .19) * 17 / (17 + 7) - 7 * STEP
          : hazard.s - hazard.length / 2 - .19;
        assert(earliest >= base + 18, `Insufficient entry reaction space in chunk ${chunk}`);
        assert(hazard.s + hazard.length / 2 <= base + 80, `Exit transition blocked in chunk ${chunk}`);
      }
      previousSafe = safe;
    }
  }
});

test('real fixed-step runs survive 640 chunks across 10 seeds without shielding', () => {
  let maxEntities = 0;
  for (let seed = 10; seed < 20; seed++) {
    const sim = new Simulation(seed); sim.start();
    untilDistance(sim, 96 * 64, s => { followOpenRoute(s); maxEntities = Math.max(maxEntities, s.entities.length); });
    assert.equal(sim.mode, 'running', `Open route failed for seed ${seed} at ${sim.distance.toFixed(2)} m`);
    assert.equal(sim.boardTime, 0); assert.equal(sim.invincible, 0); assert(sim.coins > 500);
    assert(sim.distance >= 96 * 64);
  }
  assert(maxEntities < 350, `Live entity list grew to ${maxEntities}`);
  console.log(`  Maximum live entities across route runs: ${maxEntities}`);
});

test('a 50 km run remains stable with bounded entities and finite state', () => {
  const sim = new Simulation(987654321); sim.start();
  let maxEntities = 0;
  untilDistance(sim, 50_000, s => {
    followOpenRoute(s); maxEntities = Math.max(maxEntities, s.entities.length);
    assert(Number.isFinite(s.player.x) && Number.isFinite(s.player.y) && Number.isFinite(s.score));
  });
  assert.equal(sim.mode, 'running'); assert(sim.distance >= 50_000);
  assert(maxEntities < 350); assert(sim.entities.every(e => e.s + e.length / 2 > sim.distance - 24));
  console.log(`  50 km in ${sim.time.toFixed(1)} simulated seconds; max ${maxEntities} live entities; ${sim.coins} coins`);
});

const failures = results.filter(result => !result.passed);
console.log(`\n${results.length - failures.length}/${results.length} gameplay tests passed.`);
if (failures.length) process.exitCode = 1;

