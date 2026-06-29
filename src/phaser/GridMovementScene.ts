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

  // 状態管理
  private currentGridX: number = 4; // 中央スタート (0-indexed 0~8の4)
  private currentGridY: number = 4;
  private isMoving: boolean = false;
  private currentDirection: Direction = 'idle';
  
  // 設定
  private moveSpeedMs: number = 450; // 1グリッド移動にかかる時間(ms)
  private isRandomWalkEnabled: boolean = true;
  private showGridLines: boolean = true;

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
    // Canvasでスプライトシートを生成して登録
    generateHeroSpritesheet(this);
  }

  create() {
    const { GRID_SIZE, GRID_COLS, GRID_ROWS } = GridMovementScene;

    // 1. 背景グリッドとタイルの作成
    this.createGridBackground();

    // 2. 移動先ターゲットのマーカー（移動中に目的地をハイライト）
    this.targetMarker = this.add.graphics();
    this.targetMarker.setDepth(1);

    // 3. アニメーション定義 (4方向 × 4フレーム)
    // 行0: down, 行1: up, 行2: left, 行3: right
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

      // 待機中フレーム
      this.anims.create({
        key: `idle-${key}`,
        frames: [{ key: 'hero_spritesheet', frame: startFrame }],
        frameRate: 1
      });
    });

    // 4. 勇者スプライトの配置 (中心座標にセット)
    const startX = this.currentGridX * GRID_SIZE + GRID_SIZE / 2;
    const startY = this.currentGridY * GRID_SIZE + GRID_SIZE / 2;

    this.hero = this.add.sprite(startX, startY, 'hero_spritesheet', 0);
    this.hero.setDepth(10);
    this.hero.play('idle-down');

    // 5. 初回ステータス通知
    this.notifyStateChange();

    // 6. ランダムウォークのタイマー開始
    this.time.addEvent({
      delay: 100,
      callback: this.checkAndMoveRandomly,
      callbackScope: this,
      loop: true
    });
  }

  /**
   * グリッド背景を描画
   */
  private createGridBackground() {
    const { GRID_SIZE, GRID_COLS, GRID_ROWS } = GridMovementScene;

    this.gridGraphics = this.add.graphics();
    this.drawGrid();
  }

  private drawGrid() {
    const { GRID_SIZE, GRID_COLS, GRID_ROWS } = GridMovementScene;
    this.gridGraphics.clear();

    // チェッカーボード状の草原背景
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const isEven = (row + col) % 2 === 0;
        this.gridGraphics.fillStyle(isEven ? 0xecfdf5 : 0xd1fae5, 1);
        this.gridGraphics.fillRect(col * GRID_SIZE, row * GRID_SIZE, GRID_SIZE, GRID_SIZE);
      }
    }

    // グリッド線の描画
    if (this.showGridLines) {
      this.gridGraphics.lineStyle(1, 0x059669, 0.25);
      for (let i = 0; i <= GRID_COLS; i++) {
        this.gridGraphics.lineBetween(i * GRID_SIZE, 0, i * GRID_SIZE, GRID_ROWS * GRID_SIZE);
      }
      for (let j = 0; j <= GRID_ROWS; j++) {
        this.gridGraphics.lineBetween(0, j * GRID_SIZE, GRID_COLS * GRID_SIZE, j * GRID_SIZE);
      }
    }
  }

  /**
   * グリッド線表示の切り替え
   */
  public toggleGridLines(show?: boolean) {
    this.showGridLines = show !== undefined ? show : !this.showGridLines;
    this.drawGrid();
  }

  /**
   * ランダムウォークのON/OFF
   */
  public setRandomWalk(enabled: boolean) {
    this.isRandomWalkEnabled = enabled;
  }

  /**
   * 移動速度の変更(ms)
   */
  public setSpeed(speedMs: number) {
    this.moveSpeedMs = speedMs;
    // アニメーション速度も移動スピードに合わせて調整
    const frameRate = Math.max(4, Math.round(3600 / speedMs));
    ['up', 'down', 'left', 'right'].forEach(dir => {
      const anim = this.anims.get(`walk-${dir}`);
      if (anim) {
        anim.frameRate = frameRate;
      }
    });
  }

  /**
   * 定期チェックでランダム移動を実行
   */
  private checkAndMoveRandomly() {
    if (!this.isRandomWalkEnabled || this.isMoving) {
      return;
    }

    // 移動可能な方向をリストアップ
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

  /**
   * 指定方向への手動または自動移動
   */
  public moveInDirection(dir: Direction): boolean {
    if (this.isMoving || dir === 'idle') {
      return false;
    }

    let targetGridX = this.currentGridX;
    let targetGridY = this.currentGridY;

    switch (dir) {
      case 'up':
        targetGridY -= 1;
        break;
      case 'down':
        targetGridY += 1;
        break;
      case 'left':
        targetGridX -= 1;
        break;
      case 'right':
        targetGridX += 1;
        break;
    }

    // グリッド範囲外チェック
    if (
      targetGridX < 0 ||
      targetGridX >= GridMovementScene.GRID_COLS ||
      targetGridY < 0 ||
      targetGridY >= GridMovementScene.GRID_ROWS
    ) {
      return false;
    }

    // 移動処理開始
    this.isMoving = true;
    this.currentDirection = dir;
    this.hero.play(`walk-${dir}`, true);

    const { GRID_SIZE } = GridMovementScene;
    const targetX = targetGridX * GRID_SIZE + GRID_SIZE / 2;
    const targetY = targetGridY * GRID_SIZE + GRID_SIZE / 2;

    // 目的地をパルス表示
    this.targetMarker.clear();
    this.targetMarker.lineStyle(2, 0x10b981, 0.8);
    this.targetMarker.strokeRect(targetGridX * GRID_SIZE + 4, targetGridY * GRID_SIZE + 4, GRID_SIZE - 8, GRID_SIZE - 8);

    this.notifyStateChange();

    // Phaserトゥイーンで滑らかに移動
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

        // 停止時はidleアニメーションへ移行
        this.hero.play(`idle-${dir}`, true);
        this.notifyStateChange();
      }
    });

    return true;
  }

  /**
   * ステータス通知
   */
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

  /**
   * 初期位置に戻す
   */
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
