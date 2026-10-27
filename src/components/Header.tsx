/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Volume2, VolumeX, Copy, Check, BarChart3, Wifi, WifiOff, LogOut } from 'lucide-react';
import { sound } from '../services/sound.ts';
import type { StoredPlayer } from '../services/api.ts';

interface HeaderProps {
  player: StoredPlayer | null;
  lobbyId: string | null;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  onOpenStats: () => void;
  onLeaveLobby?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  player,
  lobbyId,
  connectionStatus,
  onOpenStats,
  onLeaveLobby,
}) => {
  const [muted, setMuted] = useState(sound.getMuted());
  const [copied, setCopied] = useState(false);

  const handleToggleMute = () => {
    const isNowMuted = sound.toggleMute();
    setMuted(isNowMuted);
  };

  const handleCopyLobby = () => {
    if (!lobbyId) return;
    const shareUrl = `${window.location.origin}?lobby=${lobbyId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <header className="sticky top-0 z-30 bg-[#0c392b] text-white border-b border-[#144f3b] shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-900 border border-emerald-600/40 flex items-center justify-center font-bold text-emerald-200 text-sm shadow-inner">
            🀄
          </div>
          <span className="font-bold text-base tracking-tight text-emerald-50 whitespace-nowrap">
            Mahjong Ledger
          </span>
        </div>

        {/* Center Zone: Lobby Info & Connection */}
        <div className="flex items-center gap-2">
          {lobbyId && (
            <button
              onClick={handleCopyLobby}
              title="Click to copy lobby link"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-700/50 hover:bg-emerald-900/60 transition-colors text-xs text-emerald-200 font-mono"
            >
              <span className="font-semibold text-emerald-100">{lobbyId}</span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-emerald-400 opacity-70" />
              )}
            </button>
          )}

          {/* Connection status */}
          <div
            className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-300/80"
            title={`Status: ${connectionStatus}`}
          >
            {connectionStatus === 'connected' ? (
              <span className="flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline text-[11px]">Live</span>
              </span>
            ) : connectionStatus === 'connecting' ? (
              <span className="flex items-center gap-1 text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="hidden sm:inline text-[11px]">Connecting</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-rose-300">
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline text-[11px]">Offline</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Zone */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleToggleMute}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-900/60 transition-colors"
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
            aria-label="Toggle sound"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onOpenStats}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-900/80 border border-emerald-700/50 hover:bg-emerald-800 text-xs font-medium text-emerald-100 transition-colors whitespace-nowrap"
            title="View Player Stats & History"
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-300" />
            <span className="hidden sm:inline">Stats</span>
          </button>

          {lobbyId && onLeaveLobby && (
            <button
              onClick={onLeaveLobby}
              className="p-1.5 rounded-lg text-emerald-300 hover:text-rose-200 hover:bg-rose-950/40 transition-colors"
              title="Leave Lobby"
              aria-label="Leave lobby"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
