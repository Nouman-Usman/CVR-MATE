"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshTransmissionMaterial, MeshDistortMaterial, Environment } from "@react-three/drei";
import * as THREE from "three";

/* ─── Floating Glass Orb ────────────────────────────────────────── */

function GlassOrb({ position, scale, speed = 1, distort = 0.3, color = "#2563eb" }: {
  position: [number, number, number];
  scale: number;
  speed?: number;
  distort?: number;
  color?: string;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * speed * 0.3) * 0.2;
    ref.current.rotation.y += 0.003 * speed;
  });

  return (
    <Float speed={speed * 1.5} rotationIntensity={0.4} floatIntensity={1.2} floatingRange={[-0.1, 0.1]}>
      <mesh ref={ref} position={position} scale={scale}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshTransmissionMaterial
          backside
          samples={6}
          thickness={0.4}
          chromaticAberration={0.15}
          anisotropy={0.2}
          distortion={distort}
          distortionScale={0.3}
          temporalDistortion={0.1}
          iridescence={1}
          iridescenceIOR={1.5}
          iridescenceThicknessRange={[100, 400]}
          color={color}
          roughness={0.1}
          transmission={0.95}
          ior={1.25}
        />
      </mesh>
    </Float>
  );
}

/* ─── Gradient Torus ────────────────────────────────────────────── */

function GradientRing({ position, scale }: {
  position: [number, number, number];
  scale: number;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.x = state.clock.elapsedTime * 0.15;
    ref.current.rotation.z = state.clock.elapsedTime * 0.1;
  });

  return (
    <Float speed={1} rotationIntensity={0.3} floatIntensity={0.8}>
      <mesh ref={ref} position={position} scale={scale}>
        <torusGeometry args={[1, 0.3, 32, 100]} />
        <MeshDistortMaterial
          color="#06b6d4"
          roughness={0.2}
          metalness={0.8}
          distort={0.15}
          speed={2}
        />
      </mesh>
    </Float>
  );
}

/* ─── Particle Field ────────────────────────────────────────────── */

function Particles({ count = 300 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  const [positions, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
      sz[i] = Math.random() * 0.03 + 0.005;
    }
    return [pos, sz];
  }, [count]);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.015;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.05;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizes, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#4a8eff"
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ─── Scene Composition ─────────────────────────────────────────── */

function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={0.5} color="#b4c5ff" />
      <pointLight position={[-3, 2, 2]} intensity={0.8} color="#2563eb" />
      <pointLight position={[3, -2, 0]} intensity={0.5} color="#06b6d4" />

      {/* Main glass orbs */}
      <GlassOrb position={[-3.2, 1.2, -1]} scale={1.1} speed={0.8} color="#2563eb" distort={0.25} />
      <GlassOrb position={[3.5, -0.5, -2]} scale={0.8} speed={1.2} color="#06b6d4" distort={0.3} />
      <GlassOrb position={[0.5, 2.2, -1.5]} scale={0.5} speed={1.5} color="#8b5cf6" distort={0.2} />
      <GlassOrb position={[-1.5, -1.8, -0.5]} scale={0.4} speed={1} color="#4a8eff" distort={0.35} />
      <GlassOrb position={[2, 1.5, -3]} scale={0.6} speed={0.6} color="#2563eb" distort={0.15} />

      {/* Gradient ring */}
      <GradientRing position={[1.8, -1, -2.5]} scale={0.7} />

      {/* Particle field */}
      <Particles count={400} />

      <Environment preset="night" />
    </>
  );
}

/* ─── Exported Canvas ───────────────────────────────────────────── */

export default function HeroScene() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
