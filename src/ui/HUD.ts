export class HUD {
  private readonly root: HTMLElement;
  private readonly playerHealth: HTMLElement;
  private readonly opponentHealth: HTMLElement;
  private readonly staminaBar: HTMLElement;
  private readonly timerEl: HTMLElement;
  private readonly roundLabel: HTMLElement;
  private readonly comboEl: HTMLElement;
  private readonly messageEl: HTMLElement;

  constructor(root: HTMLElement) {
    const wrap = document.createElement('div');
    wrap.id = 'hud-wrap';
    root.appendChild(wrap);
    wrap.innerHTML = `
      <div id="hud" class="hidden">
        <div id="crosshair"></div>
        <div class="hud-top">
          <div class="bar-group">
            <label>Você</label>
            <div class="bar-track"><div class="bar-fill health-player" id="player-health-bar" style="width:100%"></div></div>
          </div>
          <div class="hud-center">
            <div id="round-timer">2:00</div>
            <div id="round-label">Round 1 / 3</div>
            <div id="combo-indicator"></div>
          </div>
          <div class="bar-group" style="text-align:right">
            <label>Oponente</label>
            <div class="bar-track"><div class="bar-fill health-opponent" id="opponent-health-bar" style="width:100%"></div></div>
          </div>
        </div>
        <div class="bar-group" style="max-width:200px;margin-top:auto">
          <label>Stamina</label>
          <div class="bar-track"><div class="bar-fill stamina" id="stamina-bar" style="width:100%"></div></div>
        </div>
        <div id="hud-message"></div>
      </div>
    `;
    this.root = wrap.querySelector('#hud')!;
    this.playerHealth = wrap.querySelector('#player-health-bar')!;
    this.opponentHealth = wrap.querySelector('#opponent-health-bar')!;
    this.staminaBar = wrap.querySelector('#stamina-bar')!;
    this.timerEl = wrap.querySelector('#round-timer')!;
    this.roundLabel = wrap.querySelector('#round-label')!;
    this.comboEl = wrap.querySelector('#combo-indicator')!;
    this.messageEl = wrap.querySelector('#hud-message')!;
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  updateHealth(player: number, opponent: number): void {
    this.playerHealth.style.width = `${player}%`;
    this.opponentHealth.style.width = `${opponent}%`;
  }

  updateStamina(percent: number, exhausted: boolean): void {
    this.staminaBar.style.width = `${percent}%`;
    this.staminaBar.classList.toggle('low', exhausted);
  }

  updateTimer(seconds: number): void {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    this.timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }

  updateRound(round: number, total: number): void {
    this.roundLabel.textContent = `Round ${round} / ${total}`;
  }

  setCombo(text: string): void {
    this.comboEl.textContent = text;
  }

  showMessage(text: string, durationMs = 2000): void {
    this.messageEl.textContent = text;
    this.messageEl.classList.add('visible');
    setTimeout(() => this.messageEl.classList.remove('visible'), durationMs);
  }

  shake(): void {
    document.getElementById('app')?.classList.add('shake');
    setTimeout(() => document.getElementById('app')?.classList.remove('shake'), 120);
  }
}
