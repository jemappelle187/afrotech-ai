"use client";

import { Canvas, useFrame, extend } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { EffectComposer as _EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass as _RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass as _UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// Register postprocessing classes
extend({
  EffectComposer: _EffectComposer,
  RenderPass: _RenderPass,
  UnrealBloomPass: _UnrealBloomPass,
});
import {
  OrbitControls,
  PerspectiveCamera,
  shaderMaterial,
  Environment,
  ContactShadows,
  RoundedBox,
  MeshReflectorMaterial,
  useGLTF,
  Html,
  useProgress,
} from "@react-three/drei";
import {
  EffectComposer,
  SMAA,
  N8AO,
  Bloom,
  Vignette,
  Noise,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useMemo, useRef, Suspense, useState, useEffect } from "react";
import * as THREE from "three";
import { palette } from "@/lib/palettes";

interface SceneProps {
  environment: "darkroom" | "beach";
  beat: number;
}

// === Volumetric curtain shader material ===
const CurtainMat = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color("#7ec8ff"),
    uIntensity: 1,
    uNoiseScale: 1.5,
    uOpacity: 0.9,
  },
  /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  /* glsl */ `
  varying vec2 vUv;
  uniform float uTime; uniform vec3 uColor; uniform float uIntensity; uniform float uNoiseScale; uniform float uOpacity;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p);
    float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
    vec2 u=f*f*(3.-2.*f);
    return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
  }
  void main(){
    float center = 1.0 - abs(vUv.x - 0.5) * 2.0; center = pow(clamp(center,0.0,1.0), 1.2);
    float n = noise(vec2(vUv.x*8.0, vUv.y*4.0 + uTime*0.6) * uNoiseScale);
    n = smoothstep(0.45, 1.0, n);
    float vfade = smoothstep(0.05,0.3,vUv.y) * (1.0 - smoothstep(0.7,1.0,vUv.y));
    float a = center * n * vfade * uOpacity;
    vec3 col = uColor * (0.6 + 0.4*n) * uIntensity;
    gl_FragColor = vec4(col, a);
    gl_FragColor.rgb *= gl_FragColor.a; // additive-ish
  }`
);
extend({ CurtainMat });

// === Fullscreen Atmospheric Haze overlay ===
const HazeMat = shaderMaterial(
  {
    uTime: 0,
    uDensity: 0.9,
    uColor: new THREE.Color("#ffffff"),
    uStrength: 0.8,
  },
  `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0); }`,
  `varying vec2 vUv; uniform float uTime; uniform float uDensity; uniform vec3 uColor; uniform float uStrength;
   float h(vec2 p){ return fract(sin(dot(p, vec2(41.29,95.07))) * 43758.5453); }
   float n(vec2 p){ vec2 i=floor(p), f=fract(p);
     float a=h(i), b=h(i+vec2(1,0)), c=h(i+vec2(0,1)), d=h(i+vec2(1,1));
     vec2 u=f*f*(3.-2.*f);
     return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;
   }
   void main(){
     float fog = smoothstep(0.2, 1.0, n(vUv*2.0 + vec2(0.0, uTime*0.03))) * uDensity;
     float d = distance(vUv, vec2(0.5)); fog *= 1.2 - smoothstep(0.0, 0.8, d);
     vec3 col = uColor * fog * uStrength;
     gl_FragColor = vec4(col, fog*0.9);
   }`
);
extend({ HazeMat });

function AtmosphericHaze({
  strength = 0.85,
  color = "#ffffff",
  position = [0, 0, 0] as [number, number, number],
  scale = [2, 2] as [number, number],
}: {
  strength?: number;
  color?: string;
  position?: [number, number, number];
  scale?: [number, number];
}) {
  const mat = useRef<any>(null!);
  useFrame((_, dt) => {
    if (mat.current) mat.current.uTime += dt;
  });
  return (
    <mesh
      renderOrder={999}
      frustumCulled={false}
      position={position}
      scale={[scale[0], scale[1], 1]}
    >
      <planeGeometry args={[1, 1]} />
      {/* @ts-ignore */}
      <hazeMat
        ref={mat}
        uStrength={strength}
        uColor={new THREE.Color(color)}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

function BloomComposer() {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<any>(null!);
  const renderPassRef = useRef<any>(null!);
  const bloomPassRef = useRef<any>(null!);

  useFrame((_, dt) => {
    if (composerRef.current) composerRef.current.render(dt);
  }, 1);

  return (
    // @ts-ignore R3F intrinsic
    <effectComposer ref={composerRef} args={[gl]}>
      {/* @ts-ignore */}
      <renderPass ref={renderPassRef} args={[scene, camera]} />
      {/* @ts-ignore */}
      <unrealBloomPass
        ref={bloomPassRef}
        args={[[size.width, size.height], 1.15, 0.8, 0.25]}
      />
    </effectComposer>
  );
}

// Preload model so it's ready if present
useGLTF.preload("/models/pioneer_rig.glb");

// === Loader Component ===
function Loader() {
  const { progress } = useProgress();
  return (
    <Html center style={{ pointerEvents: "none" }}>
      <div style={{ color: "#bbb", fontSize: 12 }}>
        Loading gear… {progress.toFixed(0)}%
      </div>
    </Html>
  );
}

// === Real Gear Auto-Fit for glTF models ===
function RealGearAutoFit({
  url,
  targetWidth = 3.8, // desired total width on desk
  placeAt = [0, 1.06, 0.22] as [number, number, number],
  faceCamera = true,
  rotationY,
  showHelperSeconds = 3, // temporary Box3 helper
  onReady,
}: {
  url: string;
  targetWidth?: number;
  placeAt?: [number, number, number];
  faceCamera?: boolean;
  rotationY?: number;
  showHelperSeconds?: number;
  onReady?: () => void;
}) {
  const { scene } = useGLTF(url);
  // Kill plastic toy sheen
  scene.traverse((o: any) => {
    if (o.isMesh && o.material) {
      const m = o.material;
      o.castShadow = true;
      o.receiveShadow = true;
      if (m.map) m.map.encoding = THREE.sRGBEncoding;
      m.roughness = THREE.MathUtils.clamp(
        (m.roughness ?? 0.7) * 1.1,
        0.65,
        0.92
      );
      m.metalness = THREE.MathUtils.clamp(
        (m.metalness ?? 0.2) * 0.8,
        0.05,
        0.25
      );
      if ("emissiveIntensity" in m) {
        m.emissiveIntensity = (m.emissiveIntensity || 0) * 0.35;
      }
    }
  });

  // Put model under a root so we can re-center/scale safely
  const root = new THREE.Group();
  root.add(scene);

  // Ensure matrices are up to date before measuring
  root.updateWorldMatrix(true, true);
  scene.updateWorldMatrix(true, true);

  // Measure
  const originalBox = new THREE.Box3().setFromObject(scene);
  if (originalBox.isEmpty()) {
    console.warn("GLB has empty bounds; falling back to primitives.");
    return null;
  }
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  originalBox.getSize(size);
  originalBox.getCenter(center);

  // Recenter around origin
  scene.position.sub(center);
  scene.updateWorldMatrix(true, true);

  // Re-measure after centering to get correct bottom
  const centeredBox = new THREE.Box3().setFromObject(scene);
  const centeredSize = new THREE.Vector3();
  centeredBox.getSize(centeredSize);

  // Compute scale
  const width = Math.max(centeredSize.x, 1e-4);
  let scale = targetWidth / width;
  // Sanity clamp to avoid absurd values if model units are weird
  scale = THREE.MathUtils.clamp(scale, 0.05, 20);

  root.scale.setScalar(scale);

  // Drop to desk surface: bottomY in centered space * scale
  const bottomY = centeredBox.min.y * scale;
  root.position.set(placeAt[0], placeAt[1] - bottomY, placeAt[2]);
  if (rotationY !== undefined) {
    root.rotation.y = rotationY;
  } else if (faceCamera) {
    root.rotation.y = Math.PI;
  }

  // Optional helper box (auto hides)
  const [showHelper, setShowHelper] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowHelper(false), showHelperSeconds * 1000);
    onReady?.();
    return () => clearTimeout(t);
  }, [onReady, showHelperSeconds]);

  return (
    <group>
      <primitive object={root} />
      {showHelper && (
        <primitive
          object={
            new THREE.Box3Helper(
              new THREE.Box3().setFromObject(root),
              new THREE.Color("#44aaee")
            )
          }
        />
      )}
    </group>
  );
}

// === DJ Human Silhouette ===
function DJHuman({ url = "/models/dj_silhouette.glb" }: { url?: string }) {
  try {
    const { scene } = useGLTF(url);
    scene.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        // ultra-dark fabric/skin
        o.material = new THREE.MeshPhysicalMaterial({
          color: "#0a0a0a",
          roughness: 0.9,
          metalness: 0.0,
          sheen: 0.15,
          sheenRoughness: 0.9,
        });
      }
    });
    const root = new THREE.Group();
    root.add(scene);
    // size ~1.78m
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = 1.78 / Math.max(size.y, 0.0001);
    root.scale.setScalar(s);
    // place 35cm behind mixer, slight lean to decks
    root.position.set(0, 1.05, -0.25);
    root.rotation.y = Math.PI; // face camera
    root.rotation.x = -0.02;
    return <primitive object={root} />;
  } catch {
    // Fallback: simple silhouette if model not present
    return (
      <group position={[0, 1.8, -0.25]}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <sphereGeometry args={[0.28, 16, 16]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
        <mesh position={[0, 0.0, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.32, 0.9, 12]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
        {/* Raised arms */}
        <group position={[-0.45, 0.45, 0]} rotation={[0, 0, -2.1]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.6, 8]} />
            <meshStandardMaterial color="#0a0a0a" />
          </mesh>
        </group>
        <group position={[0.45, 0.45, 0]} rotation={[0, 0, 2.1]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.6, 8]} />
            <meshStandardMaterial color="#0a0a0a" />
          </mesh>
        </group>
      </group>
    );
  }
}

// === Volumetric Beam Cone ===
function BeamCone({
  pos = [0, 1.4, -0.2] as [number, number, number],
  dir = [0, -0.2, 0.9] as [number, number, number],
  length = 4,
  angle = 0.22,
  color = "#7ec8ff",
  alpha = 0.12,
}: {
  pos?: [number, number, number];
  dir?: [number, number, number];
  length?: number;
  angle?: number;
  color?: string;
  alpha?: number;
}) {
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: alpha,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [color, alpha]
  );
  const g = useMemo(
    () => new THREE.ConeGeometry(Math.tan(angle) * length, length, 32, 1, true),
    [angle, length]
  );
  const m = useRef<THREE.Mesh>(null!);
  useEffect(() => {
    const v = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      v
    );
    m.current.quaternion.copy(q);
  }, [dir]);
  return <mesh ref={m} geometry={g} material={mat} position={pos} />;
}

// === Laser Bar ===
function LaserBar({
  from = [-1.6, 1.25, 0.25] as [number, number, number],
  to = [1.6, 1.25, 0.25] as [number, number, number],
  color = "#8fb7ff",
  width = 0.01,
  alpha = 0.25,
}: {
  from?: [number, number, number];
  to?: [number, number, number];
  color?: string;
  width?: number;
  alpha?: number;
}) {
  const len = new THREE.Vector3(...to).sub(new THREE.Vector3(...from)).length();
  const mid = new THREE.Vector3(...from)
    .add(new THREE.Vector3(...to))
    .multiplyScalar(0.5);
  const dir = new THREE.Vector3(...to)
    .sub(new THREE.Vector3(...from))
    .normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    dir
  );
  return (
    <group position={mid.toArray()}>
      <mesh rotation={new THREE.Euler().setFromQuaternion(q)}>
        <boxGeometry args={[len, width, width]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={alpha}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// === Focus Scene: DJ Booth only ===
function DJBooth({
  beat = 0,
  colors,
}: {
  beat?: number;
  colors: ReturnType<typeof palette>;
}) {
  const [gearReady, setGearReady] = useState(false);
  const platterL = useRef<THREE.Mesh>(null!);
  const platterR = useRef<THREE.Mesh>(null!);
  const vuLeft = useRef<THREE.Mesh>(null!);
  const vuRight = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (platterL.current) platterL.current.rotation.y = t * 1.4;
    if (platterR.current) platterR.current.rotation.y = -t * 1.2;
    const vu = 0.15 + Math.min(1, beat * 1.6);
    if (vuLeft.current)
      vuLeft.current.scale.y = 0.4 + vu * (0.8 + 0.2 * Math.sin(t * 6));
    if (vuRight.current)
      vuRight.current.scale.y = 0.4 + vu * (0.8 + 0.2 * Math.cos(t * 6));
  });

  return (
    <group position={[0, 0, -4]} scale={[1.25, 1, 1.25]}>
      {/* Platform (desk base) */}
      <group>
        <RoundedBox
          args={[8, 0.1, 4]}
          radius={0.05}
          smoothness={6}
          position={[0, 0.05, 0]}
          receiveShadow
        >
          <meshPhysicalMaterial
            color="#080808"
            roughness={0.9}
            metalness={0.03}
          />
        </RoundedBox>
        <mesh position={[0, 0.005, 0]}>
          <boxGeometry args={[7.9, 0.005, 3.9]} />
          <meshPhysicalMaterial
            color="#080808"
            roughness={0.9}
            metalness={0.03}
          />
        </mesh>
      </group>

      {/* Booth desk top */}
      <mesh position={[0, 1.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[6, 0.2, 2]} />
        <meshPhysicalMaterial
          color="#070707"
          roughness={0.9}
          metalness={0.04}
          clearcoat={0.05}
          clearcoatRoughness={0.95}
        />
      </mesh>

      {/* Front glossy panel with soft reflection */}
      <mesh position={[0, 0.5, 1.0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[4.8, 0.9]} />
        <MeshReflectorMaterial
          mirror={0.02}
          blur={[180, 18]}
          mixBlur={0.35}
          mixStrength={0.6}
          roughness={0.48}
          metalness={0.08}
          color="#090909"
        />
      </mesh>

      {/* === REAL MODEL (complete rig from Sketchfab) === */}
      <Suspense fallback={<Loader />}>
        <RealGearAutoFit
          url="/models/pioneer_rig.glb"
          targetWidth={3.9}
          placeAt={[0, 1.12, 0.0]}
          faceCamera={false}
          rotationY={Math.PI} // flipped: show the back (cables/text) to the audience
          showHelperSeconds={3}
          onReady={() => setGearReady(true)}
        />
      </Suspense>

      {/* === PRIMITIVE FALLBACKS (render only until model is ready) === */}
      {!gearReady && (
        <>
          {/* CDJ Left */}
          <group position={[-1.6, 1.2, 0.25]}>
            <RoundedBox
              args={[1.2, 0.12, 0.9]}
              radius={0.03}
              smoothness={4}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color="#101010"
                roughness={0.65}
                metalness={0.2}
              />
            </RoundedBox>
            <mesh ref={platterL} position={[0, 0.1, 0]} castShadow>
              <cylinderGeometry args={[0.42, 0.42, 0.06, 32]} />
              <meshStandardMaterial
                color="#121212"
                roughness={0.55}
                metalness={0.25}
                emissive={colors.key}
                emissiveIntensity={0.18 + beat * 0.28}
              />
            </mesh>
            {/* Outer ring */}
            <mesh position={[0, 0.11, 0]}>
              <torusGeometry args={[0.48, 0.03, 16, 64]} />
              <meshStandardMaterial
                color="#cfd6e6"
                roughness={0.35}
                metalness={0.45}
                emissive={colors.key}
                emissiveIntensity={0.05}
              />
            </mesh>
          </group>

          {/* Mixer */}
          <group position={[0, 1.23, 0.25]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[1.0, 0.08, 0.9]} />
              <meshStandardMaterial color="#0f0f0f" roughness={0.5} />
            </mesh>
            {/* VU meters */}
            <mesh ref={vuLeft} position={[-0.25, 0.25, 0.41]} castShadow>
              <boxGeometry args={[0.08, 0.6, 0.05]} />
              <meshBasicMaterial color="#7cff85" />
            </mesh>
            <mesh ref={vuRight} position={[0.25, 0.25, 0.41]} castShadow>
              <boxGeometry args={[0.08, 0.6, 0.05]} />
              <meshBasicMaterial color="#7cff85" />
            </mesh>
            {/* Faders */}
            {[-0.35, -0.15, 0.05, 0.25, 0.45].map((x, i) => (
              <group key={i} position={[x, 0.07 + (i % 2 ? 0.02 : -0.02), 0.3]}>
                <mesh>
                  <boxGeometry args={[0.02, 0.12, 0.08]} />
                  <meshStandardMaterial
                    color="#cfcfcf"
                    metalness={0.6}
                    roughness={0.3}
                  />
                </mesh>
              </group>
            ))}
          </group>

          {/* CDJ Right */}
          <group position={[1.6, 1.2, 0.25]}>
            <RoundedBox
              args={[1.2, 0.12, 0.9]}
              radius={0.03}
              smoothness={4}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color="#101010"
                roughness={0.65}
                metalness={0.2}
              />
            </RoundedBox>
            <mesh ref={platterR} position={[0, 0.1, 0]} castShadow>
              <cylinderGeometry args={[0.42, 0.42, 0.06, 32]} />
              <meshStandardMaterial
                color="#121212"
                roughness={0.55}
                metalness={0.25}
                emissive={colors.key}
                emissiveIntensity={0.18 + beat * 0.28}
              />
            </mesh>
            <mesh position={[0, 0.11, 0]}>
              <torusGeometry args={[0.48, 0.03, 16, 64]} />
              <meshStandardMaterial
                color="#cfd6e6"
                roughness={0.35}
                metalness={0.45}
                emissive={colors.key}
                emissiveIntensity={0.05}
              />
            </mesh>
          </group>

          {/* TODO: when assets are ready, uncomment these and remove the primitive decks */}
          {/* <RealGear url="/models/cdj.glb" scale={0.9} position={[-1.6, 1.1, 0.25]} /> */}
          {/* <RealGear url="/models/cdj.glb" scale={0.9} position={[1.6, 1.1, 0.25]} /> */}
          {/* <RealGear url="/models/djm.glb" scale={0.9} position={[0, 1.1, 0.25]} /> */}
        </>
      )}

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 14]} />
        <meshPhysicalMaterial
          color="#050505"
          roughness={0.95}
          metalness={0.02}
        />
      </mesh>
    </group>
  );
}

// === Living room environment (walls, floor, lamp, TV cabinet) ===
function LivingRoomSet({ colors }: { colors: ReturnType<typeof palette> }) {
  const wallColor = new THREE.Color("#1b1b1b"); // dark cozy wall
  const floorColor = new THREE.Color("#2b1e18"); // wood tone
  const skirtingColor = new THREE.Color("#111111"); // baseboard

  // Materials
  const wallMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: wallColor,
        roughness: 0.9,
        metalness: 0.0,
      }),
    []
  );
  const floorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: floorColor,
        roughness: 0.8,
        metalness: 0.05,
      }),
    []
  );
  const baseboardMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ color: skirtingColor, roughness: 0.5 }),
    []
  );

  // TV cabinet under the booth
  const cabinetMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#151515",
        roughness: 0.6,
        metalness: 0.1,
      }),
    []
  );

  // Lamp glow (additive)
  const lampGlow = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      color: colors.accent,
      transparent: true,
      opacity: 0.5,
    });
    m.blending = THREE.AdditiveBlending;
    return m;
  }, [colors.accent]);

  return (
    <group>
      {/* Floor (wood) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 14]} />
        <primitive object={floorMat} attach="material" />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 2.4, -7]} receiveShadow>
        <planeGeometry args={[18, 8]} />
        <primitive object={wallMat} attach="material" />
      </mesh>

      {/* Left wall */}
      <mesh
        rotation={[0, Math.PI / 2, 0]}
        position={[-9, 2.4, 0]}
        receiveShadow
      >
        <planeGeometry args={[14, 8]} />
        <primitive object={wallMat} attach="material" />
      </mesh>

      {/* Right wall */}
      <mesh
        rotation={[0, -Math.PI / 2, 0]}
        position={[9, 2.4, 0]}
        receiveShadow
      >
        <planeGeometry args={[14, 8]} />
        <primitive object={wallMat} attach="material" />
      </mesh>

      {/* Baseboards */}
      <group position={[0, 0.15, 0]}>
        {/* Back */}
        <mesh position={[0, 0, -7.01]}>
          <boxGeometry args={[18, 0.1, 0.05]} />
          <primitive object={baseboardMat} attach="material" />
        </mesh>
        {/* Left */}
        <mesh rotation={[0, Math.PI / 2, 0]} position={[-9.01, 0, 0]}>
          <boxGeometry args={[14, 0.1, 0.05]} />
          <primitive object={baseboardMat} attach="material" />
        </mesh>
        {/* Right */}
        <mesh rotation={[0, -Math.PI / 2, 0]} position={[9.01, 0, 0]}>
          <boxGeometry args={[14, 0.1, 0.05]} />
          <primitive object={baseboardMat} attach="material" />
        </mesh>
      </group>

      {/* TV cabinet under the DJ booth */}
      <group position={[0, 0.55, -4.2]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[7.5, 0.5, 1.2]} />
          <primitive object={cabinetMat} attach="material" />
        </mesh>
        {/* little legs */}
        {[-3.4, -1.1, 1.1, 3.4].map((x, i) => (
          <mesh key={i} position={[x, -0.3, 0]} castShadow>
            <boxGeometry args={[0.15, 0.3, 0.9]} />
            <primitive object={cabinetMat} attach="material" />
          </mesh>
        ))}
      </group>

      {/* Standing floor lamp (warm key light) */}
      <group position={[-6.5, 0, -3.5]}>
        <mesh position={[0, 1.0, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 2, 12]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh position={[0, 2.2, 0]} castShadow>
          <cylinderGeometry args={[0.5, 0.5, 0.9, 16]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.8} />
        </mesh>
        {/* glow disc */}
        <mesh position={[0, 2.65, 0]}>
          <circleGeometry args={[0.55, 24]} />
          <primitive object={lampGlow} attach="material" />
        </mesh>
        <pointLight
          position={[0, 2.5, 0]}
          intensity={1.2}
          color={colors.accent}
          distance={6}
          castShadow
        />
      </group>

      {/* Plant + frame (right side accents) */}
      <group position={[6.5, 0, -3.5]}>
        <mesh position={[0, 1.0, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.35, 12]} />
          <meshStandardMaterial color="#333" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.4, 0]} castShadow>
          <icosahedronGeometry args={[0.6, 0]} />
          <meshStandardMaterial color="#1f3d2b" roughness={0.8} />
        </mesh>
        {/* Wall frame */}
        <mesh position={[-0.6, 2.2, -0.2]} rotation={[0, 0, 0]}>
          <boxGeometry args={[1.2, 0.8, 0.02]} />
          <meshStandardMaterial color="#0e0e0e" />
        </mesh>
      </group>
    </group>
  );
}

// === Small living-room audience (3 silhouettes) ===
function LivingRoomAudience({ beat = 0 }: { beat?: number }) {
  const bob = (i: number, t: number) => 0.02 * Math.sin(t * 2 + i);
  useFrame((state) => {
    // animation handled per-mesh below via position.y offsets
  });
  return (
    <group position={[0, 0, 2.2]}>
      {[-1.2, 0, 1.2].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh position={[0, 0.9, 0]}>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial color="#0a0a0a" />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.22, 0.26, 1.0, 12]} />
            <meshStandardMaterial color="#0a0a0a" />
          </mesh>
          {/* subtle bounce via onBeforeRender */}
          <group
            onBeforeRender={(r, s, c, g) => {
              // @ts-ignore - clock access pattern
              const t = r.clock?.getElapsedTime() || Date.now() / 1000;
              (g as any).position.y = bob(i, t);
            }}
          />
        </group>
      ))}
    </group>
  );
}

function Handheld() {
  const { camera } = useThree();
  const base = useRef<{ x: number; y: number; z: number }>({
    x: 0,
    y: 0,
    z: 0,
  });
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const amp = 0.03;
    camera.position.x = base.current.x + Math.sin(t * 0.35) * amp;
    camera.position.y = 1.6 + Math.sin(t * 0.42) * amp;
    camera.lookAt(0, 1.5, -4);
  });
  return null;
}

export default function Scene({ environment, beat }: SceneProps) {
  // --- Beat-reactive "equalizer" bands and track meta (local, event-driven) ---
  const bpmRef = useRef(120);
  const energyRef = useRef(0.6);
  const lastBeatMs = useRef(0);

  // three bands (0..1): kick, snare/hat, ambient
  const kickRef = useRef(0);
  const snareRef = useRef(0);
  const ambientRef = useRef(0);

  // Light refs we’ll modulate per-frame
  const rectKey = useRef<THREE.RectAreaLight>(null!);
  const backSpot = useRef<THREE.SpotLight>(null!);
  const fillPoint = useRef<THREE.PointLight>(null!);

  // Listen to global bus events from the player
  useEffect(() => {
    const onNP = (e: any) => {
      const d = e.detail || {};
      if (typeof d.bpm === "number") bpmRef.current = d.bpm || 120;
      if (typeof d.energy === "number") energyRef.current = d.energy ?? 0.6;
    };
    const onBeat = (e: any) => {
      const v = Math.max(0, Math.min(1, e.detail?.v ?? 0));
      // strong pulse on beat with quick decay
      kickRef.current = Math.max(kickRef.current * 0.85, v);
      lastBeatMs.current = performance.now();
    };
    window.addEventListener("afrotech:nowplaying", onNP as EventListener);
    window.addEventListener("afrotech:beat", onBeat as EventListener);
    return () => {
      window.removeEventListener("afrotech:nowplaying", onNP as EventListener);
      window.removeEventListener("afrotech:beat", onBeat as EventListener);
    };
  }, []);

  // Per-frame band decay and light modulation
  useFrame(({ clock }) => {
    const bpm = Math.max(60, Math.min(200, bpmRef.current));
    const beatPeriodMs = 60000 / bpm;
    const now = performance.now();
    const t = clock.getElapsedTime();

    // phase since last beat (0..1)
    const phase = ((now - lastBeatMs.current) % beatPeriodMs) / beatPeriodMs;

    // Snare/hat band pulses between beats
    const sn = Math.max(0, Math.sin(Math.PI * phase));
    snareRef.current = Math.max(snareRef.current * 0.9, sn * 0.7);

    // Ambient band eases toward track energy
    ambientRef.current += (energyRef.current - ambientRef.current) * 0.05;

    // Apply to lights if mounted
    if (rectKey.current) {
      // Kick-driven intensity + subtle color shift (blue→white)
      rectKey.current.intensity = 8 + 10 * kickRef.current;
      const kickColor = new THREE.Color().lerpColors(
        new THREE.Color("#ffffff"),
        new THREE.Color("#aac5ff"),
        kickRef.current * 0.4
      );
      rectKey.current.color.copy(kickColor);

      // Subtle positional jitter on kick
      const jitter = kickRef.current * 0.05;
      rectKey.current.position.x = 0.8 + Math.sin(t * 8) * jitter;
      rectKey.current.position.y = 1.95 + Math.cos(t * 6) * jitter;
    }
    if (backSpot.current) {
      // Snare-driven rapid flash
      backSpot.current.intensity = 6 + 6 * snareRef.current;

      // Snare color flash (cool blue → warm accent)
      const snareColor = new THREE.Color().lerpColors(
        new THREE.Color("#86a7ff"),
        new THREE.Color("#ff8650"),
        snareRef.current * 0.6
      );
      backSpot.current.color.copy(snareColor);
    }
    if (fillPoint.current) {
      // Ambient hue rotation
      fillPoint.current.intensity = 1.3 + 0.8 * ambientRef.current;
      const hueShift = (t * 0.08 + ambientRef.current * 0.3) % 1.0;
      const ambientColor = new THREE.Color().setHSL(hueShift, 0.2, 0.85);
      fillPoint.current.color.copy(ambientColor);
    }
  });

  const energy = Math.max(beat, 0.25);
  const colors = palette(
    environment,
    Math.max(energy, ambientRef.current) * 1.1,
    0.6
  );
  const liveColors = {
    ...colors,
    base: "#050505" as any,
    key: "#8fb7ff",
    accent: "#ff8650",
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: liveColors.base as any,
      }}
    >
      <Canvas
        shadows
        gl={{ antialias: true }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.8; // darker, TV-safe
          // @ts-ignore
          gl.outputColorSpace = THREE.SRGBColorSpace;
          // @ts-ignore - deprecated but still functional
          gl.physicallyCorrectLights = true;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          scene.background = new THREE.Color("#050505"); // deep black
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 1.7, 3.35]} fov={46} />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI * 0.39}
          maxPolarAngle={Math.PI * 0.47}
          target={[0, 1.18, -4]}
        />

        {/* HDRI environment for realistic reflections */}
        <Environment
          preset="studio"
          environmentIntensity={0.12}
          background={false}
        />

        {/* Soft key from front-right */}
        <rectAreaLight
          ref={rectKey}
          position={[0.8, 1.95, 1.1]}
          intensity={16}
          width={2.8}
          height={1.2}
          color="#ffffff"
        />

        {/* Cool rim from back */}
        <spotLight
          ref={backSpot}
          position={[0, 2.2, -3.6]}
          angle={0.5}
          penumbra={1}
          intensity={12}
          color="#86a7ff"
          castShadow
          shadow-bias={-0.00035}
        />

        {/* Tiny neutral fill so details aren't crushed */}
        <pointLight
          ref={fillPoint}
          position={[-1.2, 1.4, 1.2]}
          intensity={2.4}
          color="#ffffff"
        />

        {/* Audio-reactive beam cones */}
        <BeamCone
          pos={[-1.2, 2.0, -1.5]}
          color="#8fb7ff"
          alpha={0.08 + 0.25 * kickRef.current}
        />
        <BeamCone
          pos={[1.2, 2.0, -1.5]}
          color="#ff8650"
          alpha={0.08 + 0.25 * snareRef.current}
        />
        <BeamCone
          pos={[0, 2.5, -2.0]}
          color="#ffffff"
          alpha={0.06 + 0.2 * ambientRef.current}
        />

        {/* Audio-reactive laser bars */}
        <LaserBar
          from={[-1.6, 1.5, -3.2]}
          to={[1.6, 1.5, -3.2]}
          alpha={0.1 + 0.35 * snareRef.current}
        />
        <LaserBar
          from={[-1.4, 1.8, -3.5]}
          to={[1.4, 1.8, -3.5]}
          alpha={0.08 + 0.3 * kickRef.current}
        />

        {/* Audio-reactive atmospheric haze */}
        <AtmosphericHaze
          strength={0.6 + ambientRef.current * 0.6}
          color="#4a5a7f"
          position={[0, 1.5, -3]}
          scale={[6, 3]}
        />

        {/* Contact shadows to ground the booth */}
        <ContactShadows
          position={[0, 0, -4]}
          opacity={0.98}
          scale={6.0}
          blur={0.4}
          far={2.6}
        />

        {/* DJ Booth */}
        <DJBooth beat={energy} colors={liveColors} />

        {/* Post-processing - clean anti-aliasing only */}
        <EffectComposer multisampling={0}>
          <SMAA />
        </EffectComposer>
      </Canvas>

      {/* Attribution for CC BY licensed model */}
      <p
        style={{
          position: "fixed",
          bottom: 10,
          left: 12,
          opacity: 0.6,
          fontSize: 12,
          color: "#ffffff",
          margin: 0,
        }}
      >
        3D gear © MaxTht —{" "}
        <a
          href="https://sketchfab.com/3d-models/pioneer-cdj-3000-djm-900-nxs2-6c844b39b3644d1b9e7bb88c8f66b70b"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#8fb7ff", textDecoration: "none" }}
        >
          Sketchfab
        </a>{" "}
        (CC BY)
      </p>
    </div>
  );
}
