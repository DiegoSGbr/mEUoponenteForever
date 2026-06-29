export interface MenuCallbacks {
  onPlay: () => void;
  onTutorial: () => void;
  onSettings: () => void;
  onCredits: () => void;
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  onVolumeChange: (v: number) => void;
}

export class Menu {
  private readonly root: HTMLElement;
  private volume = 0.7;
  callbacks: MenuCallbacks;

  constructor(root: HTMLElement, callbacks: MenuCallbacks) {
    this.root = root;
    this.callbacks = callbacks;
    const saved = localStorage.getItem('boxe-fp-volume');
    if (saved) this.volume = parseFloat(saved);
    this.render();
  }

  getVolume(): number {
    return this.volume;
  }

  private render(): void {
    const wrap = document.createElement('div');
    wrap.id = 'menu-wrap';
    wrap.className = 'interactive';
    this.root.prepend(wrap);
    wrap.innerHTML = `
      <div id="menu-main" class="menu-screen interactive">
        <div class="panel">
          <h1>mEU_Oponente_Forever</h1>
          <p class="subtitle">Aquele cara ali encarando você no Espelho? <br/> É o seu maior adversário!</p>
          <p id="menu-loading-status" class="loading-status" aria-live="polite"></p>
          <div class="menu-buttons">
            <button class="primary" data-action="play" disabled>Jogar</button>
            <button data-action="tutorial" disabled>Tutorial</button>
            <button data-action="settings">Configurações</button>
            <button data-action="credits">Créditos</button>
          </div>
        </div>
      </div>
      <div id="menu-settings" class="menu-screen interactive hidden">
        <div class="panel">
          <h1>Configurações</h1>
          <div class="settings-row">
            <label>Volume</label>
            <input type="range" id="volume-slider" min="0" max="100" value="${Math.round(this.volume * 100)}" />
            <span id="volume-value">${Math.round(this.volume * 100)}%</span>
          </div>
          <div class="menu-buttons">
            <button data-action="back-settings">Voltar</button>
          </div>
        </div>
      </div>
      <div id="menu-credits" class="menu-screen interactive hidden">
        <div class="panel">
          <h1>Créditos</h1>
          <p class="credits-text">
            mEU_Oponente_Forever — beta open source.<br/>
            Vite + TypeScript + Three.js.<br/>
            Personagem e animação: Adobe Mixamo.<br/>
            <a href="https://github.com/DiegoSGbr/mEUoponenteForever" target="_blank" rel="noopener">Contribua no GitHub</a>
          </p>
          <div class="menu-buttons">
            <button data-action="back-credits">Voltar</button>
          </div>
        </div>
      </div>
      <div id="menu-pause" class="pause-overlay interactive hidden">
        <div class="panel">
          <h1>Pausa</h1>
          <div class="menu-buttons">
            <button data-action="resume">Retomar</button>
            <button data-action="restart">Reiniciar</button>
            <button data-action="main-menu">Menu principal</button>
          </div>
        </div>
      </div>
      <div id="menu-result" class="result-overlay interactive hidden">
        <div class="panel">
          <h1 id="result-title">Vitória!</h1>
          <div class="result-stats" id="result-stats"></div>
          <div class="menu-buttons">
            <button data-action="restart">Jogar novamente</button>
            <button data-action="main-menu">Menu principal</button>
          </div>
        </div>
      </div>
    `;

    wrap.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      switch (action) {
        case 'play':
          this.callbacks.onPlay();
          break;
        case 'tutorial':
          this.callbacks.onTutorial();
          break;
        case 'settings':
          this.showScreen('settings');
          break;
        case 'credits':
          this.showScreen('credits');
          break;
        case 'back-settings':
        case 'back-credits':
          this.showScreen('main');
          break;
        case 'resume':
          this.callbacks.onResume();
          break;
        case 'restart':
          this.callbacks.onRestart();
          break;
        case 'main-menu':
          this.callbacks.onMainMenu();
          break;
      }
    });

    const slider = wrap.querySelector('#volume-slider') as HTMLInputElement;
    slider?.addEventListener('input', () => {
      this.volume = parseInt(slider.value, 10) / 100;
      localStorage.setItem('boxe-fp-volume', String(this.volume));
      const val = wrap.querySelector('#volume-value');
      if (val) val.textContent = `${slider.value}%`;
      this.callbacks.onVolumeChange(this.volume);
    });
  }

  private menuWrap(): HTMLElement | null {
    return this.root.querySelector('#menu-wrap');
  }

  showScreen(which: 'main' | 'settings' | 'credits'): void {
    const w = this.menuWrap();
    w?.querySelector('#menu-main')?.classList.toggle('hidden', which !== 'main');
    w?.querySelector('#menu-settings')?.classList.toggle('hidden', which !== 'settings');
    w?.querySelector('#menu-credits')?.classList.toggle('hidden', which !== 'credits');
  }

  showMain(): void {
    this.hidePause();
    this.hideResult();
    this.showScreen('main');
    this.menuWrap()?.querySelector('#menu-main')?.classList.remove('hidden');
  }

  hideMain(): void {
    const w = this.menuWrap();
    w?.querySelector('#menu-main')?.classList.add('hidden');
    w?.querySelector('#menu-settings')?.classList.add('hidden');
    w?.querySelector('#menu-credits')?.classList.add('hidden');
  }

  showPause(): void {
    this.menuWrap()?.querySelector('#menu-pause')?.classList.remove('hidden');
  }

  hidePause(): void {
    this.menuWrap()?.querySelector('#menu-pause')?.classList.add('hidden');
  }

  showResult(title: string, statsHtml: string): void {
    const w = this.menuWrap();
    const titleEl = w?.querySelector('#result-title');
    const statsEl = w?.querySelector('#result-stats');
    if (titleEl) titleEl.textContent = title;
    if (statsEl) statsEl.innerHTML = statsHtml;
    w?.querySelector('#menu-result')?.classList.remove('hidden');
  }

  hideResult(): void {
    this.menuWrap()?.querySelector('#menu-result')?.classList.add('hidden');
  }

  setLoading(loading: boolean): void {
    const w = this.menuWrap();
    const play = w?.querySelector('[data-action="play"]') as HTMLButtonElement | null;
    const tutorial = w?.querySelector('[data-action="tutorial"]') as HTMLButtonElement | null;
    const status = w?.querySelector('#menu-loading-status');

    if (play) play.disabled = loading;
    if (tutorial) tutorial.disabled = loading;
    if (status) {
      status.textContent = loading ? 'Carregando oponente...' : '';
    }
  }
}
