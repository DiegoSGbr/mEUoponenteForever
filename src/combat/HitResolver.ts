import * as THREE from 'three';
import { PunchType, PUNCH_CONFIGS, WEAK_PUNCH_MULTIPLIER } from './PunchType';

export interface HitResult {
  hit: boolean;
  blocked: boolean;
  damage: number;
  stagger: boolean;
}

const GUARD_DAMAGE_REDUCTION = 0.55;

export class HitResolver {
  resolvePlayerHit(
    punchPos: THREE.Vector3,
    punchType: PunchType,
    weak: boolean,
    opponentBox: THREE.Box3,
    opponentGuarding: boolean,
    comboBonus: number,
  ): HitResult {
    const cfg = PUNCH_CONFIGS[punchType];
    const dist = punchPos.distanceTo(
      opponentBox.getCenter(new THREE.Vector3()),
    );

    if (dist > cfg.range + 0.35) {
      return { hit: false, blocked: false, damage: 0, stagger: false };
    }

    if (!opponentBox.containsPoint(punchPos) && dist > cfg.range) {
      const closest = new THREE.Vector3();
      opponentBox.clampPoint(punchPos, closest);
      if (punchPos.distanceTo(closest) > 0.45) {
        return { hit: false, blocked: false, damage: 0, stagger: false };
      }
    }

    let damage = cfg.damage * (weak ? WEAK_PUNCH_MULTIPLIER : 1);
    damage *= 1 + comboBonus;
    let blocked = false;

    if (opponentGuarding) {
      blocked = true;
      damage *= GUARD_DAMAGE_REDUCTION;
    }

    const stagger = damage >= 10 && !blocked;

    return { hit: true, blocked, damage, stagger };
  }

  resolveOpponentHit(
    punchOrigin: THREE.Vector3,
    range: number,
    damage: number,
    playerPos: THREE.Vector3,
    playerGuarding: boolean,
  ): HitResult {
    const dist = punchOrigin.distanceTo(playerPos.clone().add(new THREE.Vector3(0, 1.5, 0)));
    if (dist > range + 0.5) {
      return { hit: false, blocked: false, damage: 0, stagger: false };
    }

    let finalDamage = damage;
    let blocked = false;
    if (playerGuarding) {
      blocked = true;
      finalDamage *= GUARD_DAMAGE_REDUCTION;
    }

    return {
      hit: true,
      blocked,
      damage: finalDamage,
      stagger: finalDamage >= 8 && !blocked,
    };
  }
}
