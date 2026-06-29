import Phaser from 'phaser';
import { generateHeroSpritesheet } from './HeroSpritesheet';

export type Direction = 'up' | 'down' | 'left' | 'right' | 'idle';

export interface HeroState {
  gridX: number;
  gridY: number;
  direction: Direction;
  isMoving: boolean;
  speedMs: number;
}

export class GridMovementScene extends Phaser.Scene {
  public static readonly GRID_SIZE = 64;
  public static readonly GRID_COLS = 9;
  public static readonly GRID_ROWS = 9;

  private hero!: Phaser.GameObjects.Sprite;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private targetMarker!: Phaser.GameObjects.Graphics;
  private hd2dLighting!: Phaser.GameObjects.Graphics;
  private vignetteOverlay!: Phaser.GameObjects.Graphics;
  private particleMotes!: Phaser.GameObjects.Arc[];

  // 状態管理
  private currentGridX: number = 4; // 中央スタート (0-indexed 0~8の4)
  private currentGridY: number = 4;
  private isMoving: boolean = false;
  private currentDirection: Direction = 'idle';
  
  // 設定
  private moveSpeedMs: number = 450; // 1グリッド移動にかかる時間(ms)
  private isRandomWalkEnabled: boolean = true;
  private showGridLines: boolean = true;
  private isHd2dEffectsEnabled: boolean = true;

  // Reactコールバック用
  private onStateChangeCallback?: (state: HeroState) => void;

  constructor() {
    super({ key: 'GridMovementScene' });
  }

  public setOnStateChange(callback: (state: HeroState) => void) {
    this.onStateChangeCallback = callback;
    this.notifyStateChange();
  }

  preload() {
    generateHeroSpritesheet(this);
  }

  create() {
    const { GRID_SIZE, GRID_COLS, GRID_ROWS } = GridMovementScene;

    // 1. 背景グリッドとタイルの作成
    this.createGridBackground();

    // 2. HD-2D 環境光＆ゴッドレイ風オーバーレイ
    this.hd2dLighting = this.add.graphics();
    this.hd2dLighting.setDepth(2);
    this.drawHd2dLighting();

    // 3. 移動先ターゲットのマーカー
    this.targetMarker = this.add.graphics();
    this.targetMarker.setDepth(3);

    // 4. アニメーション定義 (4方向 × 4フレーム)
    const dirs: { key: Direction; row: number }[] = [
      { key: 'down', row: 0 },
      { key: 'up', row: 1 },
      { key: 'left', row: 2 },
      { key: 'right', row: 3 }
    ];

    dirs.forEach(({ key, row }) => {
      const startFrame = row * 4;
      this.anims.create({
        key: `walk-${key}`,
        frames: this.anims.generateFrameNumbers('hero_spritesheet', {
          start: startFrame,
          end: startFrame + 3
        }),
        frameRate: 8,
        repeat: -1
      });

      this.anims.create({
        key: `idle-${key}`,
        frames: [{ key: 'hero_spritesheet', frame: startFrame }],
        frameRate: 1
      });
    });

    // 5. 勇者スプライト配置
    const startX = this.currentGridX * GRID_SIZE + GRID_SIZE / 2;
    const startY = this.currentGridY * GRID_SIZE + GRID_SIZE / 2;

    this.hero = this.add.sprite(startX, startY, 'hero_spritesheet', 0);
    this.hero.setDepth(10);
    this.hero.play('idle-down');

    // 6. HD-2D マナ粒子（ホタル風パーティクル）の生成
    this.particleMotes = [];
    for (let i = 0; i < 24; i++) {
      const px = Phaser.Math.Between(0, GRID_COLS * GRID_SIZE);
      const py = Phaser.Math.Between(0, GRID_ROWS * GRID_SIZE);
      const radius = Phaser.Math.FloatBetween(1, 2.8);
      const color = Phaser.Math.RND.pick([0xfef08a, 0xa5f3fc, 0xffffff, 0xbbf7d0]);
      
      const mote = this.add.circle(px, py, radius, color, Phaser.Math.FloatBetween(0.3, 0.85));
      mote.setDepth(15);
      this.particleMotes.push(mote);

      // ふわふわ漂うトゥイーン
      this.startMoteAnimation(mote);
    }

    // 7. HD-2D ヴィネット（シネマティック枠）
    this.vignetteOverlay = this.add.graphics();
    this.vignetteOverlay.setDepth(20);
    this.drawVignette();

    // 8. 初回ステータス通知
    this.notifyStateChange();

    // 9. ランダムウォークAIタイマー
    this.time.addEvent({
      delay: 100,
      callback: this.checkAndMoveRandomly,
      callbackScope: this,
      loop: true
    });
  }

  private startMoteAnimation(mote: Phaser.GameObjects.Arc) {
    const targetX = mote.x + Phaser.Math.Between(-40, 40);
    const targetY = mote.y - Phaser.Math.Between(20, 60);
    const duration = Phaser.Math.Between(3000, 7000);

    this.tweens.add({
      targets: mote,
      x: targetX,
      y: targetY,
      alpha: { from: mote.alpha, to: 0.1 },
      duration: duration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        const { GRID_SIZE, GRID_COLS, GRID_ROWS } = GridMovementScene;
        mote.setPosition(Phaser.Math.Between(0, GRID_COLS * GRID_SIZE), GRID_ROWS * GRID_SIZE + 10);
        mote.setAlpha(Phaser.Math.FloatBetween(0.3, 0.8));
        this.startMoteAnimation(mote);
      }
    });
  }

  private createGridBackground() {
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.setDepth(0);
    this.drawGrid();
  }

  private drawGrid() {
    const { GRID_SIZE, GRID_COLS, GRID_ROWS } = GridMovementScene;
    this.gridGraphics.clear();

    // HD-2D風 深みのある森の芝生タイル（微細な濃淡トーン）
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const isEven = (row + col) % 2 === 0;
        const color = isEven ? 0x064e3b : 0x065f46; // ダークエメラルド
        this.gridGraphics.fillStyle(color, 1);
        this.gridGraphics.fillRect(col * GRID_SIZE, row * GRID_SIZE, GRID_SIZE, GRID_SIZE);

        // タイル内側のハイライト（立体感）
        if (this.isHd2dEffectsEnabled) {
          this.gridGraphics.fillStyle(0x34d399, isEven ? 0.08 : 0.04);
          this.gridGraphics.fillRect(col * GRID_SIZE + 2, row * GRID_SIZE + 2, GRID_SIZE - 4, GRID_SIZE - 4);
        }
      }
    }

    // グリッド線
    if (this.showGridLines) {
      this.gridGraphics.lineStyle(1, 0x10b981, 0.35);
      for (let i = 0; i <= GRID_COLS; i++) {
        this.gridGraphics.lineBetween(i * GRID_SIZE, 0, i * GRID_SIZE, GRID_ROWS * GRID_SIZE);
      }
      for (let j = 0; j <= GRID_ROWS; j++) {
        this.gridGraphics.lineBetween(0, j * GRID_SIZE, GRID_COLS * GRID_SIZE, j * GRID_SIZE);
      }
    }
  }

  private drawHd2dLighting() {
    const { GRID_SIZE, GRID_COLS, GRID_ROWS } = GridMovementScene;
    this.hd2dLighting.clear();

    if (!this.isHd2dEffectsEnabled) return;

    // 左上からの陽光（サンライト・ゴッドレイ）
    this.hd2dLighting.fillStyle(0xfef08a, 0.12);
    this.hd2dLighting.fillTriangle(0, 0, GRID_COLS * GRID_SIZE * 0.7, 0, 0, GRID_ROWS * GRID_SIZE * 0.7);

    this.hd2dLighting.fillStyle(0x38bdf8, 0.08);
    this.hd2dLighting.fillTriangle(GRID_COLS * GRID_SIZE, 0, GRID_COLS * GRID_SIZE, GRID_ROWS * GRID_SIZE, 0, GRID_ROWS * GRID_SIZE);
  }

  private drawVignette() {
    const { GRID_SIZE, GRID_COLS, GRID_ROWS } = GridMovementScene;
    const totalW = GRID_COLS * GRID_SIZE;
    const totalH = GRID_ROWS * GRID_SIZE;

    this.vignetteOverlay.clear();
    if (!this.isHd2dEffectsEnabled) return;

    // 周辺減光（ヴィネットフレーム）
    const frameSize = 48;
    this.vignetteOverlay.fillStyle(0x022c22, 0.45);
    this.vignetteOverlay.fillRect(0, 0, totalW, frameSize);
    this.vignetteOverlay.fillRect(0, totalH - frameSize, totalW, frameSize);
    this.vignetteOverlay.fillRect(0, frameSize, frameSize, totalH - frameSize * 2);
    this.vignetteOverlay.fillRect(totalW - frameSize, frameSize, frameSize, totalH - frameSize * 2);
  }

  public toggleGridLines(show?: boolean) {
    this.showGridLines = show !== undefined ? show : !this.showGridLines;
    this.drawGrid();
  }

  public toggleHd2dEffects(enabled?: boolean) {
    this.isHd2dEffectsEnabled = enabled !== undefined ? enabled : !this.isHd2dEffectsEnabled;
    this.drawGrid();
    this.drawHd2dLighting();
    this.drawVignette();
    this.particleMotes.forEach(m => m.setVisible(this.isHd2dEffectsEnabled));
  }

  public setRandomWalk(enabled: boolean) {
    this.isRandomWalkEnabled = enabled;
  }

  public setSpeed(speedMs: number) {
    this.moveSpeedMs = speedMs;
    const frameRate = Math.max(4, Math.round(3600 / speedMs));
    ['up', 'down', 'left', 'right'].forEach(dir => {
      const anim = this.anims.get(`walk-${dir}`);
      if (anim) {
        anim.frameRate = frameRate;
      }
    });
  }

  private checkAndMoveRandomly() {
    if (!this.isRandomWalkEnabled || this.isMoving) return;

    const possibleDirs: Direction[] = [];
    if (this.currentGridY > 0) possibleDirs.push('up');
    if (this.currentGridY < GridMovementScene.GRID_ROWS - 1) possibleDirs.push('down');
    if (this.currentGridX > 0) possibleDirs.push('left');
    if (this.currentGridX < GridMovementScene.GRID_COLS - 1) possibleDirs.push('right');

    if (possibleDirs.length > 0) {
      const nextDir = Phaser.Utils.Array.GetRandom(possibleDirs);
      this.moveInDirection(nextDir);
    }
  }

  public moveInDirection(dir: Direction): boolean {
    if (this.isMoving || dir === 'idle') return false;

    let targetGridX = this.currentGridX;
    let targetGridY = this.currentGridY;

    switch (dir) {
      case 'up': targetGridY -= 1; break;
      case 'down': targetGridY += 1; break;
      case 'left': targetGridX -= 1; break;
      case 'right': targetGridX += 1; break;
    }

    if (
      targetGridX < 0 || targetGridX >= GridMovementScene.GRID_COLS ||
      targetGridY < 0 || targetGridY >= GridMovementScene.GRID_ROWS
    ) {
      return false;
    }

    this.isMoving = true;
    this.currentDirection = dir;
    this.hero.play(`walk-${dir}`, true);

    const { GRID_SIZE } = GridMovementScene;
    const targetX = targetGridX * GRID_SIZE + GRID_SIZE / 2;
    const targetY = targetGridY * GRID_SIZE + GRID_SIZE / 2;

    // 目的地パルス
    this.targetMarker.clear();
    this.targetMarker.lineStyle(2, 0xfacc15, 0.9);
    this.targetMarker.strokeRect(targetGridX * GRID_SIZE + 4, targetGridY * GRID_SIZE + 4, GRID_SIZE - 8, GRID_SIZE - 8);

    // HD-2D ダストトレイル（踏み出し時の土煙エフェクト）
    if (this.isHd2dEffectsEnabled) {
      this.spawnStepTrail(this.hero.x, this.hero.y + 24);
    }

    this.notifyStateChange();

    this.tweens.add({
      targets: this.hero,
      x: targetX,
      y: targetY,
      duration: this.moveSpeedMs,
      ease: 'Linear',
      onComplete: () => {
        this.currentGridX = targetGridX;
        this.currentGridY = targetGridY;
        this.isMoving = false;
        this.targetMarker.clear();

        this.hero.play(`idle-${dir}`, true);
        this.notifyStateChange();
      }
    });

    return true;
  }

  private spawnStepTrail(px: number, py: number) {
    const puff = this.add.circle(px, py, 6, 0xffffff, 0.5);
    puff.setDepth(5);
    this.tweens.add({
      targets: puff,
      scale: { from: 0.8, to: 2.2 },
      alpha: { from: 0.5, to: 0 },
      y: py - 6,
      duration: 350,
      ease: 'Quad.easeOut',
      onComplete: () => puff.destroy()
    });
  }

  private notifyStateChange() {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({
        gridX: this.currentGridX,
        gridY: this.currentGridY,
        direction: this.currentDirection,
        isMoving: this.isMoving,
        speedMs: this.moveSpeedMs
      });
    }
  }

  public resetPosition() {
    if (this.isMoving) return;

    this.currentGridX = 4;
    this.currentGridY = 4;
    const { GRID_SIZE } = GridMovementScene;
    this.hero.setPosition(this.currentGridX * GRID_SIZE + GRID_SIZE / 2, this.currentGridY * GRID_SIZE + GRID_SIZE / 2);
    this.hero.play('idle-down');
    this.currentDirection = 'idle';
    this.notifyStateChange();
  }
}
