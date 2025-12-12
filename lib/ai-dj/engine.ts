"use client";
import { emitBeat, emitNowPlaying } from "@/lib/bus";
import { estimateBPM, estimateEnergy, detectPeaks, guessKey } from "@/lib/analysis";

export type Source = { id: string; title: string; artists: string[]; source: "soundcloud" | "youtube"; artwork?: string | null; durationMs?: number | null };

interface YTPlayer {
  destroy?: () => void;
  setVolume?: (volume: number) => void;
  playVideo?: () => void;
}

type Deck = {
  type: "sc" | "yt";
  el?: HTMLAudioElement;          // SC deck
  yt?: YTPlayer | null;           // YouTube deck (iframe)
  gain: number;                   // software gain for crossfade
  ready: boolean;
  current?: Source | null;
  analyser?: AnalyserNode;
  raf?: number;
};

declare global { interface Window { YT?: any } }

export class AIDJEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private deckA: Deck;
  private deckB: Deck;
  private beatTimer?: number;
  private mixLenMs = 14000; // default 14s crossfade

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(this.ctx.destination);
    this.deckA = { type: "sc", gain: 1, ready: false };
    this.deckB = { type: "sc", gain: 0, ready: false };
  }

  private connectAudio(el: HTMLAudioElement, deck: Deck) {
    const src = this.ctx.createMediaElementSource(el);
    const g = this.ctx.createGain();
    g.gain.value = deck.gain;
    src.connect(g).connect(this.masterGain);
    // analyser for HUD/beat
    const an = this.ctx.createAnalyser();
    an.fftSize = 2048;
    g.connect(an);
    deck.analyser = an;
  }

  private tickBeat(deck: Deck) {
    if (!deck.analyser) return;
    const buf = new Uint8Array(deck.analyser.frequencyBinCount);
    deck.analyser.getByteTimeDomainData(buf);
    // quick amplitude spike as beat proxy
    let max = 0;
    for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i] - 128));
    const v = Math.min(1, max / 64);
    emitBeat(v);
  }

  private async analyzeOnce(el: HTMLAudioElement): Promise<{ bpm: number | null; energy: number | null; key: string | null }> {
    try {
      const ac = this.ctx;
      const resp = await fetch((el as any).src);
      const ab = await resp.arrayBuffer();
      const decoded = await ac.decodeAudioData(ab.slice(0)); // decode into real ctx
      // take first channel small window
      const ch = decoded.getChannelData(0).slice(0, Math.min(decoded.sampleRate * 8, decoded.length));
      const peaks = detectPeaks(ch, 0.5);
      const bpm = estimateBPM(peaks, decoded.sampleRate);
      const energy = estimateEnergy(ch);
      const key = guessKey();
      return { bpm, energy, key };
    } catch {
      return { bpm: null, energy: null, key: null };
    }
  }

  private setCrossfade(x: number) {
    // equal-power curve
    const a = Math.cos(0.5 * Math.PI * x);
    const b = Math.cos(0.5 * Math.PI * (1 - x));
    this.deckA.gain = a;
    this.deckB.gain = b;
    const update = (d: Deck) => {
      const an = d.analyser?.context as AudioContext;
      // gain node is upstream; to keep simple we adjust element volume too
      if (d.el) d.el.volume = d.gain;
      if (d.yt && d.yt.setVolume) d.yt.setVolume(Math.round(d.gain * 100));
    };
    update(this.deckA);
    update(this.deckB);
  }

  async playSoundCloud(src: Source, streamUrl: string, into: "A" | "B") {
    const deck = into === "A" ? this.deckA : this.deckB;
    // create / replace element
    if (deck.el) { try { deck.el.pause(); } catch {} }
    const el = new Audio();
    el.crossOrigin = "anonymous";
    el.src = streamUrl;
    el.preload = "auto";
    el.loop = false;
    el.volume = deck.gain;
    this.connectAudio(el, deck);
    deck.el = el;
    deck.type = "sc";
    deck.current = src;
    deck.ready = false;
    el.oncanplay = () => { deck.ready = true; el.play(); };
    // lightweight analysis
    setTimeout(async () => {
      const a = await this.analyzeOnce(el);
      emitNowPlaying({
        id: src.id, title: src.title, artists: src.artists, source: "soundcloud",
        bpm: a.bpm, energy: a.energy, key: a.key, durationMs: src.durationMs ?? null, positionMs: 0, artwork: src.artwork ?? null
      });
    }, 800);
    // start beat ticks
    cancelAnimationFrame(deck.raf!);
    const loop = () => { this.tickBeat(deck); deck.raf = requestAnimationFrame(loop); };
    deck.raf = requestAnimationFrame(loop);
  }

  async playYouTube(src: Source, videoId: string, into: "A" | "B") {
    const deck = into === "A" ? this.deckA : this.deckB;
    deck.type = "yt";
    deck.current = src;
    deck.ready = false;
    // lazy load YT iframe api
    if (!window.YT) {
      await new Promise<void>((res) => {
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        (window as any).onYouTubeIframeAPIReady = () => res();
        document.head.appendChild(s);
      });
    }
    // create hidden iframe
    const id = `yt-deck-${into}`;
    let host = document.getElementById(id) as HTMLDivElement;
    if (!host) {
      host = document.createElement("div");
      host.id = id;
      host.style.position = "fixed";
      host.style.left = "-9999px";
      host.style.top = "-9999px";
      document.body.appendChild(host);
    }
    // destroy previous
    if (deck.yt && deck.yt.destroy) deck.yt.destroy();
    deck.yt = new window.YT.Player(id, {
      videoId,
      playerVars: { autoplay: 1, controls: 0, disablekb: 1 },
      events: {
        onReady: () => {
          deck.ready = true;
          if (deck.yt?.setVolume) deck.yt.setVolume(Math.round(deck.gain * 100));
          if (deck.yt?.playVideo) deck.yt.playVideo();
          emitNowPlaying({
            id: src.id, title: src.title, artists: src.artists, source: "youtube",
            bpm: null, energy: null, key: null, durationMs: null, positionMs: 0, artwork: src.artwork ?? null
          });
        }
      }
    });
  }

  async crossfadeTo(next: Source) {
    // choose target deck
    const target = (this.deckA.gain < this.deckB.gain) ? "A" : "B";
    if (next.source === "soundcloud") {
      const r = await fetch(`/api/soundcloud/stream?id=${encodeURIComponent(next.id)}`).then(r=>r.json());
      if (!r?.url) throw new Error("No SC URL");
      await this.playSoundCloud(next, r.url, target);
    } else {
      await this.playYouTube(next, next.id, target);
    }
    // perform timed crossfade
    const steps = 40;
    const stepMs = this.mixLenMs / steps;
    for (let i = 0; i <= steps; i++) {
      const x = i / steps;
      this.setCrossfade(x);
      await new Promise(r => setTimeout(r, stepMs));
    }
    // swap roles
    this.setCrossfade(1); // B on-air
  }
}

