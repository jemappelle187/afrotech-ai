"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  MutableRefObject,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { useGLTF, PerspectiveCamera } from "@react-three/drei";

RectAreaLightUniformsLib.init();

export const GLB_TARGETS = {
  xfade: new THREE.Vector3(0, -0.25, 0.9),
  filterL: new THREE.Vector3(-0.7, -0.25, 0.9),
  jogL: new THREE.Vector3(-0.9, -0.25, 0.8),
  jogR: new THREE.Vector3(0.9, -0.25, 0.8),
};

function findNode(root: THREE.Object3D, names: string[]) {
  let hit: THREE.Object3D | null = null;
  const lowered = names.map((n) => n.toLowerCase());
  root.traverse((o) => {
    const n = o.name?.toLowerCase?.() ?? "";
    if (!n) return;
    if (lowered.some((key) => n.includes(key))) {
      hit = o;
    }
  });
  return hit;
}

function PioneerBooth(props: JSX.IntrinsicElements["group"]) {
  let gltf;
  try {
    gltf = useGLTF("/models/pioneer_rig.glb") as any;
  } catch (error) {
    console.error("[PioneerBooth] Error loading GLB:", error);
    return (
      <group {...props}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[2, 0.5, 1]} />
          <meshStandardMaterial color="#ff0000" />
        </mesh>
      </group>
    );
  }
  
  if (!gltf || !gltf.scene) {
    console.error("[PioneerBooth] GLB model failed to load - gltf:", gltf);
    return (
      <group {...props}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[2, 0.5, 1]} />
          <meshStandardMaterial color="#ff0000" />
        </mesh>
      </group>
    );
  }
  
  const scene = gltf.scene?.clone(true) ?? gltf.scene;
  console.log("[PioneerBooth] Model loaded successfully");
  
  // Store references to beat-reactive materials
  const beatReactiveMaterials = useRef<Array<{
    mesh: THREE.Mesh;
    material: THREE.Material;
    baseEmissive: THREE.Color;
    isJogWheel: boolean;
    isScreen: boolean;
    isButton: boolean;
  }>>([]);
  
  // Beat pulse from event bus
  const beatPulse = useRef(0);
  const energy = useRef(0.5);

  useMemo(() => {
    beatReactiveMaterials.current = [];
    scene.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        const m = obj.material;
        if (m && m.isMaterial) {
          // More realistic material properties with better visibility
          if (typeof m.metalness === "number")
            m.metalness = Math.max(
              0.3,
              Math.min(0.95, (m.metalness ?? 0.4) * 1.2)
            );
          if (typeof m.roughness === "number")
            m.roughness = Math.max(
              0.1,
              Math.min(0.6, (m.roughness ?? 0.3) * 0.8)
            );
          if ("envMapIntensity" in m) (m as any).envMapIntensity = 1.2;
          if ("toneMapped" in m) (m as any).toneMapped = true;
          
          // Increase base color brightness for better visibility
          if (m.color && m.color instanceof THREE.Color) {
            const currentBrightness = m.color.r + m.color.g + m.color.b;
            if (currentBrightness < 0.3) {
              // Brighten dark materials
              m.color.multiplyScalar(1.5);
            }
          }
          
          // Identify beat-reactive elements
          const name = (obj.name || "").toLowerCase();
          const isJogWheel = name.includes("jog") || name.includes("wheel") || name.includes("platter");
          const isScreen = name.includes("screen") || name.includes("display") || name.includes("lcd");
          const isButton = name.includes("button") || name.includes("pad") || name.includes("cue");
          
          if (isJogWheel || isScreen || isButton) {
            // Store base emissive color
            const baseEmissive = m.emissive ? m.emissive.clone() : new THREE.Color("#000000");
            if (!m.emissive) m.emissive = new THREE.Color("#000000");
            
            // Set visible initial emissive intensity
            const mat = m as any;
            if (typeof mat.emissiveIntensity === "number") {
              mat.emissiveIntensity = isJogWheel ? 0.4 : isScreen ? 0.6 : 0.3;
            } else {
              mat.emissiveIntensity = isJogWheel ? 0.4 : isScreen ? 0.6 : 0.3;
            }
            
            // Set subtle white/neutral emissive colors for realistic glow
            if (isJogWheel) {
              m.emissive.set("#ffffff"); // White glow for jog wheels
            } else if (isScreen) {
              m.emissive.set("#ffffff"); // White glow for screens
            } else if (isButton) {
              m.emissive.set("#ffffff"); // White glow for buttons
            }
            
            beatReactiveMaterials.current.push({
              mesh: obj,
              material: m,
              baseEmissive,
              isJogWheel,
              isScreen,
              isButton,
            });
          } else {
            // Non-reactive materials - keep dark
            if (m.emissive && m.emissive.set) m.emissive.set("#000000");
            const mat = m as any;
            if (typeof mat.emissiveIntensity === "number")
              mat.emissiveIntensity = 0.0;
          }
        }
      }
    });
  }, [scene]);
  
  // Listen to beat events
  useEffect(() => {
    const onBeat = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      beatPulse.current = detail?.v ?? 0;
    };
    
    const onNowPlaying = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      energy.current = typeof detail?.energy === "number" ? detail.energy : 0.5;
    };
    
    window.addEventListener("afrotech:beat", onBeat as EventListener);
    window.addEventListener("afrotech:nowplaying", onNowPlaying as EventListener);
    
    return () => {
      window.removeEventListener("afrotech:beat", onBeat as EventListener);
      window.removeEventListener("afrotech:nowplaying", onNowPlaying as EventListener);
    };
  }, []);
  
  // Animate beat-reactive materials
  useFrame(() => {
    const pulse = beatPulse.current;
    const energyLevel = energy.current;
    const beatIntensity = 1 + pulse * (0.6 + energyLevel * 0.4);
    
      beatReactiveMaterials.current.forEach(({ material, isJogWheel, isScreen, isButton }) => {
      // Type guard for materials with emissiveIntensity
      const mat = material as any;
      if (typeof mat.emissiveIntensity === "number") {
        if (isJogWheel) {
          // Jog wheels visible pulse
          mat.emissiveIntensity = 0.4 + pulse * 0.3 * (1 + energyLevel * 0.5);
        } else if (isScreen) {
          // Screens have steady visible glow with pulse
          mat.emissiveIntensity = 0.6 + pulse * 0.2 * energyLevel;
        } else if (isButton) {
          // Buttons visible flash on beat
          mat.emissiveIntensity = 0.3 + pulse * 0.25 * beatIntensity;
        }
      }
    });
  });

  const xfade = useMemo<THREE.Object3D | null>(
    () => findNode(scene, ["xfader", "crossfader", "fader"]),
    [scene]
  );
  const leftFilter = useMemo<THREE.Object3D | null>(
    () => findNode(scene, ["filter", "knob", "hp", "lp", "resonance"]),
    [scene]
  );
  const jogL = useMemo<THREE.Object3D | null>(
    () => findNode(scene, ["jog", "wheel", "left", "decka", "deck1"]),
    [scene]
  );
  const jogR = useMemo<THREE.Object3D | null>(
    () => findNode(scene, ["jog", "wheel", "right", "deckb", "deck2"]),
    [scene]
  );

  const xfadeAnim = useRef<{
    t0: number;
    dur: number;
    from: number;
    to: number;
  } | null>(null);
  const filterAnim = useRef<{
    t0: number;
    dur: number;
    from: number;
    to: number;
  } | null>(null);
  const jogSpin = useRef<{ speedL: number; speedR: number }>({
    speedL: 0,
    speedR: 0,
  });
  const xfadeCenter = useMemo(() => xfade?.position?.x ?? 0, [xfade]);
  const filterBase = useMemo(() => leftFilter?.rotation?.y ?? 0, [leftFilter]);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const crossState = useRef<{ last: number }>({ last: 1 });

  useEffect(() => {
    const onX = (e: Event) => {
      const detail = (e as CustomEvent).detail as { duration?: number } | null;
      const dur = Math.max(0.6, detail?.duration ?? 1.2);
      const now = performance.now() / 1000;
      crossState.current.last *= -1;
      const range = 0.42;
      const from = xfade?.position?.x ?? xfadeCenter;
      const to = xfadeCenter + crossState.current.last * range;
      xfadeAnim.current = { t0: now, dur, from, to };
      jogSpin.current = { speedL: 6, speedR: -6 };
      window.setTimeout(() => {
        jogSpin.current = { speedL: 0.8, speedR: -0.8 };
      }, dur * 1000);
    };

    const onF = (e: Event) => {
      const detail = (e as CustomEvent).detail as { duration?: number } | null;
      const dur = Math.max(0.4, detail?.duration ?? 0.9);
      const now = performance.now() / 1000;
      filterAnim.current = {
        t0: now,
        dur,
        from: leftFilter?.rotation?.y ?? filterBase,
        to: filterBase + Math.PI * 0.6,
      };
    };

    window.addEventListener("afrotech:dj:crossfade", onX);
    window.addEventListener("afrotech:dj:filter", onF);
    return () => {
      window.removeEventListener("afrotech:dj:crossfade", onX);
      window.removeEventListener("afrotech:dj:filter", onF);
    };
  }, [filterBase, leftFilter, xfade, xfadeCenter]);

  useEffect(() => {
    return () => {
      GLB_TARGETS.xfade.copy(DEFAULT_XFADE_TARGET);
      GLB_TARGETS.filterL.copy(DEFAULT_FILTER_TARGET);
      GLB_TARGETS.jogL.set(-0.9, -0.25, 0.8);
      GLB_TARGETS.jogR.set(0.9, -0.25, 0.8);
    };
  }, []);

  useFrame(() => {
    const now = performance.now() / 1000;
    if (xfade && xfadeAnim.current) {
      const { t0, dur, from, to } = xfadeAnim.current;
      const u = THREE.MathUtils.clamp((now - t0) / dur, 0, 1);
      const k = u < 1 ? THREE.MathUtils.smoothstep(u, 0, 1) : 1;
      xfade.position.x = THREE.MathUtils.lerp(from, to, k);
      if (u >= 1) xfadeAnim.current = null;
    }

    if (leftFilter && filterAnim.current) {
      const { t0, dur, from, to } = filterAnim.current;
      const u = THREE.MathUtils.clamp((now - t0) / dur, 0, 1);
      const k = u < 1 ? THREE.MathUtils.smoothstep(u, 0, 1) : 1;
      leftFilter.rotation.y = THREE.MathUtils.lerp(from, to, k);
      if (u >= 1) {
        leftFilter.rotation.y = filterBase;
        filterAnim.current = null;
      }
    }

    if (jogL) {
      jogL.rotation.y += (jogSpin.current.speedL || 0) * 0.008;
    }
    if (jogR) {
      jogR.rotation.y += (jogSpin.current.speedR || 0) * 0.008;
    }
    jogSpin.current.speedL *= 0.98;
    jogSpin.current.speedR *= 0.98;
    if (Math.abs(jogSpin.current.speedL) < 0.01) jogSpin.current.speedL = 0;
    if (Math.abs(jogSpin.current.speedR) < 0.01) jogSpin.current.speedR = 0;

    if (xfade) {
      xfade.updateWorldMatrix(true, false);
      GLB_TARGETS.xfade.copy(xfade.getWorldPosition(scratch));
    }
    if (leftFilter) {
      leftFilter.updateWorldMatrix(true, false);
      GLB_TARGETS.filterL.copy(leftFilter.getWorldPosition(scratch));
    }
    if (jogL) {
      jogL.updateWorldMatrix(true, false);
      GLB_TARGETS.jogL.copy(jogL.getWorldPosition(scratch));
    }
    if (jogR) {
      jogR.updateWorldMatrix(true, false);
      GLB_TARGETS.jogR.copy(jogR.getWorldPosition(scratch));
    }
  });

  return <primitive object={scene} {...props} />;
}

useGLTF.preload("/models/pioneer_rig.glb");

type Gesture = {
  start: number;
  duration: number;
  target: THREE.Vector3;
};

const DEFAULT_XFADE_TARGET = new THREE.Vector3(0, -0.25, 0.9);
const DEFAULT_FILTER_TARGET = new THREE.Vector3(-0.7, -0.25, 0.9);
function getXFadeTarget() {
  return (GLB_TARGETS.xfade ?? DEFAULT_XFADE_TARGET).clone();
}
function getFilterTarget() {
  return (GLB_TARGETS.filterL ?? DEFAULT_FILTER_TARGET).clone();
}
const RIGHT_HAND_ORIGIN = new THREE.Vector3(0.32, -0.12, 0.35);
const LEFT_HAND_ORIGIN = new THREE.Vector3(-0.32, -0.12, 0.35);

// --- smoothing helpers (critically-damped interpolation) ---
const _tmpV3 = new THREE.Vector3();

function dampScalar(
  current: number,
  target: number,
  lambda: number,
  dt: number
) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

function dampVec3(
  current: THREE.Vector3,
  target: THREE.Vector3,
  lambda: number,
  dt: number
) {
  current.x = dampScalar(current.x, target.x, lambda, dt);
  current.y = dampScalar(current.y, target.y, lambda, dt);
  current.z = dampScalar(current.z, target.z, lambda, dt);
  return current;
}

function lerpVec3(a: THREE.Vector3, b: THREE.Vector3, alpha: number) {
  _tmpV3.copy(a).lerp(b, alpha);
  return _tmpV3;
}

// --- Beat clock: derives a smooth pulse and beat events from BPM ---
function useBeatClock() {
  const bpmRef = useRef<number | null>(null);
  const playingRef = useRef(false);
  const energyRef = useRef(0.5);
  const pulseRef = useRef(0);
  const lastBeatMs = useRef<number | null>(null);

  useEffect(() => {
    // Seed from global store
    if (typeof window !== "undefined") {
      const seed = window.__afro?.nowplaying;
      if (seed?.bpm) bpmRef.current = seed.bpm;
      if (typeof seed?.energy === "number") energyRef.current = seed.energy;
      playingRef.current = !!window.__afro?.playing;
    }

    const onNP = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (typeof d?.bpm === "number") bpmRef.current = d.bpm;
      if (typeof d?.energy === "number") energyRef.current = d.energy;
    };

    const onTransport = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      playingRef.current = !!d.playing;
      lastBeatMs.current = null;
    };

    window.addEventListener("afrotech:nowplaying", onNP as EventListener);
    window.addEventListener("afrotech:transport", onTransport as EventListener);
    return () => {
      window.removeEventListener("afrotech:nowplaying", onNP as EventListener);
      window.removeEventListener(
        "afrotech:transport",
        onTransport as EventListener
      );
    };
  }, []);

  useFrame(() => {
    const bpm = bpmRef.current;
    if (!playingRef.current || !bpm || bpm <= 0) {
      pulseRef.current = 0;
      return;
    }

    const now = performance.now();
    const quarterMs = 60_000 / bpm;

    if (lastBeatMs.current == null) {
      lastBeatMs.current = now;
      return;
    }

    const dt = now - lastBeatMs.current;
    const phase = (dt % quarterMs) / quarterMs;
    pulseRef.current = Math.max(0, Math.sin(phase * Math.PI));

    if (dt >= quarterMs) {
      lastBeatMs.current = now;
      window.dispatchEvent(new CustomEvent("afrotech:beat"));
    }
  });

  return { pulse: pulseRef.current, energyRef };
}

function HazeBursts({
  pulse,
  energyRef,
}: {
  pulse: number;
  energyRef: MutableRefObject<number>;
}) {
  const count = 16;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const alphas = useRef<number[]>(Array(count).fill(0));
  const life = useRef<number[]>(Array(count).fill(0));
  const lifeMax = useRef<number[]>(Array(count).fill(1));
  const seeds = useRef<number[]>(
    Array.from({ length: count }, () => Math.random())
  );
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
  }, []);

  useEffect(() => {
    function onBeat(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.kind !== "quarter") return;

      for (let i = 0; i < 2; i += 1) {
        const idx = Math.floor(Math.random() * count);
        const lifespan = 0.75 + Math.random() * 0.6;
        life.current[idx] = lifespan;
        lifeMax.current[idx] = lifespan;
        alphas.current[idx] = 0.18 + energyRef.current * 0.12;
      }
    }

    window.addEventListener("afrotech:beat", onBeat as EventListener);
    return () =>
      window.removeEventListener("afrotech:beat", onBeat as EventListener);
  }, [count, energyRef]);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < count; i += 1) {
      if (life.current[i] > 0) {
        life.current[i] = Math.max(0, life.current[i] - dt);
      }

      const maxLife = lifeMax.current[i] || 1;
      const remaining = life.current[i];
      const ratio = maxLife > 0 ? remaining / maxLife : 0;
      const strength = alphas.current[i] * ratio;

      const seed = seeds.current[i];
      dummy.position.set(
        (seed - 0.5) * 0.7,
        1.05 + strength * 0.45,
        0.15 + (seed - 0.5) * 0.2
      );
      const scale = strength > 0 ? 0.25 + strength * 1.05 : 0.01;
      dummy.scale.setScalar(scale);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      if (remaining <= 0) {
        alphas.current[i] = 0;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined as any, undefined as any, count]}
    >
      <planeGeometry args={[0.6, 0.6]} />
      <meshBasicMaterial
        color="#99a2ff"
        transparent
        depthWrite={false}
        opacity={0.12 + pulse * 0.06}
      />
    </instancedMesh>
  );
}

function LightRig({
  pulse,
  energyRef,
}: {
  pulse: number;
  energyRef: MutableRefObject<number>;
}) {
  const key = useRef<THREE.RectAreaLight>(null);
  const rim = useRef<THREE.SpotLight>(null);
  const fill = useRef<THREE.PointLight>(null);
  const accentLeft = useRef<THREE.PointLight>(null);
  const accentRight = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const energy = THREE.MathUtils.clamp(energyRef.current, 0, 1);
    const t = clock.getElapsedTime();
    const breathe = 0.85 + Math.sin(t * 0.3) * 0.05;
    const hit = 1 + pulse * (0.4 + energy * 0.3);

    if (key.current) key.current.intensity = 3.5 * breathe * hit;
    if (rim.current) rim.current.intensity = 2.8 * hit;
    if (fill.current) fill.current.intensity = 1.8 * (0.8 + energy * 0.4);
    
    // Accent lights that pulse with beat
    if (accentLeft.current) {
      accentLeft.current.intensity = 0.6 + pulse * 0.8 * hit;
    }
    if (accentRight.current) {
      accentRight.current.intensity = 0.6 + pulse * 0.8 * hit;
    }
  });

  return (
    <>
      <rectAreaLight
        ref={key}
        position={[0.7, 1.85, 1.15]}
        width={3.5}
        height={1.4}
        intensity={3.5}
        color="#ffffff"
        onUpdate={(light) => light.lookAt(0, 0.95, 0.1)}
      />
      <spotLight
        ref={rim}
        position={[0, 2.2, -3.4]}
        angle={0.55}
        penumbra={1.0}
        intensity={2.8}
        color="#ffffff"
        castShadow
        shadow-bias={-0.00035}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight
        ref={fill}
        position={[-1.1, 1.4, 1.1]}
        intensity={1.8}
        color="#ffffff"
        decay={2}
      />
      {/* Subtle accent lights for atmosphere */}
      <pointLight
        ref={accentLeft}
        position={[-2.5, 1.8, 0]}
        intensity={0.4}
        color="#ffffff"
        distance={4}
        decay={2}
      />
      <pointLight
        ref={accentRight}
        position={[2.5, 1.8, 0]}
        intensity={0.4}
        color="#ffffff"
        distance={4}
        decay={2}
      />
    </>
  );
}

function useAvatarEvents(
  bpmRef: MutableRefObject<number>,
  energyRef: MutableRefObject<number>,
  crossfadeRef: MutableRefObject<Gesture | null>,
  filterRef: MutableRefObject<Gesture | null>
) {
  useEffect(() => {
    function onNowPlaying(e: Event) {
      const detail = (e as CustomEvent).detail ?? {};
      const bpm = typeof detail?.bpm === "number" ? detail.bpm : 120;
      const energy = typeof detail?.energy === "number" ? detail.energy : 0.5;
      bpmRef.current = THREE.MathUtils.clamp(bpm, 60, 180);
      energyRef.current = THREE.MathUtils.clamp(energy, 0, 1);
    }

    function onCrossfade(e: Event) {
      const detail = (e as CustomEvent).detail as
        | { duration?: number }
        | undefined;
      const now = performance.now();
      crossfadeRef.current = {
        start: now,
        duration: (Math.max(0.4, detail?.duration ?? 4) * 1000) / 1.25,
        target: getXFadeTarget(),
      };
    }

    function onFilter(e: Event) {
      const detail = (e as CustomEvent).detail as
        | { duration?: number }
        | undefined;
      const now = performance.now();
      filterRef.current = {
        start: now,
        duration: detail?.duration ? detail.duration * 1000 : 900,
        target: getFilterTarget(),
      };
    }

    window.addEventListener(
      "afrotech:nowplaying",
      onNowPlaying as EventListener
    );
    window.addEventListener(
      "afrotech:dj:crossfade",
      onCrossfade as EventListener
    );
    window.addEventListener("afrotech:dj:filter", onFilter as EventListener);

    return () => {
      window.removeEventListener(
        "afrotech:nowplaying",
        onNowPlaying as EventListener
      );
      window.removeEventListener(
        "afrotech:dj:crossfade",
        onCrossfade as EventListener
      );
      window.removeEventListener(
        "afrotech:dj:filter",
        onFilter as EventListener
      );
    };
  }, [bpmRef, energyRef, crossfadeRef, filterRef]);
}

function HoodieRig() {
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);

  const bpmRef = useRef<number>(120);
  const energyRef = useRef<number>(0.5);
  const crossfadeGestureRef = useRef<Gesture | null>(null);
  const filterGestureRef = useRef<Gesture | null>(null);

  useAvatarEvents(bpmRef, energyRef, crossfadeGestureRef, filterGestureRef);

  const baseColor = useMemo(() => new THREE.Color("#050505"), []);
  const restLookRight = useMemo(() => new THREE.Vector3(0.3, 0.9, 0.4), []);
  const restLookLeft = useMemo(() => new THREE.Vector3(-0.3, 0.9, 0.4), []);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const bpm = bpmRef.current;
    const energy = energyRef.current;
    const groove = Math.sin((t * bpm * Math.PI) / 60) * 0.2 * energy;
    const phase = (t * bpm) / 60;

    if (bodyRef.current) {
      bodyRef.current.rotation.z = groove * 0.35;
      bodyRef.current.rotation.x = groove * 0.15;
      bodyRef.current.position.y = 1.05 + groove * 0.05;
    }
    if (headRef.current) {
      headRef.current.position.y = 1.6 + groove * 0.06;
      headRef.current.rotation.y = groove * 0.15;
    }

    const now = performance.now();

    function applyGesture(
      ref: MutableRefObject<THREE.Group | null>,
      origin: THREE.Vector3,
      gesture: Gesture | null,
      idleSwing: number,
      restLook: THREE.Vector3
    ) {
      const group = ref.current;
      if (!group) return;

      let desired = origin;

      if (gesture) {
        const elapsed = now - gesture.start;
        const progress = THREE.MathUtils.clamp(
          elapsed / gesture.duration,
          0,
          1
        );
        const eased =
          progress < 1 ? THREE.MathUtils.smoothstep(progress, 0, 1) : 1;
        const tgt = gesture.target;
        desired = lerpVec3(origin, tgt, eased);
        if (progress >= 1) {
          if (ref === rightArmRef) crossfadeGestureRef.current = null;
          if (ref === leftArmRef) filterGestureRef.current = null;
          desired = lerpVec3(tgt, origin, 0.35);
        }
      } else {
        const swayX =
          Math.sin(t * 1.5 + idleSwing) * 0.05 * (0.3 + energy * 0.7);
        const swayY =
          Math.cos(t * 1.3 + idleSwing) * 0.025 * (0.4 + energy * 0.6);
        desired = _tmpV3.set(origin.x + swayX, origin.y + swayY, origin.z);
      }

      dampVec3(group.position, desired, 12, delta);
      const look = gesture ? gesture.target : restLook;
      group.lookAt(look.x, look.y, look.z);
    }

    applyGesture(
      rightArmRef,
      RIGHT_HAND_ORIGIN,
      crossfadeGestureRef.current,
      0.2,
      restLookRight
    );
    applyGesture(
      leftArmRef,
      LEFT_HAND_ORIGIN,
      filterGestureRef.current,
      -0.2,
      restLookLeft
    );
  });

  return (
    <group position={[0, 1.3, 0]} scale={[1.05, 1.05, 1.05]}>
      {/* floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.3, 0]}
        receiveShadow
      >
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#0d0d12" metalness={0.4} roughness={0.6} />
      </mesh>

      {/* platform */}
      <mesh position={[0, -0.48, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 0.05, 1.8]} />
        <meshStandardMaterial
          color="#07070d"
          metalness={0.15}
          roughness={0.75}
        />
      </mesh>

      {/* decks & mixer (GLB) */}
      <group position={[0, 0, 0.9]}>
        {/* Pioneer GLB */}
        <PioneerBooth scale={[1.05, 1.05, 1.05]} position={[0, -0.26, 0]} />

        {/* Fallback placeholder geometry (hidden) */}
        <group visible={false}>
          <mesh position={[-0.9, -0.28, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.1, 0.08, 0.7]} />
            <meshStandardMaterial
              color="#11131c"
              roughness={0.8}
              metalness={0.2}
              emissive="#1a1f3f"
              emissiveIntensity={0.3}
            />
          </mesh>
          <mesh position={[0.9, -0.28, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.1, 0.08, 0.7]} />
            <meshStandardMaterial
              color="#11131c"
              roughness={0.8}
              metalness={0.2}
              emissive="#1a1f3f"
              emissiveIntensity={0.3}
            />
          </mesh>
          <mesh position={[0, -0.28, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.8, 0.07, 0.7]} />
            <meshStandardMaterial
              color="#11131c"
              roughness={0.75}
              metalness={0.25}
              emissive="#1a1f3f"
              emissiveIntensity={0.3}
            />
          </mesh>
        </group>
      </group>

      {/* body */}
      <group ref={bodyRef} position={[0, -0.2, 0]} castShadow>
        <mesh position={[0, 0.3, 0]}>
          <capsuleGeometry args={[0.32, 0.8, 16, 32]} />
          <meshStandardMaterial
            color={baseColor}
            roughness={0.9}
            metalness={0.1}
          />
        </mesh>
        <mesh ref={headRef} position={[0, 0.82, 0]}>
          <sphereGeometry args={[0.26, 24, 24]} />
          <meshStandardMaterial
            color={baseColor}
            roughness={0.75}
            metalness={0.05}
          />
        </mesh>
        {/* shoulders */}
        <mesh position={[0, 0.56, 0]}>
          <torusGeometry args={[0.35, 0.08, 12, 32]} />
          <meshStandardMaterial
            color={baseColor}
            roughness={0.8}
            metalness={0.1}
          />
        </mesh>
        <group ref={rightArmRef} position={RIGHT_HAND_ORIGIN.toArray()}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.6, 12]} />
            <meshStandardMaterial
              color={baseColor}
              roughness={0.85}
              metalness={0.05}
            />
          </mesh>
          <mesh position={[0, -0.32, 0]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial
              color={baseColor}
              roughness={0.8}
              metalness={0.05}
            />
          </mesh>
        </group>
        <group ref={leftArmRef} position={LEFT_HAND_ORIGIN.toArray()}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.6, 12]} />
            <meshStandardMaterial
              color={baseColor}
              roughness={0.85}
              metalness={0.05}
            />
          </mesh>
          <mesh position={[0, -0.32, 0]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial
              color={baseColor}
              roughness={0.8}
              metalness={0.05}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function BeatLayer() {
  const { pulse, energyRef } = useBeatClock();
  return (
    <>
      <LightRig pulse={pulse} energyRef={energyRef} />
      <HazeBursts pulse={pulse} energyRef={energyRef} />
    </>
  );
}

export function HoodieDJ() {
  // Camera target focused on Pioneer equipment (at z=0.9, y=-0.26)
  const cameraTarget = useMemo(() => new THREE.Vector3(0, -0.2, 0.9), []);
  const fogArgs = useMemo(
    () => [new THREE.Color("#06060a"), 10, 25] as [THREE.Color, number, number],
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0">
      <Canvas
        className="w-full h-full"
        style={{ width: "100%", height: "100%" }}
        shadows
        dpr={[1, 1.5]}
        onCreated={({ gl }) => {
          // @ts-ignore
          gl.physicallyCorrectLights = true;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.outputEncoding = THREE.sRGBEncoding;
        }}
      >
        <color attach="background" args={["#05070d"]} />
        <fog attach="fog" args={fogArgs} />
        <Suspense fallback={
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        }>
          <group position={[0, 0.5, 2.5]}>
            <PerspectiveCamera
              makeDefault
              fov={55}
              near={0.1}
              far={50}
              position={[0, 0.5, 2.5]}
              onUpdate={(cam) => cam.lookAt(cameraTarget)}
            />
          </group>
          <BeatLayer />
          {/* Ambient light for base illumination */}
          <ambientLight intensity={0.85} />
          {/* Pioneer DJ Equipment - centered and well-lit */}
          <group position={[0, 0, 0.9]}>
            <PioneerBooth scale={[1.1, 1.1, 1.1]} position={[0, -0.26, 0]} />
          </group>
          {/* Platform for equipment */}
          <mesh position={[0, -0.48, 0.9]} castShadow receiveShadow>
            <boxGeometry args={[3.6, 0.05, 1.8]} />
            <meshStandardMaterial
              color="#0a0a0f"
              metalness={0.2}
              roughness={0.7}
            />
          </mesh>
        </Suspense>
      </Canvas>
    </div>
  );
}

export default HoodieDJ;
