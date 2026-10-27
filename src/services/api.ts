/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  LobbyState,
  Player,
  PlayerStats,
  SessionHistoryItem,
  ReasonType,
  SessionResult,
} from '../types/mahjong.ts';

const TOKEN_KEY = 'mj_player_token';
const PLAYER_ID_KEY = 'mj_player_id';
const DISPLAY_NAME_KEY = 'mj_display_name';

export interface StoredPlayer {
  id: string;
  token: string;
  displayName: string;
}

class ApiService {
  private player: StoredPlayer | null = null;
  private ws: WebSocket | null = null;
  private currentLobbyId: string | null = null;
  private stateListeners: Set<(state: LobbyState) => void> = new Set();
  private connectionListeners: Set<(status: 'connected' | 'connecting' | 'disconnected') => void> = new Set();
  private reconnectTimer: any = null;
  private pingInterval: any = null;

  constructor() {
    this.loadStoredPlayer();
  }

  private loadStoredPlayer() {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem(TOKEN_KEY);
    const id = localStorage.getItem(PLAYER_ID_KEY);
    const displayName = localStorage.getItem(DISPLAY_NAME_KEY) || 'Player';
    if (token && id) {
      this.player = { id, token, displayName };
    }
  }

  public getPlayer(): StoredPlayer | null {
    return this.player;
  }

  public async initPlayer(displayName: string): Promise<StoredPlayer> {
    const existingToken = this.player?.token || localStorage.getItem(TOKEN_KEY) || undefined;
    const res = await fetch('/api/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, token: existingToken }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to authenticate player');
    }

    const data = await res.json();
    this.player = data.player;
    localStorage.setItem(TOKEN_KEY, data.player.token);
    localStorage.setItem(PLAYER_ID_KEY, data.player.id);
    localStorage.setItem(DISPLAY_NAME_KEY, data.player.displayName);
    return this.player!;
  }

  private getAuthHeader(): Record<string, string> {
    if (!this.player?.token) return {};
    return { Authorization: `Bearer ${this.player.token}` };
  }

  // Lobby management
  public async createLobby(
    startingChips = 1000,
    houseRules = 'Singapore Mahjong Rules: Max 5 Tai, Shooter pays all. Animals & Flowers: 1 chip instant payout.'
  ): Promise<string> {
    if (!this.player) throw new Error('Player identity required');
    const res = await fetch('/api/lobbies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify({ startingChips, houseRules }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create lobby');
    }

    const data = await res.json();
    return data.lobbyId;
  }

  public async joinLobby(lobbyId: string): Promise<{ lobbyId: string; seatIndex: number }> {
    if (!this.player) throw new Error('Player identity required');
    const res = await fetch(`/api/lobbies/${encodeURIComponent(lobbyId)}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to join lobby');
    }

    return await res.json();
  }

  public async getLobbyState(lobbyId: string): Promise<LobbyState> {
    const res = await fetch(`/api/lobbies/${encodeURIComponent(lobbyId)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Lobby not found');
    }
    const data = await res.json();
    return data.state;
  }

  public async updateLobbySettings(
    lobbyId: string,
    settings: { startingChips?: number; houseRules?: string }
  ): Promise<void> {
    const res = await fetch(`/api/lobbies/${encodeURIComponent(lobbyId)}/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify(settings),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update lobby settings');
    }
  }

  public async startSession(lobbyId: string): Promise<void> {
    const res = await fetch(`/api/lobbies/${encodeURIComponent(lobbyId)}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to start session');
    }
  }

  // Transfers
  public async proposeTransfer(
    lobbyId: string,
    options: {
      direction: 'pay' | 'request';
      otherPlayerId: string;
      amount: number;
      reasonType: ReasonType;
      reasonNote?: string;
    }
  ): Promise<string> {
    const res = await fetch(`/api/lobbies/${encodeURIComponent(lobbyId)}/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify(options),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to propose transfer');
    }

    const data = await res.json();
    return data.transferId;
  }

  public async acceptTransfer(lobbyId: string, transferId: string): Promise<void> {
    const res = await fetch(
      `/api/lobbies/${encodeURIComponent(lobbyId)}/transfers/${encodeURIComponent(transferId)}/accept`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to accept transfer');
    }
  }

  public async rejectTransfer(lobbyId: string, transferId: string): Promise<void> {
    const res = await fetch(
      `/api/lobbies/${encodeURIComponent(lobbyId)}/transfers/${encodeURIComponent(transferId)}/reject`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to reject transfer');
    }
  }

  public async cancelTransfer(lobbyId: string, transferId: string): Promise<void> {
    const res = await fetch(
      `/api/lobbies/${encodeURIComponent(lobbyId)}/transfers/${encodeURIComponent(transferId)}/cancel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to cancel transfer');
    }
  }

  public async cancelAllPendingTransfers(lobbyId: string): Promise<void> {
    const res = await fetch(`/api/lobbies/${encodeURIComponent(lobbyId)}/transfers/cancel-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to cancel pending transfers');
    }
  }

  public async finalizeSession(lobbyId: string): Promise<SessionResult[]> {
    const res = await fetch(`/api/lobbies/${encodeURIComponent(lobbyId)}/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to finalize session');
    }

    const data = await res.json();
    return data.results;
  }

  public async getPlayerStats(): Promise<PlayerStats> {
    const res = await fetch('/api/player/stats', {
      headers: this.getAuthHeader(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch player stats');
    }
    const data = await res.json();
    return data.stats;
  }

  public async getSessionsHistory(): Promise<SessionHistoryItem[]> {
    const res = await fetch('/api/sessions/history');
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch session history');
    }
    const data = await res.json();
    return data.history;
  }

  // Real-time WebSocket connection
  public subscribeToLobby(
    lobbyId: string,
    onState: (state: LobbyState) => void,
    onConnection?: (status: 'connected' | 'connecting' | 'disconnected') => void
  ): () => void {
    this.currentLobbyId = lobbyId;
    this.stateListeners.add(onState);
    if (onConnection) this.connectionListeners.add(onConnection);

    this.connectWs();

    // Return unsubscribe cleanup function
    return () => {
      this.stateListeners.delete(onState);
      if (onConnection) this.connectionListeners.delete(onConnection);
      if (this.stateListeners.size === 0) {
        this.disconnectWs();
      }
    };
  }

  private connectWs() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.notifyConnection('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.notifyConnection('connected');
        if (this.currentLobbyId && this.player) {
          this.ws?.send(
            JSON.stringify({
              type: 'subscribe',
              lobbyId: this.currentLobbyId,
              token: this.player.token,
            })
          );
        }

        // Setup ping interval
        clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'state' && msg.state) {
            for (const listener of this.stateListeners) {
              listener(msg.state);
            }
          }
        } catch (e) {
          console.error('Failed to parse incoming WebSocket message', e);
        }
      };

      this.ws.onclose = () => {
        this.notifyConnection('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (e) => {
        console.warn('WebSocket connection error:', e);
        this.notifyConnection('disconnected');
      };
    } catch (e) {
      this.notifyConnection('disconnected');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    clearInterval(this.pingInterval);
    if (this.stateListeners.size > 0 && this.currentLobbyId) {
      this.reconnectTimer = setTimeout(() => {
        this.connectWs();
      }, 2000);
    }
  }

  private disconnectWs() {
    clearTimeout(this.reconnectTimer);
    clearInterval(this.pingInterval);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.currentLobbyId = null;
    this.notifyConnection('disconnected');
  }

  private notifyConnection(status: 'connected' | 'connecting' | 'disconnected') {
    for (const listener of this.connectionListeners) {
      listener(status);
    }
  }
}

export const api = new ApiService();
