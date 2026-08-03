import { GRAVITY_DIRECTIONS } from './config.js';

export class UIController {
  constructor(root, callbacks) {
    this.root = root;
    this.callbacks = callbacks;
    root.insertAdjacentHTML('beforeend', `
      <div class="hud" aria-live="polite">
        <header class="objective-card">
          <div class="eyebrow">GRAVITY THIEF · PROTOTYPE</div>
          <div class="objective"><span class="objective-dot"></span><span>箱の重力を変えて、床のスイッチまで運ぼう！</span></div>
        </header>
        <aside class="status-card">
          <div class="status-row"><span>箱の重力</span><strong data-box-status>床へ</strong></div>
          <div class="status-row"><span>盗んだ重力</span><strong data-held-status>なし</strong></div>
        </aside>
        <button class="reset-button" data-reset aria-label="ステージをリセット">↻ <span>リセット</span></button>
        <div class="toast" data-toast></div>
        <div class="interaction" data-interaction><kbd>E</kbd><span>重力を盗む</span></div>
        <div class="help" data-help>
          <button class="help-close" data-help-close aria-label="操作説明を閉じる">×</button>
          <div class="help-title">箱から重力を盗み出そう</div>
          <div class="help-grid">
            <span><kbd>WASD</kbd> 移動</span><span><kbd>Space</kbd> ジャンプ</span>
            <span><kbd>Drag</kbd> カメラ</span><span><kbd>E</kbd> 重力を盗む</span>
            <span><kbd>1–6</kbd> 重力を選ぶ</span><span><kbd>R</kbd> リセット</span>
          </div>
          <div class="help-hint">ヒント：箱を右の壁へ落としてから、床へ。</div>
        </div>
        <div class="gravity-picker" data-picker>
          <div class="picker-panel">
            <div class="picker-eyebrow">STOLEN GRAVITY</div>
            <h2>箱をどこへ落とす？</h2>
            <div class="direction-grid">
              ${GRAVITY_DIRECTIONS.map((item) => `<button data-direction="${item.id}"><span class="direction-icon direction-${item.id}">➜</span><b>${item.label}</b><small>${item.key}</small></button>`).join('')}
            </div>
            <p>数字キー 1〜6 でも選べます</p>
          </div>
        </div>
        <div class="clear-screen" data-clear>
          <div class="clear-rays"></div>
          <div class="clear-panel">
            <div class="clear-star">✦</div>
            <div class="picker-eyebrow">PUZZLE SOLVED</div>
            <h1>ステージクリア！</h1>
            <p>重力を盗み、道をひらいた。</p>
            <div class="clear-actions">
              <button data-replay>もう一度遊ぶ</button>
              <button class="secondary" data-free-play>自由に遊ぶ</button>
            </div>
          </div>
        </div>
        <div class="touch-ui">
          <div class="joystick" data-joystick><div class="joystick-knob" data-joystick-knob></div></div>
          <div class="look-area" data-look-area></div>
          <button class="touch-button jump" data-touch-action="jump">↑<span>JUMP</span></button>
          <button class="touch-button steal" data-touch-action="steal" aria-label="箱から重力を盗む">✦<span>STEAL</span></button>
        </div>
      </div>
    `);

    this.boxStatus = root.querySelector('[data-box-status]');
    this.heldStatus = root.querySelector('[data-held-status]');
    this.interaction = root.querySelector('[data-interaction]');
    this.interactionLabel = this.interaction.querySelector('span');
    this.stealButton = root.querySelector('[data-touch-action="steal"]');
    this.picker = root.querySelector('[data-picker]');
    this.toastElement = root.querySelector('[data-toast]');
    this.clearScreen = root.querySelector('[data-clear]');
    this.toastTimer = null;

    root.querySelector('[data-reset]').addEventListener('click', callbacks.reset);
    root.querySelector('[data-help-close]').addEventListener('click', () => root.querySelector('[data-help]').classList.add('hidden'));
    root.querySelectorAll('[data-direction]').forEach((button) => button.addEventListener('click', () => callbacks.chooseGravity(button.dataset.direction)));
    root.querySelector('[data-replay]').addEventListener('click', callbacks.reset);
    root.querySelector('[data-free-play]').addEventListener('click', callbacks.freePlay);
  }

  updateStatus(directionId, held) {
    const direction = GRAVITY_DIRECTIONS.find((item) => item.id === directionId);
    this.boxStatus.textContent = direction?.label ?? 'なし（無重力）';
    this.boxStatus.classList.toggle('zero', !direction);
    this.heldStatus.textContent = held ? 'あり' : 'なし';
    this.heldStatus.classList.toggle('held', held);
  }

  showInteraction(show, label = '重力を盗む') {
    this.interactionLabel.textContent = label;
    this.interaction.classList.toggle('visible', show);
  }

  setRecoveryMode(active) {
    this.stealButton.classList.toggle('recovery', active);
    this.stealButton.querySelector('span').textContent = active ? 'RECALL' : 'STEAL';
    this.stealButton.setAttribute('aria-label', active ? '天井の箱から重力を遠隔回収' : '箱から重力を盗む');
  }

  showPicker(show) {
    this.picker.classList.toggle('visible', show);
  }

  showClear(show) {
    this.clearScreen.classList.toggle('visible', show);
  }

  toast(message, tone = 'teal') {
    clearTimeout(this.toastTimer);
    this.toastElement.textContent = message;
    this.toastElement.dataset.tone = tone;
    this.toastElement.classList.add('visible');
    this.toastTimer = setTimeout(() => this.toastElement.classList.remove('visible'), 2100);
  }

  reset() {
    this.showPicker(false);
    this.showClear(false);
    this.showInteraction(false);
    this.toastElement.classList.remove('visible');
    this.setRecoveryMode(false);
  }
}
