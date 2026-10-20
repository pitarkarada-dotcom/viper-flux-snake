import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Crown,
  Flame,
  Gamepad2,
  Infinity as InfinityIcon,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { LeaderboardPanel } from './components/LeaderboardPanel';
import { MobileControls } from './components/MobileControls';
import { SnakeGameEngine } from './game/engine';
import {
  getBestScore,
  getSavedPlayerName,
  loadLeaderboard,
  recordScore,
  renameScoreEntry,
  resetLeaderboard,
} from './game/leaderboard';
import { sound } from './game/sound';
import { Direction, GameMode, HighScoreEntry, HudSnapshot } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'menu',
  mode: 'arcade',
  score: 0,
  bestScore: getBestScore(),
  length: 4,
  combo: 1,
  maxCombo: 1,
  comboProgress: 0,
  isBoosting: false,
  applesEaten: 0,
  novasEaten: 0,
  survivalSeconds: 0,
  deathReason: null,
  isNewRecord: false,
  qualifiesForBoard: false,
};

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SnakeGameEngine | null>(null);
  const swipeOriginRef = useRef<{ x: number; y: number } | null>(null);
  const gameOverAtRef = useRef<number>(0);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [soundOn, setSoundOn] = useState<boolean>(() => sound.enabled);
  const [showDpad, setShowDpad] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 768;
  });
  const [menuTab, setMenuTab] = useState<'play' | 'scores'>('play');
  const [leaderboard, setLeaderboard] = useState<HighScoreEntry[]>(() =>
    loadLeaderboard()
  );
  const [playerName, setPlayerName] = useState<string>(() => getSavedPlayerName());
  const [latestEntryId, setLatestEntryId] = useState<string | null>(null);
  const [scorePopKey, setScorePopKey] = useState<number>(0);
  const prevScoreRef = useRef<number>(0);

  const handleHudUpdate = useCallback((snap: HudSnapshot) => {
    setHud(snap);
    if (snap.score > prevScoreRef.current) {
      setScorePopKey((k) => k + 1);
    }
    prevScoreRef.current = snap.score;
  }, []);

  const handleGameOver = useCallback((snap: HudSnapshot) => {
    gameOverAtRef.current = performance.now();
    const currentCallsign = getSavedPlayerName();
    setPlayerName(currentCallsign);

    if (snap.score > 0 && snap.qualifiesForBoard) {
      const { entries, createdEntry } = recordScore({
        name: currentCallsign,
        score: snap.score,
        length: snap.length,
        maxCombo: snap.maxCombo,
        mode: snap.mode,
      });
      setLeaderboard(entries);
      setLatestEntryId(createdEntry ? createdEntry.id : null);
    } else {
      setLeaderboard(loadLeaderboard());
      setLatestEntryId(null);
    }
  }, []);

  // Initialize 60fps Canvas Engine & ResizeObserver
  useEffect(() => {
    const engine = new SnakeGameEngine(handleHudUpdate, handleGameOver);
    engineRef.current = engine;

    const canvas = canvasRef.current;
    if (canvas) {
      engine.attachCanvas(canvas);
    }

    const observer = new ResizeObserver(() => {
      engine.resizeCanvas();
    });
    if (canvas) {
      observer.observe(canvas);
    }

    const onVisibility = () => {
      if (document.hidden && engine.phase === 'playing') {
        engine.togglePause();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
      engine.detachCanvas();
    };
  }, [handleHudUpdate, handleGameOver]);

  // Keyboard Controls (WASD, Arrows, Boost, Pause, Instant Restart)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (e.key === 'Enter' || e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      const engine = engineRef.current;
      if (!engine) return;

      const key = e.key;

      // Direction mapping
      let dir: Direction | null = null;
      if (key === 'ArrowUp' || key === 'w' || key === 'W') dir = 'UP';
      else if (key === 'ArrowDown' || key === 's' || key === 'S') dir = 'DOWN';
      else if (key === 'ArrowLeft' || key === 'a' || key === 'A') dir = 'LEFT';
      else if (key === 'ArrowRight' || key === 'd' || key === 'D') dir = 'RIGHT';

      if (dir) {
        e.preventDefault();
        if (!e.repeat) {
          engine.queueDirection(dir);
        }
        return;
      }

      // Pause toggle
      if (key === 'Escape' || key === 'p' || key === 'P') {
        if (engine.phase === 'playing' || engine.phase === 'paused') {
          e.preventDefault();
          engine.togglePause();
        }
        return;
      }

      // Instant Restart hotkey
      if (key === 'r' || key === 'R') {
        if (
          engine.phase === 'playing' ||
          engine.phase === 'paused' ||
          engine.phase === 'gameover'
        ) {
          e.preventDefault();
          engine.startGame();
        }
        return;
      }

      // Space / Enter / Shift
      if (key === ' ' || key === 'Enter') {
        e.preventDefault();
        if (engine.phase === 'menu') {
          if (!e.repeat) engine.startGame();
        } else if (engine.phase === 'paused') {
          if (!e.repeat) engine.togglePause();
        } else if (engine.phase === 'gameover') {
          if (!e.repeat && performance.now() - gameOverAtRef.current > 240) {
            engine.startGame();
          }
        } else if (engine.phase === 'playing' && key === ' ') {
          engine.setBoost(true);
        }
        return;
      }

      if (key === 'Shift' && engine.phase === 'playing') {
        engine.setBoost(true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (e.key === ' ' || e.key === 'Shift') {
        engine.setBoost(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Ultra-responsive Continuous Touch Swipe Handler (triggers immediately on >18px drag)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    const t = e.touches[0];
    swipeOriginRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeOriginRef.current || e.touches.length === 0) return;
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.phase !== 'playing' && engine.phase !== 'menu') return;

    const t = e.touches[0];
    const dx = t.clientX - swipeOriginRef.current.x;
    const dy = t.clientY - swipeOriginRef.current.y;
    const threshold = 18;

    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

    let dir: Direction;
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? 'RIGHT' : 'LEFT';
    } else {
      dir = dy > 0 ? 'DOWN' : 'UP';
    }

    engine.queueDirection(dir);
    // Re-anchor origin immediately so multi-turn zig-zag swipes work without lifting finger!
    swipeOriginRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = () => {
    swipeOriginRef.current = null;
  };

  const handleToggleSound = () => {
    const next = !soundOn;
    sound.setEnabled(next);
    setSoundOn(next);
  };

  const handleCallsignChange = (val: string) => {
    const upper = val.toUpperCase().slice(0, 10);
    setPlayerName(upper);
    if (latestEntryId) {
      const updated = renameScoreEntry(latestEntryId, upper);
      setLeaderboard(updated);
    }
  };

  const handleResetScores = () => {
    const fresh = resetLeaderboard();
    setLeaderboard(fresh);
    setLatestEntryId(null);
    engineRef.current?.refreshBestScore();
  };

  const handleModeSelect = (m: GameMode) => {
    engineRef.current?.setMode(m);
  };

  return (
    <div
      className="relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-[#060912] px-2.5 py-2 sm:px-4 sm:py-3"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Subtle ambient background glow orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[110px]" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-sky-500/10 blur-[110px]" />
      </div>

      {/* Top Arcade HUD Bezel */}
      <header
        className={`relative z-30 mb-2 flex items-center justify-between gap-2 rounded-2xl border border-slate-800/90 bg-slate-900/85 px-3 py-2 shadow-xl backdrop-blur-md ${
          showDpad && hud.phase === 'playing'
            ? 'w-[min(94vw,calc(100dvh-258px),520px)]'
            : 'w-[min(94vw,calc(100dvh-96px),580px)]'
        }`}
      >
        {/* Left: Score + Combo */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              Score
            </span>
            <div className="flex items-baseline gap-2">
              <span
                key={scorePopKey}
                className="animate-score-pop inline-block font-mono-num text-xl sm:text-2xl font-extrabold leading-none text-white"
              >
                {hud.score.toLocaleString()}
              </span>
              {hud.combo > 1 && hud.phase === 'playing' && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-400/20 px-1.5 py-0.5 font-mono-num text-xs font-extrabold text-amber-300 ring-1 ring-amber-400/40">
                  <Flame className="h-3 w-3 text-amber-400" />x{hud.combo}
                </span>
              )}
            </div>
            {/* Live Combo Decay Bar */}
            <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full transition-none ${
                  hud.combo >= 4 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.round(hud.comboProgress * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center: Mode indicator + Best Score */}
        <div className="hidden xs:flex sm:flex flex-col items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold tracking-wider text-emerald-400">
              VIPER FLUX
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                hud.mode === 'warp'
                  ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/30'
                  : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30'
              }`}
            >
              {hud.mode}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
            <Trophy className="h-3 w-3 text-amber-400" />
            <span>BEST</span>
            <span className="font-mono-num font-bold text-slate-200">
              {hud.bestScore.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Right: Best score on tiny mobile + Action Buttons */}
        <div className="flex items-center gap-1.5">
          <div className="flex sm:hidden flex-col items-end mr-1">
            <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">
              Best
            </span>
            <span className="font-mono-num text-sm font-bold text-amber-300 leading-tight">
              {hud.bestScore.toLocaleString()}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowDpad((v) => !v)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition cursor-pointer ${
              showDpad
                ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                : 'border-slate-700/80 bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title="Toggle On-Screen D-Pad"
            aria-label="Toggle On-Screen Touch D-Pad"
          >
            <Gamepad2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleToggleSound}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-800/80 text-slate-300 transition hover:bg-slate-800 hover:text-white cursor-pointer"
            title={soundOn ? 'Mute Sound' : 'Enable Sound'}
            aria-label={soundOn ? 'Mute Sound' : 'Enable Sound'}
          >
            {soundOn ? (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-500" />
            )}
          </button>

          {(hud.phase === 'playing' || hud.phase === 'paused') && (
            <button
              type="button"
              onClick={() => engineRef.current?.togglePause()}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-800/80 text-slate-200 transition hover:border-emerald-400/50 hover:bg-slate-800 cursor-pointer"
              title={hud.phase === 'paused' ? 'Resume (Space)' : 'Pause (Esc / P)'}
              aria-label={hud.phase === 'paused' ? 'Resume Game' : 'Pause Game'}
            >
              {hud.phase === 'paused' ? (
                <Play className="h-4 w-4 fill-emerald-400 text-emerald-400" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Square 1:1 60fps Game Arena */}
      <main
        className={`relative z-10 aspect-square overflow-hidden rounded-2xl border-2 border-slate-800/95 bg-[#070b14] shadow-[0_0_50px_rgba(0,0,0,0.85)] ${
          showDpad && hud.phase === 'playing'
            ? 'w-[min(94vw,calc(100dvh-258px),520px)]'
            : 'w-[min(94vw,calc(100dvh-96px),580px)]'
        }`}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
        />

        {/* Subtle CRT phosphor scanline sheen */}
        <div className="crt-scanlines pointer-events-none absolute inset-0 opacity-35" />

        {hud.phase !== 'playing' && (
          <div className="pointer-events-none absolute inset-0 bg-slate-950/58 backdrop-blur-[2.5px]" />
        )}

        {/* Live Length & Boost Pill in corner while playing */}
        {hud.phase === 'playing' && (
          <div className="pointer-events-none absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-semibold">
            <span className="rounded-lg bg-slate-950/65 px-2 py-0.5 font-mono-num text-slate-300 ring-1 ring-slate-800/80 backdrop-blur-xs">
              LEN {hud.length}
            </span>
            {hud.isBoosting ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-sky-500/25 px-2 py-0.5 font-mono-num text-sky-200 ring-1 ring-sky-400/50 backdrop-blur-xs">
                <Zap className="h-3 w-3 fill-sky-300 text-sky-300" />
                BOOST 1.5x
              </span>
            ) : (
              <span className="hidden sm:inline-block rounded-lg bg-slate-950/55 px-2 py-0.5 text-[10px] text-slate-400 ring-1 ring-slate-800/70">
                Hold SPACE to Boost
              </span>
            )}
          </div>
        )}
      </main>

      {/* ==================== START SCREEN OVERLAY ==================== */}
      {hud.phase === 'menu' && (
        <div className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-center px-4 pt-16 pb-4">
          <div className="pointer-events-auto flex max-h-full w-full max-w-sm flex-col items-center overflow-y-auto rounded-2xl border border-slate-700/80 bg-slate-900/92 p-5 sm:p-6 shadow-2xl backdrop-blur-md">
              <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-0.5 text-[11px] font-bold tracking-widest text-emerald-300 ring-1 ring-emerald-400/35 uppercase">
                <Sparkles className="h-3 w-3" />
                60FPS Arcade Edition
              </div>

              <h1 className="text-center text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                VIPER{' '}
                <span className="bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">
                  FLUX
                </span>
              </h1>

              {/* Menu View Toggle: Play vs Leaderboard */}
              <div className="mt-3 mb-4 grid w-full grid-cols-2 rounded-xl bg-slate-950/90 p-1 ring-1 ring-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    sound.playUiClick();
                    setMenuTab('play');
                  }}
                  className={`rounded-lg py-1.5 text-xs font-bold tracking-wide transition cursor-pointer ${
                    menuTab === 'play'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Game Setup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sound.playUiClick();
                    setLeaderboard(loadLeaderboard());
                    setMenuTab('scores');
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold tracking-wide transition cursor-pointer ${
                    menuTab === 'scores'
                      ? 'bg-slate-800 text-amber-300 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  High Scores
                </button>
              </div>

              {menuTab === 'play' ? (
                <>
                  {/* Mode Switcher */}
                  <div className="mb-4 grid w-full grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleModeSelect('arcade')}
                      className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition cursor-pointer ${
                        hud.mode === 'arcade'
                          ? 'border-emerald-400/70 bg-emerald-500/15 text-white shadow-inner'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <ShieldAlert className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Arcade</span>
                      </div>
                      <span className="mt-0.5 text-[11px] text-slate-400">
                        Solid lethal walls
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleModeSelect('warp')}
                      className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition cursor-pointer ${
                        hud.mode === 'warp'
                          ? 'border-sky-400/70 bg-sky-500/15 text-white shadow-inner'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <InfinityIcon className="h-3.5 w-3.5 text-sky-400" />
                        <span>Warp Grid</span>
                      </div>
                      <span className="mt-0.5 text-[11px] text-slate-400">
                        Wrap through edges
                      </span>
                    </button>
                  </div>

                  {/* Primary Launch Button */}
                  <button
                    type="button"
                    onClick={() => engineRef.current?.startGame()}
                    className="btn-glow-emerald flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3.5 text-base font-extrabold tracking-wider text-slate-950 uppercase transition hover:brightness-110 active:scale-[0.98] cursor-pointer"
                  >
                    <Play className="h-5 w-5 fill-slate-950" />
                    <span>Start Game</span>
                  </button>

                  {/* Crisp visual control summary */}
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                    <span>
                      <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono-num text-[10px] text-slate-200">
                        WASD
                      </kbd>{' '}
                      /{' '}
                      <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono-num text-[10px] text-slate-200">
                        Arrows
                      </kbd>{' '}
                      or <strong className="text-slate-200">Swipe</strong>
                    </span>
                    <span>
                      <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono-num text-[10px] text-sky-300">
                        SPACE
                      </kbd>{' '}
                      Boost
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full">
                  <LeaderboardPanel
                    entries={leaderboard}
                    highlightId={latestEntryId}
                    onReset={handleResetScores}
                    compact
                  />
                  <button
                    type="button"
                    onClick={() => engineRef.current?.startGame()}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-extrabold tracking-wider text-slate-950 uppercase transition hover:bg-emerald-400 cursor-pointer"
                  >
                    <Play className="h-4 w-4 fill-slate-950" />
                    <span>Play Now</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      {/* ==================== PAUSE OVERLAY ==================== */}
      {hud.phase === 'paused' && (
        <div className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-center px-4 pt-16 pb-4">
          <div className="pointer-events-auto flex w-full max-w-xs flex-col items-center rounded-2xl border border-slate-700/80 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-md">
              <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase">
                Game Paused
              </span>
              <h2 className="mt-1 text-2xl font-extrabold text-white">
                Take a Breather
              </h2>
              <p className="mt-1 font-mono-num text-xs text-slate-400">
                Score {hud.score.toLocaleString()} · Length {hud.length}
              </p>

              <div className="mt-5 flex w-full flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => engineRef.current?.togglePause()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-extrabold tracking-wider text-slate-950 uppercase transition hover:bg-emerald-400 cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-slate-950" />
                  <span>Resume (Space)</span>
                </button>
                <button
                  type="button"
                  onClick={() => engineRef.current?.startGame()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 py-2.5 text-xs font-bold tracking-wider text-slate-200 uppercase transition hover:bg-slate-800 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Instant Restart (R)</span>
                </button>
                <button
                  type="button"
                  onClick={() => engineRef.current?.returnToMenu()}
                  className="py-1.5 text-xs font-semibold text-slate-400 transition hover:text-slate-200 cursor-pointer"
                >
                  Main Menu
                </button>
              </div>
            </div>
          </div>
        )}

      {/* ==================== GAME OVER + INSTANT RESTART + HIGH SCORES ==================== */}
      {hud.phase === 'gameover' && (
        <div className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-center px-3 pt-16 pb-3">
          <div className="pointer-events-auto flex max-h-full w-full max-w-sm flex-col items-center overflow-y-auto rounded-2xl border border-slate-700/85 bg-slate-900/95 p-4 sm:p-5 shadow-2xl backdrop-blur-md">
              {hud.isNewRecord ? (
                <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-0.5 text-xs font-extrabold tracking-wider text-amber-300 ring-1 ring-amber-400/50 uppercase">
                  <Crown className="h-3.5 w-3.5 text-amber-300" />
                  New All-Time Record!
                </div>
              ) : (
                <span className="text-[11px] font-bold tracking-widest text-rose-400 uppercase">
                  {hud.deathReason === 'wall' ? 'Wall Impact' : 'Tail Collision'}
                </span>
              )}

              {/* Run Summary Strip */}
              <div className="mt-2 mb-3 grid w-full grid-cols-3 divide-x divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/80 py-2 text-center">
                <div>
                  <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    Score
                  </div>
                  <div className="font-mono-num text-lg font-extrabold text-white">
                    {hud.score.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    Length
                  </div>
                  <div className="font-mono-num text-lg font-bold text-emerald-300">
                    {hud.length}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    Max Combo
                  </div>
                  <div className="font-mono-num text-lg font-bold text-amber-300">
                    x{hud.maxCombo}
                  </div>
                </div>
              </div>

              {/* Live Callsign Editor when ranked on Leaderboard */}
              {latestEntryId && (
                <div className="mb-2.5 flex w-full items-center justify-between gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5">
                  <span className="text-xs font-semibold text-emerald-200">
                    Ranked! Tag:
                  </span>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => handleCallsignChange(e.target.value)}
                    maxLength={10}
                    aria-label="Player Callsign"
                    placeholder="VIPER"
                    className="w-28 rounded-lg border border-emerald-400/50 bg-slate-950 px-2 py-0.5 text-center font-mono-num text-xs font-bold tracking-wider text-white uppercase focus:border-emerald-300 focus:outline-none"
                  />
                </div>
              )}

              {/* Local High-Score Table */}
              <LeaderboardPanel
                entries={leaderboard}
                highlightId={latestEntryId}
                onReset={handleResetScores}
                compact
              />

              {/* Instant Restart CTA */}
              <div className="mt-3.5 flex w-full items-center gap-2">
                <button
                  type="button"
                  onClick={() => engineRef.current?.startGame()}
                  className="btn-glow-emerald flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-sm font-extrabold tracking-wider text-slate-950 uppercase transition hover:brightness-110 active:scale-[0.98] cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4 stroke-[2.5]" />
                  <span>Play Again</span>
                  <span className="hidden sm:inline rounded bg-slate-950/20 px-1.5 py-0.5 font-mono-num text-[10px]">
                    SPACE
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => engineRef.current?.returnToMenu()}
                  className="rounded-xl border border-slate-700/80 bg-slate-800/80 px-3.5 py-3 text-xs font-bold text-slate-300 transition hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  Menu
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Optional / Mobile Tactile D-Pad + Boost Dock */}
      {showDpad && hud.phase === 'playing' && (
        <div className="relative z-10 flex w-full justify-center">
          <MobileControls
            onDirection={(dir) => engineRef.current?.queueDirection(dir)}
            onBoostChange={(b) => engineRef.current?.setBoost(b)}
            isBoosting={hud.isBoosting}
          />
        </div>
      )}
    </div>
  );
}

export default App;
