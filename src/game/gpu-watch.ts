/** Watch renderer.info.memory for monotonic growth after warmup. */
export type GpuSnap = {
  calls: number;
  tris: number;
  geos: number;
  tex: number;
  programs: number;
  dpr: number;
  leak: "ok" | "geo" | "tex" | "both";
  dGeo: number;
  dTex: number;
  wasmMb: number;
  api: "webgl" | "webgl2" | "webgpu";
};

type Info = {
  render: { calls: number; triangles: number };
  memory: { geometries: number; textures: number };
  programs?: { length: number } | null;
};

export class GpuWatch {
  private ring: { geos: number; tex: number }[] = [];
  private warmup = 14;
  private last: GpuSnap = {
    calls: 0,
    tris: 0,
    geos: 0,
    tex: 0,
    programs: 0,
    dpr: 1,
    leak: "ok",
    dGeo: 0,
    dTex: 0,
    wasmMb: 0,
    api: "webgl2",
  };

  sample(info: Info, dpr: number, wasmBytes = 0, api: GpuSnap["api"] = "webgl2"): GpuSnap {
    const geos = info.memory.geometries;
    const tex = info.memory.textures;
    this.ring.push({ geos, tex });
    if (this.ring.length > 16) this.ring.shift();
    this.warmup = Math.max(0, this.warmup - 1);

    let leak: GpuSnap["leak"] = "ok";
    let dGeo = 0;
    let dTex = 0;
    if (this.warmup === 0 && this.ring.length >= 10) {
      const a = this.ring[0]!;
      const b = this.ring[this.ring.length - 1]!;
      dGeo = b.geos - a.geos;
      dTex = b.tex - a.tex;
      const geoLeak = dGeo >= 6;
      const texLeak = dTex >= 3;
      leak = geoLeak && texLeak ? "both" : geoLeak ? "geo" : texLeak ? "tex" : "ok";
    }

    this.last = {
      calls: info.render.calls,
      tris: info.render.triangles,
      geos,
      tex,
      programs: info.programs?.length ?? 0,
      dpr,
      leak,
      dGeo,
      dTex,
      wasmMb: Math.round((wasmBytes / 1048576) * 10) / 10,
      api,
    };
    return this.last;
  }

  reset() {
    this.ring = [];
    this.warmup = 14;
  }
}
