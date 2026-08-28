import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { LabEngine } from "@/game/lab-types";
import type { HudState } from "@/game/lab-types";

type Runtime = LabEngine & { tick: (dt: number) => void };

function LabBridge({
  onHud,
  onEngine,
}: {
  onHud: (s: HudState) => void;
  onEngine: (e: LabEngine | null) => void;
}) {
  const { gl, scene, camera } = useThree();
  const engine = useRef<Runtime | null>(null);
  const onHudRef = useRef(onHud);
  const onEngineRef = useRef(onEngine);
  onHudRef.current = onHud;
  onEngineRef.current = onEngine;

  useEffect(() => {
    let dead = false;
    void import("@/game/engine").then(({ LabEngine: Engine }) => {
      if (dead) return;
      const e = new Engine(gl.domElement, (s) => onHudRef.current(s), {
        gl,
        scene,
        camera,
        ownLoop: false,
      });
      engine.current = e as Runtime;
      onEngineRef.current(e);
    });
    return () => {
      dead = true;
      engine.current?.dispose();
      engine.current = null;
      onEngineRef.current(null);
    };
  }, [gl, scene, camera]);

  useFrame((_, delta) => {
    engine.current?.tick(Math.min(delta, 0.1));
  });

  return null;
}

export function LabCanvas({
  onHud,
  onEngine,
}: {
  onHud: (s: HudState) => void;
  onEngine: (e: LabEngine | null) => void;
}) {
  return (
    <Canvas
      className="absolute inset-0 size-full touch-none"
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 55, near: 0.1, far: 1800, position: [6, 4.2, 10] }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor("#c8dff2");
        scene.background = null;
      }}
    >
      <LabBridge onHud={onHud} onEngine={onEngine} />
    </Canvas>
  );
}
