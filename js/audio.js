/** Original procedural city-pop score and game sounds. No network or audio files. */
export class AudioEngine {
  constructor() {
    this.context = null;
    this.muted = false;
    this.musicEnabled = false;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
    this.bpm = 112;
    this.speed = 20;
    this.lastCoin = -10;
    this.lastTrain = -10;
    this.lastFilterUpdate = -10;
    this.coinRun = 0;
    this.voices = new Set();
    this.musicVoices = new Set();
    this.voiceCleanup = new Map();
    this.voiceEnds = new Map();
  }

  async unlock() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return false;
      this.context = new Context();
      const c = this.context;
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.compressor = c.createDynamicsCompressor();
      this.compressor.threshold.value = -16;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 3;
      this.compressor.attack.value = 0.008;
      this.compressor.release.value = 0.18;
      this.music = c.createGain();
      this.music.gain.value = this.musicEnabled ? 0.29 : 0;
      this.effects = c.createGain();
      this.effects.gain.value = 0.58;
      this.musicFilter = c.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 6900;
      this.musicFilter.Q.value = 0.35;
      this.music.connect(this.musicFilter).connect(this.compressor);
      this.effects.connect(this.compressor);
      this.compressor.connect(this.master).connect(c.destination);
      this.delay = c.createDelay(1);
      this.delay.delayTime.value = 60 / this.bpm * 0.75;
      this.delayWet = c.createGain();
      this.delayWet.gain.value = 0.13;
      this.delayFeedback = c.createGain();
      this.delayFeedback.gain.value = 0.2;
      this.delay.connect(this.delayWet).connect(this.music);
      this.delay.connect(this.delayFeedback).connect(this.delay);
      this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const data = this.noise.getChannelData(0);
      // Fixed seed makes this score reproducible while keeping naturally noisy drums.
      let seed = 74291;
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        data[i] = (seed / 4294967296) * 2 - 1;
      }
    }
    if (this.context.state === 'suspended') await this.context.resume();
    if (this.musicEnabled && !this.timer) this._beginScheduler();
    return this.context.state === 'running';
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.context && this.master) {
      const t = this.context.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, t, 0.035);
    }
  }

  startMusic() {
    this.musicEnabled = true;
    if (!this.context) return;
    const t = this.context.currentTime;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setTargetAtTime(0.29, t, 0.18);
    if (!this.timer) this._beginScheduler();
  }

  stopMusic() {
    this.musicEnabled = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.context) {
      const t = this.context.currentTime;
      this.music.gain.cancelScheduledValues(t);
      this.music.gain.setTargetAtTime(0, t, 0.08);
      // Retire music voices after the fade, including notes in the scheduler's
      // look-ahead window. Game-over and other effects keep their own lifetime.
      for (const source of this.musicVoices) {
        source.stop(Math.min(this.voiceEnds.get(source), t + 0.18));
      }
    }
  }

  update(speed, dt) {
    this.speed = Number.isFinite(speed) ? speed : this.speed;
    if (this.context && this.musicEnabled && this.context.currentTime - this.lastFilterUpdate >= 0.15) {
      this.lastFilterUpdate = this.context.currentTime;
      this.musicFilter.frequency.setTargetAtTime(5800 + Math.min(1, Math.max(0, (this.speed - 18) / 22)) * 2600, this.context.currentTime, 0.4);
    }
  }

  async dispose() {
    this.stopMusic();
    const context = this.context;
    if (!context) return;
    for (const source of [...this.voices]) {
      source.stop(context.currentTime);
      this.voiceCleanup.get(source)?.();
    }
    // The mixer and feedback delay are intentionally shared for the engine's
    // lifetime; disconnect their cycle explicitly when retiring the engine.
    for (const name of ['music', 'effects', 'musicFilter', 'delay', 'delayWet', 'delayFeedback', 'compressor', 'master']) {
      this[name]?.disconnect();
      this[name] = null;
    }
    this.context = null;
    this.noise = null;
    this.lastCoin = this.lastTrain = this.lastFilterUpdate = -10;
    if (context.state !== 'closed') await context.close();
  }

  _beginScheduler() {
    this.nextTime = this.context.currentTime + 0.08;
    this.step = 0;
    this._schedule();
    this.timer = setInterval(() => this._schedule(), 60);
  }

  _schedule() {
    if (!this.context || !this.musicEnabled || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const stepLength = 60 / this.bpm / 4;
    // Skip missed beats after background throttling, never queue a burst of old notes.
    if (this.nextTime < now - 0.1) {
      const missed = Math.ceil((now + 0.05 - this.nextTime) / stepLength);
      this.step += missed;
      this.nextTime += missed * stepLength;
    }
    while (this.nextTime < now + 0.18) {
      this._musicStep(this.step, this.nextTime);
      this.step++;
      this.nextTime += stepLength;
    }
  }

  _musicStep(step, t) {
    const s = step % 16;
    const bar = Math.floor(step / 16) % 16;
    const progression = [
      { bass: 38, chord: [62, 65, 69, 72], melody: [74, 77, 81, 77, 74, 72, 69, 72] },
      { bass: 34, chord: [62, 65, 69, 70], melody: [74, 77, 79, 77, 74, 72, 70, 72] },
      { bass: 41, chord: [60, 65, 69, 72], melody: [77, 81, 84, 81, 79, 77, 76, 72] },
      { bass: 36, chord: [60, 64, 67, 74], melody: [76, 79, 81, 79, 76, 74, 72, 69] },
    ];
    const harmony = progression[Math.floor(bar / 2) % 4];
    if ([0, 8, 10].includes(s) || (s === 14 && bar % 2 === 1)) this._kick(t);
    if (s === 4 || s === 12) this._snare(t);
    if (s % 2 === 0) this._noiseHit(t + (s % 4 === 2 ? 0.015 : 0), s % 4 === 2 ? 0.062 : 0.033, s % 4 === 2 ? 0.105 : 0.067, 7800, this.music, 'highpass');
    if (bar % 4 === 3 && s === 15) this._noiseHit(t, 0.025, 0.035, 6500, this.music, 'highpass');
    const bassHits = {0:0, 3:0, 6:12, 8:0, 11:7, 14:12};
    if (s in bassHits) this._tone(this._hz(harmony.bass + bassHits[s]), t, s === 8 ? 0.23 : 0.16, 'triangle', 0.35, this.music, {filter:740, attack:0.006});
    if ([2, 6, 10, 14].includes(s)) {
      harmony.chord.forEach((note, i) => this._tone(this._hz(note), t + i * 0.006, 0.19, 'triangle', 0.068, this.music, {filter:2500, attack:0.008, delay:true}));
    }
    // The lead leaves alternating space for the rhythm and game sound effects.
    const phrase = [0, 3, 5, 8, 10, 12, 14];
    if (phrase.includes(s) && bar % 4 !== 3) {
      const n = harmony.melody[(phrase.indexOf(s) + (bar % 2) * 2) % harmony.melody.length];
      this._tone(this._hz(n), t, s === 14 ? 0.3 : 0.16, 'sine', 0.105, this.music, {attack:0.005, delay:true});
      this._tone(this._hz(n + 12), t, 0.1, 'sine', 0.018, this.music);
    }
    if (s === 0 && bar % 2 === 0) {
      harmony.chord.slice(0, 3).forEach(n => this._tone(this._hz(n - 12), t, 1.5, 'sine', 0.043, this.music, {attack:0.15}));
    }
  }

  _hz(midi) { return 440 * 2 ** ((midi - 69) / 12); }

  _track(source, ownedNodes, endTime, isMusic) {
    this.voices.add(source);
    this.voiceEnds.set(source, endTime);
    if (isMusic) this.musicVoices.add(source);
    const cleanup = () => {
      if (!this.voices.delete(source)) return;
      this.musicVoices.delete(source);
      this.voiceEnds.delete(source);
      this.voiceCleanup.delete(source);
      source.onended = null;
      // A voice owns its oscillator/buffer source, envelope, and optional
      // filter. Shared buses and delay are owned by the engine, not the voice.
      source.disconnect();
      for (const node of ownedNodes) node.disconnect();
    };
    this.voiceCleanup.set(source, cleanup);
    source.onended = cleanup;
  }

  _tone(frequency, time, duration, type = 'sine', volume = 0.2, target = this.effects, options = {}) {
    if (!this.context) return;
    const c = this.context;
    const osc = c.createOscillator();
    const gain = c.createGain();
    const ownedNodes = [gain];
    const attack = options.attack || 0.003;
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, frequency), time);
    if (options.endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFrequency), time + duration);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(attack + 0.005, duration));
    if (options.filter) {
      const filter = c.createBiquadFilter();
      ownedNodes.push(filter);
      filter.type = 'lowpass';
      filter.frequency.value = options.filter;
      filter.Q.value = 0.65;
      osc.connect(filter).connect(gain);
    } else osc.connect(gain);
    gain.connect(target);
    if (options.delay) gain.connect(this.delay);
    osc.start(time);
    osc.stop(time + duration + 0.025);
    this._track(osc, ownedNodes, time + duration + 0.025, target === this.music);
  }

  _noiseHit(time, duration, volume, frequency, target = this.effects, type = 'bandpass', endFrequency) {
    if (!this.context) return;
    const c = this.context;
    const src = c.createBufferSource();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();
    src.buffer = this.noise;
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, time);
    if (endFrequency) filter.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    filter.Q.value = type === 'bandpass' ? 0.65 : 0.45;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    src.connect(filter).connect(gain).connect(target);
    src.start(time, (time * 0.37) % 1);
    src.stop(time + duration + 0.02);
    this._track(src, [gain, filter], time + duration + 0.02, target === this.music);
  }

  _kick(t) {
    this._tone(125, t, 0.19, 'sine', 0.72, this.music, {endFrequency:43});
    this._tone(750, t, 0.015, 'sine', 0.075, this.music, {endFrequency:120});
  }

  _snare(t) {
    this._noiseHit(t, 0.12, 0.2, 2600, this.music);
    this._noiseHit(t + 0.014, 0.07, 0.085, 4200, this.music, 'highpass');
    this._tone(175, t, 0.085, 'triangle', 0.11, this.music, {endFrequency:115});
  }

  play(name) {
    if (!this.context || this.context.state !== 'running' || this.muted) return;
    const t = this.context.currentTime + 0.006;
    switch (name) {
      case 'coin': {
        if (t - this.lastCoin < 0.038) return;
        this.coinRun = t - this.lastCoin < 0.29 ? (this.coinRun + 1) % 5 : 0;
        this.lastCoin = t;
        const pitch = [79, 81, 84, 86, 88][this.coinRun];
        this._tone(this._hz(pitch), t, 0.16, 'sine', 0.24);
        this._tone(this._hz(pitch + 12), t + 0.016, 0.105, 'sine', 0.1);
        break;
      }
      case 'jump':
        this._tone(185, t, 0.2, 'triangle', 0.16, this.effects, {endFrequency:630, filter:1800});
        this._noiseHit(t, 0.1, 0.08, 1200, this.effects, 'bandpass', 3400);
        break;
      case 'slide':
        this._noiseHit(t, 0.3, 0.23, 3900, this.effects, 'bandpass', 550);
        this._tone(180, t, 0.16, 'sine', 0.13, this.effects, {endFrequency:85});
        break;
      case 'board':
        [62, 69, 74, 81].forEach((n, i) => this._tone(this._hz(n), t + i * 0.047, 0.26, 'triangle', 0.13, this.effects, {filter:3200}));
        this._noiseHit(t, 0.28, 0.14, 600, this.effects, 'bandpass', 5200);
        break;
      case 'magnet':
        [74, 77, 81, 86].forEach((n, i) => this._tone(this._hz(n), t + i * 0.072, 0.22, 'sine', 0.2));
        this._tone(220, t, 0.32, 'triangle', 0.1, this.effects, {endFrequency:880, filter:2000});
        break;
      case 'crash':
        this._noiseHit(t, 0.34, 0.48, 1500, this.effects, 'lowpass', 250);
        this._tone(110, t, 0.31, 'triangle', 0.43, this.effects, {endFrequency:28, filter:650});
        this._tone(360, t + 0.07, 0.26, 'sine', 0.12, this.effects, {endFrequency:105});
        break;
      case 'shield':
      case 'boardbreak':
        this._noiseHit(t, 0.22, 0.26, 4200, this.effects, 'bandpass', 600);
        [81, 76, 69].forEach((n, i) => this._tone(this._hz(n), t + i * 0.04, 0.17, 'triangle', 0.14));
        break;
      case 'start':
        [62, 65, 69, 74].forEach((n, i) => this._tone(this._hz(n), t + i * 0.075, 0.24, 'triangle', 0.16, this.effects, {filter:3000}));
        break;
      case 'land':
        this._tone(92, t, 0.075, 'sine', 0.2, this.effects, {endFrequency:42});
        this._noiseHit(t, 0.045, 0.055, 550, this.effects, 'lowpass');
        break;
      case 'whoosh':
      case 'lane':
        this._noiseHit(t, 0.09, 0.075, 1500, this.effects, 'bandpass', 2800);
        break;
      case 'train':
        if (t - this.lastTrain < 0.55) return;
        this.lastTrain = t;
        // Rounded dual-tone horn with a gentle Doppler fall and passing air.
        this._tone(220, t, 0.53, 'triangle', 0.2, this.effects, {attack:0.035, endFrequency:176, filter:950});
        this._tone(293.66, t + 0.014, 0.48, 'triangle', 0.15, this.effects, {attack:0.035, endFrequency:235, filter:1100});
        this._noiseHit(t + 0.045, 0.58, 0.1, 1900, this.effects, 'bandpass', 500);
        break;
      case 'record':
        [74, 77, 81, 86, 89].forEach((n, i) => this._tone(this._hz(n), t + i * 0.09, 0.34, 'sine', 0.2));
        break;
      case 'click':
        this._tone(650, t, 0.06, 'sine', 0.12, this.effects, {endFrequency:850});
        break;
      default: break;
    }
  }
}

