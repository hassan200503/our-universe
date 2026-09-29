"use client";

/**
 * Ringtone, ringback and hang-up tones, synthesised with Web Audio so there's
 * nothing to download and they start instantly. Browsers only let audio start
 * after the page has been touched once, so the context is unlocked on the
 * first tap anywhere.
 */
let ac: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ac) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ac = new Ctx();
  }
  if (ac.state === "suspended") void ac.resume().catch(() => {});
  return ac;
}

export function unlockAudio() {
  const once = () => {
    context();
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
  };
  window.addEventListener("pointerdown", once);
  window.addEventListener("keydown", once);
}

function note(c: AudioContext, freq: number, at: number, len: number, peak: number, type: OscillatorType = "sine") {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + 0.02);
  g.gain.setValueAtTime(peak, at + len - 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + len + 0.02);
}

function loop(pattern: (c: AudioContext, t: number) => void, every: number): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const play = () => {
    if (stopped) return;
    const c = context();
    if (c && c.state === "running") pattern(c, c.currentTime + 0.02);
    timer = setTimeout(play, every);
  };
  play();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

/** Incoming call: a warm, rising four-note phrase. */
export const ringtone = () =>
  loop((c, t) => {
    [659.25, 830.61, 987.77, 1318.51].forEach((f, i) => note(c, f, t + i * 0.16, 0.34, 0.09, "triangle"));
    [659.25, 830.61, 987.77, 1318.51].forEach((f, i) => note(c, f, t + 0.9 + i * 0.16, 0.34, 0.07, "triangle"));
  }, 3200);

/** Outgoing call while it rings on the other side: a soft double pulse. */
export const ringback = () =>
  loop((c, t) => {
    note(c, 440, t, 0.42, 0.05);
    note(c, 480, t, 0.42, 0.05);
    note(c, 440, t + 0.6, 0.42, 0.05);
    note(c, 480, t + 0.6, 0.42, 0.05);
  }, 3000);

/** Call over. */
export function hangupTone() {
  const c = context();
  if (!c || c.state !== "running") return;
  const t = c.currentTime + 0.02;
  [0, 0.22, 0.44].forEach((d) => note(c, 480, t + d, 0.16, 0.05));
}

export function connectTone() {
  const c = context();
  if (!c || c.state !== "running") return;
  const t = c.currentTime + 0.02;
  note(c, 880, t, 0.12, 0.04);
  note(c, 1318.5, t + 0.1, 0.18, 0.04);
}
