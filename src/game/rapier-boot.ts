import RAPIER from "@dimforge/rapier3d-compat";

const RESERVE = 4 * 1024 * 1024;

let boot: Promise<void> | null = null;

/** Rapier 0.19 compat inlines wasm — `init()` takes no args. */
export function bootRapier(): Promise<void> {
  if (!boot) {
    boot = (async () => {
      await RAPIER.init();
      try {
        RAPIER.reserveMemory(RESERVE);
      } catch {
        /* heap already large enough */
      }
    })();
  }
  return boot;
}

export function wasmHeapBytes(): number {
  try {
    const buf = (RAPIER as unknown as { scratchBuffer?: { buffer?: ArrayBuffer } }).scratchBuffer?.buffer;
    return buf ? buf.byteLength : 0;
  } catch {
    return 0;
  }
}
