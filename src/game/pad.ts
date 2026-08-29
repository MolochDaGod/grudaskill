/** Standard-mapping Xbox/PlayStation pad. Polled fresh every frame — never cache the Gamepad object. */

export type PadFrame = {
  connected: boolean;
  id: string;
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  sprint: boolean;
  fire: boolean;
  fireEdge: boolean;
  focus: boolean;
  focusEdge: boolean;
  focusToggleEdge: boolean;
  pauseEdge: boolean;
  bookEdge: boolean;
  weaponDelta: number;
  classSlot: number;
};

const EMPTY: PadFrame = {
  connected: false,
  id: "",
  moveX: 0,
  moveY: 0,
  lookX: 0,
  lookY: 0,
  sprint: false,
  fire: false,
  fireEdge: false,
  focus: false,
  focusEdge: false,
  focusToggleEdge: false,
  pauseEdge: false,
  bookEdge: false,
  weaponDelta: 0,
  classSlot: -1,
};

const prev = {
  fire: false,
  focus: false,
  ls: false,
  start: false,
  back: false,
  lb: false,
  rb: false,
  dpad: [false, false, false, false],
  x: false,
  y: false,
};

function radial(x: number, y: number, dz = 0.18) {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = (m - dz) / (1 - dz) / m;
  return { x: x * scale, y: y * scale };
}

function pressed(gp: Gamepad, i: number) {
  return gp.buttons[i]?.pressed === true;
}

function value(gp: Gamepad, i: number) {
  return gp.buttons[i]?.value ?? 0;
}

function edge(now: boolean, key: "fire" | "focus" | "ls" | "start" | "back" | "lb" | "rb" | "x" | "y") {
  const e = now && !prev[key];
  prev[key] = now;
  return e;
}

export function pollPad(): PadFrame {
  const list = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
  let gp: Gamepad | null = null;
  for (const p of list) {
    if (p?.connected) {
      gp = p;
      break;
    }
  }
  if (!gp) {
    prev.fire = prev.focus = prev.ls = prev.start = prev.back = prev.lb = prev.rb = prev.x = prev.y = false;
    prev.dpad = [false, false, false, false];
    return EMPTY;
  }

  const left = radial(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
  const right = radial(gp.axes[2] ?? 0, gp.axes[3] ?? 0, 0.2);
  const fire = pressed(gp, 0) || value(gp, 7) > 0.55;
  const focus = value(gp, 6) > 0.5;
  const ls = pressed(gp, 10);
  const start = pressed(gp, 9);
  const back = pressed(gp, 8);
  const lb = pressed(gp, 4);
  const rb = pressed(gp, 5);
  const x = pressed(gp, 2);
  const y = pressed(gp, 3);
  const dpad = [12, 13, 14, 15].map((i) => pressed(gp, i));

  let classSlot = -1;
  if (dpad[0] && !prev.dpad[0]) classSlot = 0;
  else if (dpad[2] && !prev.dpad[2]) classSlot = 1;
  else if (dpad[1] && !prev.dpad[1]) classSlot = 2;
  else if (dpad[3] && !prev.dpad[3]) classSlot = 3;
  else if (edge(x, "x")) classSlot = 4;
  else if (edge(y, "y")) classSlot = 5;
  prev.dpad = dpad;

  let weaponDelta = 0;
  if (edge(lb, "lb")) weaponDelta = -1;
  if (edge(rb, "rb")) weaponDelta = 1;

  return {
    connected: true,
    id: gp.id.replace(/\s+/g, " ").slice(0, 42),
    moveX: left.x,
    moveY: -left.y,
    lookX: right.x,
    lookY: right.y,
    sprint: pressed(gp, 11) || value(gp, 7) > 0.92,
    fire,
    fireEdge: edge(fire, "fire"),
    focus,
    focusEdge: edge(focus, "focus"),
    focusToggleEdge: edge(ls, "ls"),
    pauseEdge: edge(start, "start"),
    bookEdge: edge(back, "back"),
    weaponDelta,
    classSlot,
  };
}

export function rumble(strong = 0.32, weak = 0.12, ms = 70) {
  const list = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of list) {
    const actuator = p?.vibrationActuator;
    if (!actuator?.playEffect) continue;
    void actuator.playEffect("dual-rumble", {
      startDelay: 0,
      duration: ms,
      strongMagnitude: strong,
      weakMagnitude: weak,
    });
  }
}
