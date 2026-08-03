import { GRAVITY_DIRECTIONS } from './config.js';

export class UIController {
  constructor(root, callbacks) {
    this.root = root;
    this.callbacks = callbacks;
    root.insertAdjacentHTML('beforeend', `
      <div class="hud" aria-live="polite">
        <header class="objective-card">
          <div class="stage-line"><span data-stage-number>STAGE 1 / 5</span><strong data-stage-name>はじめの一歩</strong></div>
          <div class="objective"><span class="objective-dot"></span><span data-objective>箱の重力を変えて、床のスイッチまで運ぼう！</span></div>
        </header>
        <aside class="status-card">
          <div class="status-row"><span>操作する箱</span><strong data-target-status>なし</strong></div>
          <div class="status-row"><span>箱の重力</span><strong data-box-status>床へ</strong></div>
          <div class="status-row"><span>ぬすんだ重力</span><strong data-held-status>なし</strong></div>
        </aside>
        <button class="reset-button" data-reset aria-label="現在のステージをリセット">↻ <span>リセット</span></button>
        <button class="settings-button" data-settings-toggle aria-label="カメラ設定" aria-expanded="false">⚙</button>
        <section class="camera-settings hidden" data-camera-settings aria-hidden="true" data-no-camera>
          <div class="camera-settings-head">
            <div><strong>酔いにくいモード</strong><small>Motion Comfort</small></div>
            <button data-settings-close aria-label="設定を閉じる">×</button>
          </div>
          <label class="comfort-switch">
            <input type="checkbox" data-motion-comfort />
            <span aria-hidden="true"></span>
            <b data-comfort-label>ON</b>
          </label>
          <div class="sensitivity-setting">
            <span>カメラ感度</span>
            <div class="sensitivity-options" role="group" aria-label="カメラ感度">
              <button data-sensitivity="low">低い</button>
              <button data-sensitivity="normal">ふつう</button>
              <button data-sensitivity="high">高い</button>
            </div>
          </div>
          <p>右側をドラッグしてカメラを回します</p>
        </section>
        <div class="comfort-dot" data-comfort-dot aria-hidden="true"></div>
        <div class="toast" data-toast></div>
        <div class="interaction" data-interaction><kbd>E</kbd><span>重力をぬすむ</span></div>
        <div class="help" data-help>
          <button class="help-close" data-help-close aria-label="操作説明を閉じる">×</button>
          <div class="help-title">箱から重力をぬすみ出そう</div>
          <div class="help-grid">
            <span><kbd>WASD</kbd> 移動</span><span><kbd>Space</kbd> ジャンプ</span>
            <span><kbd>Drag</kbd> カメラ</span><span><kbd>E</kbd> 重力をぬすむ</span>
            <span><kbd>1〜6</kbd> 重力を選ぶ</span><span><kbd>R</kbd> ステージリセット</span>
          </div>
          <div class="help-hint" data-stage-hint></div>
        </div>
        <div class="gravity-picker" data-picker>
          <div class="picker-panel">
            <div class="picker-eyebrow">CHOOSE GRAVITY</div>
            <h2>重力をどこへ向ける？</h2>
            <div class="direction-grid">
              ${GRAVITY_DIRECTIONS.map((item) => `<button data-direction="${item.id}"><span class="direction-icon direction-${item.id}">➜</span><b>${item.label}</b><small>${item.key}</small></button>`).join('')}
            </div>
            <p data-keyboard-hint>数字キー 1〜6 でも選べます</p>
          </div>
        </div>
        <div class="clear-screen" data-clear>
          <div class="clear-rays"></div>
          <div class="clear-panel">
            <div class="clear-star">★</div>
            <div class="picker-eyebrow" data-clear-eyebrow>PUZZLE SOLVED</div>
            <h1 data-clear-title>STAGE CLEAR!</h1>
            <h2 data-clear-stage></h2>
            <p data-clear-message>重力をあやつってゴールへたどり着いた！</p>
            <div class="clear-actions" data-stage-clear-actions>
              <button data-next-stage>次のステージへ</button>
              <button class="secondary" data-replay>もう一度遊ぶ</button>
            </div>
            <div class="clear-actions hidden" data-all-clear-actions>
              <button data-restart-all>最初から遊ぶ</button>
              <button class="secondary" data-free-play>ステージ5で自由に遊ぶ</button>
            </div>
          </div>
        </div>
        <div class="stage-fade" data-stage-fade></div>
        <div class="touch-ui">
          <div class="joystick" data-joystick><div class="joystick-knob" data-joystick-knob></div></div>
          <div class="look-area" data-look-area></div>
          <button class="touch-button jump" data-touch-action="jump" aria-label="ジャンプ">↑<span>JUMP</span></button>
          <button class="touch-button steal" data-touch-action="steal" aria-label="操作できる箱はありません" disabled>✦<span>STEAL</span></button>
        </div>
      </div>
    `);

    this.stageNumber = root.querySelector('[data-stage-number]');
    this.stageName = root.querySelector('[data-stage-name]');
    this.objective = root.querySelector('[data-objective]');
    this.stageHint = root.querySelector('[data-stage-hint]');
    this.targetStatus = root.querySelector('[data-target-status]');
    this.boxStatus = root.querySelector('[data-box-status]');
    this.heldStatus = root.querySelector('[data-held-status]');
    this.interaction = root.querySelector('[data-interaction]');
    this.interactionLabel = this.interaction.querySelector('span');
    this.stealButton = root.querySelector('[data-touch-action="steal"]');
    this.picker = root.querySelector('[data-picker]');
    this.settingsButton = root.querySelector('[data-settings-toggle]');
    this.settingsPanel = root.querySelector('[data-camera-settings]');
    this.motionComfortInput = root.querySelector('[data-motion-comfort]');
    this.comfortLabel = root.querySelector('[data-comfort-label]');
    this.comfortDot = root.querySelector('[data-comfort-dot]');
    this.settingsOpen = false;
    this.toastElement = root.querySelector('[data-toast]');
    this.clearScreen = root.querySelector('[data-clear]');
    this.fade = root.querySelector('[data-stage-fade]');
    this.clearTitle = root.querySelector('[data-clear-title]');
    this.clearStage = root.querySelector('[data-clear-stage]');
    this.clearMessage = root.querySelector('[data-clear-message]');
    this.stageClearActions = root.querySelector('[data-stage-clear-actions]');
    this.allClearActions = root.querySelector('[data-all-clear-actions]');
    this.toastTimer = null;

    root.querySelector('[data-reset]').addEventListener('click', callbacks.reset);
    root.querySelector('[data-help-close]').addEventListener('click', () => root.querySelector('[data-help]').classList.add('hidden'));
    root.querySelector('[data-next-stage]').addEventListener('click', callbacks.nextStage);
    root.querySelector('[data-replay]').addEventListener('click', callbacks.reset);
    root.querySelector('[data-restart-all]').addEventListener('click', callbacks.restartAll);
    root.querySelector('[data-free-play]').addEventListener('click', callbacks.freePlay);
    this.settingsButton.addEventListener('click', () => this.showSettings(!this.settingsOpen));
    root.querySelector('[data-settings-close]').addEventListener('click', () => this.showSettings(false));
    this.motionComfortInput.addEventListener('change', () => callbacks.setMotionComfort(this.motionComfortInput.checked));
    root.querySelectorAll('[data-sensitivity]').forEach((button) => {
      button.addEventListener('click', () => callbacks.setCameraSensitivity(button.dataset.sensitivity));
    });

    root.querySelectorAll('[data-direction]').forEach((button) => {
      const id = button.dataset.direction;
      button.addEventListener('pointerenter', () => callbacks.previewGravity(id));
      button.addEventListener('pointerleave', callbacks.clearPreview);
      button.addEventListener('focus', () => callbacks.previewGravity(id));
      button.addEventListener('blur', callbacks.clearPreview);
      button.addEventListener('pointerdown', () => callbacks.previewGravity(id));
      button.addEventListener('pointercancel', callbacks.clearPreview);
      button.addEventListener('click', () => callbacks.chooseGravity(id));
    });
  }

  setStage(stage, total) {
    this.stageNumber.textContent = `STAGE ${stage.id} / ${total}`;
    this.stageName.textContent = stage.name;
    this.objective.textContent = stage.objective;
    this.stageHint.textContent = `ヒント：${stage.hint}`;
    this.root.style.setProperty('--stage-accent', stage.palette.gravity);
    this.root.style.setProperty('--stage-bg', stage.palette.background);
  }

  updateStatus(box, heldBox) {
    const direction = GRAVITY_DIRECTIONS.find((item) => item.id === box?.directionId);
    this.targetStatus.textContent = box ? `箱 ${box.id.replace('box-', '').toUpperCase()}` : 'なし';
    this.boxStatus.textContent = box ? (direction?.label ?? '無重力') : '—';
    this.boxStatus.classList.toggle('zero', Boolean(box && !direction));
    this.heldStatus.textContent = heldBox ? 'あり' : 'なし';
    this.heldStatus.classList.toggle('held', Boolean(heldBox));
  }

  showInteraction(show, label = '重力をぬすむ') {
    this.interactionLabel.textContent = label;
    this.interaction.classList.toggle('visible', show);
  }

  setStealState(available, recovery = false) {
    this.stealButton.disabled = !available;
    this.stealButton.classList.toggle('available', available);
    this.stealButton.classList.toggle('recovery', recovery);
    this.stealButton.querySelector('span').textContent = recovery ? 'RECALL' : 'STEAL';
    this.stealButton.setAttribute('aria-label', available ? (recovery ? '天井の箱から重力を遠隔回収' : '箱から重力をぬすむ') : '操作できる箱はありません');
  }

  pulseSteal() {
    this.stealButton.classList.remove('attention');
    void this.stealButton.offsetWidth;
    this.stealButton.classList.add('attention');
  }

  bounceSteal() {
    this.stealButton.classList.remove('stolen');
    void this.stealButton.offsetWidth;
    this.stealButton.classList.add('stolen');
  }

  showPicker(show) {
    this.picker.classList.toggle('visible', show);
    this.root.classList.toggle('gravity-picker-open', show);
  }

  showClear(show, { final = false, stageName = '' } = {}) {
    this.clearScreen.classList.toggle('visible', show);
    this.root.classList.toggle('clear-screen-open', show);
    if (!show) return;
    this.clearTitle.textContent = final ? 'ALL STAGES CLEAR!' : 'STAGE CLEAR!';
    this.clearStage.textContent = final ? '重力泥棒マスター！' : stageName;
    this.clearMessage.textContent = final ? '5つのステージをすべてクリアした！' : '重力をあやつってゴールへたどり着いた！';
    this.stageClearActions.classList.toggle('hidden', final);
    this.allClearActions.classList.toggle('hidden', !final);
  }

  showFade(show) {
    this.fade.classList.toggle('visible', show);
  }

  showSettings(show) {
    this.settingsOpen = show;
    this.settingsPanel.classList.toggle('hidden', !show);
    this.settingsPanel.setAttribute('aria-hidden', String(!show));
    this.settingsButton.setAttribute('aria-expanded', String(show));
    this.root.classList.toggle('camera-settings-open', show);
    this.callbacks.settingsVisibility(show);
  }

  setCameraSettings({ motionComfort, sensitivity }) {
    this.motionComfortInput.checked = motionComfort;
    this.comfortLabel.textContent = motionComfort ? 'ON' : 'OFF';
    this.comfortDot.classList.toggle('hidden', !motionComfort);
    this.root.querySelectorAll('[data-sensitivity]').forEach((button) => {
      const selected = button.dataset.sensitivity === sensitivity;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  toast(message, tone = 'teal') {
    clearTimeout(this.toastTimer);
    this.toastElement.textContent = message;
    this.toastElement.dataset.tone = tone;
    this.toastElement.classList.add('visible');
    this.toastTimer = setTimeout(() => this.toastElement.classList.remove('visible'), 2100);
  }

  resetTransient() {
    clearTimeout(this.toastTimer);
    this.showSettings(false);
    this.showPicker(false);
    this.showClear(false);
    this.showInteraction(false);
    this.toastElement.classList.remove('visible');
    this.setStealState(false);
  }
}
