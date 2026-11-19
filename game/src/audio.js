export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.ambienceGain = null;
    this.noiseBuffer = null;
    this.sirenActive = false;
    this.sirenDist = 999;
    this.sirenPhase = 0;
  }

  unlock() {
    if (this.unlocked) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      this.unlocked = true;

      // Pre-generate 1 second of white noise for gunfire, impacts, and ocean breeze
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, sr, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < sr; i++) data[i] = (i * 16807 % 2147483647) / 1073741824 - 1;
      this.noiseBuffer = buf;

      // Engine synthesizer (sawtooth through lowpass)
      const engFilter = this.ctx.createBiquadFilter();
      engFilter.type = 'lowpass';
      engFilter.frequency.value = 340;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 58;
      this.engineOsc.connect(engFilter).connect(this.engineGain).connect(this.ctx.destination);
      this.engineOsc.start();

      // Police siren oscillator
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.0;
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 660;
      this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
      this.sirenOsc.start();

      // Coastal wind / surf ambience
      const ambSrc = this.ctx.createBufferSource();
      ambSrc.buffer = this.noiseBuffer;
      ambSrc.loop = true;
      const ambFilter = this.ctx.createBiquadFilter();
      ambFilter.type = 'lowpass';
      ambFilter.frequency.value = 260;
      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.value = 0.018;
      ambSrc.connect(ambFilter).connect(this.ambienceGain).connect(this.ctx.destination);
      ambSrc.start();
    } catch {
      this.ctx = null;
    }
  }

  setSirenActive(active, distance = 40) {
    this.sirenActive = active;
    this.sirenDist = distance;
  }

  update(dt, player) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    if (player.vehicle) {
      const spd = Math.abs(player.vehicle.speed);
      const pitch = 55 + spd * 3.1;
      this.engineOsc.frequency.setTargetAtTime(pitch, now, 0.05);
      this.engineGain.gain.setTargetAtTime(0.045 + Math.min(0.05, spd * 0.0012), now, 0.08);
    } else {
      this.engineGain.gain.setTargetAtTime(0.0, now, 0.08);
    }

    if (this.sirenActive) {
      this.sirenPhase += dt * 4.2;
      const freq = 620 + Math.sin(this.sirenPhase) * 230;
      const atten = Math.max(0, 1 - this.sirenDist / 120);
      this.sirenOsc.frequency.setTargetAtTime(freq, now, 0.03);
      this.sirenGain.gain.setTargetAtTime(0.045 * atten, now, 0.08);
    } else {
      this.sirenGain.gain.setTargetAtTime(0.0, now, 0.08);
    }
  }

  playGunshot(pitchScale = 1.0) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 950 * pitchScale;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.15);
  }

  playImpact(strength = 10) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 280;
    const gain = this.ctx.createGain();
    const vol = Math.min(0.26, 0.05 + strength * 0.009);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.24);
  }

  playDoor() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.09);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playMissionChime() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.09, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.28);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.3);
    });
  }
}
