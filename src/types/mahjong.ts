/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LobbyStatus = 'waiting' | 'active' | 'finalized';

export type TransferStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'failed';

export type ReasonType =
  | 'hand_win'
  | 'self_draw'
  | 'kong'
  | 'flower_animal'
  | 'adjustment'
  | 'custom';

export interface Player {
  id: string;
  displayName: string;
  createdAt: number;
}

export interface PlayerSeat {
  seatIndex: number;
  playerId: string;
  displayName: string;
  chips: number;
  startingChips: number;
  netChips: number;
  isHost: boolean;
  isOnline: boolean;
  joinedAt: number;
}

export interface TransferRequest {
  id: string;
  lobbyId: string;
  initiatorPlayerId: string;
  senderPlayerId: string;
  recipientPlayerId: string;
  amount: number;
  reasonType: ReasonType;
  reasonNote: string;
  status: TransferStatus;
  failureReason?: string;
  createdAt: number;
  resolvedAt?: number;
  // Denormalized player names for clear display
  initiatorName: string;
  senderName: string;
  recipientName: string;
}

export interface SessionResult {
  id: string;
  lobbyId: string;
  playerId: string;
  displayName: string;
  seatIndex: number;
  startingChips: number;
  endingChips: number;
  netChips: number;
  position: number; // 1, 2, 3, 4
  isTied: boolean;
  createdAt: number;
}

export interface LobbyState {
  id: string;
  hostPlayerId: string;
  status: LobbyStatus;
  startingChips: number;
  houseRules: string;
  createdAt: number;
  startedAt?: number;
  finalizedAt?: number;
  seats: PlayerSeat[];
  pendingRequests: TransferRequest[];
  completedTransfers: TransferRequest[];
  results?: SessionResult[];
  totalChips: number;
  isTotalChipsValid: boolean;
}

export interface PlayerStats {
  playerId: string;
  displayName: string;
  completedSessions: number;
  totalNetChips: number;
  averageNetChips: number;
  highestSession: number;
  lowestSession: number;
  soloFirstPlaces: number;
  tiedFirstPlaces: number;
  totalFirstPlaces: number;
}

export interface SessionHistoryItem {
  lobbyId: string;
  startedAt: number;
  finalizedAt: number;
  durationMinutes: number;
  startingChips: number;
  houseRules: string;
  results: SessionResult[];
}
