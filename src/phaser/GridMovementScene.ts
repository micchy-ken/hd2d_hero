import Phaser from 'phaser';
import { generateHeroSpritesheet } from './HeroSpritesheet';
import { generateSlimeSpritesheet } from './MonsterSpritesheets';

export type Direction = 'up' | 'down' | 'left' | 'right' | 'idle';

export interface HeroState {
  gridX: number;
  gridY: number;
  camGridX: number;
  camGridY: number;
  direction: Direction;
  isMoving: boolean;
  isScrolling: boolean;
  speedMs: number;
  hp: number;
  maxHp: number;
  attack: number;
  level: number;
  exp: number;
}

interface SlimeData {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  gridX: number;
  gridY: number;
  isMoving: boolean;
  hp: number;
  maxHp: number;
}

export interface ActionLog {
  id: string;
  message: string;
  type: 'info' | 'combat' | 'system' | 'damage';
}

export class GridMovementScene extends Phaser.Scene {
  public static readonly GRID_SIZE = 64;
  public static readonly GRID_COLS = 16;
  public static readonly GRID_ROWS = 16;
  public static readonly VIEWPORT_COLS = 7;
  public static readonly VIEWPORT_ROWS = 7;

  private hero!: Phaser.GameObjects.Sprite;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private targetMarker!: Phaser.GameObjects.Graphics;
  private hd2dLighting!: Phaser.GameObjects.Graphics;
  private vignetteOverlay!: Phaser.GameObjects.Graphics;
  private particleMotes!: Phaser.GameObjects.Arc[];
  private slimes: SlimeData[] = [];

  // 状態管理
  private currentGridX: number = 7; // 16x16の中央付近(7,7)
  private currentGridY: number = 7;
  private currentCamGridX: number = 4; // 7x7画面の中央に(7,7)が来るようカメラ左上を(4,4)に設定
  private currentCamGridY: number = 4;
  private isMoving: boolean = false;
  private currentDirection: Direction = 'idle';
  
  // 設定
  private moveSpeedMs: number = 450; // 1グリッド移動にかかる時間(ms)
  private autoMode: 'none' | 'random' | 'seek' = 'random';
  private showGridLines: boolean = true;
  private isHd2dEffectsEnabled: boolean = true;

  // ヒーローステータス
  private heroHp: number = 20;
  private heroMaxHp: number = 20;
  private heroAttack: number = 5;
  private heroLevel: number = 1;
  private heroExp: number = 0;

  // Reactコールバック用
  private onStateChangeCallback?: (state: HeroState) => void;
  private onLogCallback?: (log: ActionLog) => void;

  constructor() {
    super({ key: 'GridMovementScene' });
  }

  public setOnStateChange(callback: (state: HeroState) => void) {
    this.onStateChangeCallback = callback;
    this.notifyStateChange();
  }

  public setOnLog(callback: (log: ActionLog) => void) {
    this.onLogCallback = callback;
  }

  private sendLog(message: string, type: ActionLog['type'] = 'info') {
    if (this.onLogCallback) {
      this.onLogCallback({
        id: Math.random().toString(36).substring(2, 9),
        message,
        type
      });
    }
  }

  preload() {
    generateHeroSpritesheet(this);
    generateSlimeSpritesheet(this);
  }

  create() {
    const { GRID_SIZE, GRID_COLS, GRID_ROWS, VIEWPORT_COLS, VIEWPORT_ROWS } = GridMovementScene;

    // カメラ境界を設定
    this.cameras.main.setBounds(0, 0, GRID_COLS * GRID_SIZE, GRID_ROWS * GRID_SIZE);
    this.cameras.main.scrollX = this.currentCamGridX * GRID_SIZE;
    this.cameras.main.scrollY = this.currentCamGridY * GRID_SIZE;

    // 1. 背景グリッドとタイルの作成
    this.createGridBackground();

    // 2. HD-2D 環境光＆ゴッドレイ風オーバーレイ (カメラ固定)
    this.hd2dLighting = this.add.graphics();
    this.hd2dLighting.setDepth(2);
    this.hd2dLighting.setScrollFactor(0, 0);
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

    // スライムのアニメーション
    this.anims.create({
      key: 'slime-idle',
      frames: [{ key: 'slime_spritesheet', frame: 0 }],
      frameRate: 1
    });
    this.anims.create({
      key: 'slime-shake',
      frames: this.anims.generateFrameNumbers('slime_spritesheet', { start: 1, end: 2 }),
      frameRate: 12,
      repeat: -1
    });
    this.anims.create({
      key: 'slime-jump',
      frames: [{ key: 'slime_spritesheet', frame: 3 }],
      frameRate: 1
    });

    // 5. 勇者スプライト配置
    const startX = this.currentGridX * GRID_SIZE + GRID_SIZE / 2;
    const startY = this.currentGridY * GRID_SIZE + GRID_SIZE / 2;

    this.hero = this.add.sprite(startX, startY, 'hero_spritesheet', 0);
    this.hero.setDepth(10);
    this.hero.play('idle-down');

    // 5.5. スライムの配置
    this.slimes = [];
    for (let i = 0; i < 5; i++) {
      const sx = Phaser.Math.Between(2, GRID_COLS - 3);
      const sy = Phaser.Math.Between(2, GRID_ROWS - 3);
      const slimeSprite = this.add.sprite(sx * GRID_SIZE + GRID_SIZE / 2, sy * GRID_SIZE + GRID_SIZE / 2, 'slime_spritesheet', 0);
      slimeSprite.setDepth(9); // 勇者より少し奥
      slimeSprite.play('slime-idle');
      
      this.slimes.push({
        id: `slime-${Math.random().toString(36).substring(2, 9)}`,
        sprite: slimeSprite,
        gridX: sx,
        gridY: sy,
        isMoving: false,
        hp: 10,
        maxHp: 10
      });
    }

    // 6. HD-2D マナ粒子（ホタル風パーティクル）の生成（カメラ固定領域内で生成）
    this.particleMotes = [];
    for (let i = 0; i < 20; i++) {
      const px = Phaser.Math.Between(0, VIEWPORT_COLS * GRID_SIZE);
      const py = Phaser.Math.Between(0, VIEWPORT_ROWS * GRID_SIZE);
      const radius = Phaser.Math.FloatBetween(1, 2.8);
      const color = Phaser.Math.RND.pick([0xfef08a, 0xa5f3fc, 0xffffff, 0xbbf7d0]);
      
      const mote = this.add.circle(px, py, radius, color, Phaser.Math.FloatBetween(0.3, 0.85));
      mote.setDepth(15);
      mote.setScrollFactor(0, 0); // 常に画面内に表示
      this.particleMotes.push(mote);

      // ふわふわ漂うトゥイーン
      this.startMoteAnimation(mote);
    }

    // 7. HD-2D ヴィネット（シネマティック枠）(カメラ固定)
    this.vignetteOverlay = this.add.graphics();
    this.vignetteOverlay.setDepth(20);
    this.vignetteOverlay.setScrollFactor(0, 0);
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
        const { GRID_SIZE, VIEWPORT_COLS, VIEWPORT_ROWS } = GridMovementScene;
        mote.setPosition(Phaser.Math.Between(0, VIEWPORT_COLS * GRID_SIZE), VIEWPORT_ROWS * GRID_SIZE + 10);
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

        // スクロール時の現在地把握に役立つ自然のランドマーク配置
        const landmarkHash = (row * 37 + col * 17) % 13;
        if (landmarkHash === 1) {
          // 小さな黄・白の花
          this.gridGraphics.fillStyle(0xfef08a, 0.75);
          this.gridGraphics.fillCircle(col * GRID_SIZE + 20, row * GRID_SIZE + 24, 3.5);
          this.gridGraphics.fillStyle(0xffffff, 0.85);
          this.gridGraphics.fillCircle(col * GRID_SIZE + 16, row * GRID_SIZE + 21, 2);
          this.gridGraphics.fillCircle(col * GRID_SIZE + 24, row * GRID_SIZE + 21, 2);
        } else if (landmarkHash === 4) {
          // 森の小石
          this.gridGraphics.fillStyle(0x334155, 0.8);
          this.gridGraphics.fillRoundedRect(col * GRID_SIZE + 40, row * GRID_SIZE + 42, 10, 6, 2);
          this.gridGraphics.fillStyle(0x475569, 0.5);
          this.gridGraphics.fillRoundedRect(col * GRID_SIZE + 41, row * GRID_SIZE + 43, 8, 3, 1);
        } else if (landmarkHash === 7) {
          // 小さなシダ植物
          this.gridGraphics.fillStyle(0x10b981, 0.55);
          this.gridGraphics.fillRect(col * GRID_SIZE + 14, row * GRID_SIZE + 46, 4, 10);
          this.gridGraphics.fillRect(col * GRID_SIZE + 20, row * GRID_SIZE + 44, 4, 12);
        }
      }
    }

    // 16x16フィールド全体の外枠ボーダー
    this.gridGraphics.lineStyle(4, 0x047857, 0.9);
    this.gridGraphics.strokeRect(1, 1, GRID_COLS * GRID_SIZE - 2, GRID_ROWS * GRID_SIZE - 2);

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
    const { GRID_SIZE, VIEWPORT_COLS, VIEWPORT_ROWS } = GridMovementScene;
    const totalW = VIEWPORT_COLS * GRID_SIZE; // 448
    const totalH = VIEWPORT_ROWS * GRID_SIZE; // 448
    this.hd2dLighting.clear();

    if (!this.isHd2dEffectsEnabled) return;

    // 左上からの陽光（サンライト・ゴッドレイ）
    this.hd2dLighting.fillStyle(0xfef08a, 0.12);
    this.hd2dLighting.fillTriangle(0, 0, totalW * 0.7, 0, 0, totalH * 0.7);

    this.hd2dLighting.fillStyle(0x38bdf8, 0.08);
    this.hd2dLighting.fillTriangle(totalW, 0, totalW, totalH, 0, totalH);
  }

  private drawVignette() {
    const { GRID_SIZE, VIEWPORT_COLS, VIEWPORT_ROWS } = GridMovementScene;
    const totalW = VIEWPORT_COLS * GRID_SIZE;
    const totalH = VIEWPORT_ROWS * GRID_SIZE;

    this.vignetteOverlay.clear();
    if (!this.isHd2dEffectsEnabled) return;

    // 周辺減光（ヴィネットフレーム）
    const frameSize = 38;
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

  public setAutoMode(mode: 'none' | 'random' | 'seek') {
    this.autoMode = mode;
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
    if (this.autoMode === 'none') return;

    // スライムの補充
    if (this.slimes.length < 5 && Math.random() < 0.1) {
      const sx = Phaser.Math.Between(2, GridMovementScene.GRID_COLS - 3);
      const sy = Phaser.Math.Between(2, GridMovementScene.GRID_ROWS - 3);
      // 勇者の位置以外に湧く
      if (sx !== this.currentGridX && sy !== this.currentGridY) {
        const { GRID_SIZE } = GridMovementScene;
        const slimeSprite = this.add.sprite(sx * GRID_SIZE + GRID_SIZE / 2, sy * GRID_SIZE + GRID_SIZE / 2, 'slime_spritesheet', 0);
        slimeSprite.setDepth(9);
        slimeSprite.play('slime-idle');
        
        this.slimes.push({
          id: `slime-${Math.random().toString(36).substring(2, 9)}`,
          sprite: slimeSprite,
          gridX: sx,
          gridY: sy,
          isMoving: false,
          hp: 10,
          maxHp: 10
        });
        this.sendLog('A wild slime appeared!', 'system');
      }
    }

    // 勇者の自動移動
    if (!this.isMoving) {
      if (this.autoMode === 'seek') {
        // 索敵・戦闘モード (AIを使わないロジック)
        if (this.slimes.length > 0) {
          // 最も近いスライムを探す
          let closestSlime: SlimeData | null = null;
          let minDistance = Infinity;

          this.slimes.forEach(slime => {
            const dist = Math.abs(slime.gridX - this.currentGridX) + Math.abs(slime.gridY - this.currentGridY);
            if (dist < minDistance) {
              minDistance = dist;
              closestSlime = slime;
            }
          });

          if (closestSlime) {
            // 最も近いスライムに近づく方向を決定
            const possibleDirs: Direction[] = [];
            const sx = closestSlime.gridX;
            const sy = closestSlime.gridY;

            if (this.currentGridX > sx) possibleDirs.push('left');
            if (this.currentGridX < sx) possibleDirs.push('right');
            if (this.currentGridY > sy) possibleDirs.push('up');
            if (this.currentGridY < sy) possibleDirs.push('down');

            if (possibleDirs.length > 0) {
              // 複数ある場合はランダムに一つ選ぶ
              const nextDir = Phaser.Utils.Array.GetRandom(possibleDirs);
              this.moveInDirection(nextDir);
            }
          }
        } else {
          // 敵がいない場合はランダム散策
          this.performRandomWalk();
        }
      } else {
        // 通常のランダムウォーク
        this.performRandomWalk();
      }
    }

    // スライムのランダム移動
    this.slimes.forEach(slime => {
      if (slime.isMoving) return;
      if (Math.random() > 0.3) return; // 30%の確率で動く

      const slimeDirs: Direction[] = [];
      if (slime.gridY > 0) slimeDirs.push('up');
      if (slime.gridY < GridMovementScene.GRID_ROWS - 1) slimeDirs.push('down');
      if (slime.gridX > 0) slimeDirs.push('left');
      if (slime.gridX < GridMovementScene.GRID_COLS - 1) slimeDirs.push('right');

      if (slimeDirs.length > 0) {
        const nextDir = Phaser.Utils.Array.GetRandom(slimeDirs);
        this.moveSlime(slime, nextDir);
      }
    });
  }

  private performRandomWalk() {
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

  private performAttack(slimeIndex: number) {
    const slime = this.slimes[slimeIndex];
    if (!slime) {
      this.isMoving = false;
      return;
    }

    const damage = Math.max(1, this.heroAttack - 1); // Simple damage calc
    slime.hp -= damage;
    this.sendLog(`Hero hit Slime for ${damage} damage!`, 'combat');

    // 攻撃エフェクト
    const slash = this.add.graphics();
    slash.setDepth(15);
    slash.lineStyle(4, 0xfacc15, 1);
    const sx = slime.sprite.x - 20;
    const sy = slime.sprite.y - 20;
    const ex = slime.sprite.x + 20;
    const ey = slime.sprite.y + 20;
    slash.beginPath();
    slash.moveTo(sx, sy);
    slash.lineTo(ex, ey);
    slash.strokePath();
    
    this.tweens.add({
      targets: slash,
      alpha: 0,
      duration: 300,
      onComplete: () => slash.destroy()
    });

    // ちょっとだけ前進して戻る（バンプ）
    const origX = this.hero.x;
    const origY = this.hero.y;
    const dx = (slime.sprite.x - origX) * 0.3;
    const dy = (slime.sprite.y - origY) * 0.3;

    this.tweens.add({
      targets: this.hero,
      x: origX + dx,
      y: origY + dy,
      duration: 100,
      yoyo: true,
      onComplete: () => {
        this.hero.play(`idle-${this.currentDirection}`, true);
        this.isMoving = false;

        if (slime.hp <= 0) {
          this.sendLog(`Slime was defeated! Gained 2 EXP.`, 'info');
          this.heroExp += 2;
          if (this.heroExp >= 10) {
            this.heroLevel++;
            this.heroExp = 0;
            this.heroMaxHp += 5;
            this.heroHp = this.heroMaxHp;
            this.heroAttack += 2;
            this.sendLog(`Level Up! You are now level ${this.heroLevel}.`, 'system');
          }
          
          this.tweens.add({
            targets: slime.sprite,
            scaleX: 0,
            scaleY: 0,
            alpha: 0,
            duration: 200,
            onComplete: () => {
              if (slime.sprite && slime.sprite.active) slime.sprite.destroy();
            }
          });
          const currentIdx = this.slimes.indexOf(slime);
          if (currentIdx !== -1) {
            this.slimes.splice(currentIdx, 1);
          }
        }
        this.notifyStateChange(false);
      }
    });
  }

  private performSlimeAttack(slime: SlimeData) {
    slime.isMoving = true;
    slime.sprite.play('slime-jump');

    const origX = slime.sprite.x;
    const origY = slime.sprite.y;
    const dx = (this.hero.x - origX) * 0.3;
    const dy = (this.hero.y - origY) * 0.3;

    this.tweens.add({
      targets: slime.sprite,
      x: origX + dx,
      y: origY + dy,
      duration: 150,
      yoyo: true,
      onComplete: () => {
        if (slime.sprite && slime.sprite.active) {
          slime.sprite.play('slime-idle');
        }
        slime.isMoving = false;
        
        const damage = 2; // Fixed damage for now
        this.heroHp = Math.max(0, this.heroHp - damage);
        this.sendLog(`Slime attacked Hero for ${damage} damage!`, 'damage');
        
        // 画面フラッシュ
        this.cameras.main.flash(200, 255, 0, 0, 0.4);
        
        this.notifyStateChange(false);

        if (this.heroHp <= 0) {
          this.sendLog(`Hero was defeated...`, 'system');
          // 本当はゲームオーバー処理を入れる
          this.time.delayedCall(1000, () => {
             this.heroHp = this.heroMaxHp;
             this.sendLog(`Hero was revived!`, 'system');
             this.notifyStateChange(false);
          });
        }
      }
    });
  }

  private moveSlime(slime: SlimeData, dir: Direction) {
    if (slime.isMoving) return;

    let targetGridX = slime.gridX;
    let targetGridY = slime.gridY;

    switch (dir) {
      case 'up': targetGridY -= 1; break;
      case 'down': targetGridY += 1; break;
      case 'left': targetGridX -= 1; break;
      case 'right': targetGridX += 1; break;
    }

    // 勇者への攻撃判定
    if (targetGridX === this.currentGridX && targetGridY === this.currentGridY) {
      this.performSlimeAttack(slime);
      return;
    }
    // 他のスライムとの重なり防止
    if (this.slimes.some(s => s.gridX === targetGridX && s.gridY === targetGridY)) return;

    slime.isMoving = true;
    slime.sprite.play('slime-shake'); // プルプル震える

    const { GRID_SIZE } = GridMovementScene;
    const targetX = targetGridX * GRID_SIZE + GRID_SIZE / 2;
    const targetY = targetGridY * GRID_SIZE + GRID_SIZE / 2;

    // プルプルする時間 (移動速度の30%程度、最大150ms)
    const shakeDuration = Math.min(150, this.moveSpeedMs * 0.3);
    const moveDuration = this.moveSpeedMs - shakeDuration;

    this.time.delayedCall(shakeDuration, () => {
      if (!slime.sprite || !slime.sprite.active) return;
      slime.sprite.play('slime-jump'); // 移動中のフレーム
      this.tweens.add({
        targets: slime.sprite,
        x: targetX,
        y: targetY,
        duration: moveDuration,
        ease: 'Quad.easeOut',
        onComplete: () => {
          slime.gridX = targetGridX;
          slime.gridY = targetGridY;
          slime.isMoving = false;
          if (slime.sprite && slime.sprite.active) {
            slime.sprite.play('slime-idle');
          }
        }
      });
    });
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

    const { VIEWPORT_COLS, VIEWPORT_ROWS, GRID_COLS, GRID_ROWS, GRID_SIZE } = GridMovementScene;
    
    // スライムとの戦闘判定
    const targetSlimeIndex = this.slimes.findIndex(s => s.gridX === targetGridX && s.gridY === targetGridY);
    if (targetSlimeIndex !== -1) {
      this.isMoving = true;
      this.currentDirection = dir;
      this.hero.play(`walk-${dir}`, true);
      this.performAttack(targetSlimeIndex);
      return true;
    }

    // カメラのデッドゾーン（中心5x5グリッド内はカメラ固定、それ以外はスクロール）計算
    const maxCamGridX = GRID_COLS - VIEWPORT_COLS; // 16 - 7 = 9
    const maxCamGridY = GRID_ROWS - VIEWPORT_ROWS; // 9

    let targetCamGridX = this.currentCamGridX;
    let targetCamGridY = this.currentCamGridY;

    const nextViewX = targetGridX - this.currentCamGridX;
    const nextViewY = targetGridY - this.currentCamGridY;

    // 7x7画面インデックス(0~6)。中心は3。中心±2(インデックス1~5)は固定、0または6に進む場合にスクロール
    if (nextViewX > 5) {
      if (this.currentCamGridX < maxCamGridX) {
        targetCamGridX = this.currentCamGridX + 1;
      }
    } else if (nextViewX < 1) {
      if (this.currentCamGridX > 0) {
        targetCamGridX = this.currentCamGridX - 1;
      }
    }

    if (nextViewY > 5) {
      if (this.currentCamGridY < maxCamGridY) {
        targetCamGridY = this.currentCamGridY + 1;
      }
    } else if (nextViewY < 1) {
      if (this.currentCamGridY > 0) {
        targetCamGridY = this.currentCamGridY - 1;
      }
    }

    const isScrolling = targetCamGridX !== this.currentCamGridX || targetCamGridY !== this.currentCamGridY;

    this.isMoving = true;
    this.currentDirection = dir;
    this.hero.play(`walk-${dir}`, true);

    const targetX = targetGridX * GRID_SIZE + GRID_SIZE / 2;
    const targetY = targetGridY * GRID_SIZE + GRID_SIZE / 2;

    // 目的地パルス
    this.targetMarker.clear();
    this.targetMarker.lineStyle(2, 0xfacc15, 0.9);
    this.targetMarker.strokeRect(targetGridX * GRID_SIZE + 4, targetGridY * GRID_SIZE + 4, GRID_SIZE - 8, GRID_SIZE - 8);

    // HD-2D ダストトレイル
    if (this.isHd2dEffectsEnabled) {
      this.spawnStepTrail(this.hero.x, this.hero.y + 24);
    }

    this.notifyStateChange(isScrolling);

    // キャラクターの移動トゥイーン
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
        this.notifyStateChange(false);
      }
    });

    // スクロールが必要な場合、カメラも並行してトゥイーン
    if (isScrolling) {
      this.tweens.add({
        targets: this.cameras.main,
        scrollX: targetCamGridX * GRID_SIZE,
        scrollY: targetCamGridY * GRID_SIZE,
        duration: this.moveSpeedMs,
        ease: 'Linear',
        onComplete: () => {
          this.currentCamGridX = targetCamGridX;
          this.currentCamGridY = targetCamGridY;
        }
      });
    }

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

  private notifyStateChange(isScrolling: boolean = false) {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({
        gridX: this.currentGridX,
        gridY: this.currentGridY,
        camGridX: this.currentCamGridX,
        camGridY: this.currentCamGridY,
        direction: this.currentDirection,
        isMoving: this.isMoving,
        isScrolling: isScrolling,
        speedMs: this.moveSpeedMs,
        hp: this.heroHp,
        maxHp: this.heroMaxHp,
        attack: this.heroAttack,
        level: this.heroLevel,
        exp: this.heroExp
      });
    }
  }

  public resetPosition() {
    if (this.isMoving) return;

    this.currentGridX = 7;
    this.currentGridY = 7;
    this.currentCamGridX = 4;
    this.currentCamGridY = 4;
    const { GRID_SIZE } = GridMovementScene;
    this.hero.setPosition(this.currentGridX * GRID_SIZE + GRID_SIZE / 2, this.currentGridY * GRID_SIZE + GRID_SIZE / 2);
    this.cameras.main.scrollX = this.currentCamGridX * GRID_SIZE;
    this.cameras.main.scrollY = this.currentCamGridY * GRID_SIZE;
    this.hero.play('idle-down');
    this.currentDirection = 'idle';
    this.notifyStateChange(false);
  }
}
