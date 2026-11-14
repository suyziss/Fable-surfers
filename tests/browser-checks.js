// Browser integration QA. Open the actual game with ?test=1, then:
//   const qa = await import('./tests/browser-checks.js');
//   await qa.runChecks();
//   await qa.soak(120);
// Progress is serializable and available as window.neonRailsQA. No bot is left
// running afterward; both entry points finish on the ordinary pause screen.
let active = false;
const $ = id => document.getElementById(id);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const key = code => {
  document.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
  document.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true, cancelable: true }));
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const numeric = element => Number(element.textContent.replace(/[^\d.-]/g, ''));
const rounded = value => Math.round(value * 100) / 100;
const visible = element => !!element && !element.hidden && getComputedStyle(element).display !== 'none';
const rendered = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

function api() {
  assert(new URLSearchParams(location.search).get('test') === '1', 'QA requires a page opened with ?test=1');
  assert(window.neonRails?.test, 'The game test bridge is not available yet');
  return window.neonRails.test;
}
async function waitFor(predicate, description, timeout = 4000) {
  const end = performance.now() + timeout;
  while (!predicate()) {
    if (performance.now() > end) throw new Error(`Timed out: ${description}`);
    await wait(25);
  }
}
function savePreferences() {
  return Object.fromEntries(['neonrails.best', 'neonrails.muted', 'neonrails.quality'].map(name => [name, localStorage.getItem(name)]));
}
function restorePreferences(saved) {
  const muted = saved['neonrails.muted'] === 'true';
  if (($('mute-button').getAttribute('aria-pressed') === 'true') !== muted) key('KeyM');
  for (const [name, value] of Object.entries(saved)) {
    if (value === null) localStorage.removeItem(name); else localStorage.setItem(name, value);
  }
}
function captureErrors() {
  const errors = [];
  const onError = event => errors.push({ type: 'error', message: String(event.message || event.error || 'Unknown error'), source: event.filename || '', line: event.lineno || 0 });
  const onRejection = event => errors.push({ type: 'unhandledrejection', message: String(event.reason?.stack || event.reason) });
  const onContextLoss = () => errors.push({ type: 'webglcontextlost', message: 'The renderer lost its WebGL context' });
  addEventListener('error', onError); addEventListener('unhandledrejection', onRejection);
  $('game').addEventListener('webglcontextlost', onContextLoss);
  return { errors, close() { removeEventListener('error', onError); removeEventListener('unhandledrejection', onRejection); $('game').removeEventListener('webglcontextlost', onContextLoss); } };
}
async function cleanCourse(test) { await test.start(); test.clear(); test.step(0); }
function toDistance(test, distance, onStep) {
  let frames = 0;
  while (test.sim.distance < distance && test.sim.mode === 'running') {
    assert(++frames < 5000, 'Isolated course exceeded its step budget');
    test.step(.025); onStep?.(test.sim);
  }
}

export async function runChecks() {
  assert(!active, 'A browser QA job is already active');
  const test = api(); active = true;
  const started = performance.now(), saved = savePreferences(), capture = captureErrors();
  const report = { kind: 'checks', status: 'running', startedAt: new Date().toISOString(), current: '', results: [], errors: capture.errors };
  window.neonRailsQA = report;
  async function check(name, fn) {
    report.current = name;
    const began = performance.now();
    try {
      const details = await fn();
      report.results.push({ name, passed: true, durationMs: rounded(performance.now() - began), details: details ?? null });
    } catch (error) {
      report.results.push({ name, passed: false, durationMs: rounded(performance.now() - began), error: String(error.stack || error) });
    }
  }
  try {
    await check('Start button, rendered scene, and visible HUD', async () => {
      await cleanCourse(test); test.step(.5);
      $('start-button').click();
      await waitFor(() => test.sim.distance < 1 && test.sim.mode === 'running', 'start button resets the run');
      test.clear(); await rendered();
      assert(!visible($('menu')) && visible($('hud')), 'Starting must hide the menu and reveal the HUD');
      assert(!visible($('game-over')) && !visible($('pause-menu')), 'Overlays must be hidden during a new run');
      const stats = window.neonRails.stats();
      assert(stats.drawCalls > 0 && stats.triangles > 1000 && stats.geometries > 0, 'The WebGL renderer did not draw the scene');
      assert($('game').width > 300 && $('game').height > 200, 'Game canvas has an invalid render size');
      return { canvas: [$('game').width, $('game').height], stats };
    });

    await check('Keyboard and button pause freeze the simulation', async () => {
      await cleanCourse(test); key('Escape');
      assert(test.sim.mode === 'paused' && visible($('pause-menu')), 'Escape did not pause');
      const distance = test.sim.distance; await wait(180);
      assert(test.sim.distance === distance, 'Distance advanced while paused');
      $('resume-button').click();
      assert(test.sim.mode === 'running' && !visible($('pause-menu')), 'Resume button did not resume');
      key('KeyP'); assert(test.sim.mode === 'paused', 'P did not pause');
      key('Escape'); assert(test.sim.mode === 'running', 'Escape did not resume');
      return { pausedDistance: distance, elapsedDuringPause: 0 };
    });

    await check('Mute keyboard/button state and cinema HUD visibility', async () => {
      await cleanCourse(test);
      const before = $('mute-button').getAttribute('aria-pressed');
      key('KeyM');
      assert($('mute-button').getAttribute('aria-pressed') !== before, 'M did not change the sound button');
      assert(localStorage.getItem('neonrails.muted') === $('mute-button').getAttribute('aria-pressed'), 'Mute preference was not saved');
      $('mute-button').click(); assert($('mute-button').getAttribute('aria-pressed') === before, 'Sound button did not restore the initial state');
      key('KeyH'); assert(document.body.classList.contains('cinema'), 'H did not enter recording mode');
      assert(!visible($('hud')), 'Recording mode did not hide the HUD');
      key('KeyH'); assert(!document.body.classList.contains('cinema') && visible($('hud')), 'H did not restore the HUD');
      $('cinema-button').click(); assert(!visible($('hud')), 'Recording button did not hide the HUD');
      key('KeyH');
      return { soundButtonRestored: true, cinemaKeyboardAndButton: true };
    });

    await check('Normal A/D, arrow, jump, slide, and board keyboard bindings', async () => {
      await cleanCourse(test);
      key('KeyD'); test.step(.25); assert(test.sim.player.lane === 1 && test.sim.player.x > 3.2, 'D failed to change lane');
      key('ArrowLeft'); test.step(.25); assert(test.sim.player.lane === 0 && Math.abs(test.sim.player.x) < .06, 'Left arrow failed');
      key('KeyA'); test.step(.25); assert(test.sim.player.lane === -1, 'A failed');
      key('ArrowRight'); test.step(.25); assert(test.sim.player.lane === 0, 'Right arrow failed');
      key('Space'); test.step(.2); assert(test.sim.player.y > 1.5 && !test.sim.player.grounded, 'Space jump failed');
      key('KeyS'); test.step(.25); assert(test.sim.player.slide > 0 && test.sim.player.grounded, 'S fast descent/slide failed');
      key('ArrowUp'); test.step(.15); assert(test.sim.player.y > 1 && test.sim.player.slide === 0, 'Up arrow jump failed');
      key('ArrowDown'); test.step(.25); assert(test.sim.player.slide > 0, 'Down arrow slide failed');
      key('KeyB'); test.step(0);
      assert(test.sim.boardTime > 20 && test.sim.boards === 2, 'B did not activate the board');
      assert($('board-status').classList.contains('active') && visible($('board-status')), 'Board HUD status is absent');
      assert(numeric($('board-count')) === 2, 'Board inventory HUD is wrong');
      await rendered();
      return { lane: test.sim.player.lane, boardInventory: test.sim.boards, boardChip: $('board-status').textContent };
    });

    await check('Low hurdle jump and high-bar slide in the rendered scene', async () => {
      await cleanCourse(test); test.add('low', 0, 7); test.render(); key('Space'); test.step(1);
      assert(test.sim.mode === 'running' && test.sim.player.grounded, 'Jump failed to clear the low hurdle');
      test.clear(); test.add('high', 0, test.sim.distance + 7); test.render(); key('KeyS'); test.step(1);
      assert(test.sim.mode === 'running' && test.sim.player.slide === 0, 'Slide failed to clear the high bar');
      await rendered();
      return { distance: rounded(test.sim.distance), survivedBoth: true };
    });

    await check('Coins, score, magnet pickup, and active bonus HUD', async () => {
      await cleanCourse(test);
      test.add('coin', 0, 2, { y: 1.05 }); test.add('magnet', 0, 3, { y: 1.2 });
      test.add('coin', -1, 9, { y: 1.05 }); test.add('coin', 1, 10, { y: 4.15 });
      test.render(); test.step(.35);
      assert(test.sim.coins === 3 && numeric($('coins')) === 3, 'Coin HUD does not match all three collected coins');
      assert(test.sim.magnetTime > 12, 'Magnet was not activated');
      assert($('magnet-status').classList.contains('active') && visible($('magnet-status')), 'Magnet HUD status is absent');
      assert(numeric($('score')) === test.sim.score, 'Displayed score does not match simulation');
      await rendered();
      return { coins: test.sim.coins, score: test.sim.score, magnetChip: $('magnet-status').textContent };
    });

    await check('Hoverboard one-hit protection updates gameplay and HUD', async () => {
      await cleanCourse(test); test.add('low', 0, 5); key('KeyB'); test.step(.5);
      assert(test.sim.mode === 'running' && test.sim.boardTime === 0 && test.sim.invincible > 0, 'Board shield did not absorb the collision');
      assert(!$('board-status').classList.contains('active'), 'Spent shield still appears active in HUD');
      assert(numeric($('board-count')) === 2, 'Shield spent an incorrect number of boards');
      await rendered();
      return { inventory: test.sim.boards, recoverySeconds: rounded(test.sim.invincible), toast: $('toast').textContent };
    });

    await check('Ramp ascent and roof-to-roof gap jump in actual game rendering', async () => {
      await cleanCourse(test);
      test.add('ramp', 0, 12, { length: 10 });
      test.add('train', 0, 28, { length: 22, variant: 1 });
      test.add('train', 0, 54, { length: 22, variant: 2 });
      test.render(); toDistance(test, 34);
      assert(test.sim.mode === 'running' && Math.abs(test.sim.player.y - 3.1) < .001 && test.sim.player.grounded, 'Ramp did not reach the first roof');
      toDistance(test, 36); key('Space'); let apex = 3.1;
      toDistance(test, 58, sim => { apex = Math.max(apex, sim.player.y); });
      assert(test.sim.mode === 'running' && apex > 5.3, 'Roof jump did not clear the gap');
      assert(Math.abs(test.sim.player.y - 3.1) < .001 && test.sim.player.grounded, 'Runner did not land on the second roof');
      await rendered();
      const stats = window.neonRails.stats(); assert(stats.drawCalls > 0, 'Roof scenario did not render');
      return { roofHeight: test.sim.player.y, jumpApex: rounded(apex), distance: rounded(test.sim.distance), stats };
    });

    await check('Collision, delayed result screen, record persistence, and quick keyboard restart', async () => {
      await cleanCourse(test); test.add('coin', 0, 1, { y: 1.05 }); test.add('low', 0, 5);
      test.step(.5); assert(test.sim.mode === 'dead', 'Unprotected collision did not end the run');
      const score = test.sim.score, coins = test.sim.coins, diedAt = performance.now();
      await wait(1600);
      await waitFor(() => visible($('game-over')), 'result screen after guard catch animation', 8000);
      assert(!visible($('hud')), 'Result screen must hide the running HUD');
      assert(numeric($('final-score')) === score && numeric($('final-coins')) === coins, 'Result values differ from the ended run');
      const persistedBest = Number(localStorage.getItem('neonrails.best'));
      assert(Number.isFinite(persistedBest) && persistedBest >= score && persistedBest >= Number(saved['neonrails.best'] || 0), 'Best score was not persisted');
      assert(numeric($('final-best')) === persistedBest, 'Result record differs from saved record');
      const resultDelayMs = rounded(performance.now() - diedAt);
      key('Enter'); await waitFor(() => test.sim.mode === 'running' && !visible($('game-over')), 'Enter restarts from results');
      assert(test.sim.coins === 0 && test.sim.boards === 3 && test.sim.distance < 3, 'Restart did not reset the run');
      test.clear(); test.step(.5); $('restart-button').click();
      await waitFor(() => test.sim.mode === 'running' && test.sim.distance < 1, 'restart button binding');
      return { endedScore: score, endedCoins: coins, savedRecordObserved: persistedBest, resultDelayMs, keyboardAndButtonRestart: true };
    });

    await check('No runtime errors or WebGL context loss', async () => {
      await rendered(); assert(capture.errors.length === 0, JSON.stringify(capture.errors));
      return { errors: [], stats: window.neonRails.stats() };
    });
  } finally {
    report.current = 'Cleanup';
    try {
      await test.start();
      if (test.sim.mode === 'running') key('Escape');
      if (document.body.classList.contains('cinema')) key('KeyH');
      restorePreferences(saved);
      report.cleanup = { normalCourseRestored: test.sim.entities.length > 0, paused: test.sim.mode === 'paused', savedPreferencesRestored: true, inputBotActive: false };
    } catch (error) { report.cleanup = { error: String(error) }; }
    capture.close(); active = false;
    report.durationMs = rounded(performance.now() - started);
    report.passed = report.results.filter(result => result.passed).length;
    report.failed = report.results.length - report.passed;
    report.status = report.failed || capture.errors.length || report.cleanup.error ? 'failed' : 'complete';
    report.current = null;
  }
  return report;
}

function openRouteLane(sim, chunk) {
  const base = chunk * 96, hazards = new Set(['train', 'block', 'low', 'high']);
  const occupied = new Set(sim.entities.filter(entity => !entity.removed && hazards.has(entity.type) && entity.s >= base + 16 && entity.s <= base + 81).map(entity => entity.lane));
  const candidates = [-1, 0, 1].filter(lane => !occupied.has(lane));
  assert(candidates.length === 1, `Chunk ${chunk} has ${candidates.length} observable open lanes`);
  return candidates[0];
}
function frameSummary(times) {
  if (!times.length) return { count: 0 };
  const sorted = [...times].sort((a, b) => a - b), sum = times.reduce((a, b) => a + b, 0);
  return { count: times.length, meanMs: rounded(sum / times.length), medianMs: rounded(sorted[Math.floor(sorted.length * .5)]), p95Ms: rounded(sorted[Math.floor(sorted.length * .95)]), p99Ms: rounded(sorted[Math.floor(sorted.length * .99)]), maxMs: rounded(sorted.at(-1)), averageFps: rounded(1000 * times.length / sum), over50ms: times.filter(time => time > 50).length, over100ms: times.filter(time => time > 100).length };
}

export async function soak(seconds = 120) {
  assert(!active, 'A browser QA job is already active');
  assert(Number.isFinite(seconds) && seconds >= 1 && seconds <= 3600, 'Soak duration must be between 1 and 3600 seconds');
  const test = api(); active = true;
  const saved = savePreferences(), capture = captureErrors(), choices = new Map(), frameTimes = [];
  const report = { kind: 'soak', status: 'starting', requestedSeconds: seconds, elapsedSeconds: 0, simulationSeconds: 0, distance: 0, samples: [], errors: capture.errors, cancelRequested: false };
  window.neonRailsQA = report;
  let frameId = 0, intervalId = 0, deadlineId = 0, lastFrame = 0, nextSample = 0, started = 0;
  let stop;
  function sample() {
    const sim = test.sim, stats = window.neonRails.stats();
    const entry = { elapsedSeconds: rounded((performance.now() - started) / 1000), simulationSeconds: rounded(sim.time), distance: rounded(sim.distance), mode: sim.mode, entities: sim.entities.length, ...stats };
    report.samples.push(entry);
    return entry;
  }
  function steer() {
    try {
      const sim = test.sim;
      report.elapsedSeconds = rounded((performance.now() - started) / 1000);
      report.simulationSeconds = rounded(sim.time); report.distance = rounded(sim.distance); report.coins = sim.coins;
      if (report.cancelRequested) return stop('Cancelled by QA controller');
      if (sim.mode !== 'running') return stop(`Run unexpectedly entered ${sim.mode} mode`);
      if (capture.errors.length) return stop('Runtime error or graphics context loss');
      const chunk = Math.floor((sim.distance + 10) / 96);
      if (!choices.has(chunk)) choices.set(chunk, openRouteLane(sim, chunk));
      const lane = choices.get(chunk);
      if (sim.player.lane < lane) key('KeyD');
      if (sim.player.lane > lane) key('KeyA');
      // Only route choices are cached; old choices can be discarded as well.
      if (choices.size > 4) for (const oldChunk of choices.keys()) if (oldChunk < chunk - 1) choices.delete(oldChunk);
      if (report.elapsedSeconds >= nextSample) { sample(); nextSample += 5; }
    } catch (error) { stop(String(error.stack || error)); }
  }
  try {
    await test.start();
    assert(test.sim.mode === 'running', 'Start failed before soak');
    started = performance.now(); report.status = 'running'; report.startedAt = new Date().toISOString();
    await new Promise(resolve => {
      let finished = false;
      stop = error => {
        if (finished) return;
        finished = true; report.failure = error || null;
        clearInterval(intervalId); clearTimeout(deadlineId); cancelAnimationFrame(frameId);
        resolve();
      };
      const observeFrame = now => {
        if (lastFrame) frameTimes.push(now - lastFrame);
        lastFrame = now;
        frameId = requestAnimationFrame(observeFrame);
      };
      intervalId = setInterval(steer, 40);
      deadlineId = setTimeout(() => stop(null), seconds * 1000);
      frameId = requestAnimationFrame(observeFrame);
      steer();
    });
    sample();
    report.frameTimes = frameSummary(frameTimes);
    report.maxima = Object.fromEntries(['geometries', 'textures', 'drawCalls', 'triangles', 'meshes', 'entities'].map(name => [name, Math.max(...report.samples.map(entry => entry[name] || 0))]));
    report.initialStats = report.samples[0]; report.finalStats = report.samples.at(-1);
    // Warm-up creates the small finite library of material/train variants; a
    // plateau is reported without inventing an arbitrary universal FPS limit.
    const tail = report.samples.filter(entry => entry.elapsedSeconds >= Math.min(30, seconds / 2));
    report.tailResourceRange = Object.fromEntries(['geometries', 'textures', 'entities'].map(name => [name, { min: Math.min(...tail.map(entry => entry[name])), max: Math.max(...tail.map(entry => entry[name])) }]));
    assert(!report.failure, report.failure);
    assert(test.sim.mode === 'running' && test.sim.time > 0, 'Soak did not remain playable');
    assert(test.sim.boardTime === 0 && test.sim.invincible === 0, 'Soak must survive through normal route choice without shielding');
    assert(capture.errors.length === 0, JSON.stringify(capture.errors));
    assert(report.maxima.entities < 350, 'Live simulation objects grew beyond the expected fixed horizon');
    report.status = 'complete';
  } catch (error) {
    report.failure = String(error.stack || error); report.status = 'failed';
  } finally {
    clearInterval(intervalId); clearTimeout(deadlineId); cancelAnimationFrame(frameId);
    try {
      if (test.sim.mode === 'dead') await test.start();
      if (test.sim.mode === 'running') key('Escape');
      if (document.body.classList.contains('cinema')) key('KeyH');
      restorePreferences(saved);
      report.cleanup = { paused: test.sim.mode === 'paused', inputBotActive: false, timersCleared: true, savedPreferencesRestored: true };
    } catch (error) { report.cleanup = { error: String(error) }; report.status = 'failed'; }
    capture.close(); active = false;
    report.elapsedSeconds = started ? rounded((performance.now() - started) / 1000) : 0;
  }
  return report;
}

