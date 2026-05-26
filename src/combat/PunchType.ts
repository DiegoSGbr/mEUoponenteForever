export enum PunchType {
  Jab = 'jab',
  Cross = 'cross',
  Hook = 'hook',
  Uppercut = 'uppercut',
}

export interface PunchConfig {
  type: PunchType;
  damage: number;
  range: number;
  staminaCost: number;
  windUp: number;
  active: number;
  recovery: number;
  key: string;
  hand: 'left' | 'right';
}

export const PUNCH_CONFIGS: Record<PunchType, PunchConfig> = {
  [PunchType.Jab]: {
    type: PunchType.Jab,
    damage: 6,
    range: 1.35,
    staminaCost: 8,
    windUp: 0.08,
    active: 0.1,
    recovery: 0.22,
    key: 'q',
    hand: 'left',
  },
  [PunchType.Cross]: {
    type: PunchType.Cross,
    damage: 12,
    range: 1.5,
    staminaCost: 14,
    windUp: 0.12,
    active: 0.12,
    recovery: 0.32,
    key: 'e',
    hand: 'right',
  },
  [PunchType.Hook]: {
    type: PunchType.Hook,
    damage: 14,
    range: 1.25,
    staminaCost: 16,
    windUp: 0.14,
    active: 0.11,
    recovery: 0.38,
    key: 'r',
    hand: 'left',
  },
  [PunchType.Uppercut]: {
    type: PunchType.Uppercut,
    damage: 18,
    range: 1.1,
    staminaCost: 20,
    windUp: 0.16,
    active: 0.1,
    recovery: 0.42,
    key: 'f',
    hand: 'right',
  },
};

export const WEAK_PUNCH_MULTIPLIER = 0.35;
