/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Crown, Check, Play, Settings2, Share2, ShieldAlert } from 'lucide-react';
import type { LobbyState } from '../types/mahjong.ts';

interface LobbySetupProps {
  state: LobbyState;
  currentUserId: string;
  onStartSession: () => Promise<void>;
  onUpdateSettings: (settings: { startingChips?: number; houseRules?: string }) => Promise<void>;
  onLeaveLobby: () => void;
}

const SEAT_WINDS = ['East (东)', 'South (南)', 'West (西)', 'North (北)'];
const CHIP_PRESETS = [500, 1000, 1500, 2000];

export const LobbySetup: React.FC<LobbySetupProps> = ({
  state,
  currentUserId,
  onStartSession,
  onUpdateSettings,
  onLeaveLobby,
}) => {
  const isHost = state.hostPlayerId === currentUserId;
  const [copied, setCopied] = useState(false);
  const [startingChips, setStartingChips] = useState<number>(state.startingChips);
  const [houseRules, setHouseRules] = useState<string>(state.houseRules);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [starting, setStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}?lobby=${state.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setErrorMsg(null);
    try {
      await onUpdateSettings({ startingChips, houseRules });
      setIsEditingSettings(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    setErrorMsg(null);
    try {
      await onStartSession();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start session');
    } finally {
      setStarting(false);
    }
  };

  const seatsCount = state.seats.length;
  const canStart = seatsCount >= 2;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      {/* Lobby Header Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Mahjong Waiting Table
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <h2 className="text-xl font-bold font-mono text-slate-900 tracking-wider">
                {state.id}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                {seatsCount}/4 Players Seated
              </span>
            </div>
          </div>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition-colors shadow-xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Share Link</span>
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Share this code or link with your fellow players. Once all players take their seats, the host starts the session.
        </p>
      </div>

      {/* 4 Player Seats */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Player Seats (Max 4)
          </label>
          <span className="text-xs text-slate-500 font-mono">
            {seatsCount === 4 ? 'Full Roster' : `Waiting for ${4 - seatsCount} more`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((seatIdx) => {
            const seat = state.seats.find((s) => s.seatIndex === seatIdx);
            const isMe = seat?.playerId === currentUserId;
            const windName = SEAT_WINDS[seatIdx];

            if (seat) {
              return (
                <div
                  key={seatIdx}
                  className={`p-3.5 rounded-2xl border transition-all relative ${
                    isMe
                      ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600 shadow-xs'
                      : 'border-slate-200 bg-white shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-400">
                      {windName}
                    </span>
                    <div className="flex items-center gap-1">
                      {seat.isHost && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                          <Crown className="w-2.5 h-2.5 text-amber-600" />
                          <span>Host</span>
                        </span>
                      )}
                      {isMe && (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-200 text-emerald-900 text-[10px] font-bold">
                          You
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-sm font-bold text-slate-900 truncate">
                    {seat.displayName}
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-500">Chips:</span>
                    <span className="font-mono font-bold text-emerald-800 tabular-nums">
                      {seat.chips}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={seatIdx}
                className="p-3.5 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 flex flex-col justify-between min-h-[96px]"
              >
                <span className="text-[11px] font-medium text-slate-400">
                  {windName}
                </span>
                <div className="text-xs text-slate-400 italic">
                  Empty seat...
                </div>
                <div className="text-[10px] text-slate-400">
                  {state.startingChips} starting chips
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* House Rules & Starting Chips Info */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-emerald-800" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Table Configuration
            </h3>
          </div>
          {isHost && !isEditingSettings && (
            <button
              onClick={() => setIsEditingSettings(true)}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950"
            >
              Edit Rules & Chips
            </button>
          )}
        </div>

        {isEditingSettings && isHost ? (
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                Starting Chips per Player
              </label>
              <div className="flex gap-2 mb-2">
                {CHIP_PRESETS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setStartingChips(amt)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                      startingChips === amt
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="100"
                step="50"
                value={startingChips}
                onChange={(e) => setStartingChips(Math.max(100, parseInt(e.target.value, 10) || 1000))}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                House Rules
              </label>
              <textarea
                value={houseRules}
                onChange={(e) => setHouseRules(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 leading-relaxed font-sans"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingSettings(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-4 py-1.5 rounded-lg bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Starting Chips:</span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {state.startingChips} chips
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">House Rules:</span>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-slate-700 whitespace-pre-line leading-relaxed font-sans text-[11px]">
                {state.houseRules || 'Standard Singapore Mahjong rules.'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error notice */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Host / Guest Action Zone */}
      <div className="space-y-3">
        {isHost ? (
          <div>
            <button
              onClick={handleStart}
              disabled={!canStart || starting}
              className="w-full h-13 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>
                {starting
                  ? 'Starting Session...'
                  : canStart
                  ? 'Start Session (Lock Roster & Chips)'
                  : 'Waiting for Players (Min 2 required)'}
              </span>
            </button>
            <p className="text-[11px] text-slate-500 text-center mt-2">
              Starting locks the starting chips and seat roster. Players can then propose and accept chip transfers.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
            <div className="text-xs font-semibold text-emerald-900 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
              <span>Waiting for table host to start the session...</span>
            </div>
            <p className="text-[11px] text-emerald-700 mt-1">
              Keep this screen open. The game will automatically begin once the host starts.
            </p>
          </div>
        )}

        <button
          onClick={onLeaveLobby}
          type="button"
          className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-600 transition-colors"
        >
          Exit Lobby
        </button>
      </div>
    </div>
  );
};
