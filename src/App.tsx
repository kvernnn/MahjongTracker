/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import type { LobbyState, ReasonType } from './types/mahjong.ts';
import { api, StoredPlayer } from './services/api.ts';
import { sound } from './services/sound.ts';
import { Header } from './components/Header.tsx';
import { CreateOrJoin } from './components/CreateOrJoin.tsx';
import { LobbySetup } from './components/LobbySetup.tsx';
import { LiveSession } from './components/LiveSession.tsx';
import { SessionSummary } from './components/SessionSummary.tsx';
import { StatisticsModal } from './components/StatisticsModal.tsx';

const LAST_LOBBY_KEY = 'mj_current_lobby';

export default function App() {
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'connecting' | 'disconnected'
  >('disconnected');
  const [showStats, setShowStats] = useState(false);
  const [initialLobbyCode, setInitialLobbyCode] = useState<string>('');

  const previousPendingCountRef = useRef<number>(0);

  // Initialize player and check URL for lobby code on mount
  useEffect(() => {
    const existing = api.getPlayer();
    if (existing) {
      setPlayer(existing);
    }

    // Check URL parameters for ?lobby=CODE
    const params = new URLSearchParams(window.location.search);
    const urlLobby = params.get('lobby');
    const savedLobby = localStorage.getItem(LAST_LOBBY_KEY);

    if (urlLobby) {
      setInitialLobbyCode(urlLobby.toUpperCase());
      setLobbyId(urlLobby.toUpperCase());
    } else if (savedLobby) {
      setLobbyId(savedLobby);
    }
  }, []);

  // Subscribe to WebSocket when lobbyId and player are available
  useEffect(() => {
    if (!lobbyId || !player) {
      setLobbyState(null);
      return;
    }

    localStorage.setItem(LAST_LOBBY_KEY, lobbyId);

    // Initial fetch via REST to ensure fast immediate rendering
    api
      .getLobbyState(lobbyId)
      .then((state) => {
        setLobbyState(state);
      })
      .catch((err) => {
        console.warn('Lobby not found or error loading:', err);
        localStorage.removeItem(LAST_LOBBY_KEY);
        setLobbyId(null);
      });

    // Real-time WebSocket subscription
    const unsubscribe = api.subscribeToLobby(
      lobbyId,
      (newState) => {
        setLobbyState(newState);

        // Sound alert for new incoming requests
        const myPending = newState.pendingRequests.filter(
          (r) =>
            (r.recipientPlayerId === player.id || r.senderPlayerId === player.id) &&
            r.initiatorPlayerId !== player.id
        );

        if (myPending.length > previousPendingCountRef.current) {
          sound.playReceived();
        }
        previousPendingCountRef.current = myPending.length;
      },
      (status) => {
        setConnectionStatus(status);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [lobbyId, player]);

  const handleInitPlayer = async (displayName: string) => {
    const p = await api.initPlayer(displayName);
    setPlayer(p);
    return p;
  };

  const handleCreateLobby = async (startingChips: number, houseRules: string) => {
    const newLobbyId = await api.createLobby(startingChips, houseRules);
    setLobbyId(newLobbyId);
    window.history.replaceState(null, '', `?lobby=${newLobbyId}`);
  };

  const handleJoinLobby = async (targetLobbyId: string) => {
    const res = await api.joinLobby(targetLobbyId);
    setLobbyId(res.lobbyId);
    window.history.replaceState(null, '', `?lobby=${res.lobbyId}`);
  };

  const handleLeaveLobby = () => {
    localStorage.removeItem(LAST_LOBBY_KEY);
    setLobbyId(null);
    setLobbyState(null);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const handleNewGame = () => {
    localStorage.removeItem(LAST_LOBBY_KEY);
    setLobbyId(null);
    setLobbyState(null);
    window.history.replaceState(null, '', window.location.pathname);
  };

  // Live actions
  const handleStartSession = async () => {
    if (!lobbyId) return;
    await api.startSession(lobbyId);
  };

  const handleUpdateSettings = async (settings: {
    startingChips?: number;
    houseRules?: string;
  }) => {
    if (!lobbyId) return;
    await api.updateLobbySettings(lobbyId, settings);
  };

  const handleProposeTransfer = async (payload: {
    direction: 'pay' | 'request';
    otherPlayerId: string;
    amount: number;
    reasonType: ReasonType;
    reasonNote: string;
  }) => {
    if (!lobbyId) return;
    await api.proposeTransfer(lobbyId, payload);
  };

  const handleAcceptTransfer = async (transferId: string) => {
    if (!lobbyId) return;
    await api.acceptTransfer(lobbyId, transferId);
  };

  const handleRejectTransfer = async (transferId: string) => {
    if (!lobbyId) return;
    await api.rejectTransfer(lobbyId, transferId);
  };

  const handleCancelTransfer = async (transferId: string) => {
    if (!lobbyId) return;
    await api.cancelTransfer(lobbyId, transferId);
  };

  const handleCancelAllPending = async () => {
    if (!lobbyId) return;
    await api.cancelAllPendingTransfers(lobbyId);
  };

  const handleFinalizeSession = async () => {
    if (!lobbyId) return;
    await api.finalizeSession(lobbyId);
  };

  return (
    <div className="min-h-screen bg-[#f7f5f0] flex flex-col font-sans">
      <Header
        player={player}
        lobbyId={lobbyId}
        connectionStatus={connectionStatus}
        onOpenStats={() => setShowStats(true)}
        onLeaveLobby={lobbyId ? handleLeaveLobby : undefined}
      />

      <main className="flex-1 pb-12">
        {!lobbyId || !lobbyState ? (
          <CreateOrJoin
            player={player}
            onInitPlayer={handleInitPlayer}
            onCreateLobby={handleCreateLobby}
            onJoinLobby={handleJoinLobby}
            onOpenStats={() => setShowStats(true)}
            initialLobbyCode={initialLobbyCode}
          />
        ) : lobbyState.status === 'waiting' ? (
          <LobbySetup
            state={lobbyState}
            currentUserId={player?.id || ''}
            onStartSession={handleStartSession}
            onUpdateSettings={handleUpdateSettings}
            onLeaveLobby={handleLeaveLobby}
          />
        ) : lobbyState.status === 'active' ? (
          <LiveSession
            state={lobbyState}
            currentUserId={player?.id || ''}
            onProposeTransfer={handleProposeTransfer}
            onAcceptTransfer={handleAcceptTransfer}
            onRejectTransfer={handleRejectTransfer}
            onCancelTransfer={handleCancelTransfer}
            onCancelAllPending={handleCancelAllPending}
            onFinalizeSession={handleFinalizeSession}
          />
        ) : (
          <SessionSummary
            state={lobbyState}
            currentUserId={player?.id || ''}
            onNewGame={handleNewGame}
            onOpenStats={() => setShowStats(true)}
          />
        )}
      </main>

      {/* Lifetime Stats & Past Sessions Modal */}
      {showStats && (
        <StatisticsModal
          isOpen={showStats}
          onClose={() => setShowStats(false)}
          currentUserId={player?.id}
        />
      )}
    </div>
  );
}
