import { useSyncExternalStore } from "react";
import type { Rarity } from "../api/types";

/**
 * The reveal's sound effects, synthesised with the Web Audio API: no file to
 * download, and every sound is a few lines to tweak.
 *
 * Every sound goes through a `bus` that `stopAll` fades out and replaces, so
 * skipping the reveal cuts a charge-up in the middle. The switch is per
 * browser, like the theme (`localStorage` `mm-sound`).
 */

const STORAGE_KEY = "mm-sound";
const VOLUME = 0.55;

let context: AudioContext | null = null;
let master: GainNode | null = null;
let bus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

let enabled = readEnabled();
const listeners = new Set<() => void>();

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function soundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(next: boolean) {
  enabled = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
  } catch {
    // Not saved: the choice lasts for this visit.
  }
  if (!next) stopAll();
  listeners.forEach((listener) => listener());
}

export function useSoundEnabled(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => enabled,
  );
}

/**
 * The shared context, created on first use. Browsers only let it play after a
 * user gesture on the page; opening a pack is one, so `resume` succeeds.
 */
function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (!enabled) return null;
  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
    // A compressor keeps the stacked layers of a legendary from clipping.
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.ratio.value = 6;
    limiter.connect(context.destination);
    master = context.createGain();
    master.gain.value = VOLUME;
    master.connect(limiter);
  }
  if (context.state === "suspended") void context.resume();
  if (!bus) {
    bus = context.createGain();
    bus.connect(master!);
  }
  return { ctx: context, out: bus };
}

/** Fades out whatever is playing, e.g. a charge-up when the reveal is skipped. */
export function stopAll() {
  if (!context || !bus) return;
  const old = bus;
  bus = null;
  const now = context.currentTime;
  old.gain.setValueAtTime(old.gain.value, now);
  old.gain.linearRampToValueAtTime(0, now + 0.08);
  window.setTimeout(() => old.disconnect(), 200);
}

function noise(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

type ToneOptions = {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  /** Glides to this frequency over the note. */
  to?: number;
  /** A lowpass on the note, for the brassy sawtooth chords. */
  lowpass?: number;
  detune?: number;
};

/** One note with an attack and an exponential decay. `at` is in seconds from now. */
function tone(freq: number, at: number, duration: number, options: ToneOptions = {}) {
  const a = audio();
  if (!a) return;
  const { ctx, out } = a;
  const start = ctx.currentTime + at;
  const { type = "sine", gain = 0.3, attack = 0.005, to, lowpass, detune = 0 } = options;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + duration);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  let node: AudioNode = osc;
  if (lowpass) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lowpass;
    osc.connect(filter);
    node = filter;
  }
  node.connect(env).connect(out);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** Filtered noise: swishes, tears and impacts. */
function hiss(at: number, duration: number, from: number, to: number, gain: number, attack = 0.01) {
  const a = audio();
  if (!a) return;
  const { ctx, out } = a;
  const start = ctx.currentTime + at;

  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(to, start + duration);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  src.connect(filter).connect(env).connect(out);
  src.start(start);
  src.stop(start + duration + 0.05);
}

/** A bell: a sine and its inharmonic partial. */
function bell(freq: number, at: number, duration: number, gain: number) {
  tone(freq, at, duration, { gain });
  tone(freq * 2.76, at, duration * 0.4, { gain: gain * 0.25 });
}

const note = (semitones: number) => 440 * 2 ** (semitones / 12);
// Semitones from A4.
const C5 = 3, E5 = 7, G5 = 10, C6 = 15, E6 = 19, G6 = 22, C7 = 27;

/** The pack drops onto the table. */
export function playPackDrop() {
  tone(150, 0, 0.22, { to: 55, gain: 0.45 });
  hiss(0, 0.28, 900, 3200, 0.18);
}

/** A card slides off the stack. */
export function playFlip() {
  hiss(0, 0.14, 1800, 5000, 0.16, 0.02);
}

/**
 * The build-up before an epic, a legendary or a shiny: a rising tone and
 * noise over `ms`, cut short by the landing.
 */
export function playCharge(kind: Rarity | "SHINY", ms: number) {
  const a = audio();
  if (!a) return;
  const seconds = ms / 1000;
  const shiny = kind === "SHINY";
  const legendary = kind === "LEGENDARY" || shiny;
  const top = shiny ? 1320 : legendary ? 880 : 520;

  tone(110, 0, seconds, { type: "sawtooth", to: top, gain: legendary ? 0.12 : 0.08, attack: seconds * 0.9, lowpass: 1600 });
  tone(55, 0, seconds, { type: "triangle", to: top / 4, gain: 0.2, attack: seconds * 0.8 });
  hiss(0, seconds, 400, legendary ? 7000 : 4000, legendary ? 0.2 : 0.12, seconds * 0.9);
  if (shiny) {
    // A shimmer of ever faster high notes.
    for (let t = 0, step = 0.14; t < seconds - 0.05; t += step, step = Math.max(0.04, step * 0.86)) {
      bell(note(C6 + [0, 4, 7, 12, 16][Math.floor(Math.random() * 5)]), t, 0.25, 0.05);
    }
  }
}

/** The card lands, with its rarity's flourish. */
export function playLand(rarity: Rarity, shiny: boolean) {
  if (shiny) {
    hiss(0, 0.6, 6000, 300, 0.3);
    tone(90, 0, 0.9, { to: 40, gain: 0.5 });
    // A rising major arpeggio, then glitter falling for a while.
    [C5, E5, G5, C6, E6, G6, C7].forEach((n, i) => bell(note(n), i * 0.05, 1.4, 0.12));
    [C5, E5, G5].forEach((n, i) => tone(note(n), 0.3, 2.2, { type: "sawtooth", gain: 0.06, attack: 0.05, lowpass: 2400, detune: i * 4 - 4 }));
    for (let i = 0; i < 18; i++) {
      bell(note(C6 + [0, 2, 4, 7, 9, 12, 14, 16, 19][Math.floor(Math.random() * 9)]), 0.4 + i * 0.09 + Math.random() * 0.04, 0.5, 0.05);
    }
    return;
  }
  switch (rarity) {
    case "COMMON":
      tone(note(E5), 0, 0.16, { type: "triangle", gain: 0.12 });
      break;
    case "UNCOMMON":
      tone(note(G5), 0, 0.2, { type: "triangle", gain: 0.13 });
      tone(note(C6), 0.07, 0.3, { type: "triangle", gain: 0.13 });
      break;
    case "RARE":
      [C6, E6, G6].forEach((n, i) => bell(note(n), i * 0.07, 0.6, 0.13));
      break;
    case "EPIC":
      hiss(0, 0.35, 5000, 400, 0.22);
      tone(110, 0, 0.5, { to: 50, gain: 0.4 });
      [C5, E5, G5, C6].forEach((n, i) => bell(note(n), i * 0.06, 0.9, 0.13));
      [C5, G5].forEach((n) => tone(note(n), 0.2, 1.1, { type: "sawtooth", gain: 0.05, attack: 0.04, lowpass: 1800 }));
      break;
    case "LEGENDARY":
      hiss(0, 0.6, 6000, 300, 0.3);
      tone(80, 0, 1, { to: 35, gain: 0.55 });
      // A fanfare: a short call, then the held major chord with a shimmer on top.
      tone(note(G5), 0.12, 0.18, { type: "sawtooth", gain: 0.09, attack: 0.02, lowpass: 2600 });
      tone(note(G5), 0.3, 0.18, { type: "sawtooth", gain: 0.09, attack: 0.02, lowpass: 2600 });
      [C5, E5, G5, C6].forEach((n, i) =>
        tone(note(n), 0.48, 2, { type: "sawtooth", gain: 0.07, attack: 0.03, lowpass: 2600, detune: i % 2 ? 5 : -5 }),
      );
      [C6, E6, G6, C7].forEach((n, i) => bell(note(n), 0.48 + i * 0.06, 1.6, 0.09));
      break;
  }
}
