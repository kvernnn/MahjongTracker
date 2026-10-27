/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Trophy, Medal, ArrowLeft, BarChart3, CheckCircle2, History, RotateCcw } from 'lucide-react';
import type { LobbyState } from '../types/mahjong.ts';

interface SessionSummaryProps {
  state: LobbyState;
  currentUserId: string;
  onNewGame: () => void;
  onOpenStats: () => void;
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({
  state,
  currentUserId,
  onNewGame,
  onOpenStats,
}) => {
  const [activeTab, setActiveTab] = useState<'standings' | 'transfers'>('standings');
  const results = state.results || [];

  const durationMin =
    state.startedAt && state.finalizedAt
      ? Math.max(1, Math.round((state.finalizedAt - state.startedAt) / (1000 * 60)))
      : 0;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      {/* Session Header Card */}
      <div className="text-center bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 border border-amber-300 text-3xl mb-3 shadow-xs">
          🏆
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Session Finalized
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Lobby {state.id} · {durationMin} min duration · Read-Only Results
        </p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-slate-200/70 p-1 border border-slate-300/40">
        <button
          onClick={() => setActiveTab('standings')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'standings'
              ? 'bg-white text-emerald-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-500" />
          <span>Final Standings</span>
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'transfers'
              ? 'bg-white text-emerald-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Log ({state.completedTransfers.length})</span>
        </button>
      </div>

      {/* Final Standings */}
      {activeTab === 'standings' && (
        <div className="space-y-3">
          {results.map((res) => {
            const isMe = res.playerId === currentUserId;
            const isWinner = res.position === 1;
            const isPositive = res.netChips > 0;
            const isZero = res.netChips === 0;

            return (
              <div
                key={res.playerId}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                  isWinner
                    ? 'border-amber-300 bg-amber-50/40 shadow-xs ring-1 ring-amber-300/50'
                    : isMe
                    ? 'border-emerald-600 bg-white ring-1 ring-emerald-600/30'
                    : 'border-slate-200 bg-white shadow-xs'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Position Badge */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 font-mono ${
                      isWinner
                        ? 'bg-amber-400 text-amber-950 shadow-xs'
                        : res.position === 2
                        ? 'bg-slate-200 text-slate-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    #{res.position}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-slate-900 truncate">
                        {res.displayName}
                      </span>
                      {res.isTied && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-200 text-amber-900 font-bold">
                          Tied
                        </span>
                      )}
                      {isMe && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold">
                          You
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                      Start: {res.startingChips} ➔ End: {res.endingChips}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={`text-base font-black font-mono tabular-nums ${
                      isPositive
                        ? 'text-emerald-700'
                        : isZero
                        ? 'text-slate-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {isPositive ? `+${res.netChips}` : res.netChips}
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Net Chips</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Transaction Audit Log */}
      {activeTab === 'transfers' && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Confirmed Transfer History
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {state.completedTransfers.map((item) => (
              <div key={item.id} className="py-2.5 px-2 flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-slate-900">
                    {item.senderName} ➔ {item.recipientName}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {item.reasonType.replace('_', ' ')}
                    {item.reasonNote && ` · "${item.reasonNote}"`}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-slate-900 tabular-nums">
                    {item.amount} chips
                  </div>
                  <div className="text-[10px] text-emerald-700 font-semibold uppercase">
                    {item.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Actions */}
      <div className="space-y-3 pt-2">
        <button
          onClick={onOpenStats}
          className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors flex items-center justify-center gap-2"
        >
          <BarChart3 className="w-4 h-4 text-emerald-300" />
          <span>View Player Standings & Lifetime Stats</span>
        </button>

        <button
          onClick={onNewGame}
          className="w-full h-12 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Start New Table</span>
        </button>
      </div>
    </div>
  );
};
