"use client";

import type { CallSignal, CallSync, CallView } from "@/lib/calls/types";
import { connectTone, hangupTone, ringback, ringtone } from "./tones";
import { buzz } from "@/lib/ui/buzz";

/**
 * One voice or video call between the two of you, peer to peer over WebRTC.
 *
 * The server only relays the handshake (SDP offer/answer and ICE candidates)
 * through /api/call; audio and video go straight from one browser to the
 * other, encrypted end to end by WebRTC itself.
 *
 * Both sides always negotiate an audio and a video channel, even for voice
 * calls, so turning the camera on later is instant (no renegotiation). A small
 * data channel carries "camera on/off", "muted" and "hang up" between phones.
 * Only the caller ever creates offers, including ICE restarts when a network
 * changes, so the two sides can never talk over each other.
 */

export type Phase = "idle" | "outgoing" | "incoming" | "connecting" | "connected" | "reconnecting" | "ended";

export type Snapshot = {
  phase: Phase;
  call: CallView | null;
  kind: "audio" | "video";
  local: MediaStream | null;
  /** One stream for the whole call; tracks are added to it as they arrive. */
  remote: MediaStream | null;
  /** The other side's video is actually flowing (not just negotiated). */
  remoteVideoLive: boolean;
  micOn: boolean;
  camOn: boolean;
  remoteMicOn: boolean;
  remoteCamOn: boolean;
  facing: "user" | "environment";
  canFlip: boolean;
  connectedAt: number | null;
  /** Why it ended, shown for a moment before the screen closes. */
  endedReason: string | null;
  quality: 0 | 1 | 2 | 3;
  notice: string | null;
  /** The browser refused to start the other side's audio until a tap. */
  audioBlocked: boolean;
  relayed: boolean;
  /** While a call is connecting: what each phone has found so far, so a stuck call can be explained. */
  route: string | null;
};

const initial: Snapshot = {
  phase: "idle",
  call: null,
  kind: "audio",
  local: null,
  remote: null,
  remoteVideoLive: false,
  micOn: true,
  camOn: false,
  remoteMicOn: true,
  remoteCamOn: false,
  facing: "user",
  canFlip: false,
  connectedAt: null,
  endedReason: null,
  quality: 3,
  notice: null,
  audioBlocked: false,
  relayed: false,
  route: null,
};

const RING_TIMEOUT = 45_000;
const CONNECT_TIMEOUT = 35_000;
const RECONNECT_GIVE_UP = 25_000;

type Ice = RTCIceServer[];
let iceCache: { at: number; servers: Ice; source: string } | null = null;
const STUN_ONLY: Ice = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
async function iceServers(): Promise<{ servers: Ice; source: string }> {
  if (iceCache && Date.now() - iceCache.at < 30 * 60_000) return iceCache;
  try {
    // Never let a slow server hold up a call: after 5 s, go with direct routes only.
    const res = await fetch("/api/call/ice", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    const { iceServers: servers, source = "none" } = (await res.json()) as { iceServers: Ice; source?: string };
    // Your own relay's credentials are worth reusing; otherwise ask again next time, so one saved in Settings is used at once.
    iceCache = source === "own" ? { at: Date.now(), servers, source } : null;
    return { servers, source };
  } catch {
    return { servers: STUN_ONLY, source: "unavailable" };
  }
}

async function api(body: unknown): Promise<{ ok: boolean; error?: string; call?: CallView | null; glare?: boolean }> {
  try {
    const res = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await res.json();
  } catch {
    return { ok: false, error: "You seem to be offline." };
  }
}

function mediaError(e: unknown, video: boolean): string {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return `Our Universe needs permission to use your ${video ? "camera and microphone" : "microphone"}. Allow it in your browser's site settings, then try again.`;
  if (name === "NotFoundError" || name === "OverconstrainedError") return video ? "No camera was found on this device." : "No microphone was found on this device.";
  if (name === "NotReadableError") return `Another app is using your ${video ? "camera or microphone" : "microphone"}. Close it and try again.`;
  if (typeof navigator !== "undefined" && !navigator.mediaDevices) return "Calls need a secure (https) connection.";
  return "Couldn't start your microphone.";
}

const AUDIO: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const videoConstraints = (facing: "user" | "environment"): MediaTrackConstraints => ({ facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } });

export class CallEngine {
  private s: Snapshot = { ...initial };
  private listeners = new Set<() => void>();
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  /** Candidate types seen on each side (host, srflx, relay), to explain a call that can't connect. */
  private candTypes = { mine: new Set<string>(), theirs: new Set<string>() };
  private hasRelay = false;
  private relaySource = "none";
  private outgoingIce: RTCIceCandidateInit[] = [];
  private iceFlush: ReturnType<typeof setTimeout> | null = null;
  private bufferedOffer: string | null = null;
  private afterSignal = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private polling = false;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private stopTone: (() => void) | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private lastStats: { lost: number; recv: number } | null = null;
  private disconnectedSince: number | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private accepted = false;
  private earlyRestarts = 0;
  private wakeLock: { release: () => Promise<void> } | null = null;
  private epoch = 0;
  /** Calls this device already handled, so a late pulse doesn't ring again. */
  readonly handled = new Set<string>();
  private autoAnswerId: string | null = null;

  get snapshot() {
    return this.s;
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  private set(patch: Partial<Snapshot>) {
    this.s = { ...this.s, ...patch };
    this.listeners.forEach((l) => l());
  }
  private later(fn: () => void, ms: number) {
    const t = setTimeout(fn, ms);
    this.timers.push(t);
    return t;
  }
  private tone(start: (() => () => void) | null) {
    this.stopTone?.();
    this.stopTone = start ? start() : null;
  }

  get busy() {
    return this.s.phase !== "idle" && this.s.phase !== "ended";
  }

  // ─── Starting and answering ────────────────────────────────────────────

  async start(kind: "audio" | "video") {
    if (this.busy) return;
    const epoch = ++this.epoch;
    this.reset();
    this.unlockRemoteAudio();
    this.set({ ...initial, phase: "outgoing", kind, camOn: kind === "video", notice: null });
    const local = await this.getMedia(kind === "video");
    if (epoch !== this.epoch) return this.stopTracks(local);
    if (!local) return;
    const r = await api({ action: "start", kind });
    if (epoch !== this.epoch) return this.stopTracks(local);
    if (!r.ok || !r.call) {
      this.stopTracks(local);
      return this.finish(r.error ?? "Couldn't start the call.", false);
    }
    this.handled.add(r.call.id);
    if (r.glare) {
      // You both pressed call at the same moment: answer theirs instead.
      this.set({ call: r.call, kind: r.call.kind });
      return this.answer(local);
    }
    this.set({ call: r.call });
    this.tone(ringback);
    await this.createPeer(local, true);
    if (epoch !== this.epoch) return;
    this.startPolling();
    this.later(() => {
      if (this.s.phase === "outgoing" && this.s.call) {
        void api({ action: "missed", id: this.s.call.id });
        this.finish("No answer");
      }
    }, RING_TIMEOUT);
  }

  /** Someone is calling: ring, and tell their phone it's ringing here. */
  incoming(call: CallView) {
    if (this.busy || this.handled.has(call.id)) return;
    this.handled.add(call.id);
    ++this.epoch;
    this.reset();
    this.set({ ...initial, phase: "incoming", call, kind: call.kind, camOn: call.kind === "video" });
    void api({ action: "ringing", id: call.id });
    this.startPolling();
    if (this.autoAnswerId === call.id) {
      this.autoAnswerId = null;
      void this.accept();
      return;
    }
    this.tone(ringtone);
    buzz([400, 200, 400, 200, 400]);
  }

  /** "Answer" was tapped on a notification: pick up this call as soon as it rings here. */
  answerWhenRinging(id: string) {
    if (this.s.phase === "incoming" && this.s.call?.id === id) void this.accept();
    else if (!this.busy) this.autoAnswerId = id;
  }

  async accept(withVideo?: boolean) {
    const call = this.s.call;
    if (this.s.phase !== "incoming" || !call) return;
    const epoch = this.epoch;
    this.unlockRemoteAudio();
    this.tone(null);
    buzz(0);
    const video = withVideo ?? call.kind === "video";
    this.set({ phase: "connecting", camOn: video });
    const local = await this.getMedia(video);
    if (epoch !== this.epoch) return this.stopTracks(local);
    if (!local) {
      void api({ action: "decline", id: call.id });
      return;
    }
    await this.answer(local);
  }

  private async answer(local: MediaStream) {
    const call = this.s.call!;
    const epoch = this.epoch;
    const r = await api({ action: "accept", id: call.id });
    if (epoch !== this.epoch) return this.stopTracks(local);
    if (!r.ok) {
      this.stopTracks(local);
      return this.finish(r.call?.status === "active" ? "Answered on another device" : "This call has already ended.", false);
    }
    this.accepted = true;
    this.set({ phase: "connecting", call: r.call ?? call });
    this.connectDeadline();
    await this.createPeer(local, false);
    if (epoch !== this.epoch) return;
    this.afterSignal = 0;
    this.startPolling(true);
  }

  decline() {
    const call = this.s.call;
    if (!call || this.s.phase !== "incoming") return;
    void api({ action: "decline", id: call.id });
    this.finish("Declined", false);
  }

  hangup() {
    const call = this.s.call;
    if (!call || !this.busy) return;
    this.sendCtl({ t: "bye" });
    void api({ action: "end", id: call.id });
    this.finish(this.s.phase === "outgoing" ? "Cancelled" : "Call ended");
  }

  /** Last-chance hang-up when the page is closing. */
  beaconEnd() {
    const call = this.s.call;
    if (!call || !this.busy) return;
    this.sendCtl({ t: "bye" });
    navigator.sendBeacon?.("/api/call", new Blob([JSON.stringify({ action: "end", id: call.id })], { type: "application/json" }));
  }

  // ─── Media ─────────────────────────────────────────────────────────────

  private async getMedia(video: boolean): Promise<MediaStream | null> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.finish("Calls need a secure (https) connection.", false);
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO, video: video ? videoConstraints(this.s.facing) : false });
      void this.detectFlip();
      return stream;
    } catch (e) {
      if (video && ((e as { name?: string }).name === "NotFoundError" || (e as { name?: string }).name === "NotReadableError")) {
        // No usable camera: carry on as a voice call.
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO });
          this.set({ camOn: false, notice: "Your camera isn't available, so this is a voice call." });
          return stream;
        } catch (e2) {
          this.finish(mediaError(e2, false), false);
          return null;
        }
      }
      this.finish(mediaError(e, video), false);
      return null;
    }
  }

  private async detectFlip() {
    try {
      const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
      this.set({ canFlip: cams.length > 1 });
    } catch {
      /* unknown */
    }
  }

  private stopTracks(stream: MediaStream | null) {
    stream?.getTracks().forEach((t) => t.stop());
  }

  private attachLocal(pc: RTCPeerConnection, stream: MediaStream, caller: boolean) {
    const audio = stream.getAudioTracks()[0] ?? null;
    const video = stream.getVideoTracks()[0] ?? null;
    if (caller) {
      pc.addTransceiver(audio ?? "audio", { direction: "sendrecv", streams: [stream] });
      const vt = pc.addTransceiver(video ?? "video", { direction: "sendrecv", streams: [stream] });
      this.tuneVideo(vt.sender);
    }
    // The callee's transceivers are created by the caller's offer (see onOffer).
    this.set({ local: stream, micOn: !!audio, camOn: !!video });
  }

  private tuneVideo(sender: RTCRtpSender) {
    // Cap video so calls stay smooth on mobile data; WebRTC adapts below this on its own.
    try {
      const p = sender.getParameters();
      if (!p.encodings?.length) p.encodings = [{}];
      p.encodings[0].maxBitrate = 1_200_000;
      void sender.setParameters(p).catch(() => {});
    } catch {
      /* not supported before negotiation in some browsers */
    }
  }

  private transceiver(kind: "audio" | "video") {
    return this.pc?.getTransceivers().find((t) => (t.receiver.track?.kind ?? t.sender.track?.kind) === kind) ?? null;
  }

  toggleMic() {
    const t = this.s.local?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    this.set({ micOn: t.enabled });
    this.sendState();
  }

  async toggleCam() {
    const local = this.s.local;
    if (!local) return;
    const current = local.getVideoTracks()[0];
    if (current && this.s.camOn) {
      // Turning the camera off releases it (the light goes out), like a real phone call.
      await this.transceiver("video")?.sender.replaceTrack(null);
      current.stop();
      local.removeTrack(current);
      this.set({ camOn: false, local: new MediaStream(local.getTracks()) });
      this.sendState();
      return;
    }
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(this.s.facing) });
      const track = cam.getVideoTracks()[0];
      const tr = this.transceiver("video");
      if (tr) {
        if (tr.direction !== "sendrecv") tr.direction = "sendrecv";
        await tr.sender.replaceTrack(track);
        this.tuneVideo(tr.sender);
      }
      local.addTrack(track);
      this.set({ camOn: true, kind: "video", local: new MediaStream(local.getTracks()), notice: null });
      this.sendState();
      void this.detectFlip();
    } catch (e) {
      this.set({ notice: mediaError(e, true) });
    }
  }

  async flip() {
    const local = this.s.local;
    const current = local?.getVideoTracks()[0];
    if (!local || !current) return;
    const facing = this.s.facing === "user" ? "environment" : "user";
    // Phones can't open two cameras at once: release the current one first.
    current.stop();
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(facing) });
      const track = cam.getVideoTracks()[0];
      await this.transceiver("video")?.sender.replaceTrack(track);
      local.removeTrack(current);
      local.addTrack(track);
      this.set({ facing, local: new MediaStream(local.getTracks()) });
    } catch (e) {
      this.set({ notice: mediaError(e, true) });
    }
  }

  /** Browsers need a tap before they'll play the other side's audio; this is that tap. */
  unlockRemoteAudio() {
    if (!this.audioEl) {
      this.audioEl = document.createElement("audio");
      this.audioEl.autoplay = true;
      this.audioEl.setAttribute("playsinline", "");
      this.audioEl.style.display = "none";
      document.body.appendChild(this.audioEl);
    }
    if (this.s.remote && this.audioEl.srcObject !== this.s.remote) this.audioEl.srcObject = this.s.remote;
    const p = this.audioEl.play();
    p?.then(() => this.s.audioBlocked && this.set({ audioBlocked: false })).catch(() => {
      if (this.s.remote) this.set({ audioBlocked: true });
    });
  }

  async setSpeaker(deviceId: string) {
    const el = this.audioEl as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    await el?.setSinkId?.(deviceId).catch(() => {});
  }

  // ─── The peer connection ───────────────────────────────────────────────

  /**
   * Everything that shapes the first offer (data channel, audio and video
   * channels) is added in one synchronous run, so the caller negotiates once.
   */
  private async createPeer(local: MediaStream, caller: boolean) {
    const { servers, source } = await iceServers();
    this.relaySource = source;
    this.hasRelay = servers.some((x) => (Array.isArray(x.urls) ? x.urls : [x.urls]).some((u) => /^turns?:/.test(u)));
    this.candTypes = { mine: new Set(), theirs: new Set() };
    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({ iceServers: servers, bundlePolicy: "max-bundle", rtcpMuxPolicy: "require" });
    } catch {
      // A relay address this browser won't accept mustn't stop the call: go with direct routes.
      this.hasRelay = false;
      this.relaySource = "rejected";
      pc = new RTCPeerConnection({ iceServers: STUN_ONLY, bundlePolicy: "max-bundle", rtcpMuxPolicy: "require" });
    }
    this.pc = pc;
    const remote = new MediaStream();
    this.set({ remote, remoteVideoLive: false });
    if (this.audioEl) this.audioEl.srcObject = remote;

    const dc = pc.createDataChannel("ctl", { negotiated: true, id: 0 });
    this.dc = dc;
    dc.onopen = () => this.sendState();
    dc.onmessage = (e) => this.onCtl(e.data);

    pc.ontrack = (e) => {
      const track = e.track;
      if (!remote.getTracks().includes(track)) remote.addTrack(track);
      if (track.kind === "video") {
        const live = () => this.set({ remoteVideoLive: track.readyState === "live" && !track.muted });
        track.onunmute = live;
        track.onmute = live;
        track.onended = live;
        live();
      }
      this.unlockRemoteAudio();
    };
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const type = e.candidate.type ?? / typ (\w+)/.exec(e.candidate.candidate)?.[1];
      if (type) this.candTypes.mine.add(type);
      this.outgoingIce.push(e.candidate.toJSON());
      this.iceFlush ??= setTimeout(() => this.flushIce(), 120);
    };
    pc.oniceconnectionstatechange = () => this.onIceState();
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") this.onConnected();
      if (pc.connectionState === "failed") this.onIceState();
    };
    pc.onnegotiationneeded = async () => {
      // Only the caller offers, for the first handshake and for every ICE restart.
      if (this.s.call?.role !== "caller" || this.accepted) return;
      try {
        await pc.setLocalDescription();
        this.sendSignals([{ kind: "offer", payload: JSON.stringify(pc.localDescription) }]);
      } catch {
        /* a newer negotiation replaced this one */
      }
    };
    this.attachLocal(pc, local, caller);
  }

  private flushIce() {
    this.iceFlush = null;
    const batch = this.outgoingIce.splice(0);
    if (batch.length) this.sendSignals(batch.map((c) => ({ kind: "ice" as const, payload: JSON.stringify(c) })));
  }

  private sendSignals(signals: { kind: CallSignal["kind"]; payload: string }[]) {
    const call = this.s.call;
    if (!call) return;
    const attempt = async (n: number): Promise<void> => {
      const r = await api({ action: "signal", id: call.id, signals });
      if (!r.ok && n < 3 && this.busy && r.error !== "That call has ended.") {
        await new Promise((res) => setTimeout(res, 400 * (n + 1)));
        return attempt(n + 1);
      }
    };
    void attempt(0);
  }

  private async onSignal(sig: CallSignal) {
    const pc = this.pc;
    if (sig.kind === "offer") {
      if (!pc || !this.accepted) {
        this.bufferedOffer = sig.payload;
        return;
      }
      await this.onOffer(sig.payload);
    } else if (sig.kind === "answer") {
      if (!pc || pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription(JSON.parse(sig.payload)).catch(() => {});
      await this.drainIce();
    } else if (sig.kind === "ice") {
      const c = JSON.parse(sig.payload) as RTCIceCandidateInit;
      const type = / typ (\w+)/.exec(c.candidate ?? "")?.[1];
      if (type) this.candTypes.theirs.add(type);
      if (pc?.remoteDescription) await pc.addIceCandidate(c).catch(() => {});
      else this.pendingIce.push(c);
    } else if (sig.kind === "restart") {
      if (this.s.call?.role === "caller") this.pc?.restartIce();
    }
  }

  private async onOffer(payload: string) {
    const pc = this.pc!;
    await pc.setRemoteDescription(JSON.parse(payload));
    const local = this.s.local;
    for (const t of pc.getTransceivers()) {
      const kind = t.receiver.track?.kind;
      if (!kind) continue;
      const track = kind === "audio" ? local?.getAudioTracks()[0] : local?.getVideoTracks()[0];
      if (t.direction !== "sendrecv") t.direction = "sendrecv";
      if (t.sender.track !== (track ?? null)) await t.sender.replaceTrack(track ?? null);
      if (track) t.sender.setStreams?.(local!);
      if (kind === "video") this.tuneVideo(t.sender);
    }
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.sendSignals([{ kind: "answer", payload: JSON.stringify(pc.localDescription) }]);
    await this.drainIce();
  }

  private async drainIce() {
    const pc = this.pc;
    if (!pc?.remoteDescription) return;
    for (const c of this.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {});
  }

  private onConnected() {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    this.disconnectedSince = null;
    if (this.s.phase === "connected") return;
    const first = !this.s.connectedAt;
    this.tone(null);
    if (first) connectTone();
    this.set({ phase: "connected", connectedAt: this.s.connectedAt ?? Date.now(), notice: null });
    const vt = this.transceiver("video");
    if (vt) this.tuneVideo(vt.sender);
    this.unlockRemoteAudio();
    this.startStats();
    void this.lockScreen();
    this.startPolling();
  }

  private onIceState() {
    const pc = this.pc;
    if (!pc) return;
    const st = pc.iceConnectionState;
    if (!this.s.connectedAt) {
      // Never connected yet: retry the path search a couple of times before the deadline gives up.
      if (st === "failed" || pc.connectionState === "failed") {
        if (this.earlyRestarts < 2) {
          this.earlyRestarts++;
          if (this.s.call?.role === "caller") pc.restartIce();
          else this.sendSignals([{ kind: "restart", payload: "{}" }]);
        } else if (this.s.call && this.s.phase === "connecting") {
          // Every path was tried three times: say why now rather than at the deadline.
          void api({ action: "failed", id: this.s.call.id });
          this.finish(this.whyNot());
        }
      }
      return;
    }
    if (st === "connected" || st === "completed") return this.onConnected();
    if (st !== "disconnected" && st !== "failed") return;
    this.disconnectedSince ??= Date.now();
    if (this.s.phase === "connected") this.set({ phase: "reconnecting" });
    this.startPolling();
    const restart = () => {
      if (!this.pc || this.s.phase !== "reconnecting") return;
      if (Date.now() - (this.disconnectedSince ?? Date.now()) > RECONNECT_GIVE_UP) {
        if (this.s.call) void api({ action: "end", id: this.s.call.id });
        return this.finish("Connection lost");
      }
      // A new network path: the caller restarts ICE, the callee asks the caller to.
      if (this.s.call?.role === "caller") this.pc.restartIce();
      else this.sendSignals([{ kind: "restart", payload: "{}" }]);
      this.restartTimer = setTimeout(restart, 6000);
    };
    if (!this.restartTimer) this.restartTimer = setTimeout(restart, st === "failed" ? 200 : 2500);
  }

  /** A plain explanation of a call that couldn't connect, from what each side managed to offer. */
  private whyNot(): string {
    const { mine, theirs } = this.candTypes;
    if (!this.hasRelay) return "Couldn't connect: your networks block direct calls (common on mobile data). Add a free relay in Settings → Call relay, then call again.";
    if (!mine.has("relay")) return "Couldn't connect: this network blocked the call relay too. Try Wi-Fi, or check Settings → Call relay → Test from this device.";
    if (!theirs.has("relay")) return "Couldn't connect: your partner's network blocked the call. Ask them to try Wi-Fi.";
    return "Couldn't connect the call. Try again, or switch one phone to Wi-Fi.";
  }

  private describeRoute(): string {
    const list = (x: Set<string>) => (x.size ? [...x].sort().join(" ") : "nothing yet");
    const relay = { own: "your relay", public: "public relay", none: "no relay", unavailable: "relay settings unreachable", rejected: "relay refused by browser" }[this.relaySource] ?? this.relaySource;
    return `This phone: ${list(this.candTypes.mine)} · Other phone: ${list(this.candTypes.theirs)} · ${relay} · ${this.pc?.iceConnectionState ?? "starting"}`;
  }

  private connectDeadline() {
    // After a few seconds without a connection, show what each side has found (and keep it current).
    const tick = () => {
      if (this.s.phase !== "connecting") return this.s.route && this.set({ route: null });
      this.set({ route: this.describeRoute() });
      this.later(tick, 1500);
    };
    this.later(tick, 6000);
    this.later(() => {
      if (this.s.phase === "connecting" && this.s.call) {
        void api({ action: "failed", id: this.s.call.id });
        this.finish(this.whyNot());
      }
    }, CONNECT_TIMEOUT);
  }

  // ─── Control messages between the phones ───────────────────────────────

  private sendCtl(msg: object) {
    if (this.dc?.readyState === "open") {
      try {
        this.dc.send(JSON.stringify(msg));
      } catch {
        /* channel closing */
      }
    }
  }
  private sendState() {
    this.sendCtl({ t: "state", mic: this.s.micOn, cam: this.s.camOn });
  }
  private onCtl(raw: string) {
    try {
      const m = JSON.parse(raw) as { t: string; mic?: boolean; cam?: boolean };
      if (m.t === "state") this.set({ remoteMicOn: m.mic !== false, remoteCamOn: !!m.cam, kind: m.cam || this.s.camOn ? "video" : this.s.kind });
      if (m.t === "bye") this.finish("Call ended");
    } catch {
      /* ignore */
    }
  }

  // ─── Polling the server for the handshake and the call's status ────────

  private startPolling(immediate = false) {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => this.poll(), immediate ? 0 : this.cadence());
  }
  private cadence() {
    return this.s.phase === "connected" ? 2500 : this.s.phase === "incoming" ? 1500 : 600;
  }
  private async poll() {
    const call = this.s.call;
    if (!call || !this.busy || this.polling) return;
    this.polling = true;
    const epoch = this.epoch;
    try {
      const res = await fetch(`/api/call?id=${call.id}&after=${this.afterSignal}`, { cache: "no-store" });
      if (epoch !== this.epoch) return;
      if (res.status === 404) return this.finish("Call ended");
      if (res.ok) {
        const sync = (await res.json()) as CallSync;
        await this.onSync(sync);
      }
    } catch {
      /* offline for a moment */
    } finally {
      this.polling = false;
      if (epoch === this.epoch && this.busy) {
        if (this.pollTimer) clearTimeout(this.pollTimer);
        this.pollTimer = setTimeout(() => this.poll(), this.cadence());
      }
    }
  }

  private async onSync(sync: CallSync) {
    const call = sync.call;
    this.set({ call });
    if (call.status === "ringing" && this.s.phase === "outgoing") this.set({ notice: null });
    if (call.status === "active" && this.s.phase === "incoming" && !this.accepted) return this.finish("Answered on another device", false);
    if (!["calling", "ringing", "active"].includes(call.status)) {
      const reason =
        call.status === "declined"
          ? "Declined"
          : call.status === "missed"
            ? call.role === "caller"
              ? "No answer"
              : "Missed call"
            : call.status === "failed"
              ? this.whyNot()
              : "Call ended";
      return this.finish(reason);
    }
    for (const sig of sync.signals) {
      this.afterSignal = Math.max(this.afterSignal, sig.id);
      // The callee reads everything, including the buffered offer, only after answering.
      if (this.s.phase === "incoming") continue;
      await this.onSignal(sig);
    }
    if (this.accepted && this.bufferedOffer && this.pc && this.pc.signalingState === "stable" && !this.pc.remoteDescription) {
      const offer = this.bufferedOffer;
      this.bufferedOffer = null;
      await this.onOffer(offer);
    }
    if (call.status === "active" && this.s.phase === "outgoing") {
      this.tone(null);
      this.set({ phase: "connecting" });
      this.connectDeadline();
    }
  }

  // ─── Quality, screen, and cleanup ──────────────────────────────────────

  private startStats() {
    if (this.statsTimer) return;
    this.statsTimer = setInterval(async () => {
      const pc = this.pc;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let rtt = 0;
        let lost = 0;
        let recv = 0;
        let relayed = false;
        stats.forEach((r) => {
          if (r.type === "candidate-pair" && r.nominated && r.state === "succeeded") {
            rtt = r.currentRoundTripTime ?? 0;
            const localCand = stats.get(r.localCandidateId);
            relayed = localCand?.candidateType === "relay";
          }
          if (r.type === "inbound-rtp" && r.kind === "audio") {
            lost += r.packetsLost ?? 0;
            recv += r.packetsReceived ?? 0;
          }
        });
        const prev = this.lastStats;
        this.lastStats = { lost, recv };
        const dLost = prev ? lost - prev.lost : 0;
        const dRecv = prev ? recv - prev.recv : 0;
        const loss = dLost + dRecv > 0 ? dLost / (dLost + dRecv) : 0;
        const quality = rtt < 0.3 && loss < 0.03 ? 3 : rtt < 0.7 && loss < 0.1 ? 2 : 1;
        if (quality !== this.s.quality || relayed !== this.s.relayed) this.set({ quality, relayed });
      } catch {
        /* stats unavailable */
      }
    }, 2000);
  }

  private async lockScreen() {
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      if (wl && this.s.kind === "video") this.wakeLock = await wl.request("screen");
    } catch {
      /* not allowed */
    }
  }

  private finish(reason: string, tone = true) {
    const wasBusy = this.busy;
    ++this.epoch;
    this.tone(null);
    buzz(0);
    if (tone && wasBusy) hangupTone();
    this.teardown();
    this.set({ phase: "ended", endedReason: reason, local: null, remote: null, remoteVideoLive: false, audioBlocked: false });
    const epoch = this.epoch;
    setTimeout(() => {
      if (this.epoch === epoch && this.s.phase === "ended") this.set({ ...initial });
    }, 2600);
  }

  private teardown() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.iceFlush) clearTimeout(this.iceFlush);
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.pollTimer = this.iceFlush = this.restartTimer = this.statsTimer = null;
    this.stopTracks(this.s.local);
    try {
      this.dc?.close();
      this.pc?.close();
    } catch {
      /* already closed */
    }
    this.pc = null;
    this.dc = null;
    if (this.audioEl) this.audioEl.srcObject = null;
    void this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
  }

  private reset() {
    this.teardown();
    this.pendingIce = [];
    this.outgoingIce = [];
    this.bufferedOffer = null;
    this.afterSignal = 0;
    this.accepted = false;
    this.disconnectedSince = null;
    this.lastStats = null;
    this.earlyRestarts = 0;
  }

  dismiss() {
    if (this.s.phase === "ended") this.set({ ...initial });
  }
  clearNotice() {
    if (this.s.notice) this.set({ notice: null });
  }
}
