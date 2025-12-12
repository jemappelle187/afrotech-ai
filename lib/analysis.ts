// Minimal, fast-enough estimators (heuristics) for BPM & energy from audio time-domain data.
// We keep it light for the browser MVP; can swap with a more robust lib later.
export type AnalysisResult = { bpm: number | null; energy: number | null; key: string | null };

export function estimateEnergy(samples: Float32Array): number {
  // RMS as proxy for energy, normalized 0..1
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    sum += v * v;
  }
  const rms = Math.sqrt(sum / samples.length);
  return Math.max(0, Math.min(1, rms * 3)); // rough scale
}

export function estimateBPM(peaks: number[], sampleRate: number): number | null {
  // simple peak-interval histogram
  if (peaks.length < 2) return null;
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) intervals.push(peaks[i] - peaks[i - 1]);
  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)];
  const seconds = median / sampleRate;
  if (seconds <= 0) return null;
  let bpm = 60 / seconds;
  // normalize to 80..180 range
  while (bpm < 80) bpm *= 2;
  while (bpm > 180) bpm /= 2;
  return Math.round(bpm);
}

export function detectPeaks(channel: Float32Array, threshold = 0.6): number[] {
  const peaks: number[] = [];
  let last = -1e9;
  for (let i = 0; i < channel.length; i++) {
    const v = Math.abs(channel[i]);
    if (v > threshold && i - last > 2000) {
      peaks.push(i);
      last = i;
    }
  }
  return peaks;
}

export function guessKey(): string | null {
  // Placeholder (fast): we'll enrich later
  return null;
}


