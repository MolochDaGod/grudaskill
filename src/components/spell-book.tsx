import { useState } from "react";
import { BookOpen, KeyRound } from "lucide-react";
import type { LabEngine, HudState } from "@/game/lab-types";
import {
  KIND_LABEL,
  PATH_LABEL,
  CLASS_KEYS,
  WEAPON_KEYS,
  keyLabel,
  editorMeters,
  showsMeshEditor,
  type SkillKind,
  type PathKind,
  type ProjectileAsset,
  type ExplosionKind,
  type EditorMeterKey,
} from "@/game/skills";

const KINDS: SkillKind[] = [
  "linear",
  "nova",
  "beam",
  "ritual",
  "portal",
  "buff",
  "slash",
  "cone",
  "path",
  "dash",
  "volley",
  "weapon",
];
const PATHS: PathKind[] = ["straight", "arc", "sine", "homing"];
const ASSETS: ProjectileAsset[] = ["arrow", "bolt", "ice", "fire", "spear", "bullet"];
const BOOMS: ExplosionKind[] = ["fire", "ice", "kinetic"];

export function SpellBook({
  hud,
  engine,
  onClose,
}: {
  hud: HudState;
  engine: LabEngine | null;
  onClose: () => void;
}) {
  const [activeFilter, setActiveFilter] = useState("all");
  const books = ["all", ...Array.from(new Set((hud.book ?? []).map((s) => s.book)))];
  const rows = (hud.book ?? []).filter((s) => {
    if (activeFilter === "all") return true;
    return s.book === activeFilter || s.kind === activeFilter;
  });

  return (
    <div className="pointer-events-auto absolute inset-3 z-30 flex flex-col overflow-hidden rounded-xl border border-border bg-bg/92 shadow-2xl md:inset-8">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <BookOpen className="size-5 text-gold" />
        <div>
          <h2 className="font-display text-2xl leading-none">Spell book</h2>
          <p className="text-xs text-muted">1–6 weapon · R F V T G B class · click a slot to bind</p>
        </div>
        <span className="ml-auto text-xs text-muted">{hud.listening ? "Listening for key…" : `${hud.book.length} skills`}</span>
        <button type="button" className="rounded-lg border border-border px-3 py-1.5 text-sm" onClick={onClose}>
          Close (Tab)
        </button>
      </header>
      <BindStrip hud={hud} engine={engine} />
      <div className="flex min-h-0 flex-1">
        <aside className="w-36 shrink-0 overflow-auto border-r border-border p-2 text-xs">
          {["all", ...books.filter((b) => b !== "all"), ...KINDS].map((f) => (
            <button
              key={f}
              type="button"
              className={`mb-1 w-full rounded-md px-2 py-1.5 text-left ${
                activeFilter === f ? "bg-primary text-bg" : "text-muted hover:bg-surface"
              }`}
              onClick={() => setActiveFilter(f)}
            >
              {KIND_LABEL[f as SkillKind] ?? f}
            </button>
          ))}
        </aside>
        <div className="min-w-0 flex-1 overflow-auto p-2">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {rows.map((s) => {
              const on = hud.skill.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left ${
                    on ? "border-gold bg-gold/15" : "border-border bg-surface/60"
                  }`}
                  onClick={() => engine?.setActiveSkill(s.id)}
                  onDoubleClick={() => {
                    engine?.setActiveSkill(s.id);
                    engine?.castCurrent();
                  }}
                >
                  <span className="w-8 text-[11px] font-semibold text-gold">{s.hotkey || "—"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.name}</span>
                    <span className="block text-[11px] text-muted">
                      {KIND_LABEL[s.kind]} · {s.school} · {s.book}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <Editor hud={hud} engine={engine} />
      </div>
    </div>
  );
}

function BindStrip({ hud, engine }: { hud: HudState; engine: LabEngine | null }) {
  const banks: { title: string; keys: readonly string[] }[] = [
    { title: "Weapon 1–6", keys: WEAPON_KEYS },
    { title: "Class R F V T G B", keys: CLASS_KEYS },
  ];
  return (
    <div className="border-b border-border px-3 py-2">
      {banks.map((bank) => (
        <div key={bank.title} className="mb-1.5 last:mb-0">
          <p className="mb-1 text-[10px] tracking-wide text-muted uppercase">{bank.title}</p>
          <div className="flex gap-1">
            {bank.keys.map((code) => {
              const id = hud.bindings[code];
              const row = hud.book.find((s) => s.id === id);
              const on = hud.skill.id === id;
              return (
                <button
                  key={code}
                  type="button"
                  className={`min-w-0 flex-1 rounded-md px-1 py-1.5 text-left ${
                    on ? "bg-gold text-bg" : "border border-border bg-surface/70"
                  }`}
                  title={row?.name ?? "Empty — click Bind then this slot"}
                  onClick={() => {
                    if (hud.listening || !id) engine?.bindToSlot(code);
                    else engine?.setActiveSkill(id);
                  }}
                >
                  <span className="block text-[10px] font-semibold">{keyLabel(code)}</span>
                  <span className="block truncate text-[11px]">{row?.name ?? "—"}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Editor({ hud, engine }: { hud: HudState; engine: LabEngine | null }) {
  const s = hud.skill;
  return (
    <aside className="hidden w-72 shrink-0 overflow-auto border-l border-border p-3 md:block">
      <p className="font-display text-xl">{s.name}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{s.desc}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-lg bg-fire py-2 text-sm font-semibold text-bg"
          onClick={() => engine?.castCurrent()}
        >
          Cast
        </button>
        <button
          type="button"
          className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm ${
            hud.listening ? "bg-gold text-bg" : "border border-border"
          }`}
          onClick={() => engine?.armBind()}
        >
          <KeyRound className="size-4" /> Bind
        </button>
      </div>
      <label className="mt-3 block text-[11px] text-muted">
        Delivery
        <select
          className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm text-fg"
          value={s.kind}
          onChange={(e) => engine?.patchActive({ kind: e.target.value as SkillKind })}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-2 block text-[11px] text-muted">
        Pathing
        <select
          className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm text-fg"
          value={s.path}
          onChange={(e) => engine?.patchActive({ path: e.target.value as PathKind, kind: s.kind === "linear" ? "path" : s.kind })}
        >
          {PATHS.map((k) => (
            <option key={k} value={k}>
              {PATH_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      {showsMeshEditor(s.kind) && (
        <label className="mt-2 block text-[11px] text-muted">
          Mesh
          <select
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm text-fg"
            value={s.asset}
            onChange={(e) => engine?.patchActive({ asset: e.target.value as ProjectileAsset })}
          >
            {ASSETS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="mt-2 flex items-center justify-between text-[11px] text-muted">
        Color
        <input
          type="color"
          value={s.color}
          onChange={(e) => engine?.patchActive({ color: e.target.value })}
          className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-1">
        {BOOMS.map((b) => (
          <button
            key={b}
            type="button"
            className={`rounded-full px-2 py-1 text-[11px] ${s.explosion === b ? "bg-fire text-bg" : "border border-border"}`}
            onClick={() => engine?.patchActive({ explosion: b })}
          >
            {b}
          </button>
        ))}
      </div>
      {editorMeters(s.kind).map((m) => (
        <Meter
          key={m.k}
          label={m.label}
          v={Number(s[m.k] ?? m.min)}
          min={m.min}
          max={m.max}
          step={m.step}
          on={engine}
          k={m.k}
        />
      ))}
    </aside>
  );
}

function Meter({
  label,
  v,
  min,
  max,
  step,
  on,
  k,
}: {
  label: string;
  v: number;
  min: number;
  max: number;
  step: number;
  on: LabEngine | null;
  k: EditorMeterKey;
}) {
  return (
    <label className="mt-2 block text-[11px] text-muted">
      <span className="flex justify-between">
        {label}
        <span className="text-fg">{Number(v ?? 0).toFixed(step < 1 ? 2 : 0)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v ?? min}
        onChange={(e) => on?.patchActive({ [k]: Number(e.target.value) })}
        className="w-full accent-primary"
      />
    </label>
  );
}
