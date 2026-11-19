// Every sound in VICE MERIDIAN is synthesised here with the Web Audio API: no sample files.
// A single master bus (with a soft compressor) feeds the destination so many overlapping
// one-shots (gunfire, glass, sirens) never clip.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.master = null;
    this.engineOsc = null;
    this.engineSub = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.ambienceGain = null;
    this.screechGain = null;
    this.screechFilter = null;
    this.noiseBuffer = null;
    this.sirenActive = false;
    this.sirenDist = 999;
    this.sirenPhase = 0;
    this.tyreSlip = 0;
    this.stepAccum = 0;
    this.stepAlt = false;
    this.lastStars = 0;
    this.muted = false;
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

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 5;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(comp).connect(this.ctx.destination);

      // One second of deterministic white noise (Lehmer LCG) for gunfire, impacts, tyres and surf.
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, sr, sr);
      const data = buf.getChannelData(0);
      let s = 48271;
      for (let i = 0; i < sr; i++) {
        s = (s * 16807) % 2147483647;
        data[i] = s / 1073741823.5 - 1;
      }
      this.noiseBuffer = buf;

      // Engine: sawtooth + square sub-octave through a lowpass whose cutoff follows the revs.
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 340;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 58;
      this.engineSub = this.ctx.createOscillator();
      this.engineSub.type = 'square';
      this.engineSub.frequency.value = 29;
      const subGain = this.ctx.createGain();
      subGain.gain.value = 0.35;
      this.engineOsc.connect(this.engineFilter);
      this.engineSub.connect(subGain).connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
      this.engineSub.start();

      // Police siren oscillator (wail between two pitches).
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.0;
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 660;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();

      // Continuous tyre-screech bed: band-passed noise whose gain follows lateral slip.
      const scrSrc = this.ctx.createBufferSource();
      scrSrc.buffer = this.noiseBuffer;
      scrSrc.loop = true;
      this.screechFilter = this.ctx.createBiquadFilter();
      this.screechFilter.type = 'bandpass';
      this.screechFilter.frequency.value = 2400;
      this.screechFilter.Q.value = 9;
      this.screechGain = this.ctx.createGain();
      this.screechGain.gain.value = 0;
      scrSrc.connect(this.screechFilter).connect(this.screechGain).connect(this.master);
      scrSrc.start();

      // Coastal wind / surf ambience with a slow swell LFO.
      const ambSrc = this.ctx.createBufferSource();
      ambSrc.buffer = this.noiseBuffer;
      ambSrc.loop = true;
      const ambFilter = this.ctx.createBiquadFilter();
      ambFilter.type = 'lowpass';
      ambFilter.frequency.value = 260;
      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.value = 0.018;
      const swell = this.ctx.createOscillator();
      swell.frequency.value = 0.11;
      const swellDepth = this.ctx.createGain();
      swellDepth.gain.value = 0.009;
      swell.connect(swellDepth).connect(this.ambienceGain.gain);
      swell.start();
      ambSrc.connect(ambFilter).connect(this.ambienceGain).connect(this.master);
      ambSrc.start();
    } catch {
      this.ctx = null;
    }
  }

  get ready() {
    return Boolean(this.ctx && this.noiseBuffer && this.master);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  setSirenActive(active, distance = 40) {
    this.sirenActive = active;
    this.sirenDist = distance;
  }

  // 0..1 amount of sideways slip on the player's tyres; drives the screech bed.
  setTyreSlip(amount) {
    this.tyreSlip = Math.max(0, Math.min(1, amount));
  }

  update(dt, player, police) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    if (player.vehicle) {
      const v = player.vehicle;
      const spd = Math.abs(v.speed);
      const maxSpd = (v.spec && v.spec.maxSpeed) || 40;
      // Fake gearbox: revs climb within each of five gears and drop on shift.
      const ratio = Math.min(0.999, spd / maxSpd);
      const gearPos = (ratio * 5) % 1;
      const pitch = 48 + gearPos * 70 + ratio * 40;
      this.engineOsc.frequency.setTargetAtTime(pitch, now, 0.05);
      this.engineSub.frequency.setTargetAtTime(pitch * 0.5, now, 0.05);
      this.engineFilter.frequency.setTargetAtTime(260 + gearPos * 900, now, 0.06);
      this.engineGain.gain.setTargetAtTime(0.045 + Math.min(0.05, spd * 0.0012), now, 0.08);

      let slip = this.tyreSlip;
      if (v.lateralSlip !== undefined) slip = Math.max(slip, Math.min(1, Math.abs(v.lateralSlip) / 6));
      this.screechGain.gain.setTargetAtTime(spd > 6 ? slip * 0.07 : 0, now, 0.04);
      this.screechFilter.frequency.setTargetAtTime(2000 + slip * 900, now, 0.05);
      this.stepAccum = 0;
    } else {
      this.engineGain.gain.setTargetAtTime(0.0, now, 0.08);
      this.screechGain.gain.setTargetAtTime(0.0, now, 0.05);
      // Footsteps keyed to horizontal speed, alternating left/right pitch.
      const hs = player.vel ? Math.hypot(player.vel.x, player.vel.z) : 0;
      if (player.onGround && hs > 1.2 && player.health > 0) {
        this.stepAccum += dt * hs * 0.36;
        if (this.stepAccum >= 1) {
          this.stepAccum -= 1;
          this.playFootstep(hs > 8 ? 1.3 : 1);
        }
      }
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

    // A rising sweep whenever the wanted level climbs.
    const stars = police ? police.stars || 0 : 0;
    if (stars > this.lastStars) this.playWantedSweep(stars);
    this.lastStars = stars;
  }

  // Small helpers for one-shots ------------------------------------------------------------

  _noiseShot(start, dur, type, freq, vol, q = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(start, (start * 7.13) % 0.8);
    src.stop(start + dur + 0.02);
    return filter;
  }

  _tone(start, dur, type, freq, vol, endFreq = null) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(vol, start + Math.min(0.012, dur * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  playGunshot(pitchScale = 1.0) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this._noiseShot(now, 0.14, 'bandpass', 950 * pitchScale, 0.24);
    // Low thump body so shots feel weighty, not just hissy.
    this._tone(now, 0.09, 'sine', 160 * pitchScale, 0.18, 45);
  }

  playImpact(strength = 10) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const vol = Math.min(0.26, 0.05 + strength * 0.009);
    this._noiseShot(now, 0.22, 'lowpass', 280, vol);
    if (strength > 14) this.playGlassBreak(Math.min(1, strength / 30));
  }

  playDoor() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this._tone(now, 0.1, 'sine', 140, 0.14, 48);
    this._noiseShot(now + 0.02, 0.05, 'highpass', 3000, 0.04);
  }

  playMissionChime() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => this._tone(now + i * 0.1, 0.28, 'triangle', freq, 0.09));
  }

  // Short brass-ish fanfare: arpeggio up, then a held major chord.
  playMissionComplete() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const seq = [392.0, 523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => {
      this._tone(now + i * 0.09, 0.22, 'square', f, 0.035);
      this._tone(now + i * 0.09, 0.24, 'triangle', f, 0.06);
    });
    const chordAt = now + seq.length * 0.09;
    [523.25, 659.25, 783.99].forEach((f) => this._tone(chordAt, 0.9, 'sawtooth', f, 0.025));
    this._tone(chordAt, 0.9, 'triangle', 261.63, 0.08);
  }

  playMissionFailed() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    [392.0, 369.99, 311.13].forEach((f, i) => this._tone(now + i * 0.22, 0.38, 'sawtooth', f, 0.04, f * 0.97));
    this._tone(now + 0.66, 0.8, 'triangle', 155.56, 0.08, 140);
  }

  // Two-tone rising siren sweep that signals a wanted level increase.
  playWantedSweep(stars = 1) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const base = 420 + stars * 40;
    this._tone(now, 0.32, 'sawtooth', base, 0.035, base * 1.9);
    this._tone(now + 0.3, 0.32, 'sawtooth', base * 1.1, 0.03, base * 2.1);
  }

  playHorn() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    // Two slightly detuned squares through a lowpass = classic car horn.
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1600;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.07, now + 0.02);
    gain.gain.setValueAtTime(0.07, now + 0.32);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    filter.connect(gain).connect(this.master);
    for (const f of [349, 440]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      osc.connect(filter);
      osc.start(now);
      osc.stop(now + 0.42);
    }
  }

  playTyreScreech(intensity = 1) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const f = this._noiseShot(now, 0.45, 'bandpass', 2600, 0.08 * intensity, 12);
    f.frequency.setValueAtTime(2600, now);
    f.frequency.linearRampToValueAtTime(1900, now + 0.45);
  }

  // Police-radio chirp: squelch burst plus two quick beeps.
  playRadioBlip() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this._noiseShot(now, 0.07, 'bandpass', 1800, 0.05, 2);
    this._tone(now + 0.05, 0.06, 'square', 1320, 0.03);
    this._tone(now + 0.13, 0.06, 'square', 990, 0.03);
  }

  playFootstep(weight = 1) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.stepAlt = !this.stepAlt;
    this._noiseShot(now, 0.06, 'lowpass', this.stepAlt ? 520 : 440, 0.035 * weight);
  }

  playPunch() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this._tone(now, 0.12, 'sine', 110, 0.22, 40);
    this._noiseShot(now, 0.08, 'lowpass', 900, 0.12);
  }

  playWhoosh() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const f = this._noiseShot(now, 0.16, 'bandpass', 600, 0.05, 3);
    f.frequency.linearRampToValueAtTime(1800, now + 0.16);
  }

  // Glass shatter: a cluster of short high-Q pings over a bright noise burst.
  playGlassBreak(intensity = 1) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this._noiseShot(now, 0.3, 'highpass', 4200, 0.08 * intensity);
    const pings = [3520, 4186, 2794, 5274, 3951];
    pings.forEach((f, i) => this._tone(now + i * 0.027, 0.16, 'sine', f, 0.025 * intensity, f * 0.92));
  }

  playWeaponSwitch() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this._noiseShot(now, 0.03, 'highpass', 2500, 0.06);
    this._noiseShot(now + 0.07, 0.04, 'bandpass', 1400, 0.07, 4);
  }

  playReload() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this._noiseShot(now, 0.05, 'bandpass', 1100, 0.07, 3);
    this._noiseShot(now + 0.32, 0.06, 'bandpass', 1700, 0.08, 3);
  }

  playPickup() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this._tone(now, 0.12, 'triangle', 880, 0.07);
    this._tone(now + 0.08, 0.18, 'triangle', 1318.5, 0.07);
  }
}
