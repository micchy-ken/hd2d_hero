import Phaser from 'phaser';

export function generateSlimeSpritesheet(scene: Phaser.Scene, isTextMode: boolean = false): string {
  const textureKey = isTextMode ? 'slime_spritesheet_text' : 'slime_spritesheet';

  if (scene.textures.exists(textureKey)) {
    return textureKey;
  }

  const frameWidth = 64;
  const frameHeight = 64;
  const frames = 4; // 0: 待機, 1: 縮む(ぷるぷる前), 2: 伸びる(ぷるぷる), 3: ジャンプ/移動

  const canvas = document.createElement('canvas');
  canvas.width = frameWidth * frames;
  canvas.height = frameHeight;
  const ctx = canvas.getContext('2d')!;

  ctx.imageSmoothingEnabled = false;

  if (isTextMode) {
    ctx.fillStyle = '#ffffff'; // 白文字で「敵」
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 40px "Inter", sans-serif';

    for (let frame = 0; frame < frames; frame++) {
      const ox = frame * frameWidth + frameWidth / 2;
      const oy = frameHeight / 2;
      ctx.fillText('敵', ox, oy);
    }
  } else {

  const palette = {
    highlight: '#a5f3fc',
    bodyHi: '#38bdf8',
    body: '#0284c7',
    bodyDark: '#0369a1',
    shadow: '#0c4a6e',
    eye: '#ffffff',
    pupil: '#0f172a',
    mouth: '#0f172a'
  };

  const p = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  };

  // 各フレームの描画
  for (let frame = 0; frame < frames; frame++) {
    const ox = frame * frameWidth;
    
    ctx.save();
    ctx.translate(ox, 0);

    // フレームごとの変形 (スケーリングとY軸オフセット)
    let scaleX = 1;
    let scaleY = 1;
    let offsetY = 0;

    if (frame === 1) { // 縮む
      scaleX = 1.2;
      scaleY = 0.8;
      offsetY = 10;
    } else if (frame === 2) { // 伸びる
      scaleX = 0.8;
      scaleY = 1.2;
      offsetY = -4;
    } else if (frame === 3) { // ジャンプ
      scaleX = 0.9;
      scaleY = 1.1;
      offsetY = -12;
    }

    ctx.translate(32, 50); // スライムの底辺中央を基準にする
    ctx.scale(scaleX, scaleY);
    ctx.translate(-32, -50 + offsetY);

    // 影
    if (frame !== 3) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
      ctx.beginPath();
      ctx.ellipse(32, 52, 16, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // ジャンプ中の影は小さく薄く
      ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
      ctx.beginPath();
      ctx.ellipse(32, 60, 10, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // スライム本体 (玉ねぎ型)
    // ダークライン/アウトライン寄り
    p(24, 28, 16, 24, palette.shadow);
    p(20, 32, 24, 18, palette.shadow);
    p(16, 36, 32, 12, palette.shadow);
    
    // メインボディ
    p(25, 29, 14, 22, palette.bodyDark);
    p(21, 33, 22, 16, palette.bodyDark);
    p(17, 37, 30, 10, palette.bodyDark);

    p(26, 30, 12, 18, palette.body);
    p(22, 32, 18, 14, palette.body);
    p(19, 36, 26, 8, palette.body);

    p(27, 31, 8, 12, palette.bodyHi);
    p(24, 34, 12, 8, palette.bodyHi);
    
    // テカり (ハイライト)
    p(26, 33, 4, 4, palette.highlight);
    p(31, 32, 2, 2, palette.highlight);
    p(22, 38, 2, 4, palette.highlight);

    // 目 (左)
    p(22, 38, 4, 6, palette.eye);
    p(24, 40, 2, 4, palette.pupil);

    // 目 (右)
    p(38, 38, 4, 6, palette.eye);
    p(38, 40, 2, 4, palette.pupil);

    // 口
    p(30, 44, 4, 2, palette.mouth);

    ctx.restore();
  }
  } // <--- Added closing brace for else block

  scene.textures.addSpriteSheet(textureKey, canvas as unknown as HTMLImageElement, {
    frameWidth: frameWidth,
    frameHeight: frameHeight
  });

  return textureKey;
}
