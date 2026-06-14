import * as THREE from 'three';
import { RingScene } from '../scene/RingScene';
import { FirstPersonRig } from '../scene/FirstPersonRig';
import { PlayerController } from '../player/PlayerController';
import { StaminaSystem } from '../player/StaminaSystem';
import { CombatManager } from '../combat/CombatManager';
import { PunchType } from '../combat/PunchType';
import { OpponentAI } from '../opponent/OpponentAI';
import { StateMachine } from './StateMachine';
import { HUD } from '../ui/HUD';
import { Menu, type MenuCallbacks } from '../ui/Menu';
import { Tutorial } from '../ui/Tutorial';
import { AudioManager } from '../audio/AudioManager';

const ROUND_DURATION = 120;
const TOTAL_ROUNDS = 3;
const TKO_KNOCKDOWNS = 3;

export type MatchEndReason = 'ko' | 'tko' | 'decision' | 'draw';

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly uiRoot: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private ring!: RingScene;
  private rig!: FirstPersonRig;
  private player!: PlayerController;
  private stamina!: StaminaSystem;
  private combat!: CombatManager;
  private ai!: OpponentAI;
  readonly stateMachine = new StateMachine();
  private hud!: HUD;
  private menu!: Menu;
  private tutorial!: Tutorial;
  private audio!: AudioManager;

  private clock = new THREE.Clock();
  private guarding = false;
  private round = 1;
  private roundTimeLeft = ROUND_DURATION;
  private debugSpeed = 1;
  private betweenRounds = false;
  private roundPauseTimer = 0;
  private matchStartTime = 0;
  private lastPlayerPos = new THREE.Vector3();
  private particles: THREE.Points | null = null;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.canvas = canvas;
    this.uiRoot = uiRoot;
  }

  init(): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this.ring = new RingScene();
    this.rig = new FirstPersonRig(window.innerWidth / window.innerHeight);
    this.ring.scene.add(this.rig.root);
    this.player = new PlayerController();
    this.stamina = new StaminaSystem();
    this.combat = new CombatManager();
    this.ai = new OpponentAI();

    this.audio = new AudioManager();

    const callbacks: MenuCallbacks = {
      onPlay: () => this.startMatch(false),
      onTutorial: () => this.startMatch(true),
      onSettings: () => {},
      onCredits: () => {},
      onResume: () => this.resume(),
      onRestart: () => this.startMatch(this.stateMachine.state === 'tutorial'),
      onMainMenu: () => this.goToMenu(),
      onVolumeChange: (v) => this.audio.setVolume(v),
    };

    this.menu = new Menu(this.uiRoot, callbacks);
    this.hud = new HUD(this.uiRoot);
    this.tutorial = new Tutorial();
    this.tutorial.mount(this.uiRoot);
    const vol = this.menu.getVolume();
    this.audio.init(vol);

    this.stateMachine.onChange((s) => this.onStateChange(s));
    this.setupInput();
    this.onResize();
    window.addEventListener('resize', () => this.onResize());

    this.animate();
  }

  private setupInput(): void {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.player.keys.add(key);

      if (key === 'escape') {
        if (this.stateMachine.state === 'playing' || this.stateMachine.state === 'tutorial') {
          this.stateMachine.transition('paused');
          this.menu.showPause();
          document.exitPointerLock();
        } else if (this.stateMachine.state === 'paused') {
          this.resume();
        }
        return;
      }

      if (!this.stateMachine.isPlaying()) return;

      if (key === '`') {
        this.debugSpeed = this.debugSpeed === 1 ? 8 : 1;
        return;
      }

      if (key === ' ' && e.code === 'Space') {
        e.preventDefault();
        const ok = this.player.tryDodge(
          this.stamina.canAfford(PlayerController.dodgeStaminaCost()),
          () => this.stamina.spend(PlayerController.dodgeStaminaCost()),
        );
        if (ok) {
          this.audio.playWhoosh();
          if (this.stateMachine.state === 'tutorial') this.tutorial.onDodge();
        }
      }

      const punchMap: Record<string, PunchType> = {
        q: PunchType.Hook,
        e: PunchType.Uppercut,
      };
      if (punchMap[key]) {
        this.tryPunch(punchMap[key]);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.player.keys.delete(e.key.toLowerCase());
    });

    window.addEventListener('mousemove', (e) => {
      if (!document.pointerLockElement) return;
      if (!this.stateMachine.isPlaying()) return;
      this.rig.applyLookDelta(e.movementX, e.movementY);
      this.tutorial.onLookDelta(e.movementX, e.movementY);
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 && e.button !== 2) return;

      if (!document.pointerLockElement && this.stateMachine.needsPointerLock()) {
        if (e.button === 0) {
          void this.canvas.requestPointerLock();
          this.audio.init(this.menu.getVolume());
        }
        return;
      }

      if (!this.stateMachine.isPlaying()) return;

      if (e.button === 0) {
        this.tryPunch(PunchType.Jab);
      } else if (e.button === 2) {
        e.preventDefault();
        this.tryPunch(PunchType.Cross);
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      if (this.stateMachine.isPlaying()) e.preventDefault();
    });
  }

  private tryPunch(type: PunchType): void {
    const started = this.combat.tryPlayerPunch(
      type,
      this.stamina,
      !this.rig.activePunch,
      (t, w) => this.rig.startPunch(t, w),
    );
    if (started) {
      this.audio.playWhoosh();
      this.tutorial.onPunch(type);
    }
  }

  private startMatch(tutorialMode: boolean): void {
    this.combat.reset();
    this.stamina.value = 100;
    this.player.position.set(0, 0, 0);
    this.rig.resetLook();
    this.ai.position.set(0, 0, -4.2);
    this.ring.setOpponentPosition(0, -4.2);
    this.round = 1;
    this.roundTimeLeft = ROUND_DURATION;
    this.betweenRounds = false;
    this.matchStartTime = performance.now() / 1000;

    this.menu.hideMain();
    this.menu.hideResult();
    this.hud.show();

    if (tutorialMode) {
      this.tutorial.reset();
      this.tutorial.show();
      this.stateMachine.transition('tutorial');
    } else {
      this.tutorial.hide();
      this.stateMachine.transition('playing');
    }

    void this.canvas.requestPointerLock();
    this.audio.playStartBell();
    this.hud.showMessage(`Round ${this.round}!`);
  }

  private resume(): void {
    this.menu.hidePause();
    const backToTutorial = this.tutorial.isActive() && !this.tutorial.isComplete();
    this.stateMachine.transition(backToTutorial ? 'tutorial' : 'playing');
    void this.canvas.requestPointerLock();
  }

  private goToMenu(): void {
    document.exitPointerLock();
    this.stateMachine.transition('menu');
    this.menu.showMain();
    this.hud.hide();
    this.tutorial.hide();
  }

  private onStateChange(state: string): void {
    if (state === 'menu') {
      this.hud.hide();
    }
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.rig.setAspect(w / h);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05) * this.debugSpeed;

    if (this.stateMachine.isPlaying()) {
      this.updateGameplay(dt);
    }

    this.renderer.render(this.ring.scene, this.rig.camera);
  };

  private updateGameplay(dt: number): void {
    this.guarding = this.player.keys.has('shift');

    if (
      this.stateMachine.state === 'tutorial' &&
      this.tutorial.step === 'guard' &&
      this.guarding
    ) {
      this.tutorial.onGuard();
    }

    const resting = !this.player.keys.has('w') &&
      !this.player.keys.has('a') &&
      !this.player.keys.has('s') &&
      !this.player.keys.has('d') &&
      !this.rig.activePunch;

    this.stamina.update(dt, resting);
    this.combat.update(dt);
    this.player.update(dt, this.rig.position);
    this.rig.setGuardPose(this.guarding);

    if (this.rig.activePunch) {
      const phase = this.rig.updatePunch(dt);
      if (phase === 'active' && !this.rig.wasHitConsumed()) {
        this.resolvePlayerPunch();
      }
    }

    const playerAggressive = !!this.rig.activePunch || this.player.keys.has('q') || this.player.keys.has('e');
    this.ai.update(dt, this.player.position, playerAggressive, this.stamina.isExhausted());
    this.ring.setOpponentPosition(this.ai.position.x, this.ai.position.z);
    this.ring.setOpponentGuardVisual(this.ai.isGuarding());
    this.ring.updateOpponentHitbox();

    if (this.ai.isPunchActive()) {
      this.resolveOpponentPunch();
    }

    const moveDist = this.player.position.distanceTo(this.lastPlayerPos);
    this.tutorial.onMove(moveDist);
    this.lastPlayerPos.copy(this.player.position);

    if (this.guarding) {
      this.combat.player.guardTime += dt;
    }
    this.combat.player.guardTotal += dt;

    this.updateRoundTimer(dt);
    this.updateHUD();

    if (this.combat.opponent.health <= 0) {
      this.endMatch('ko', 'KO! Você venceu por nocaute.');
      return;
    }
    if (this.combat.player.health <= 0) {
      this.endMatch('ko', 'KO! Você foi nocauteado.');
      return;
    }
    if (this.combat.opponent.knockdowns >= TKO_KNOCKDOWNS) {
      this.endMatch('tko', 'TKO! Oponente não se levanta.');
      return;
    }
    if (this.combat.player.knockdowns >= TKO_KNOCKDOWNS) {
      this.endMatch('tko', 'TKO! Você não se levanta.');
      return;
    }
  }

  private resolvePlayerPunch(): void {
    const type = this.rig.getCurrentPunchType();
    if (!type || !this.rig.isPunchActive()) return;

    const comboBonus = this.combat.comboDetector.getComboBonus();
    const result = this.combat.hitResolver.resolvePlayerHit(
      this.rig.getPunchWorldPosition(),
      type,
      this.rig.activePunch?.weak ?? false,
      this.ring.opponentHitbox,
      this.ai.isGuarding(),
      comboBonus,
    );

    if (!result.hit) return;

    this.rig.consumeHit();
    const ko = this.combat.applyDamageToOpponent(result.damage);

    const now = performance.now() / 1000;
    const combo = this.combat.comboDetector.registerPunch(type, now, true);
    if (combo?.name === 'jab-jab-cross') {
      this.hud.setCombo(combo.display);
      this.tutorial.onCombo();
      this.combat.triggerStagger(0.5);
    } else if (combo) {
      this.hud.setCombo(combo.display);
    }

    if (result.blocked) {
      this.audio.playBlock();
      this.hud.showMessage('Bloqueado!');
    } else {
      this.audio.playImpact();
      this.spawnImpactParticles(this.ring.getOpponentWorldPosition());
      this.ring.applyOpponentHitFlash();
      if (result.stagger) this.combat.triggerStagger(0.4);
    }

    if (ko) return;
  }

  private resolveOpponentPunch(): void {
    const result = this.combat.hitResolver.resolveOpponentHit(
      this.ai.getPunchOrigin(),
      this.ai.getCurrentRange(),
      this.ai.getCurrentDamage(),
      this.player.position,
      this.guarding,
    );

    if (!result.hit) return;

    const ko = this.combat.applyDamageToPlayer(result.damage);
    if (result.blocked) {
      this.audio.playBlock();
      this.hud.shake();
      this.hud.showMessage('Você bloqueou!');
    } else {
      this.audio.playImpact();
      this.hud.shake();
      this.hud.showMessage('Levou um soco!');
    }

    if (ko) return;
  }

  private updateRoundTimer(dt: number): void {
    if (this.betweenRounds) {
      this.roundPauseTimer -= dt;
      if (this.roundPauseTimer <= 0) {
        this.betweenRounds = false;
        this.roundTimeLeft = ROUND_DURATION;
        this.audio.playBell();
        this.hud.showMessage(`Round ${this.round}!`);
      }
      return;
    }

    this.roundTimeLeft -= dt;
    if (this.roundTimeLeft <= 0) {
      if (this.round >= TOTAL_ROUNDS) {
        this.endByDecision();
      } else {
        this.round += 1;
        this.betweenRounds = true;
        this.roundPauseTimer = 3;
        this.audio.playBell();
        this.hud.showMessage('Intervalo...');
      }
    }
  }

  private endByDecision(): void {
    const p = this.combat.player.health;
    const o = this.combat.opponent.health;
    if (p > o + 5) {
      this.endMatch('decision', 'Vitória por decisão (barra de saúde).');
    } else if (o > p + 5) {
      this.endMatch('decision', 'Derrota por decisão (barra de saúde).');
    } else {
      this.endMatch('draw', 'Empate por decisão.');
    }
  }

  private endMatch(_reason: MatchEndReason, title: string): void {
    document.exitPointerLock();
    this.stateMachine.transition('result');
    this.hud.hide();

    // Sons de torcida conforme resultado (apenas vitória/derrota do jogador).
    const p = this.combat.player.health;
    const o = this.combat.opponent.health;
    if (p > o + 0.5) {
      this.audio.playCrowdCheer();
    } else if (o > p + 0.5) {
      this.audio.playCrowdBoo();
    }

    const elapsed = Math.floor(performance.now() / 1000 - this.matchStartTime);
    const landPct =
      this.combat.player.punchesThrown > 0
        ? Math.round(
            (this.combat.player.punchesLanded / this.combat.player.punchesThrown) * 100,
          )
        : 0;
    const guardPct =
      this.combat.player.guardTotal > 0
        ? Math.round((this.combat.player.guardTime / this.combat.player.guardTotal) * 100)
        : 0;

    const stats = `
      <p>Socos desferidos: ${this.combat.player.punchesThrown}</p>
      <p>Acertos: ${this.combat.player.punchesLanded} (${landPct}%)</p>
      <p>Tempo em guarda: ${guardPct}%</p>
      <p>Tempo de luta: ${elapsed}s</p>
      <p>Saúde final — Você: ${Math.round(this.combat.player.health)} | Oponente: ${Math.round(this.combat.opponent.health)}</p>
    `;

    this.menu.showResult(title, stats);

    if (this.stateMachine.state === 'tutorial' || this.tutorial.step !== 'done') {
      this.tutorial.hide();
    }
  }

  private updateHUD(): void {
    this.hud.updateHealth(
      (this.combat.player.health / this.combat.player.maxHealth) * 100,
      (this.combat.opponent.health / this.combat.opponent.maxHealth) * 100,
    );
    this.hud.updateStamina(this.stamina.getPercent(), this.stamina.isExhausted());
    this.hud.updateTimer(this.roundTimeLeft);
    this.hud.updateRound(this.round, TOTAL_ROUNDS);

    if (this.stamina.isExhausted()) {
      this.hud.showMessage('Stamina baixa!', 800);
    }
  }

  private spawnImpactParticles(pos: THREE.Vector3): void {
    if (this.particles) {
      this.ring.scene.remove(this.particles);
      this.particles.geometry.dispose();
      (this.particles.material as THREE.Material).dispose();
    }

    const count = 12;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x + (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 1] = pos.y + 1.4 + Math.random() * 0.4;
      positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.3;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffaa44,
      size: 0.08,
      transparent: true,
      opacity: 0.9,
    });
    this.particles = new THREE.Points(geo, mat);
    this.ring.scene.add(this.particles);
    setTimeout(() => {
      if (this.particles) {
        this.ring.scene.remove(this.particles);
        this.particles.geometry.dispose();
        (this.particles.material as THREE.Material).dispose();
        this.particles = null;
      }
    }, 200);
  }
}
