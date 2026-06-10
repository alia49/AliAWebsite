// A tiny Web Audio synth for UI sounds. No audio files: every sound is built
// from oscillators/noise at play time. The AudioContext is only created after
// the first user gesture, and a mute preference is persisted in localStorage.
import { useSyncExternalStore } from 'react';
import { readStore, writeStore } from '../../lib/storage';

const KEY = 'sound';
const listeners = new Set();
let muted = readStore(KEY) === 'off';
let ctx = null;
let master = null;
let unlockInstalled = false;
let noiseBuffer = null;

function ensureContext() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const AudioCtor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AudioCtor) return null;
  try {
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Create the AudioContext on the first pointer/key gesture (autoplay policy). */
export function installSoundUnlock() {
  if (unlockInstalled || typeof window === 'undefined') return;
  unlockInstalled = true;
  const unlock = () => {
    if (muted) return; // stay silent (and don't create a context) while muted
    ensureContext();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

function envelope(gainNode, t, peak, attack, decay) {
  gainNode.gain.cancelScheduledValues(t);
  gainNode.gain.setValueAtTime(0.0001, t);
  gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone({ type = 'sine', from, to = from, at = 0, peak = 0.08, attack = 0.004, decay = 0.12 }) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  envelope(gain, t, peak, attack, decay);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
}

function noise({ at = 0, peak = 0.05, decay = 0.05, cutoff = 1200 }) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = ctx.createGain();
  envelope(gain, t, peak, 0.002, decay);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t);
  src.stop(t + decay + 0.05);
}

const PRESETS = {
  // crisp UI click
  tick: () => tone({ type: 'triangle', from: 2100, to: 1500, peak: 0.05, decay: 0.035 }),
  // soft keypress for the typing test
  key: () => noise({ peak: 0.035, decay: 0.03, cutoff: 3200 }),
  // overlay open
  pop: () => tone({ type: 'sine', from: 520, to: 190, peak: 0.1, attack: 0.006, decay: 0.11 }),
  // success: two bell-ish partials
  chime: () => {
    tone({ type: 'sine', from: 1046.5, peak: 0.06, decay: 0.45 });
    tone({ type: 'sine', from: 1568, at: 0.075, peak: 0.05, decay: 0.55 });
  },
  // gentle error buzz
  error: () => tone({ type: 'triangle', from: 220, to: 150, peak: 0.08, attack: 0.01, decay: 0.2 }),
  // footstep in the pixel room
  step: () => noise({ peak: 0.03, decay: 0.045, cutoff: 700 }),
};

export function play(name) {
  if (muted || !ctx || ctx.state !== 'running') return;
  const preset = PRESETS[name];
  if (!preset) return;
  try {
    preset();
  } catch {
    /* audio graph hiccup: ignore */
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(next) {
  muted = Boolean(next);
  writeStore(KEY, muted ? 'off' : 'on');
  if (!muted) ensureContext(); // toggling is itself a user gesture
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useMuted() {
  return useSyncExternalStore(subscribe, isMuted, () => false);
}
