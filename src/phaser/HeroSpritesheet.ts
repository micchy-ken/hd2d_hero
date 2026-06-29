import Phaser from 'phaser';

/**
 * 勇者キャラクターの64x64px スプライトシート（横4コマ × 縦4方向 = 256x256px）を動的に生成し、
 * Phaserのテクスチャマネージャーに登録するヘルパー関数。
 * 
 * 行の順番:
 * 0: Down (正面)
 * 1: Up (背面)
 * 2: Left (左向き)
 * 3: Right (右向き)
 */
export function generateHeroSpritesheet(scene: Phaser.Scene): string {
  const textureKey = 'hero_spritesheet';

  // すでにテクスチャが存在する場合は再生成しない
  if (scene.textures.exists(textureKey)) {
    return textureKey;
  }

  const frameWidth = 64;
  const frameHeight = 64;
  const cols = 4;
  const rows = 4;

  const canvas = document.createElement('canvas');
  canvas.width = frameWidth * cols;
  canvas.height = frameHeight * rows;
  const ctx = canvas.getContext('2d')!;

  // ピクセルアート風の描画設定
  ctx.imageSmoothingEnabled = false;

  // カラーパレット
  const colors = {
    shadow: 'rgba(0, 0, 0, 0.3)',
    skin: '#fcd3a1',
    skinShadow: '#d9a066',
    hair: '#8a4f27',
    hairHighlight: '#b86f3d',
    armorBlue: '#2563eb',
    armorLightBlue: '#60a5fa',
    armorDarkBlue: '#1e40af',
    gold: '#f59e0b',
    goldLight: '#fbbf24',
    boots: '#654321',
    capeRed: '#dc2626',
    capeDarkRed: '#991b1b',
    swordBlade: '#e2e8f0',
    swordHilt: '#d97706',
    shieldBase: '#cbd5e1',
    shieldBorder: '#475569',
    shieldCross: '#3b82f6',
    white: '#ffffff',
    black: '#1e293b'
  };

  // 各方向・各フレームを描画
  for (let dir = 0; dir < rows; dir++) {
    for (let frame = 0; frame < cols; frame++) {
      const ox = frame * frameWidth;
      const oy = dir * frameHeight;

      ctx.save();
      ctx.translate(ox, oy);

      // 歩行アニメーションのバウンス＆手足オフセット計算
      // フレーム0, 2: 直立/通過, フレーム1, 3: 踏み出し(上下バウンスあり)
      const isStep1 = frame === 1;
      const isStep2 = frame === 3;
      const bobY = (isStep1 || isStep2) ? -2 : 0;
      const legOffset = isStep1 ? 3 : (isStep2 ? -3 : 0);

      // 1. 足元シャドウ
      ctx.fillStyle = colors.shadow;
      ctx.beginPath();
      ctx.ellipse(32, 58, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // --- 方向別の描画 ---
      if (dir === 0) {
        // 【DOWN: 正面】
        // マント（後ろ側）
        ctx.fillStyle = colors.capeDarkRed;
        ctx.fillRect(20, 28 + bobY, 24, 22);

        // 足 (ブーツ)
        ctx.fillStyle = colors.boots;
        ctx.fillRect(24, 48 + bobY + (legOffset > 0 ? -2 : 0), 6, 10);
        ctx.fillRect(34, 48 + bobY + (legOffset < 0 ? -2 : 0), 6, 10);

        // 体 (青い鎧)
        ctx.fillStyle = colors.armorBlue;
        ctx.fillRect(22, 30 + bobY, 20, 18);
        ctx.fillStyle = colors.armorLightBlue;
        ctx.fillRect(26, 32 + bobY, 12, 10);
        // 金のベルト
        ctx.fillStyle = colors.gold;
        ctx.fillRect(22, 44 + bobY, 20, 4);

        // 頭部ベース
        ctx.fillStyle = colors.skin;
        ctx.fillRect(22, 14 + bobY, 20, 18);

        // 目
        ctx.fillStyle = colors.black;
        ctx.fillRect(26, 22 + bobY, 3, 4);
        ctx.fillRect(35, 22 + bobY, 3, 4);
        ctx.fillStyle = colors.white;
        ctx.fillRect(26, 22 + bobY, 1, 1);
        ctx.fillRect(35, 22 + bobY, 1, 1);

        // 髪の毛
        ctx.fillStyle = colors.hair;
        ctx.fillRect(20, 10 + bobY, 24, 8);
        ctx.fillRect(20, 14 + bobY, 4, 12);
        ctx.fillRect(40, 14 + bobY, 4, 12);
        ctx.fillStyle = colors.hairHighlight;
        ctx.fillRect(22, 12 + bobY, 12, 3);
        // バンダナ / サークレット
        ctx.fillStyle = colors.gold;
        ctx.fillRect(22, 18 + bobY, 20, 3);
        ctx.fillStyle = colors.capeRed;
        ctx.fillRect(30, 17 + bobY, 4, 5);

        // 腕と装備
        // 左腕（盾側）
        ctx.fillStyle = colors.armorBlue;
        ctx.fillRect(16, 30 + bobY, 6, 12);
        // 盾
        ctx.fillStyle = colors.shieldBorder;
        ctx.fillRect(12, 32 + bobY + (isStep1 ? -2 : 0), 10, 14);
        ctx.fillStyle = colors.shieldBase;
        ctx.fillRect(13, 33 + bobY + (isStep1 ? -2 : 0), 8, 12);
        ctx.fillStyle = colors.shieldCross;
        ctx.fillRect(16, 34 + bobY + (isStep1 ? -2 : 0), 2, 10);
        ctx.fillRect(14, 38 + bobY + (isStep1 ? -2 : 0), 6, 2);

        // 右腕（剣側）
        ctx.fillStyle = colors.armorBlue;
        ctx.fillRect(42, 30 + bobY, 6, 12);
        ctx.fillStyle = colors.skin;
        ctx.fillRect(42, 40 + bobY, 6, 4);
        // 剣
        ctx.fillStyle = colors.swordHilt;
        ctx.fillRect(43, 36 + bobY + (isStep2 ? -3 : 0), 8, 3);
        ctx.fillStyle = colors.swordBlade;
        ctx.fillRect(46, 18 + bobY + (isStep2 ? -3 : 0), 3, 18);

      } else if (dir === 1) {
        // 【UP: 背面】
        // 剣（背中越しに少し見える）
        ctx.fillStyle = colors.swordBlade;
        ctx.fillRect(44, 16 + bobY, 3, 16);

        // 足
        ctx.fillStyle = colors.boots;
        ctx.fillRect(24, 48 + bobY + (legOffset < 0 ? -2 : 0), 6, 10);
        ctx.fillRect(34, 48 + bobY + (legOffset > 0 ? -2 : 0), 6, 10);

        // マント（全体を覆う）
        ctx.fillStyle = colors.capeRed;
        ctx.fillRect(18, 28 + bobY, 28, 22);
        ctx.fillStyle = colors.capeDarkRed;
        ctx.fillRect(20, 30 + bobY, 6, 20);
        ctx.fillRect(38, 30 + bobY, 6, 20);

        // 髪の毛（背面全体）
        ctx.fillStyle = colors.hair;
        ctx.fillRect(20, 10 + bobY, 24, 20);
        ctx.fillStyle = colors.hairHighlight;
        ctx.fillRect(24, 12 + bobY, 16, 4);
        // 金のサークレット（後ろ紐）
        ctx.fillStyle = colors.gold;
        ctx.fillRect(20, 20 + bobY, 24, 3);

        // 盾のふち（左側に少し見える）
        ctx.fillStyle = colors.shieldBorder;
        ctx.fillRect(14, 34 + bobY, 4, 12);

      } else if (dir === 2) {
        // 【LEFT: 左向き】
        // マント（右側になびく）
        ctx.fillStyle = colors.capeDarkRed;
        ctx.fillRect(34, 30 + bobY, 10, 18);
        ctx.fillStyle = colors.capeRed;
        ctx.fillRect(36, 32 + bobY, 10, 16);

        // 足（前後の歩行）
        ctx.fillStyle = colors.boots;
        const leftLegX = 28 + (isStep1 ? -6 : (isStep2 ? 6 : 0));
        const rightLegX = 28 + (isStep1 ? 6 : (isStep2 ? -6 : 0));
        ctx.fillRect(rightLegX, 48 + bobY, 6, 10);
        ctx.fillRect(leftLegX, 48 + bobY - 1, 6, 10);

        // 体（横顔・横体）
        ctx.fillStyle = colors.armorDarkBlue;
        ctx.fillRect(26, 30 + bobY, 12, 18);
        ctx.fillStyle = colors.armorBlue;
        ctx.fillRect(24, 30 + bobY, 8, 18);
        ctx.fillStyle = colors.gold;
        ctx.fillRect(24, 44 + bobY, 12, 4);

        // 頭部
        ctx.fillStyle = colors.skin;
        ctx.fillRect(22, 14 + bobY, 16, 18);
        // 目
        ctx.fillStyle = colors.black;
        ctx.fillRect(24, 22 + bobY, 3, 4);
        ctx.fillStyle = colors.white;
        ctx.fillRect(24, 22 + bobY, 1, 1);

        // 髪の毛
        ctx.fillStyle = colors.hair;
        ctx.fillRect(26, 10 + bobY, 16, 8);
        ctx.fillRect(32, 14 + bobY, 10, 14);
        ctx.fillStyle = colors.gold;
        ctx.fillRect(22, 18 + bobY, 16, 3);

        // 盾（左側面に大きく構える）
        ctx.fillStyle = colors.shieldBorder;
        ctx.fillRect(14, 30 + bobY + (isStep1 ? -2 : 0), 8, 16);
        ctx.fillStyle = colors.shieldBase;
        ctx.fillRect(15, 31 + bobY + (isStep1 ? -2 : 0), 6, 14);
        ctx.fillStyle = colors.shieldCross;
        ctx.fillRect(17, 32 + bobY + (isStep1 ? -2 : 0), 2, 12);

      } else if (dir === 3) {
        // 【RIGHT: 右向き】
        // マント（左側になびく）
        ctx.fillStyle = colors.capeDarkRed;
        ctx.fillRect(20, 30 + bobY, 10, 18);
        ctx.fillStyle = colors.capeRed;
        ctx.fillRect(18, 32 + bobY, 10, 16);

        // 足
        ctx.fillStyle = colors.boots;
        const leftLegX = 30 + (isStep1 ? 6 : (isStep2 ? -6 : 0));
        const rightLegX = 30 + (isStep1 ? -6 : (isStep2 ? 6 : 0));
        ctx.fillRect(rightLegX, 48 + bobY, 6, 10);
        ctx.fillRect(leftLegX, 48 + bobY - 1, 6, 10);

        // 体
        ctx.fillStyle = colors.armorDarkBlue;
        ctx.fillRect(26, 30 + bobY, 12, 18);
        ctx.fillStyle = colors.armorBlue;
        ctx.fillRect(32, 30 + bobY, 8, 18);
        ctx.fillStyle = colors.gold;
        ctx.fillRect(28, 44 + bobY, 12, 4);

        // 頭部
        ctx.fillStyle = colors.skin;
        ctx.fillRect(26, 14 + bobY, 16, 18);
        // 目
        ctx.fillStyle = colors.black;
        ctx.fillRect(37, 22 + bobY, 3, 4);
        ctx.fillStyle = colors.white;
        ctx.fillRect(37, 22 + bobY, 1, 1);

        // 髪の毛
        ctx.fillStyle = colors.hair;
        ctx.fillRect(22, 10 + bobY, 16, 8);
        ctx.fillRect(22, 14 + bobY, 10, 14);
        ctx.fillStyle = colors.gold;
        ctx.fillRect(26, 18 + bobY, 16, 3);

        // 剣（右側に突き出すように構える）
        ctx.fillStyle = colors.armorBlue;
        ctx.fillRect(34, 32 + bobY, 6, 10);
        ctx.fillStyle = colors.skin;
        ctx.fillRect(38, 36 + bobY, 4, 4);
        ctx.fillStyle = colors.swordHilt;
        ctx.fillRect(40, 34 + bobY + (isStep2 ? -2 : 0), 4, 8);
        ctx.fillStyle = colors.swordBlade;
        ctx.fillRect(44, 20 + bobY + (isStep2 ? -2 : 0), 4, 18);
      }

      ctx.restore();
    }
  }

  // Phaserのテクスチャに登録（64x64pxスプライトシートとして）
  scene.textures.addSpriteSheet(textureKey, canvas as unknown as HTMLImageElement, {
    frameWidth: frameWidth,
    frameHeight: frameHeight
  });

  return textureKey;
}
