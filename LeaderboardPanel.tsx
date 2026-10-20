import React, { useState } from 'react';
import { RotateCcw, Trophy } from 'lucide-react';
import { HighScoreEntry } from '../game/types';

interface LeaderboardPanelProps {
  entries: HighScoreEntry[];
  highlightId?: string | null;
  onReset: () => void;
  compact?: boolean;
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
  entries,
  highlightId,
  onReset,
  compact = false,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  const handleResetClick = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    setConfirmReset(false);
    onReset();
  };

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-amber-300 uppercase">
          <Trophy className="h-3.5 w-3.5 text-amber-400" />
          <span>Local Hall of Fame</span>
        </div>
        <button
          type="button"
          onClick={handleResetClick}
          className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition cursor-pointer ${
            confirmReset
              ? 'bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/50'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
          title="Reset local leaderboard"
        >
          <RotateCcw className="h-3 w-3" />
          <span>{confirmReset ? 'Tap again to reset' : 'Reset'}</span>
        </button>
      </div>

      <div
        className={`divide-y divide-slate-800/75 overflow-y-auto rounded-xl border border-slate-700/60 bg-slate-950/75 ${
          compact ? 'max-h-44' : 'max-h-60'
        }`}
      >
        {entries.map((entry, idx) => {
          const rank = idx + 1;
          const isCurrentRun = highlightId && entry.id === highlightId;
          const rankStyle =
            rank === 1
              ? 'text-amber-300 font-extrabold'
              : rank === 2
              ? 'text-slate-200 font-bold'
              : rank === 3
              ? 'text-amber-500 font-bold'
              : 'text-slate-500 font-semibold';

          return (
            <div
              key={entry.id}
              className={`flex items-center justify-between px-3 py-1.5 text-xs transition ${
                isCurrentRun
                  ? 'bg-emerald-500/18 ring-1 ring-inset ring-emerald-400/50'
                  : entry.isPlayer
                  ? 'bg-slate-900/65'
                  : ''
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`font-mono-num w-5 text-right ${rankStyle}`}>
                  #{rank}
                </span>
                <span
                  className={`truncate font-mono-num tracking-wide ${
                    isCurrentRun
                      ? 'font-bold text-emerald-300'
                      : entry.isPlayer
                      ? 'font-semibold text-white'
                      : 'text-slate-300'
                  }`}
                >
                  {entry.name}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase ${
                    entry.mode === 'warp'
                      ? 'bg-sky-500/15 text-sky-300'
                      : 'bg-emerald-500/15 text-emerald-300'
                  }`}
                >
                  {entry.mode}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {entry.maxCombo > 1 && (
                  <span className="hidden sm:inline font-mono-num text-[10px] text-amber-300/85">
                    x{entry.maxCombo}
                  </span>
                )}
                <span className="font-mono-num text-[11px] text-slate-400">
                  L{entry.length}
                </span>
                <span className="font-mono-num w-14 text-right font-bold text-white">
                  {entry.score.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
