export type Context = {
  dBPM: number;
  keyCompat: 0 | 1;
  dEnergy: number;
  sectionPos: number;
};

export type Action = "straight_xfade" | "filter_sweep" | "echo_out";

const ACTIONS: Action[] = ["straight_xfade", "filter_sweep", "echo_out"];
const FEATURE_COUNT = 5; // bias + 4 features
const STORAGE_KEY = "afrotech_bandit";
const LEARNING_RATE = 0.08;

type Weights = Record<Action, number[]>;

let weights: Weights = loadWeights();
let lastVector: number[] | null = null;
let lastAction: Action | null = null;

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

function contextToVector(ctx: Context): number[] {
  return [
    1, // bias
    clamp(ctx.dBPM / 20, -2, 2),
    ctx.keyCompat,
    clamp(ctx.dEnergy, -1, 1),
    clamp(ctx.sectionPos, 0, 1),
  ];
}

function loadWeights(): Weights {
  if (typeof window === "undefined") {
    return {
      straight_xfade: new Array(FEATURE_COUNT).fill(0),
      filter_sweep: new Array(FEATURE_COUNT).fill(0),
      echo_out: new Array(FEATURE_COUNT).fill(0),
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as Weights;
    const hasAll = ACTIONS.every((a) => Array.isArray(parsed?.[a]));
    if (!hasAll) throw new Error("missing action weights");
    return parsed;
  } catch {
    return {
      straight_xfade: new Array(FEATURE_COUNT).fill(0),
      filter_sweep: new Array(FEATURE_COUNT).fill(0),
      echo_out: new Array(FEATURE_COUNT).fill(0),
    };
  }
}

function persistWeights() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
  } catch (err) {
    console.warn("learner: failed to persist weights", err);
  }
}

function score(action: Action, vec: number[]): number {
  const w = weights[action];
  let total = 0;
  for (let i = 0; i < FEATURE_COUNT; i += 1) {
    total += (w?.[i] ?? 0) * vec[i];
  }
  return total;
}

function randomAction(): Action {
  return ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
}

function updateWeights(reward: number) {
  if (!lastVector || !lastAction) return;
  const w = weights[lastAction];
  for (let i = 0; i < FEATURE_COUNT; i += 1) {
    w[i] = (w[i] ?? 0) + LEARNING_RATE * reward * lastVector[i];
  }
  persistWeights();
}

export function pickAction(ctx: Context, eps = 0.15): Action {
  const vec = contextToVector(ctx);
  let chosen: Action;

  if (Math.random() < eps) {
    chosen = randomAction();
  } else {
    const ranked = ACTIONS.map((a) => ({ action: a, score: score(a, vec) })).sort(
      (a, b) => b.score - a.score
    );
    chosen = ranked[0]?.action ?? randomAction();
  }

  lastVector = vec;
  lastAction = chosen;
  return chosen;
}

const REWARD_MAP: Record<"like" | "dislike" | "applause", number> = {
  like: 1,
  applause: 0.5,
  dislike: -1,
};

export function sendReward(type: "like" | "dislike" | "applause") {
  const reward = REWARD_MAP[type];
  updateWeights(reward);
}




