import { afterEach, expect, test, vi } from 'vitest';
import { AudioSystem } from '../../src/runtime/audio/audio-system.js';

test('audio is inert before activation and when muted', () => {
  const audio = new AudioSystem(() => true);
  expect(() => audio.play('eat')).not.toThrow();
  expect(() => audio.pause()).not.toThrow();
  audio.destroy();
});

afterEach(() => vi.unstubAllGlobals());

test('activated audio produces layered cues, music, pause, and clean shutdown', async () => {
  vi.useFakeTimers();
  const starts = [];
  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 1;
      this.destination = {};
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: { setValueAtTime() {} },
        connect() {
          return this;
        },
        start(time) {
          starts.push(time);
        },
        stop() {},
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {
          return this;
        },
      };
    }
    suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    close() {
      this.state = 'closed';
      return Promise.resolve();
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  const audio = new AudioSystem(() => false);
  await audio.activate();
  audio.play('boost');
  expect(starts).toHaveLength(3);
  audio.startMusic('reef');
  expect(starts.length).toBeGreaterThanOrEqual(7);
  const scheduledBeforePause = starts.length;
  audio.pause();
  expect(audio.paused).toBe(true);
  /** @type {any} */ (audio.context).currentTime = 3;
  await vi.advanceTimersByTimeAsync(600);
  expect(starts).toHaveLength(scheduledBeforePause);
  await audio.resume();
  expect(starts.length).toBeGreaterThan(scheduledBeforePause);
  audio.destroy();
  expect(audio.context).toBeNull();
  expect(audio.musicTimer).toBeNull();
  vi.useRealTimers();
});
