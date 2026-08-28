/**
 * Danger Room / threejs-rapier quick-action catalog — 6+6 wing slots.
 *
 * Left  = weapon skills 1–6
 * Right = class abilities R F V T G B
 */

/** @typedef {'sig1'|'sig2'|'sig3'|'sig4'|'sig5'|'sig6'|'classR'|'classF'|'classV'|'classT'|'classG'|'classB'|'primary'|'interact'|'fskill'|'heavy'|'parry'|'block'|'dodge'|'kick'|'bomb'|'heal'|'mode'} QuickActionId */

/**
 * @typedef {object} QuickAction
 * @property {QuickActionId} id
 * @property {string} label
 * @property {string} glyph
 * @property {string} key
 * @property {'action'|'skill'|'item'|'meta'} kind
 */

/** @type {Record<QuickActionId, QuickAction>} */
export const QUICK_ACTIONS = {
  primary: { id: 'primary', label: 'Attack', glyph: '⚔', key: 'LMB', kind: 'action' },
  interact: { id: 'interact', label: 'Interact', glyph: '◎', key: 'F', kind: 'action' },
  fskill: { id: 'fskill', label: 'Class F', glyph: 'F', key: 'F', kind: 'skill' },
  sig1: { id: 'sig1', label: 'Weapon 1', glyph: '1', key: '1', kind: 'skill' },
  sig2: { id: 'sig2', label: 'Weapon 2', glyph: '2', key: '2', kind: 'skill' },
  sig3: { id: 'sig3', label: 'Weapon 3', glyph: '3', key: '3', kind: 'skill' },
  sig4: { id: 'sig4', label: 'Weapon 4', glyph: '4', key: '4', kind: 'skill' },
  sig5: { id: 'sig5', label: 'Weapon 5', glyph: '5', key: '5', kind: 'skill' },
  sig6: { id: 'sig6', label: 'Weapon 6', glyph: '6', key: '6', kind: 'skill' },
  classR: { id: 'classR', label: 'Class R', glyph: 'R', key: 'R', kind: 'skill' },
  classF: { id: 'classF', label: 'Class F', glyph: 'F', key: 'F', kind: 'skill' },
  classV: { id: 'classV', label: 'Class V', glyph: 'V', key: 'V', kind: 'skill' },
  classT: { id: 'classT', label: 'Class T', glyph: 'T', key: 'T', kind: 'skill' },
  classG: { id: 'classG', label: 'Class G', glyph: 'G', key: 'G', kind: 'skill' },
  classB: { id: 'classB', label: 'Class B', glyph: 'B', key: 'B', kind: 'skill' },
  heavy: { id: 'heavy', label: 'Heavy', glyph: '◆', key: 'Hold R', kind: 'action' },
  parry: { id: 'parry', label: 'Parry', glyph: '⛨', key: 'C', kind: 'action' },
  block: { id: 'block', label: 'Block', glyph: '▣', key: 'E', kind: 'action' },
  dodge: { id: 'dodge', label: 'Back dodge', glyph: '⟳', key: 'X', kind: 'action' },
  kick: { id: 'kick', label: 'Kick', glyph: '▹', key: 'MMB', kind: 'action' },
  bomb: { id: 'bomb', label: 'Bomb', glyph: '◉', key: 'H', kind: 'item' },
  heal: { id: 'heal', label: 'Heal', glyph: '✚', key: 'J', kind: 'item' },
  mode: { id: 'mode', label: 'Mode', glyph: '◎', key: 'Q', kind: 'meta' }
};

export const QUICK_SLOTS_PER_SIDE = 6;
export const QUICK_SLOT_COUNT = 12;

/**
 * Default 6+6 Tight HUD:
 * Left  = weapon 1–6
 * Right = class R F V / T G B
 * @returns {(QuickActionId|null)[]}
 */
export function defaultQuickSlots() {
  return [
    'sig1',
    'sig2',
    'sig3',
    'sig4',
    'sig5',
    'sig6',
    'classR',
    'classF',
    'classV',
    'classT',
    'classG',
    'classB'
  ];
}

export function leftWingSlots(slots = defaultQuickSlots()) {
  return slots.slice(0, QUICK_SLOTS_PER_SIDE);
}

export function rightWingSlots(slots = defaultQuickSlots()) {
  return slots.slice(QUICK_SLOTS_PER_SIDE, QUICK_SLOT_COUNT);
}

export const COMBAT_KEY_LEGEND =
  '1–6 weapon · R F V T G B class · E block · C parry · X dodge · Q mode';

export const COMBAT_KEY_CHIPS = Object.freeze([
  '1–6: Weapon',
  'R F V T G B: Class',
  'E: Block',
  'C: Parry',
  'X: Dodge',
  'Hold Q: Mode',
  'LMB: Path',
  'Space: Jump'
]);
