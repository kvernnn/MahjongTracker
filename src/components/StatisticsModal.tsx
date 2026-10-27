/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { X, Trophy, History, TrendingUp, TrendingDown, Calendar, Clock, ChevronRight } from 'lucide-react';
import type { PlayerStats, SessionHistoryItem } from '../types/mahjong.ts';
import { api } from '../services/api.ts';

interface StatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
}

export const StatisticsModal: React.FC<StatisticsModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
}) => {
  if (!isOpen) return null;

  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SessionHistoryItem | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [playerStats, sessions] = await Promise.all([
          api.getPlayerStats().catch(() => null),
          api.getSessionsHistory().catch(() => []),
        ]);
        if (mounted) {
          setStats(playerStats);
          setHistory(sessions);
        }
      } catch (err) {
        console.error('Failed to load stats', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Player Statistics & Session History
            </h3>
            <p className="text-xs text-slate-500">
              {stats?.displayName || 'Player'} · Lifetime Record
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading statistics...</div>
          ) : (
            <>
              {/* Lifetime Stats KPI Grid */}
              <div>
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Lifetime Performance
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="text-[11px] text-slate-500">Completed Sessions</div>
                    <div className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                      {stats?.completedSessions ?? 0}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="text-[11px] text-slate-500">Total Net Chips</div>
                    <div
                      className={`text-xl font-bold font-mono tabular-nums mt-0.5 ${
                        (stats?.totalNetChips ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {(stats?.totalNetChips ?? 0) > 0 ? `+${stats?.totalNetChips}` : stats?.totalNetChips ?? 0}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="text-[11px] text-slate-500">Average Net / Session</div>
                    <div
                      className={`text-xl font-bold font-mono tabular-nums mt-0.5 ${
                        (stats?.averageNetChips ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {(stats?.averageNetChips ?? 0) > 0 ? `+${stats?.averageNetChips}` : stats?.averageNetChips ?? 0}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="text-[11px] text-slate-500">Solo 1st Place</div>
                    <div className="text-xl font-bold font-mono text-amber-700 tabular-nums mt-0.5">
                      {stats?.soloFirstPlaces ?? 0}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="text-[11px] text-slate-500">Tied 1st Place</div>
                    <div className="text-xl font-bold font-mono text-amber-600 tabular-nums mt-0.5">
                      {stats?.tiedFirstPlaces ?? 0}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="text-[11px] text-slate-500">Best / Worst Result</div>
                    <div className="text-xs font-mono font-bold mt-1 tabular-nums">
                      <span className="text-emerald-700">+{stats?.highestSession ?? 0}</span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-rose-600">{stats?.lowestSession ?? 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Past Sessions List */}
              <div>
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Past Finalized Sessions ({history.length})
                </div>

                {history.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No completed sessions recorded yet. Finish a game to view history!
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {history.map((sess) => {
                      const dateStr = new Date(sess.finalizedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      const myResult = sess.results.find((r) => r.playerId === currentUserId);

                      return (
                        <div
                          key={sess.lobbyId}
                          className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors shadow-2xs space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 font-mono">
                                {sess.lobbyId}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-500">{dateStr}</span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-500">{sess.durationMinutes} min</span>
                            </div>

                            {myResult && (
                              <div className="flex items-center gap-1.5 font-mono text-xs font-bold tabular-nums">
                                <span>Place #{myResult.position}</span>
                                <span
                                  className={
                                    myResult.netChips >= 0 ? 'text-emerald-700' : 'text-rose-600'
                                  }
                                >
                                  ({myResult.netChips >= 0 ? `+${myResult.netChips}` : myResult.netChips})
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Players row */}
                          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                            {sess.results.map((r) => (
                              <div
                                key={r.playerId}
                                className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] text-slate-700 flex items-center gap-1"
                              >
                                <span className="font-semibold">{r.displayName}</span>
                                <span
                                  className={`font-mono text-[10px] ${
                                    r.netChips >= 0 ? 'text-emerald-700' : 'text-rose-600'
                                  }`}
                                >
                                  {r.netChips >= 0 ? `+${r.netChips}` : r.netChips}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
