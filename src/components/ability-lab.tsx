import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ComponentType } from "react";
import {
  Flame,
  Snowflake,
  Crosshair,
  Pause,
  Play,
  Upload,
  Download,
  Sword,
  SlidersHorizontal,
  BookOpen,
} from "lucide-react";
import type { LabEngine, HudState } from "@/game/lab-types";
import type { ExplosionKind, ProjectileAsset } from "@/game/skills";
import { AIM_LABEL, BOOK_SKILLS, DEFAULT_BINDINGS, defaultCustomSkill, editorMeters, keyLabel, KIND_LABEL, showsMeshEditor } from "@/game/skills";
import { SpellBook } from "@/components/spell-book";
import { TightHud } from "@/components/tight-hud";
import { WEATHERS } from "@/game/weather";

const ASSETS: { id: ProjectileAsset; label: string }[] = [
  { id: "arrow", label: "Arrow" },
  { id: "bolt", label: "Bolt" },
  { id: "ice", label: "Ice shard" },
  { id: "fire", label: "Fire orb" },
  { id: "spear", label: "Spear" },
  { id: "bullet", label: "Bullet" },
];

const EXPLOSIONS: { id: ExplosionKind; label: string }[] = [
  { id: "fire", label: "Fire" },
  { id: "ice", label: "Ice" },
  { id: "kinetic", label: "Impact" },
];

function mergeHud(prev: HudState, next: Partial<HudState>): HudState {
  return {
    ...prev,
    ...next,
    skill: next.skill ?? prev.skill,
    custom: next.custom ?? prev.custom,
    kits: next.kits ?? prev.kits ?? [],
    buffs: next.buffs ?? prev.buffs ?? [],
    book: next.book ?? prev.book ?? [],
    effects: next.effects ?? prev.effects ?? [],
    tunes: next.tunes ?? prev.tunes ?? [],
    shaders: next.shaders ?? prev.shaders ?? [],
    shaderColors: next.shaderColors ?? prev.shaderColors ?? [],
    staffStars: next.staffStars ?? prev.staffStars ?? [],
    bindings: next.bindings ?? prev.bindings,
    gpu: next.gpu ?? prev.gpu,
    debug: next.debug ?? prev.debug,
  };
}

const EMPTY: HudState = {
  paused: false,
  skillName: "Fire Bolt",
  skill: defaultCustomSkill(),
  hp: 100,
  mana: 100,
  frozen: 0,
  fps: 60,
  editorOpen: false,
  studioOpen: false,
  custom: defaultCustomSkill(),
  hint: "Linking D1 / VFX…",
  armed: "",
  buffs: [],
  aim: "mouse",
  fleet: "idle",
  effects: [],
  kitId: "human",
  kits: [],
  bookOpen: false,
  listening: false,
  bindings: { ...DEFAULT_BINDINGS },
  book: BOOK_SKILLS.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    school: s.school,
    book: s.book,
    hotkey: keyLabel(Object.entries(DEFAULT_BINDINGS).find(([, id]) => id === s.id)?.[0] ?? ""),
  })),
  colliders: false,
  armor: "A",
  range: 0,
  element: "pyre",
  chrome: false,
  kitMode: "sandbox",
  bendElement: "fire",
  tunes: [],
  shaders: [],
  shaderColors: [],
  weather: "sunny",
  activeMode: false,
  animIntensity: 1,
  hour: 12,
  clock: "12:00 PM",
  period: "Midday",
  timeScale: 0,
  focusHold: false,
  focused: false,
  camStyle: "normal",
  invertY: false,
  crosshair: true,
  markX: -1,
  markY: -1,
  markHard: false,
  bowDraw: 0,
  bowZone: "",
  staffStars: [],
  staffCast: 0,
  pad: "",
  gpuOn: false,
  gpu: { calls: 0, tris: 0, geos: 0, tex: 0, programs: 0, dpr: 1, leak: "ok", dGeo: 0, dTex: 0, wasmMb: 0, api: "webgl2" },
  debug: { gl: "ok", tickErr: 0, lastErr: "", kit: "human", clips: 0, physics: false, log: [] },
};

export function AbilityLab({ autoEnter = false }: { autoEnter?: boolean }) {
  const engineRef = useRef<LabEngine | null>(null);
  const [entered, setEntered] = useState(autoEnter);
  const [hud, setHud] = useState<HudState>(EMPTY);
  const [joy, setJoy] = useState({ active: false, x: 0, y: 0 });
  const [saveName, setSaveName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [Canvas3d, setCanvas3d] = useState<ComponentType<{
    onHud: (s: HudState) => void;
    onEngine: (e: LabEngine | null) => void;
  }> | null>(null);

  const [ready3d, setReady3d] = useState(false);
  const [bootErr, setBootErr] = useState<string | null>(null);

  const applyHud = useCallback((s: HudState) => {
    setHud((prev) => mergeHud(prev, s));
  }, []);

  const onEngine = useCallback((e: LabEngine | null) => {
    if (e) {
      engineRef.current = e;
      setReady3d(true);
    } else {
      engineRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!entered) return;
    let dead = false;
    import("@/components/lab-canvas")
      .then((m) => {
        if (dead) return;
        setCanvas3d(() => m.LabCanvas);
      })
      .catch((err: Error) => {
        if (!dead) setBootErr(err?.message || "Could not load the arena");
      });
    return () => {
      dead = true;
    };
  }, [entered]);

  function onJoy(e: ReactPointerEvent<HTMLDivElement>, end = false) {
    const el = e.currentTarget;
    if (end) {
      el.releasePointerCapture(e.pointerId);
      setJoy({ active: false, x: 0, y: 0 });
      engineRef.current?.setTouchMove(0, 0);
      return;
    }
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let x = (e.clientX - cx) / (r.width * 0.42);
    let y = (cy - e.clientY) / (r.height * 0.42);
    const m = Math.hypot(x, y) || 1;
    if (m > 1) {
      x /= m;
      y /= m;
    }
    setJoy({ active: true, x, y });
    engineRef.current?.setTouchMove(x, y);
  }

  function downloadSkill() {
    const json = engineRef.current?.exportSkillJson() ?? "{}";
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${hud.custom.name.replace(/\s+/g, "-").toLowerCase()}.skill.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      {entered && Canvas3d ? <Canvas3d onHud={applyHud} onEngine={onEngine} /> : null}

      {entered && !Canvas3d && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-bg px-4">
          <div className="hud-panel max-w-md rounded-lg p-6 text-center">
            <p className="text-sm tracking-[0.28em] text-gold uppercase">
              {bootErr ? "Arena failed" : "Summoning the arena…"}
            </p>
            {bootErr ? <p className="mt-3 text-sm text-muted">{bootErr}</p> : null}
          </div>
        </div>
      )}

      {!entered && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-bg/80 px-4">
          <div className="hud-panel w-full max-w-md rounded-lg p-6 shadow-2xl">
            <p className="text-xs tracking-[0.28em] text-gold uppercase">Grudge Studio · Warlords</p>
            <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight">Ability Lab</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Warlords era · Grudge6 toon · weapon skills on 1–6 · class on R F V T G B.
              Select a skill in the book, tune it, then fire.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
              <div>
                <b className="text-fg">1–6</b> Weapon skills
              </div>
              <div>
                <b className="text-fg">R F V T G B</b> Class abilities
              </div>
              <div>
                <b className="text-fg">LMB</b> fire · <b className="text-fg">RMB</b> focus
              </div>
              <div>
                <b className="text-fg">Pad</b> LS move · RT fire · LT focus
              </div>
              <div>
                <b className="text-fg">Tab</b> spell book · editor bind
              </div>
            </div>
            <button
              type="button"
              className="mt-5 w-full rounded-lg bg-fg py-3 text-sm font-semibold text-bg"
              onClick={() => setEntered(true)}
            >
              Enter the lab
            </button>
            <p className="mt-3 text-center text-xs text-muted">
              1–6 weapons · R F V T G B class · LMB places the shot
            </p>
          </div>
        </div>
      )}

      {entered && (
        <>
          <header className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[min(100%-1.5rem,22rem)] flex-col gap-2">
            <div className="hud-panel pointer-events-auto rounded-lg px-3 py-2">
              <p className="text-xs text-muted">{hud.hint}</p>
            </div>
            {hud.gpuOn && hud.gpu ? (
              <div className="hud-panel pointer-events-none rounded-lg px-3 py-2 font-mono text-[11px] leading-5 text-muted">
                <div className="text-gold">Debug · F3 · Shift+F3 copy</div>
                <div>
                  gl {hud.debug?.gl ?? "ok"} · {hud.gpu.api ?? "webgl2"}
                  {hud.debug?.physics ? " · rapier" : " · no physics"} · {hud.fps} fps
                </div>
                <div>
                  {hud.gpu.calls} draws · {(hud.gpu.tris / 1000).toFixed(1)}k tris
                </div>
                <div>
                  {hud.gpu.geos} geo · {hud.gpu.tex} tex · {hud.gpu.programs} programs
                </div>
                <div>
                  dpr {hud.gpu.dpr} · wasm {hud.gpu.wasmMb} mb · leak {hud.gpu.leak}
                  {hud.gpu.leak !== "ok" ? ` Δg${hud.gpu.dGeo} Δt${hud.gpu.dTex}` : ""}
                </div>
                <div>
                  kit {hud.debug?.kit ?? hud.kitId} · clips {hud.debug?.clips ?? 0}
                  {hud.debug?.tickErr ? ` · tick×${hud.debug.tickErr}` : ""}
                </div>
                {hud.debug?.lastErr ? <div className="text-primary">{hud.debug.lastErr}</div> : null}
                {(hud.debug?.log ?? []).slice(-3).map((line) => (
                  <div key={line} className="truncate text-[10px] text-muted/80">
                    {line}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              {(hud.kits ?? []).map((k) => (
                <button
                  key={k.id}
                  type="button"
                  className={`pointer-events-auto rounded-full border px-2.5 py-1 text-[11px] ${
                    hud.kitId === k.id
                      ? "border-gold bg-surface text-gold"
                      : "border-border hud-panel text-fg"
                  }`}
                  onClick={() => void engineRef.current?.setWarlordKit(k.id)}
                >
                  {k.name}
                </button>
              ))}
              {(hud.buffs ?? []).map((b) => (
                <span
                  key={b}
                  className="hud-panel rounded-full px-2 py-0.5 text-[11px] tracking-wide text-gold"
                >
                  {b}
                </span>
              ))}
              {hud.frozen > 0 && (
                <span className="hud-panel flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-primary">
                  <Snowflake className="size-3" /> {hud.frozen} frozen
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WEATHERS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className={`pointer-events-auto rounded-full border px-2.5 py-1 text-[11px] ${
                    hud.weather === w.id
                      ? "border-gold bg-surface text-gold"
                      : "border-border hud-panel text-fg"
                  }`}
                  onClick={() => engineRef.current?.setWeather(w.id)}
                >
                  {w.label}
                </button>
              ))}
              <button
                type="button"
                className={`pointer-events-auto rounded-full border px-2.5 py-1 text-[11px] ${
                  hud.activeMode
                    ? "border-gold bg-surface text-gold"
                    : "border-border hud-panel text-fg"
                }`}
                onClick={() => engineRef.current?.toggleActiveMode()}
              >
                Active
              </button>
              <button
                type="button"
                className={`pointer-events-auto rounded-full border px-2.5 py-1 text-[11px] ${
                  hud.focused
                    ? "border-gold bg-surface text-gold"
                    : "border-border hud-panel text-fg"
                }`}
                onClick={() => engineRef.current?.setFocusHold(!hud.focusHold)}
              >
                RMB {hud.focusHold ? "Hold" : "Toggle"}
              </button>
              {(["tight", "normal", "wide"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`pointer-events-auto rounded-full border px-2.5 py-1 text-[11px] capitalize ${
                    hud.camStyle === s ? "border-gold bg-surface text-gold" : "border-border hud-panel text-fg"
                  }`}
                  onClick={() => engineRef.current?.setCamStyle(s)}
                >
                  {s}
                </button>
              ))}
              <button
                type="button"
                className={`pointer-events-auto rounded-full border px-2.5 py-1 text-[11px] ${
                  hud.invertY ? "border-gold bg-surface text-gold" : "border-border hud-panel text-fg"
                }`}
                onClick={() => engineRef.current?.setInvertY(!hud.invertY)}
              >
                Invert Y
              </button>
              <button
                type="button"
                className={`pointer-events-auto rounded-full border px-2.5 py-1 text-[11px] ${
                  hud.crosshair ? "border-gold bg-surface text-gold" : "border-border hud-panel text-fg"
                }`}
                onClick={() => engineRef.current?.setCrosshair(!hud.crosshair)}
              >
                Sight
              </button>
              <label className="pointer-events-auto flex items-center gap-1 rounded-full border border-border hud-panel px-2 py-1 text-[11px] text-muted">
                Anim
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={hud.animIntensity ?? 1}
                  className="w-16 accent-gold"
                  onChange={(e) => engineRef.current?.setAnimIntensity(Number(e.target.value))}
                />
              </label>
              {hud.pad ? (
                <span className="pointer-events-none rounded-full border border-gold/50 bg-surface px-2.5 py-1 text-[11px] text-gold">
                  Pad
                </span>
              ) : null}
            </div>
            <div className="hud-panel pointer-events-auto flex items-center gap-2 rounded-lg px-2.5 py-1.5">
              <span className="min-w-[4.6rem] text-[11px] tabular-nums text-gold">
                {hud.clock}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-muted">{hud.period}</span>
              <input
                type="range"
                min={0}
                max={24}
                step={0.1}
                value={hud.hour}
                aria-label="Time of day"
                className="h-1 w-28 accent-gold"
                onChange={(e) => engineRef.current?.setHour(Number(e.target.value))}
              />
              <button
                type="button"
                className={`rounded px-2 py-0.5 text-[10px] ${
                  hud.timeScale > 0 ? "bg-gold text-bg" : "border border-border"
                }`}
                onClick={() => engineRef.current?.toggleCycle()}
              >
                {hud.timeScale > 0 ? "Cycle" : "Hold"}
              </button>
            </div>
          </header>

          <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
            <div className="pointer-events-auto flex gap-2">
              <IconBtn
                label={hud.paused ? "Resume" : "Pause"}
                onClick={() => engineRef.current?.togglePause()}
              >
                {hud.paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              </IconBtn>
              <IconBtn label="Editor" onClick={() => engineRef.current?.toggleEditor()}>
                <SlidersHorizontal className="size-4" />
              </IconBtn>
              <IconBtn label="Studio" onClick={() => engineRef.current?.toggleStudio()}>
                <Sword className="size-4" />
              </IconBtn>
              <IconBtn label="Spell book" onClick={() => engineRef.current?.toggleBook()}>
                <BookOpen className="size-4" />
              </IconBtn>
            </div>
            {hud.chrome && (
            <>
            <p className="hud-panel rounded-lg px-2 py-1 text-right text-[11px] text-muted">
              {AIM_LABEL[hud.aim]} · {hud.range.toFixed(1)}m
            </p>
            <div className="pointer-events-auto hud-panel flex flex-col gap-1.5 rounded-lg p-2 text-[11px]">
              <div className="flex gap-1">
                {["A", "B", "C", "D", "E"].map((l) => (
                  <button
                    key={l}
                    type="button"
                    className={`rounded px-2 py-1 ${hud.armor === l ? "bg-gold text-bg" : "border border-border"}`}
                    onClick={() => engineRef.current?.setArmor(l)}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  className={`rounded px-2 py-1 ${hud.colliders ? "bg-primary text-bg" : "border border-border"}`}
                  onClick={() => engineRef.current?.toggleColliders()}
                >
                  Colliders
                </button>
                <button
                  type="button"
                  className={`rounded px-2 py-1 ${hud.focusHold ? "border border-border" : "bg-gold text-bg"}`}
                  onClick={() => engineRef.current?.setFocusHold(false)}
                >
                  RMB Toggle
                </button>
                <button
                  type="button"
                  className={`rounded px-2 py-1 ${hud.focusHold ? "bg-gold text-bg" : "border border-border"}`}
                  onClick={() => engineRef.current?.setFocusHold(true)}
                >
                  RMB Hold
                </button>
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1"
                  onClick={() => engineRef.current?.resetDummies()}
                >
                  Reset
                </button>
              </div>
            </div>
            </>
            )}
          </div>

          <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
            <div
              className="pointer-events-auto absolute bottom-28 left-3 size-28 rounded-full border border-border bg-surface/70 md:hidden"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                onJoy(e);
              }}
              onPointerMove={(e) => joy.active && onJoy(e)}
              onPointerUp={(e) => onJoy(e, true)}
              onPointerCancel={(e) => onJoy(e, true)}
            >
              <span
                className="absolute size-10 rounded-full bg-primary/80"
                style={{
                  left: `calc(50% + ${joy.x * 32}px - 20px)`,
                  top: `calc(50% - ${joy.y * 32}px - 20px)`,
                }}
              />
            </div>
            <button
              type="button"
              className="pointer-events-auto absolute bottom-28 right-3 min-h-12 min-w-24 rounded-lg bg-fire px-4 py-3 text-sm font-semibold text-bg shadow-lg md:hidden"
              onPointerDown={(e) => {
                e.preventDefault();
                engineRef.current?.castCurrent();
              }}
              onPointerUp={() => engineRef.current?.releaseCurrent()}
              onPointerCancel={() => engineRef.current?.releaseCurrent()}
            >
              {hud.skill.asset === "arrow" ? "Draw" : "Cast"}
            </button>
            {(hud.staffStars?.length ?? 0) > 0 ? (
              <div className="pointer-events-none absolute inset-0 z-40">
                {hud.staffCast > 0 ? (
                  <div className="pointer-events-none absolute top-[18%] left-1/2 h-1.5 w-40 -translate-x-1/2 overflow-hidden rounded-full border border-[#3a2a14] bg-black/70">
                    <div className="h-full bg-[#f0c44a]" style={{ width: `${Math.round(hud.staffCast * 100)}%` }} />
                  </div>
                ) : null}
                {hud.staffStars.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="pointer-events-auto absolute size-12 -translate-x-1/2 -translate-y-1/2 animate-pulse"
                    style={{ left: s.x, top: s.y }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      engineRef.current?.clickStaffStar(s.id);
                    }}
                  >
                    <img
                      src={s.lit ? "/hud/stars/star.svg" : "/hud/stars/star-black.svg"}
                      alt=""
                      className="size-12 drop-shadow-[0_0_10px_#f4e2a8]"
                      draggable={false}
                    />
                  </button>
                ))}
              </div>
            ) : null}
            <TightHud
              hud={hud}
              onSlot={(code) => {
                if (hud.listening || !hud.bindings[code]) {
                  engineRef.current?.bindToSlot(code);
                  return;
                }
                const id = hud.bindings[code]!;
                engineRef.current?.setActiveSkill(id);
                if (/arrow|bow/i.test(id)) return;
                if (!hud.bookOpen && !hud.editorOpen) engineRef.current?.castCurrent();
              }}
            />
            {hud.bowDraw > 0.01 ? (
              <div className="pointer-events-none absolute bottom-[22%] left-1/2 z-20 w-[min(72vw,28rem)] -translate-x-1/2">
                <p className="mb-1 text-center text-[10px] tracking-[0.2em] text-gold uppercase">
                  {hud.bowZone === "best"
                    ? "Best shot"
                    : hud.bowZone === "hit"
                      ? "Always hit"
                      : hud.bowZone === "likely"
                        ? "Likely hit"
                        : "Likely miss"}
                </p>
                <div className="relative h-3 overflow-hidden rounded-sm border border-[#3a2a14] bg-black/70 shadow-[0_0_12px_#000]">
                  <div
                    className="absolute inset-y-0 left-0 bg-[url('/hud/bars/fillers/bowattack.png')] bg-left bg-no-repeat"
                    style={{
                      width: `${Math.round(hud.bowDraw * 100)}%`,
                      backgroundSize: `${Math.round(100 / Math.max(hud.bowDraw, 0.04))}% 100%`,
                    }}
                  />
                  <div
                    className="pointer-events-none absolute inset-y-0 w-px bg-white/90"
                    style={{ left: `${Math.round(hud.bowDraw * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </footer>

          {hud.editorOpen && (
            <aside className="hud-panel absolute top-16 right-3 z-30 max-h-[min(72dvh,36rem)] w-[min(100%-1.5rem,20rem)] overflow-auto rounded-lg p-4">
              <div className="mb-2 flex items-center gap-2">
                <Flame className="size-4 text-fire" />
                <h2 className="font-display text-xl">{hud.skill.name}</h2>
              </div>
              <p className="mb-1 text-[11px] tracking-wide text-gold uppercase">
                {KIND_LABEL[hud.skill.kind]} · {hud.skill.school} · {hud.skill.book}
              </p>
              <p className="mb-3 text-xs leading-relaxed text-muted">{hud.skill.desc}</p>
              {hud.tunes && hud.tunes.length > 0 && (
                <>
                  <div className="mb-2 text-[11px] tracking-wide text-muted">Live GLSL</div>
                  <div className="mb-3 grid gap-1.5">
                    {(hud.tunes ?? []).map((k) => (
                      <MiniSlider
                        key={`${k.source}.${k.block}.${k.key}`}
                        label={k.label}
                        min={k.min}
                        max={k.max}
                        step={k.step}
                        value={k.value}
                        onChange={(v) => engineRef.current?.patchTune(k.block, k.key, k.source, v)}
                      />
                    ))}
                  </div>
                </>
              )}
              {(hud.shaders?.length ?? 0) > 0 && (
                <>
                  <div className="mb-2 text-[11px] tracking-wide text-muted">Color shaders</div>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {hud.shaders.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => engineRef.current?.applyShader(s.id)}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
                          hud.skill.shader === s.id ? "border-gold text-gold" : "border-border text-fg"
                        }`}
                      >
                        <span className="size-2.5 rounded-full" style={{ background: s.swatch }} />
                        {s.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {(hud.shaderColors?.length ?? 0) > 0 && (
                <div className="mb-3 grid gap-1.5">
                  {hud.shaderColors.map((c) => (
                    <label key={c.key} className="flex items-center justify-between text-xs text-muted">
                      {c.label}
                      <input
                        type="color"
                        value={c.value}
                        onChange={(e) => engineRef.current?.writeShaderColor(c.key, e.target.value)}
                        className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent"
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    className="rounded-full border border-border px-2 py-1 text-[11px] text-muted"
                    onClick={() => engineRef.current?.resetShader()}
                  >
                    Reset shader defaults
                  </button>
                </div>
              )}
              <div className="mb-2 text-[11px] tracking-wide text-muted">This skill</div>
              {editorMeters(hud.skill?.kind ?? "linear").map((m) => (
                <MiniSlider
                  key={m.k}
                  label={m.label}
                  min={m.min}
                  max={m.max}
                  step={m.step}
                  value={Number(hud.skill[m.k] ?? m.min)}
                  onChange={(v) => engineRef.current?.patchActive({ [m.k]: v })}
                />
              ))}
              {showsMeshEditor(hud.skill.kind) && (
                <>
                  <div className="mt-3 mb-2 text-[11px] tracking-wide text-muted">Projectile mesh</div>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {ASSETS.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => engineRef.current?.patchActive({ asset: a.id })}
                        className={`rounded-full px-3 py-1.5 text-xs ${
                          hud.skill.asset === a.id
                            ? "bg-primary text-bg"
                            : "border border-border text-fg"
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <label className="mb-3 flex items-center justify-between text-xs text-muted">
                Color
                <input
                  type="color"
                  value={hud.skill.color}
                  onChange={(e) => engineRef.current?.patchActive({ color: e.target.value })}
                  className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EXPLOSIONS.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => engineRef.current?.patchActive({ explosion: ex.id })}
                    className={`rounded-full px-3 py-1.5 text-xs ${
                      hud.skill.explosion === ex.id
                        ? "bg-fire text-bg"
                        : "border border-border text-fg"
                    }`}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 mb-2 text-[11px] tracking-wide text-muted">Warlords armor</div>
              <div className="mb-3 flex gap-1">
                {["A", "B", "C", "D", "E"].map((l) => (
                  <button
                    key={l}
                    type="button"
                    className={`rounded px-2 py-1 text-xs ${hud.armor === l ? "bg-gold text-bg" : "border border-border"}`}
                    onClick={() => engineRef.current?.setArmor(l)}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="mt-3 mb-2 text-[11px] tracking-wide text-muted">Save as new skill</div>
              <div className="mb-3 flex gap-1.5">
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Name"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm text-fg"
                />
                <button
                  type="button"
                  className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-bg"
                  onClick={() => {
                    engineRef.current?.saveNamedSkill(saveName);
                    setSaveName("");
                  }}
                >
                  Save
                </button>
              </div>
              <button
                type="button"
                className="mt-2 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-bg"
                onClick={() => engineRef.current?.castCurrent()}
              >
                Fire {hud.skill.name}
              </button>
            </aside>
          )}

          {hud.bookOpen && (
            <SpellBook
              hud={hud}
              engine={engineRef.current}
              onClose={() => engineRef.current?.toggleBook(false)}
            />
          )}

          {hud.studioOpen && (
            <aside className="hud-panel absolute left-3 top-24 z-20 w-[min(100%-1.5rem,22rem)] rounded-lg p-4">
              <h2 className="font-display text-xl">Studio import</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Fleet D1 spells + VFX catalog. Import a GLB or bind a catalog effect to T.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void engineRef.current?.importAsset(f);
                }}
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-fg py-2 text-sm font-semibold text-bg"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="size-4" /> Import mesh
                </button>
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm"
                  onClick={downloadSkill}
                >
                  <Download className="size-4" /> Export JSON
                </button>
              </div>
              <p className="mt-3 text-[11px] text-muted">D1 VFX catalog — tap to bind to T</p>
              <div className="mt-2 flex max-h-40 flex-wrap gap-1 overflow-auto">
                {(hud.effects ?? []).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="rounded-full border border-border px-2 py-1 text-[11px] text-fg"
                    onClick={() => engineRef.current?.applyVfx(e.id)}
                  >
                    {e.name}
                  </button>
                ))}
              </div>
            </aside>
          )}
        </>
      )}
    </main>
  );
}

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="hud-panel grid size-11 place-items-center rounded-lg text-fg"
    >
      {children}
    </button>
  );
}

function MiniSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-[10px] text-muted">
      <span className="flex justify-between">
        {label}
        <span className="text-fg">{Number.isFinite(value) ? value.toFixed(step < 1 ? 2 : 0) : "0"}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </label>
  );
}
