// @ts-check

/** Lightweight original synthesised cues; no network audio assets or autoplay required. */
export class AudioSystem {
  /** @param {() => boolean} muted */
  constructor(muted) {
    this.muted = muted;
    this.context = null;
    this.activeEats = 0;
    this.paused = false;
    /** @type {ReturnType<typeof setInterval>|null} */
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicPalette = 'lagoon';
    this.nextMusicAt = 0;
  }
  async activate() {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') await this.context.resume();
    if (this.musicTimer) this.scheduleMusic();
  }
  /** @param {'eat'|'bump'|'boost'|'countdown'|'results'} cue */
  play(cue) {
    if (!this.context || this.context.state !== 'running' || this.muted() || this.paused) return;
    if (cue === 'eat' && this.activeEats >= 3) return;
    const settings = {
      eat: /** @type {const} */ ([
        [660, 0, 0.07],
        [920, 0.045, 0.08],
      ]),
      bump: /** @type {const} */ ([
        [145, 0, 0.13],
        [105, 0.07, 0.11],
      ]),
      boost: /** @type {const} */ ([
        [260, 0, 0.18],
        [520, 0.08, 0.2],
        [780, 0.15, 0.16],
      ]),
      countdown: /** @type {const} */ ([[520, 0, 0.1]]),
      results: /** @type {const} */ ([
        [523, 0, 0.16],
        [659, 0.12, 0.16],
        [784, 0.24, 0.28],
      ]),
    };
    if (cue === 'eat') this.activeEats += 1;
    const notes = settings[cue];
    for (const [frequency, offset, duration] of notes)
      this.tone(frequency, duration, offset, cue === 'bump' ? 'square' : 'sine', 0.075);
    if (cue === 'eat')
      globalThis.setTimeout(() => {
        this.activeEats = Math.max(0, this.activeEats - 1);
      }, 180);
  }
  /** @param {number} frequency @param {number} duration @param {number} offset @param {OscillatorType} type @param {number} volume */
  tone(frequency, duration, offset = 0, type = 'sine', volume = 0.05) {
    if (!this.context || this.context.state !== 'running' || this.muted() || this.paused) return;
    const start = this.context.currentTime + offset;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
  /** Starts a quiet, original procedural music loop after user activation. @param {string} palette */
  startMusic(palette = 'lagoon') {
    this.stopMusic();
    this.musicPalette = palette;
    this.musicStep = 0;
    this.nextMusicAt = this.context?.currentTime ?? 0;
    this.scheduleMusic();
    this.musicTimer = globalThis.setInterval(() => this.scheduleMusic(), 200);
  }
  /** Schedules overlapping notes ahead of playback so timer jitter cannot create audible gaps. */
  scheduleMusic() {
    if (!this.context || this.context.state !== 'running' || this.muted() || this.paused) return;
    const lagoon = [262, 330, 392, 330, 294, 349, 440, 349];
    const reef = [220, 262, 330, 294, 196, 247, 330, 262];
    const melody = this.musicPalette === 'reef' ? reef : lagoon;
    if (this.nextMusicAt < this.context.currentTime - 0.1)
      this.nextMusicAt = this.context.currentTime + 0.04;
    const horizon = this.context.currentTime + 1.15;
    while (this.nextMusicAt < horizon) {
      const note = melody[this.musicStep % melody.length];
      const offset = Math.max(0, this.nextMusicAt - this.context.currentTime);
      this.musicStep += 1;
      this.tone(note, 0.82, offset, 'sine', 0.016);
      this.tone(note / 2, 1.08, offset, 'triangle', 0.01);
      this.nextMusicAt += 0.54;
    }
  }
  stopMusic() {
    if (this.musicTimer) globalThis.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.nextMusicAt = 0;
  }
  pause() {
    this.paused = true;
    this.context?.suspend();
  }
  async resume() {
    this.paused = false;
    await this.context?.resume();
    this.scheduleMusic();
  }
  destroy() {
    this.stopMusic();
    this.activeEats = 0;
    this.context?.close();
    this.context = null;
  }
}
