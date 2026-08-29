import type { HudState } from "@/game/lab-types";
import {
  CLASS_KEYS,
  WEAPON_KEYS,
  keyLabel,
  skillGlyph,
  type SkillDef,
} from "@/game/skills";
import "./tight-hud.css";

const TB_W = 3800;
const TB_H = 726;
const TB_CELL_W = 230;
const TB_CELL_H = 132;
const TB_COLS = [776, 1028, 1274, 2276, 2526, 2772];
const TB_ROWS = [378, 548];
const TB_ORB_R = 176;
const TB_ORB_HP = { cx: 351, cy: 400 };
const TB_ORB_MP = { cx: 3444, cy: 392 };

function tbX(px: number) {
  return `${((px / TB_W) * 100).toFixed(3)}%`;
}
function tbY(px: number) {
  return `${((px / TB_H) * 100).toFixed(3)}%`;
}

function slotStyle(i: number) {
  const grid = i < 6 ? 0 : 1;
  const j = i % 6;
  const col = grid * 3 + (j % 3);
  const row = Math.floor(j / 3);
  return {
    left: tbX(TB_COLS[col]!),
    top: tbY(TB_ROWS[row]!),
    width: tbX(TB_CELL_W),
    height: tbY(TB_CELL_H),
  };
}

function orbStyle(orb: { cx: number; cy: number }) {
  return {
    left: tbX(orb.cx - TB_ORB_R),
    top: tbY(orb.cy - TB_ORB_R),
    width: tbX(TB_ORB_R * 2),
    height: tbY(TB_ORB_R * 2),
  };
}

const PLAY_CODES = [...WEAPON_KEYS, ...CLASS_KEYS] as const;

function slotOf(hud: HudState, code: string) {
  const id = hud.bindings[code];
  const row = (hud.book ?? []).find((s) => s.id === id);
  const on = hud.skill.id === id;
  return {
    code,
    key: keyLabel(code),
    name: row?.name ?? "Empty",
    glyph: row ? skillGlyph(row.name) : "·",
    on,
    empty: !row,
  };
}

export function TightHud({
  hud,
  onSlot,
}: {
  hud: HudState;
  onSlot: (code: string) => void;
}) {
  const slots = PLAY_CODES.map((code) => slotOf(hud, code));
  const hpPct = Math.max(0, Math.min(100, hud.hp));
  const mpPct = Math.max(0, Math.min(100, hud.mana ?? 100));
  const kit = (hud.kits ?? []).find((k) => k.id === hud.kitId);
  const name = kit?.name ?? "Warlord";
  const letter = (hud.kitId || name).slice(0, 2).toUpperCase();
  const hpOrb = orbStyle(TB_ORB_HP);
  const mpOrb = orbStyle(TB_ORB_MP);

  return (
    <div className="tightbar-root" data-tight-hud>
      <div
        className="tightbar"
        data-tightbar
        style={{ backgroundImage: "url('/hud-tight-bar.png?v=clean')" }}
      >
        <div className="tb-orb tb-orb-hp" style={hpOrb} title="Health">
          <div className="tb-orb-clip">
            <img className="tb-orb-globe" src="/hud/health_globe.png" alt="" draggable={false} />
            <div className="tb-orb-fill" style={{ ["--orb-pct" as string]: `${hpPct}%` }} />
            <div className="tb-orb-drain" style={{ height: `${100 - hpPct}%` }} />
          </div>
          <span className="tb-orb-val">{Math.round(hud.hp)}</span>
        </div>
        <div className="tb-orb tb-orb-mp" style={mpOrb} title="Mana">
          <div className="tb-orb-clip">
            <img className="tb-orb-globe" src="/hud/mana_globe.png" alt="" draggable={false} />
            <div
              className="tb-orb-fill tb-orb-fill--mp"
              style={{ ["--orb-pct" as string]: `${mpPct}%` }}
            />
            <div className="tb-orb-drain" style={{ height: `${100 - mpPct}%` }} />
          </div>
          <span className="tb-orb-val">{Math.round(hud.mana ?? 100)}</span>
        </div>
        {slots.map((s, i) => (
          <button
            key={s.code}
            type="button"
            className={`tb-slot ${s.on ? "is-on" : ""} ${s.empty ? "tb-empty" : "ready"} ${
              hud.listening ? "is-listen" : ""
            }`}
            style={slotStyle(i)}
            title={`${s.name} — ${s.key}`}
            onClick={() => onSlot(s.code)}
          >
            <span className="tb-glyph">{s.glyph}</span>
            <span className="tb-slot-name">{s.name}</span>
            <span className="tb-key">{s.key}</span>
          </button>
        ))}
        <div className="tb-avatar" title={name}>
          <span className="tb-avatar-letter">{letter}</span>
          <span className="tb-avatar-name">{name}</span>
        </div>
        <div className="tb-poise" title="Poise">
          <div className="tb-poise-fill" style={{ width: `${hpPct}%` }} />
        </div>
      </div>
      <div className="tb-keychips">
        <span className="tb-chip">1–6 weapon</span>
        <span className="tb-chip">R F V T G B class</span>
        <span className="tb-chip">LMB fire</span>
        <span className="tb-chip">Tab book</span>
      </div>
    </div>
  );
}

export function slotSkill(hud: HudState, code: string): SkillDef | undefined {
  const id = hud.bindings[code];
  return hud.skill.id === id ? hud.skill : undefined;
}
