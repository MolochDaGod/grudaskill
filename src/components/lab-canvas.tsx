import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics, useRapier } from "@react-three/rapier";
import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace, WebGLRenderer } from "three";
import type { LabEngine } from "@/game/lab-types";
import type { HudState } from "@/game/lab-types";
import { errText } from "@/game/debug";

type Runtime = LabEngine & {
  tick: (dt: number) => void;
  attachRapier: (world: unknown) => void;
};

class CanvasGuard extends Component<{ children: ReactNode; onError?: (m: string) => void }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: Error) {
    return { err: e.message || "arena failed" };
  }
  componentDidCatch(e: Error) {
    this.props.onError?.(e.message);
  }
  render() {
    if (this.state.err) return null;
    return this.props.children;
  }
}

function LabBridge({
  onHud,
  onEngine,
}: {
  onHud: (s: HudState) => void;
  onEngine: (e: LabEngine | null) => void;
}) {
  const { gl, scene, camera } = useThree();
  const { world } = useRapier();
  const engine = useRef<Runtime | null>(null);
  const onHudRef = useRef(onHud);
  const onEngineRef = useRef(onEngine);
  onHudRef.current = onHud;
  onEngineRef.current = onEngine;

  useEffect(() => {
    let dead = false;
    void import("@/game/engine")
      .then(({ LabEngine: Engine }) => {
        if (dead) return;
        try {
          const e = new Engine(gl.domElement, (s) => onHudRef.current(s), {
            gl,
            scene,
            camera,
            ownLoop: false,
          }) as Runtime;
          engine.current = e;
          if (world) e.attachRapier(world);
          onEngineRef.current(e);
        } catch (err) {
          onHudRef.current({ hint: errText(err) } as HudState);
        }
      })
      .catch((err: Error) => {
        onHudRef.current({ hint: err?.message || "engine failed" } as HudState);
      });
    return () => {
      dead = true;
      const e = engine.current;
      engine.current = null;
      try {
        e?.dispose();
      } catch {
        /* WebGL already gone */
      }
      onEngineRef.current(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (world) engine.current?.attachRapier(world);
  }, [world]);

  useFrame((_, delta) => {
    try {
      engine.current?.tick(Math.min(delta, 0.1));
    } catch {
      /* isolated */
    }
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
  const [bootErr, setBootErr] = useState<string | null>(null);
  return (
    <>
      {bootErr ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-bg/90 px-4">
          <p className="hud-panel max-w-md rounded-lg p-4 text-sm text-primary">{bootErr}</p>
        </div>
      ) : null}
      <Canvas
        className="absolute inset-0 size-full touch-none"
        shadows
        dpr={[1, 1.5]}
        gl={(props) => {
          const renderer = new WebGLRenderer({
            ...props,
            antialias: true,
            alpha: false,
            stencil: false,
            depth: true,
            powerPreference: "high-performance",
          });
          renderer.outputColorSpace = SRGBColorSpace;
          renderer.toneMapping = ACESFilmicToneMapping;
          return renderer;
        }}
        camera={{ fov: 55, near: 0.1, far: 5000, position: [6, 4.2, 10] }}
        onCreated={({ gl, scene }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = PCFShadowMap;
          scene.background = null;
        }}
      >
        <Suspense fallback={null}>
          <CanvasGuard onError={setBootErr}>
            <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60} interpolate={false}>
              <LabBridge onHud={onHud} onEngine={onEngine} />
            </Physics>
          </CanvasGuard>
        </Suspense>
      </Canvas>
    </>
  );
}
