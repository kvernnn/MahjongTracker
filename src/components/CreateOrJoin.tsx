/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PlusCircle, LogIn, Sparkles, ScrollText, Users, History } from 'lucide-react';
import type { StoredPlayer } from '../services/api.ts';

interface CreateOrJoinProps {
  player: StoredPlayer | null;
  onInitPlayer: (displayName: string) => Promise<StoredPlayer>;
  onCreateLobby: (startingChips: number, houseRules: string) => Promise<void>;
  onJoinLobby: (lobbyId: string) => Promise<void>;
  onOpenStats: () => void;
  initialLobbyCode?: string;
}

const CHIP_PRESETS = [500, 1000, 1500, 2000];

const DEFAULT_RULES = `Singapore Mahjong House Rules:
• Maximum 5 Tai limit (Cap).
• Shooter pays all (discarder pays for whole table or loser pays winner).
• Bite payout: 1 chip for each Flower / Animal tile matched immediately.
• 1 Tai minimum to declare win.`;

export const CreateOrJoin: React.FC<CreateOrJoinProps> = ({
  player,
  onInitPlayer,
  onCreateLobby,
  onJoinLobby,
  onOpenStats,
  initialLobbyCode = '',
}) => {
  const [displayName, setDisplayName] = useState(player?.displayName || '');
  const [lobbyCodeInput, setLobbyCodeInput] = useState(initialLobbyCode);
  const [startingChips, setStartingChips] = useState<number>(1000);
  const [houseRules, setHouseRules] = useState<string>(DEFAULT_RULES);
  const [activeTab, setActiveTab] = useState<'join' | 'create'>(initialLobbyCode ? 'join' : 'join');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialLobbyCode) {
      setLobbyCodeInput(initialLobbyCode);
      setActiveTab('join');
    }
  }, [initialLobbyCode]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const name = displayName.trim() || 'Player';
    setLoading(true);
    try {
      await onInitPlayer(name);
      await onCreateLobby(startingChips, houseRules);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create lobby.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    let cleanCode = lobbyCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMsg('Please enter a 6-character lobby code.');
      return;
    }
    if (!cleanCode.startsWith('MJ-') && cleanCode.length === 4) {
      cleanCode = `MJ-${cleanCode}`;
    }

    const name = displayName.trim() || 'Player';
    setLoading(true);
    try {
      await onInitPlayer(name);
      await onJoinLobby(cleanCode);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to join lobby.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {/* Title & Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-900 border border-emerald-700/60 text-3xl shadow-md mb-3">
          🀄
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Singapore Mahjong Ledger
        </h1>
        <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
          In-person companion tracker for physical Mahjong games. Manage chip transfers, approvals, and standings in real time.
        </p>
      </div>

      {/* Player Display Name Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs mb-6">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Your Display Name
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Alice, Uncle Tan, Wei Ming"
            maxLength={25}
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 text-sm font-medium text-slate-900"
          />
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Your seat and statistics are securely remembered on this device across sessions.
        </p>
      </div>

      {/* Tabs: Join / Create */}
      <div className="flex rounded-xl bg-slate-200/70 p-1 mb-6 border border-slate-300/40">
        <button
          type="button"
          onClick={() => {
            setActiveTab('join');
            setErrorMsg(null);
          }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'join'
              ? 'bg-white text-emerald-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <LogIn className="w-4 h-4" />
          <span>Join Existing Game</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('create');
            setErrorMsg(null);
          }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'create'
              ? 'bg-white text-emerald-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create New Lobby</span>
        </button>
      </div>

      {/* Error Notice */}
      {errorMsg && (
        <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {/* Tab: Join Game */}
      {activeTab === 'join' && (
        <form onSubmit={handleJoin} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Lobby Room Code
            </label>
            <input
              type="text"
              value={lobbyCodeInput}
              onChange={(e) => setLobbyCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. MJ-7K9P"
              maxLength={10}
              className="w-full px-4 py-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 text-center font-mono font-bold text-xl tracking-widest text-slate-900 placeholder:text-slate-300 uppercase"
              required
            />
            <p className="text-[11px] text-slate-500 text-center mt-2">
              Ask your game host for the 6-character room code or open their invite link
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <span>Joining Game...</span> : <span>Enter Mahjong Table</span>}
          </button>
        </form>
      )}

      {/* Tab: Create Lobby */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
          {/* Starting Chips Config */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Starting Chips per Player
              </label>
              <span className="text-xs font-mono font-bold text-emerald-800 tabular-nums">
                {startingChips} chips
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-2">
              {CHIP_PRESETS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setStartingChips(amount)}
                  className={`py-2 px-1 rounded-xl text-xs font-mono font-semibold border transition-all ${
                    startingChips === amount
                      ? 'border-emerald-700 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  {amount}
                </button>
              ))}
            </div>

            <input
              type="number"
              min="100"
              max="50000"
              step="50"
              value={startingChips}
              onChange={(e) => setStartingChips(Math.max(100, parseInt(e.target.value, 10) || 1000))}
              className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 text-slate-900"
              placeholder="Custom starting chips"
            />
          </div>

          {/* House Rules */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              House Rules & Notes
            </label>
            <textarea
              value={houseRules}
              onChange={(e) => setHouseRules(e.target.value)}
              rows={4}
              maxLength={400}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 text-slate-800 leading-relaxed font-sans"
              placeholder="Record house rules (shooter pays all, max tai, bite chips)..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <span>Creating Table...</span> : <span>Create Table as Host</span>}
          </button>
        </form>
      )}

      {/* Quick Footer Links */}
      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={onOpenStats}
          className="flex items-center gap-1.5 text-xs font-medium text-emerald-800 hover:text-emerald-950 transition-colors"
        >
          <History className="w-4 h-4 text-emerald-700" />
          <span>View Player Standings & Lifetime Statistics</span>
        </button>
      </div>
    </div>
  );
};
