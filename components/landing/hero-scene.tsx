"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

/* ─── Gradient Orb (lightweight — no transmission material) ───── */

function GradientOrb({ position, scale, speed = 1, color = "#2563eb" }: {
  position: [number, number, number];
  scale: number;
  speed?: number;
  color?: string;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.x = Math.sin(clock.elapsedTime * speed * 0.3) * 0.2;
    ref.current.rotation.y += 0.003 * speed;
  });

  return (
    <Float speed={speed * 1.5} rotationIntensity={0.4} floatIntensity={1.2} floatingRange={[-0.1, 0.1]}>
      <mesh ref={ref} position={position} scale={scale}>
        <sphereGeometry args={[1, 32, 32]} />
        <MeshDistortMaterial
          color={color}
          roughness={0.15}
          metalness={0.9}
          distort={0.2}
          speed={1.5}
          transparent
          opacity={0.7}
        />
      </mesh>
    </Float>
  );
}

/* ─── Torus Ring ────────────────────────────────────────────────── */

function GradientRing({ position, scale }: {
  position: [number, number, number];
  scale: number;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.x = clock.elapsedTime * 0.15;
    ref.current.rotation.z = clock.elapsedTime * 0.1;
  });

  return (
    <Float speed={1} rotationIntensity={0.3} floatIntensity={0.8}>
      <mesh ref={ref} position={position} scale={scale}>
        <torusGeometry args={[1, 0.25, 24, 64]} />
        <MeshDistortMaterial
          color="#06b6d4"
          roughness={0.2}
          metalness={0.8}
          distort={0.1}
          speed={1.5}
        />
      </mesh>
    </Float>
  );
}

/* ─── Particle Field ────────────────────────────────────────────── */

function Particles({ count = 200 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 18;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2;
    }
    return pos;
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.012;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color="#4a8eff"
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ─── Scene ─────────────────────────────────────────────────────── */

function Scene() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.4} color="#b4c5ff" />
      <pointLight position={[-3, 2, 2]} intensity={0.6} color="#2563eb" />
      <pointLight position={[3, -2, 0]} intensity={0.4} color="#06b6d4" />

      <GradientOrb position={[-3, 1.2, -1]} scale={1} speed={0.8} color="#2563eb" />
      <GradientOrb position={[3.2, -0.5, -2]} scale={0.75} speed={1.2} color="#06b6d4" />
      <GradientOrb position={[0.5, 2, -1.5]} scale={0.45} speed={1.5} color="#8b5cf6" />
      <GradientOrb position={[-1.5, -1.6, -0.5]} scale={0.35} speed={1} color="#4a8eff" />

      <GradientRing position={[1.8, -1, -2.5]} scale={0.6} />

      <Particles count={200} />
    </>
  );
}

/* ─── Exported Canvas with WebGL fallback ───────────────────────── */

export default function HeroScene() {
  const [webglOk, setWebglOk] = useState(true);

  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2") || c.getContext("webgl");
      if (!gl) setWebglOk(false);
    } catch {
      setWebglOk(false);
    }
  }, []);

  if (!webglOk) return null;

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        style={{ background: "transparent" }}
        onCreated={({ gl }) => {
          gl.getContext().canvas.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            setWebglOk(false);
          });
        }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
