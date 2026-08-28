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
  weather: "sunny",
  activeMode: false,
};

export function AbilityLab({ autoEnter = false }: { autoEnter?: boolean }) {
  const engineRef = useRef<LabEngine | null>(null);
  const [entered, setEntered] = useState(autoEnter);
  const [hud, setHud] = useState<HudState>(EMPTY);
  const [joy, setJoy] = useState({ active: false, x: 0, y: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const [Canvas3d, setCanvas3d] = useState<ComponentType<{
    onHud: (s: HudState) => void;
    onEngine: (e: LabEngine | null) => void;
  }> | null>(null);

  const [ready3d, setReady3d] = useState(false);

  const onEngine = useCallback((e: LabEngine | null) => {
    engineRef.current = e;
    setReady3d(!!e);
  }, []);

  useEffect(() => {
    if (!entered) return;
    let dead = false;
    import("@/components/lab-canvas").then((m) => {
      if (!dead) setCanvas3d(() => m.LabCanvas);
    });
    return () => {
      dead = true;
      setCanvas3d(null);
      engineRef.current = null;
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
      {entered && Canvas3d ? <Canvas3d onHud={setHud} onEngine={onEngine} /> : null}

      {entered && !ready3d && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-bg">
          <p className="text-sm tracking-[0.28em] text-gold uppercase">Summoning the arena…</p>
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
                <b className="text-fg">LMB</b> fire · <b className="text-fg">RMB</b> orbit
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
              <div className="flex items-center gap-2">
                <Crosshair className="size-4 text-primary" />
                <span className="font-display text-lg leading-none">{hud.skillName}</span>
                <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] tracking-wide text-gold uppercase">
                  Warlords
                </span>
                <span className="ml-auto text-xs text-muted">{hud.fps}</span>
              </div>
              <p className="mt-1 text-xs text-muted">{hud.hint}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hud.kits.map((k) => (
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
              {hud.buffs.map((b) => (
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
              onClick={() => engineRef.current?.castCurrent()}
            >
              Cast
            </button>
            <TightHud
              hud={hud}
              onSlot={(code) => {
                if (hud.listening || !hud.bindings[code]) {
                  engineRef.current?.bindToSlot(code);
                  return;
                }
                engineRef.current?.setActiveSkill(hud.bindings[code]!);
                if (!hud.bookOpen && !hud.editorOpen) engineRef.current?.castCurrent();
              }}
            />
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
              {hud.tunes.length > 0 && (
                <>
                  <div className="mb-2 text-[11px] tracking-wide text-muted">Live GLSL</div>
                  <div className="mb-3 grid gap-1.5">
                    {hud.tunes.map((k) => (
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
              <div className="mb-2 text-[11px] tracking-wide text-muted">This skill</div>
              {editorMeters(hud.skill.kind).map((m) => (
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
                {hud.effects.map((e) => (
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
