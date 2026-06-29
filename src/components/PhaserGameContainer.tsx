import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { GridMovementScene, HeroState, Direction, ActionLog } from '../phaser/GridMovementScene';
import { Play, Pause, RotateCcw, Eye, EyeOff, Sparkles, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Gauge, Grid, Image as ImageIcon, Heart, Sword, Star } from 'lucide-react';

export const PhaserGameContainer: React.FC = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<GridMovementScene | null>(null);

  // UIステータス
  const [heroState, setHeroState] = useState<HeroState>({
    gridX: 7,
    gridY: 7,
    camGridX: 4,
    camGridY: 4,
    direction: 'idle',
    isMoving: false,
    isScrolling: false,
    speedMs: 450,
    hp: 20,
    maxHp: 20,
    attack: 5,
    level: 1,
    exp: 0
  });

  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [autoMode, setAutoMode] = useState<'none' | 'random' | 'seek'>('seek');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isHd2d, setIsHd2d] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(450);
  const [showSpritesheetModal, setShowSpritesheetModal] = useState<boolean>(false);
  const [spritesheetUrl, setSpritesheetUrl] = useState<string>('');

  useEffect(() => {
    if (!gameContainerRef.current) return;

    // ゲームコンフィグ (トータル448x448px = 7 x 64px)
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 448,
      height: 448,
      parent: gameContainerRef.current,
      backgroundColor: '#ecfdf5',
      scene: [GridMovementScene],
      physics: {
        default: 'arcade'
      },
      render: {
        pixelArt: true,
        antialias: false
      }
    };

    const game = new Phaser.Game(config);
    gameInstanceRef.current = game;

    // シーンの読み込み完了を待機してコールバックを設定
    game.events.once('ready', () => {
      const scene = game.scene.getScene('GridMovementScene') as GridMovementScene;
      if (scene) {
        sceneRef.current = scene;
        scene.setOnStateChange((newState) => {
          setHeroState(newState);
        });
        
        scene.setOnLog((newLog) => {
          setLogs(prev => [...prev.slice(-49), newLog]); // 最新50件を保持
        });

        // テクスチャからプレビュー用URLを抽出
        setTimeout(() => {
          if (game.textures.exists('hero_spritesheet')) {
            const texture = game.textures.get('hero_spritesheet');
            const sourceImage = texture.getSourceImage() as HTMLCanvasElement;
            if (sourceImage && sourceImage.toDataURL) {
              setSpritesheetUrl(sourceImage.toDataURL());
            }
          }
        }, 500);
      }
    });

    return () => {
      game.destroy(true);
      gameInstanceRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  // UI操作ハンドラー
  const toggleAutoMode = () => {
    let nextMode: 'none' | 'random' | 'seek' = 'none';
    if (autoMode === 'none') nextMode = 'random';
    else if (autoMode === 'random') nextMode = 'seek';
    else nextMode = 'none';

    setAutoMode(nextMode);
    sceneRef.current?.setAutoMode(nextMode);
  };

  const toggleGrid = () => {
    const nextVal = !showGrid;
    setShowGrid(nextVal);
    sceneRef.current?.toggleGridLines(nextVal);
  };

  const toggleHd2d = () => {
    const nextVal = !isHd2d;
    setIsHd2d(nextVal);
    sceneRef.current?.toggleHd2dEffects(nextVal);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    sceneRef.current?.setSpeed(newSpeed);
  };

  const handleManualMove = (dir: Direction) => {
    // 手動操作時はランダムウォークを一旦OFFにする
    if (isRandomWalk) {
      setIsRandomWalk(false);
      sceneRef.current?.setRandomWalk(false);
    }
    sceneRef.current?.moveInDirection(dir);
  };

  const handleReset = () => {
    sceneRef.current?.resetPosition();
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 items-center xl:items-start justify-center w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      
      {/* 左側：ゲーム画面（448x448pxフレーム） */}
      <div className="flex flex-col items-center bg-white rounded-2xl shadow-xl border border-emerald-100 overflow-hidden p-4 sm:p-6">
        <div className="flex items-center justify-between w-full mb-4 px-2">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-lg font-semibold text-slate-800 tracking-tight">HD-2D Stage (7x7 View / 16x16 Field)</h2>
          </div>
          <div className="text-xs font-mono px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md">
            448 × 448 px
          </div>
        </div>

        {/* Phaser描画ターゲットとログオーバーレイのラッパー */}
        <div className="relative rounded-lg overflow-hidden shadow-inner border-2 border-emerald-600 bg-emerald-50 select-none" style={{ width: 448, height: 448 }}>
          <div 
            ref={gameContainerRef} 
            className="w-full h-full"
          />
          {/* アクションログオーバーレイ (最新5件) */}
          <div className="absolute bottom-2 right-2 w-64 pointer-events-none flex flex-col justify-end gap-1 z-10 p-2">
            {logs.slice(-5).map((log) => (
              <div key={log.id} className={`animate-in fade-in slide-in-from-bottom-2 duration-300 text-xs font-bold text-right drop-shadow-md ${
                log.type === 'damage' ? 'text-rose-400' :
                log.type === 'combat' ? 'text-amber-400' :
                log.type === 'system' ? 'text-sky-300 font-extrabold' :
                'text-white'
              }`} style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>
                {log.message}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between w-full mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
          <div>1 Grid = <span className="font-semibold text-slate-700">64 × 64 px</span></div>
          <div>Scroll = <span className="font-semibold text-emerald-600">Inner 5x5 Fixed</span></div>
        </div>
      </div>

      {/* 右側：コントロール＆ステータスパネル */}
      <div className="flex flex-col gap-6 w-full max-w-md">
        
        {/* ステータスカード */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between pb-4 border-b border-slate-700 mb-4">
            <h3 className="font-semibold text-emerald-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Hero Status Tracker
            </h3>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${heroState.isScrolling ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : (heroState.isMoving ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40')}`}>
              {heroState.isScrolling ? 'Scrolling...' : (heroState.isMoving ? 'Walking...' : 'Standing')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono text-sm mb-3">
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                <Heart className="w-3.5 h-3.5 text-rose-400" /> HP
              </div>
              <div className="text-base font-bold text-white">
                <span className={heroState.hp <= 5 ? "text-rose-400" : ""}>{heroState.hp}</span> / {heroState.maxHp}
              </div>
              <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${heroState.hp <= 5 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                  style={{ width: `${Math.max(0, (heroState.hp / heroState.maxHp) * 100)}%` }} 
                />
              </div>
            </div>
            
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                <Star className="w-3.5 h-3.5 text-amber-400" /> Lv.{heroState.level} EXP
              </div>
              <div className="text-base font-bold text-sky-300">
                {heroState.exp} / 10
              </div>
              <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-sky-400 rounded-full transition-all" 
                  style={{ width: `${(heroState.exp / 10) * 100}%` }} 
                />
              </div>
            </div>
          </div>
          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60 font-mono text-xs flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sword className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300">ATK: <strong className="text-white text-sm">{heroState.attack}</strong></span>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-slate-400">Pos: <strong className="text-white">({heroState.gridX}, {heroState.gridY})</strong></span>
            </div>
          </div>
        </div>

        {/* コントロールカード */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-200 flex flex-col gap-6">
          <h3 className="text-base font-semibold text-slate-800 pb-3 border-b border-slate-100 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-emerald-600" /> Control & Testing Panel
          </h3>

          {/* 自動移動モード切替 */}
          <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div>
              <div className="text-sm font-medium text-slate-800">Auto Movement</div>
              <div className="text-xs text-slate-500">
                {autoMode === 'none' && 'Manual control only'}
                {autoMode === 'random' && 'Wandering randomly'}
                {autoMode === 'seek' && 'Seek & Combat (No AI)'}
              </div>
            </div>
            <button
              onClick={toggleAutoMode}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-sm ${
                autoMode !== 'none'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20' 
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
            >
              {autoMode === 'none' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {autoMode === 'none' ? 'OFF' : (autoMode === 'random' ? 'Random' : 'Seek')}
            </button>
          </div>

          {/* 手動方向指示（D-Padテスト） */}
          <div className="flex flex-col items-center bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <span className="text-xs font-medium text-slate-600 mb-3 block">Manual Direction Test (Overrides AI)</span>
            <div className="grid grid-cols-3 gap-2 w-36">
              <div />
              <button
                disabled={heroState.isMoving}
                onClick={() => handleManualMove('up')}
                className="p-3 bg-white hover:bg-emerald-50 active:bg-emerald-100 disabled:opacity-40 border border-slate-300 rounded-xl shadow-sm flex items-center justify-center text-slate-700 transition-colors"
                title="Move UP"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
              <div />

              <button
                disabled={heroState.isMoving}
                onClick={() => handleManualMove('left')}
                className="p-3 bg-white hover:bg-emerald-50 active:bg-emerald-100 disabled:opacity-40 border border-slate-300 rounded-xl shadow-sm flex items-center justify-center text-slate-700 transition-colors"
                title="Move LEFT"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-slate-300" />
              </div>
              <button
                disabled={heroState.isMoving}
                onClick={() => handleManualMove('right')}
                className="p-3 bg-white hover:bg-emerald-50 active:bg-emerald-100 disabled:opacity-40 border border-slate-300 rounded-xl shadow-sm flex items-center justify-center text-slate-700 transition-colors"
                title="Move RIGHT"
              >
                <ArrowRight className="w-5 h-5" />
              </button>

              <div />
              <button
                disabled={heroState.isMoving}
                onClick={() => handleManualMove('down')}
                className="p-3 bg-white hover:bg-emerald-50 active:bg-emerald-100 disabled:opacity-40 border border-slate-300 rounded-xl shadow-sm flex items-center justify-center text-slate-700 transition-colors"
                title="Move DOWN"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
              <div />
            </div>
          </div>

          {/* 移動スピード調整 */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm font-medium text-slate-700">
              <span>Movement Speed</span>
              <span className="font-mono text-emerald-600">{speed} ms / grid</span>
            </div>
            <input
              type="range"
              min="150"
              max="1000"
              step="50"
              value={speed}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              className="w-full accent-emerald-600 h-2 bg-slate-100 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>Fast (150ms)</span>
              <span>Slow (1000ms)</span>
            </div>
          </div>

          {/* ユーティリティボタン群 */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={toggleGrid}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-medium transition-colors ${
                showGrid 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              {showGrid ? 'Grid ON' : 'Grid OFF'}
            </button>

            <button
              onClick={toggleHd2d}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-medium transition-colors ${
                isHd2d 
                  ? 'bg-amber-50 border-amber-300 text-amber-700 font-semibold' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              {isHd2d ? 'HD-2D FX ON' : 'HD-2D FX OFF'}
            </button>

            <button
              onClick={() => setShowSpritesheetModal(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium transition-colors"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Sprites
            </button>

            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-xs font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Center
            </button>
          </div>

        </div>

      </div>
      
      {/* スプライトシートの切り出し確認モーダル */}
      {showSpritesheetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h4 className="text-lg font-bold text-slate-800">Generated 64x64px Spritesheet</h4>
                <p className="text-xs text-slate-500">4 Frames × 4 Directions (Total 256x256px)</p>
              </div>
              <button 
                onClick={() => setShowSpritesheetModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col items-center bg-slate-900 p-6 rounded-xl border border-slate-800 mb-4 overflow-auto">
              {spritesheetUrl ? (
                <div className="relative border border-slate-700 bg-slate-800/50 p-2 rounded">
                  <img 
                    src={spritesheetUrl} 
                    alt="Hero Spritesheet" 
                    className="w-64 h-64 select-none"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  {/* ガイドグリッド */}
                  <div className="absolute inset-2 pointer-events-none grid grid-cols-4 grid-rows-4">
                    {Array.from({ length: 16 }).map((_, idx) => (
                      <div key={idx} className="border border-emerald-500/20" />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 text-sm py-12">Loading texture...</div>
              )}
              <div className="grid grid-cols-4 w-64 text-center text-[10px] font-mono text-emerald-400 mt-2">
                <span>Frame 0</span>
                <span>Frame 1</span>
                <span>Frame 2</span>
                <span>Frame 3</span>
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <div><strong className="text-slate-800">Row 0:</strong> DOWN (Front walking animation)</div>
              <div><strong className="text-slate-800">Row 1:</strong> UP (Back walking animation)</div>
              <div><strong className="text-slate-800">Row 2:</strong> LEFT (Side walking animation)</div>
              <div><strong className="text-slate-800">Row 3:</strong> RIGHT (Side walking animation)</div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSpritesheetModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
