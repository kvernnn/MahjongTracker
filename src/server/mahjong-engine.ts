/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { db } from './db.ts';
import type {
  LobbyState,
  PlayerSeat,
  TransferRequest,
  SessionResult,
  PlayerStats,
  SessionHistoryItem,
  ReasonType,
} from '../types/mahjong.ts';

// Helper for unique ID generation
export function generateId(prefix = ''): string {
  return `${prefix}${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

// Generate friendly 6-char lobby code e.g. "MJ-8742" or "MJ-A7F2"
export function generateLobbyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `MJ-${code}`;
}

// Player Management
export function getOrCreatePlayer(displayName: string, existingToken?: string) {
  const cleanName = (displayName || 'Player').trim().slice(0, 30);
  const now = Date.now();

  if (existingToken) {
    const existing = db
      .prepare('SELECT id, token, display_name, created_at FROM players WHERE token = ?')
      .get(existingToken) as { id: string; token: string; display_name: string; created_at: number } | undefined;

    if (existing) {
      if (cleanName && cleanName !== existing.display_name) {
        db.prepare('UPDATE players SET display_name = ?, last_seen_at = ? WHERE id = ?').run(
          cleanName,
          now,
          existing.id
        );
        return { id: existing.id, token: existing.token, displayName: cleanName };
      }
      db.prepare('UPDATE players SET last_seen_at = ? WHERE id = ?').run(now, existing.id);
      return { id: existing.id, token: existing.token, displayName: existing.display_name };
    }
  }

  const id = generateId('p_');
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare(
    'INSERT INTO players (id, token, display_name, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, token, cleanName || 'Player', now, now);

  return { id, token, displayName: cleanName || 'Player' };
}

export function getPlayerByToken(token: string) {
  if (!token) return null;
  const row = db
    .prepare('SELECT id, token, display_name FROM players WHERE token = ?')
    .get(token) as { id: string; token: string; display_name: string } | undefined;
  if (!row) return null;
  return { id: row.id, token: row.token, displayName: row.display_name };
}

// Lobby Management
export function createLobby(
  hostPlayerId: string,
  startingChips = 1000,
  houseRules = 'Singapore Mahjong Rules: Max 5 Tai, Shooter pays all. Animals & Flowers: 1 chip instant payout.'
) {
  const lobbyId = generateLobbyCode();
  const now = Date.now();
  const safeChips = Math.max(100, Math.floor(startingChips) || 1000);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO lobbies (id, host_player_id, status, starting_chips, house_rules, created_at)
      VALUES (?, ?, 'waiting', ?, ?, ?)
    `).run(lobbyId, hostPlayerId, safeChips, houseRules.trim(), now);

    db.prepare(`
      INSERT INTO lobby_seats (lobby_id, seat_index, player_id, chips, joined_at)
      VALUES (?, 0, ?, ?, ?)
    `).run(lobbyId, hostPlayerId, safeChips, now);
  });

  tx();
  return lobbyId;
}

export function joinLobby(lobbyId: string, playerId: string) {
  const normalizedLobbyId = lobbyId.trim().toUpperCase();
  const lobby = db
    .prepare('SELECT id, status, starting_chips FROM lobbies WHERE id = ?')
    .get(normalizedLobbyId) as { id: string; status: string; starting_chips: number } | undefined;

  if (!lobby) {
    throw new Error(`Lobby ${normalizedLobbyId} not found.`);
  }

  // Check if player is already seated
  const existingSeat = db
    .prepare('SELECT seat_index, chips FROM lobby_seats WHERE lobby_id = ? AND player_id = ?')
    .get(normalizedLobbyId, playerId) as { seat_index: number; chips: number } | undefined;

  if (existingSeat) {
    return { lobbyId: normalizedLobbyId, seatIndex: existingSeat.seat_index };
  }

  if (lobby.status !== 'waiting') {
    throw new Error('This session has already started or ended. New players cannot join.');
  }

  // Count current seats
  const seatedPlayers = db
    .prepare('SELECT seat_index FROM lobby_seats WHERE lobby_id = ? ORDER BY seat_index ASC')
    .all(normalizedLobbyId) as { seat_index: number }[];

  if (seatedPlayers.length >= 4) {
    throw new Error('Lobby is full. Singapore Mahjong supports a maximum of 4 players.');
  }

  const occupiedSeats = new Set(seatedPlayers.map((s) => s.seat_index));
  let availableSeat = -1;
  for (let i = 0; i < 4; i++) {
    if (!occupiedSeats.has(i)) {
      availableSeat = i;
      break;
    }
  }

  if (availableSeat === -1) {
    throw new Error('No available seats remaining in this lobby.');
  }

  const now = Date.now();
  db.prepare(`
    INSERT INTO lobby_seats (lobby_id, seat_index, player_id, chips, joined_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(normalizedLobbyId, availableSeat, playerId, lobby.starting_chips, now);

  return { lobbyId: normalizedLobbyId, seatIndex: availableSeat };
}

export function updateLobbySettings(
  lobbyId: string,
  hostPlayerId: string,
  startingChips?: number,
  houseRules?: string
) {
  const lobby = db
    .prepare('SELECT id, host_player_id, status FROM lobbies WHERE id = ?')
    .get(lobbyId) as { id: string; host_player_id: string; status: string } | undefined;

  if (!lobby) throw new Error('Lobby not found.');
  if (lobby.host_player_id !== hostPlayerId) {
    throw new Error('Only the lobby host can update settings.');
  }
  if (lobby.status !== 'waiting') {
    throw new Error('Settings can only be changed before the session starts.');
  }

  const tx = db.transaction(() => {
    if (typeof startingChips === 'number' && startingChips >= 100) {
      const safeChips = Math.floor(startingChips);
      db.prepare('UPDATE lobbies SET starting_chips = ? WHERE id = ?').run(safeChips, lobbyId);
      // Synchronize chips for already seated players before session starts
      db.prepare('UPDATE lobby_seats SET chips = ? WHERE lobby_id = ?').run(safeChips, lobbyId);
    }
    if (typeof houseRules === 'string') {
      db.prepare('UPDATE lobbies SET house_rules = ? WHERE id = ?').run(houseRules.trim(), lobbyId);
    }
  });

  tx();
}

export function startSession(lobbyId: string, hostPlayerId: string) {
  const lobby = db
    .prepare('SELECT id, host_player_id, status, starting_chips FROM lobbies WHERE id = ?')
    .get(lobbyId) as { id: string; host_player_id: string; status: string; starting_chips: number } | undefined;

  if (!lobby) throw new Error('Lobby not found.');
  if (lobby.host_player_id !== hostPlayerId) {
    throw new Error('Only the lobby host can start the session.');
  }
  if (lobby.status !== 'waiting') {
    throw new Error('Session is already started or finished.');
  }

  const playerCount = (
    db.prepare('SELECT COUNT(*) as count FROM lobby_seats WHERE lobby_id = ?').get(lobbyId) as {
      count: number;
    }
  ).count;

  if (playerCount < 2) {
    throw new Error('At least 2 players are required to start a game.');
  }

  const now = Date.now();
  db.prepare(`UPDATE lobbies SET status = 'active', started_at = ? WHERE id = ?`).run(now, lobbyId);
}

// Transfer Management
export function proposeTransfer(
  lobbyId: string,
  initiatorPlayerId: string,
  options: {
    direction: 'pay' | 'request';
    otherPlayerId: string;
    amount: number;
    reasonType: ReasonType;
    reasonNote?: string;
  }
) {
  const lobby = db
    .prepare('SELECT status FROM lobbies WHERE id = ?')
    .get(lobbyId) as { status: string } | undefined;

  if (!lobby) throw new Error('Lobby not found.');
  if (lobby.status !== 'active') {
    throw new Error('Transfers can only be made during an active session.');
  }

  const { direction, otherPlayerId, amount, reasonType, reasonNote = '' } = options;

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Transfer amount must be a positive whole number.');
  }

  if (initiatorPlayerId === otherPlayerId) {
    throw new Error('You cannot transfer chips to yourself.');
  }

  // Verify both players are seated in this lobby
  const seatedInitiator = db
    .prepare('SELECT chips FROM lobby_seats WHERE lobby_id = ? AND player_id = ?')
    .get(lobbyId, initiatorPlayerId) as { chips: number } | undefined;

  const seatedOther = db
    .prepare('SELECT chips FROM lobby_seats WHERE lobby_id = ? AND player_id = ?')
    .get(lobbyId, otherPlayerId) as { chips: number } | undefined;

  if (!seatedInitiator || !seatedOther) {
    throw new Error('Both players must be active seated members of this lobby.');
  }

  let senderPlayerId = '';
  let recipientPlayerId = '';

  if (direction === 'pay') {
    senderPlayerId = initiatorPlayerId;
    recipientPlayerId = otherPlayerId;
  } else if (direction === 'request') {
    senderPlayerId = otherPlayerId;
    recipientPlayerId = initiatorPlayerId;
  } else {
    throw new Error('Invalid transfer direction.');
  }

  // Pre-check sender balance (non-reserving, balance remains unchanged until acceptance)
  const currentSenderBalance = direction === 'pay' ? seatedInitiator.chips : seatedOther.chips;
  if (currentSenderBalance < amount) {
    throw new Error(`Sender currently has insufficient chips (${currentSenderBalance} available, ${amount} requested).`);
  }

  const transferId = generateId('tx_');
  const now = Date.now();

  db.prepare(`
    INSERT INTO transfer_requests (
      id, lobby_id, initiator_player_id, sender_player_id, recipient_player_id,
      amount, reason_type, reason_note, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(
    transferId,
    lobbyId,
    initiatorPlayerId,
    senderPlayerId,
    recipientPlayerId,
    amount,
    reasonType,
    reasonNote.trim(),
    now
  );

  return transferId;
}

export function acceptTransfer(lobbyId: string, transferId: string, responderPlayerId: string) {
  const tx = db.transaction(() => {
    const transfer = db
      .prepare(`
        SELECT id, lobby_id, initiator_player_id, sender_player_id, recipient_player_id, amount, status
        FROM transfer_requests
        WHERE id = ? AND lobby_id = ?
      `)
      .get(transferId, lobbyId) as
      | {
          id: string;
          lobby_id: string;
          initiator_player_id: string;
          sender_player_id: string;
          recipient_player_id: string;
          amount: number;
          status: string;
        }
      | undefined;

    if (!transfer) {
      throw new Error('Transfer request not found.');
    }

    if (transfer.status !== 'pending') {
      throw new Error(`This transfer request is already ${transfer.status}.`);
    }

    // Critical authorization check:
    // Initiator can NEVER approve their own request!
    if (responderPlayerId === transfer.initiator_player_id) {
      throw new Error('The initiator cannot approve their own transfer request.');
    }

    // Only the other participant can respond
    const isSender = responderPlayerId === transfer.sender_player_id;
    const isRecipient = responderPlayerId === transfer.recipient_player_id;
    if (!isSender && !isRecipient) {
      throw new Error('Only the counterparty can approve or reject this request.');
    }

    // Check sender's current balance atomically
    const senderSeat = db
      .prepare('SELECT chips FROM lobby_seats WHERE lobby_id = ? AND player_id = ?')
      .get(lobbyId, transfer.sender_player_id) as { chips: number } | undefined;

    if (!senderSeat) {
      throw new Error('Sender is not seated in this lobby.');
    }

    if (senderSeat.chips < transfer.amount) {
      // Mark as failed due to insufficient funds
      db.prepare(`
        UPDATE transfer_requests
        SET status = 'failed', failure_reason = 'Insufficient chips at time of acceptance', resolved_at = ?
        WHERE id = ?
      `).run(Date.now(), transferId);

      throw new Error(
        `Transfer failed: Sender only has ${senderSeat.chips} chips, but ${transfer.amount} chips are required.`
      );
    }

    // Atomically debit sender and credit recipient
    db.prepare(`
      UPDATE lobby_seats
      SET chips = chips - ?
      WHERE lobby_id = ? AND player_id = ?
    `).run(transfer.amount, lobbyId, transfer.sender_player_id);

    db.prepare(`
      UPDATE lobby_seats
      SET chips = chips + ?
      WHERE lobby_id = ? AND player_id = ?
    `).run(transfer.amount, lobbyId, transfer.recipient_player_id);

    // Update transfer status
    db.prepare(`
      UPDATE transfer_requests
      SET status = 'accepted', resolved_at = ?
      WHERE id = ?
    `).run(Date.now(), transferId);
  });

  tx();
}

export function rejectTransfer(lobbyId: string, transferId: string, responderPlayerId: string) {
  const transfer = db
    .prepare(`
      SELECT id, lobby_id, initiator_player_id, sender_player_id, recipient_player_id, status
      FROM transfer_requests
      WHERE id = ? AND lobby_id = ?
    `)
    .get(transferId, lobbyId) as
    | {
        id: string;
        lobby_id: string;
        initiator_player_id: string;
        sender_player_id: string;
        recipient_player_id: string;
        status: string;
      }
    | undefined;

  if (!transfer) throw new Error('Transfer request not found.');
  if (transfer.status !== 'pending') {
    throw new Error(`This transfer request is already ${transfer.status}.`);
  }

  if (responderPlayerId === transfer.initiator_player_id) {
    throw new Error('Initiator cannot reject their own request. Use cancel instead.');
  }

  const isSender = responderPlayerId === transfer.sender_player_id;
  const isRecipient = responderPlayerId === transfer.recipient_player_id;
  if (!isSender && !isRecipient) {
    throw new Error('Only the counterparty can reject this request.');
  }

  db.prepare(`
    UPDATE transfer_requests
    SET status = 'rejected', resolved_at = ?
    WHERE id = ?
  `).run(Date.now(), transferId);
}

export function cancelTransfer(lobbyId: string, transferId: string, initiatorPlayerId: string) {
  const transfer = db
    .prepare(`
      SELECT id, lobby_id, initiator_player_id, status
      FROM transfer_requests
      WHERE id = ? AND lobby_id = ?
    `)
    .get(transferId, lobbyId) as
    | { id: string; lobby_id: string; initiator_player_id: string; status: string }
    | undefined;

  if (!transfer) throw new Error('Transfer request not found.');
  if (transfer.status !== 'pending') {
    throw new Error(`This transfer request is already ${transfer.status}.`);
  }

  if (transfer.initiator_player_id !== initiatorPlayerId) {
    throw new Error('Only the initiator can cancel this request.');
  }

  db.prepare(`
    UPDATE transfer_requests
    SET status = 'cancelled', resolved_at = ?
    WHERE id = ?
  `).run(Date.now(), transferId);
}

export function cancelAllPendingTransfers(lobbyId: string, hostPlayerId: string) {
  const lobby = db
    .prepare('SELECT host_player_id, status FROM lobbies WHERE id = ?')
    .get(lobbyId) as { host_player_id: string; status: string } | undefined;

  if (!lobby) throw new Error('Lobby not found.');
  if (lobby.host_player_id !== hostPlayerId) {
    throw new Error('Only the host can cancel pending transfers.');
  }

  db.prepare(`
    UPDATE transfer_requests
    SET status = 'cancelled', resolved_at = ?
    WHERE lobby_id = ? AND status = 'pending'
  `).run(Date.now(), lobbyId);
}

// Session Finalization
export function finalizeSession(lobbyId: string, hostPlayerId: string) {
  const lobby = db
    .prepare('SELECT id, host_player_id, status, starting_chips FROM lobbies WHERE id = ?')
    .get(lobbyId) as { id: string; host_player_id: string; status: string; starting_chips: number } | undefined;

  if (!lobby) throw new Error('Lobby not found.');
  if (lobby.host_player_id !== hostPlayerId) {
    throw new Error('Only the host can end the session.');
  }

  // Idempotent: If already finalized, return existing results
  if (lobby.status === 'finalized') {
    return getSessionResults(lobbyId);
  }

  // Check pending transfers
  const pendingCount = (
    db
      .prepare(`SELECT COUNT(*) as count FROM transfer_requests WHERE lobby_id = ? AND status = 'pending'`)
      .get(lobbyId) as { count: number }
  ).count;

  if (pendingCount > 0) {
    throw new Error(
      `Cannot finalize session: ${pendingCount} transfer request(s) are still pending. Please accept, reject, or cancel them first.`
    );
  }

  const seats = db
    .prepare(`
      SELECT s.seat_index, s.player_id, s.chips, p.display_name
      FROM lobby_seats s
      JOIN players p ON s.player_id = p.id
      WHERE s.lobby_id = ?
      ORDER BY s.chips DESC, s.seat_index ASC
    `)
    .all(lobbyId) as {
      seat_index: number;
      player_id: string;
      chips: number;
      display_name: string;
    }[];

  const now = Date.now();

  const tx = db.transaction(() => {
    db.prepare(`UPDATE lobbies SET status = 'finalized', finalized_at = ? WHERE id = ?`).run(now, lobbyId);

    // Compute standings with tied positions supported
    // Example: [1400, 1400, 800, 400] -> pos 1 (tied), pos 1 (tied), pos 3, pos 4
    for (let i = 0; i < seats.length; i++) {
      const current = seats[i];
      let position = 1;
      let isTied = false;

      for (let j = 0; j < seats.length; j++) {
        if (seats[j].chips > current.chips) {
          position++;
        } else if (seats[j].chips === current.chips && j !== i) {
          isTied = true;
        }
      }

      const netChips = current.chips - lobby.starting_chips;
      const resultId = generateId('res_');

      db.prepare(`
        INSERT OR IGNORE INTO session_results (
          id, lobby_id, player_id, seat_index, starting_chips, ending_chips, net_chips, position, is_tied, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        resultId,
        lobbyId,
        current.player_id,
        current.seat_index,
        lobby.starting_chips,
        current.chips,
        netChips,
        position,
        isTied ? 1 : 0,
        now
      );
    }
  });

  tx();
  return getSessionResults(lobbyId);
}

export function getSessionResults(lobbyId: string): SessionResult[] {
  const rows = db
    .prepare(`
      SELECT r.*, p.display_name
      FROM session_results r
      JOIN players p ON r.player_id = p.id
      WHERE r.lobby_id = ?
      ORDER BY r.position ASC, r.ending_chips DESC
    `)
    .all(lobbyId) as {
      id: string;
      lobby_id: string;
      player_id: string;
      seat_index: number;
      starting_chips: number;
      ending_chips: number;
      net_chips: number;
      position: number;
      is_tied: number;
      created_at: number;
      display_name: string;
    }[];

  return rows.map((r) => ({
    id: r.id,
    lobbyId: r.lobby_id,
    playerId: r.player_id,
    displayName: r.display_name,
    seatIndex: r.seat_index,
    startingChips: r.starting_chips,
    endingChips: r.ending_chips,
    netChips: r.net_chips,
    position: r.position,
    isTied: r.is_tied === 1,
    createdAt: r.created_at,
  }));
}

// Full State Query
export function getLobbyState(lobbyId: string, onlinePlayerIds?: Set<string>): LobbyState | null {
  const normalizedLobbyId = lobbyId.trim().toUpperCase();
  const lobby = db
    .prepare(`
      SELECT id, host_player_id, status, starting_chips, house_rules, created_at, started_at, finalized_at
      FROM lobbies
      WHERE id = ?
    `)
    .get(normalizedLobbyId) as
    | {
        id: string;
        host_player_id: string;
        status: 'waiting' | 'active' | 'finalized';
        starting_chips: number;
        house_rules: string;
        created_at: number;
        started_at?: number;
        finalized_at?: number;
      }
    | undefined;

  if (!lobby) return null;

  const seatsRows = db
    .prepare(`
      SELECT s.seat_index, s.player_id, s.chips, s.joined_at, p.display_name
      FROM lobby_seats s
      JOIN players p ON s.player_id = p.id
      WHERE s.lobby_id = ?
      ORDER BY s.seat_index ASC
    `)
    .all(normalizedLobbyId) as {
      seat_index: number;
      player_id: string;
      chips: number;
      joined_at: number;
      display_name: string;
    }[];

  const seats: PlayerSeat[] = seatsRows.map((s) => ({
    seatIndex: s.seat_index,
    playerId: s.player_id,
    displayName: s.display_name,
    chips: s.chips,
    startingChips: lobby.starting_chips,
    netChips: s.chips - lobby.starting_chips,
    isHost: s.player_id === lobby.host_player_id,
    isOnline: onlinePlayerIds ? onlinePlayerIds.has(s.player_id) : true,
    joinedAt: s.joined_at,
  }));

  const transfersRows = db
    .prepare(`
      SELECT 
        t.*,
        p_init.display_name as initiator_name,
        p_send.display_name as sender_name,
        p_recv.display_name as recipient_name
      FROM transfer_requests t
      JOIN players p_init ON t.initiator_player_id = p_init.id
      JOIN players p_send ON t.sender_player_id = p_send.id
      JOIN players p_recv ON t.recipient_player_id = p_recv.id
      WHERE t.lobby_id = ?
      ORDER BY t.created_at DESC
    `)
    .all(normalizedLobbyId) as {
      id: string;
      lobby_id: string;
      initiator_player_id: string;
      sender_player_id: string;
      recipient_player_id: string;
      amount: number;
      reason_type: ReasonType;
      reason_note: string;
      status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'failed';
      failure_reason?: string;
      created_at: number;
      resolved_at?: number;
      initiator_name: string;
      sender_name: string;
      recipient_name: string;
    }[];

  const pendingRequests: TransferRequest[] = [];
  const completedTransfers: TransferRequest[] = [];

  for (const row of transfersRows) {
    const item: TransferRequest = {
      id: row.id,
      lobbyId: row.lobby_id,
      initiatorPlayerId: row.initiator_player_id,
      senderPlayerId: row.sender_player_id,
      recipientPlayerId: row.recipient_player_id,
      amount: row.amount,
      reasonType: row.reason_type,
      reasonNote: row.reason_note,
      status: row.status,
      failureReason: row.failure_reason,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      initiatorName: row.initiator_name,
      senderName: row.sender_name,
      recipientName: row.recipient_name,
    };

    if (row.status === 'pending') {
      pendingRequests.push(item);
    } else {
      completedTransfers.push(item);
    }
  }

  let results: SessionResult[] | undefined;
  if (lobby.status === 'finalized') {
    results = getSessionResults(normalizedLobbyId);
  }

  const totalChips = seats.reduce((sum, s) => sum + s.chips, 0);
  const expectedTotal = lobby.starting_chips * seats.length;
  const isTotalChipsValid = totalChips === expectedTotal;

  return {
    id: lobby.id,
    hostPlayerId: lobby.host_player_id,
    status: lobby.status,
    startingChips: lobby.starting_chips,
    houseRules: lobby.house_rules,
    createdAt: lobby.created_at,
    startedAt: lobby.started_at,
    finalizedAt: lobby.finalized_at,
    seats,
    pendingRequests,
    completedTransfers,
    results,
    totalChips,
    isTotalChipsValid,
  };
}

// Player Statistics & History
export function getPlayerStats(playerId: string): PlayerStats {
  const player = db
    .prepare('SELECT id, display_name FROM players WHERE id = ?')
    .get(playerId) as { id: string; display_name: string } | undefined;

  const displayName = player ? player.display_name : 'Unknown';

  const results = db
    .prepare(`
      SELECT net_chips, position, is_tied
      FROM session_results
      WHERE player_id = ?
    `)
    .all(playerId) as { net_chips: number; position: number; is_tied: number }[];

  const completedSessions = results.length;
  if (completedSessions === 0) {
    return {
      playerId,
      displayName,
      completedSessions: 0,
      totalNetChips: 0,
      averageNetChips: 0,
      highestSession: 0,
      lowestSession: 0,
      soloFirstPlaces: 0,
      tiedFirstPlaces: 0,
      totalFirstPlaces: 0,
    };
  }

  let totalNetChips = 0;
  let highestSession = -Infinity;
  let lowestSession = Infinity;
  let soloFirstPlaces = 0;
  let tiedFirstPlaces = 0;

  for (const r of results) {
    totalNetChips += r.net_chips;
    if (r.net_chips > highestSession) highestSession = r.net_chips;
    if (r.net_chips < lowestSession) lowestSession = r.net_chips;

    if (r.position === 1) {
      if (r.is_tied === 1) {
        tiedFirstPlaces++;
      } else {
        soloFirstPlaces++;
      }
    }
  }

  return {
    playerId,
    displayName,
    completedSessions,
    totalNetChips,
    averageNetChips: Math.round(totalNetChips / completedSessions),
    highestSession: highestSession === -Infinity ? 0 : highestSession,
    lowestSession: lowestSession === Infinity ? 0 : lowestSession,
    soloFirstPlaces,
    tiedFirstPlaces,
    totalFirstPlaces: soloFirstPlaces + tiedFirstPlaces,
  };
}

export function getAllSessionsHistory(): SessionHistoryItem[] {
  const lobbies = db
    .prepare(`
      SELECT id, starting_chips, house_rules, started_at, finalized_at
      FROM lobbies
      WHERE status = 'finalized'
      ORDER BY finalized_at DESC
      LIMIT 50
    `)
    .all() as {
      id: string;
      starting_chips: number;
      house_rules: string;
      started_at?: number;
      finalized_at?: number;
    }[];

  return lobbies.map((lobby) => {
    const results = getSessionResults(lobby.id);
    const durationMinutes =
      lobby.started_at && lobby.finalized_at
        ? Math.max(1, Math.round((lobby.finalized_at - lobby.started_at) / (1000 * 60)))
        : 0;

    return {
      lobbyId: lobby.id,
      startedAt: lobby.started_at || 0,
      finalizedAt: lobby.finalized_at || 0,
      durationMinutes,
      startingChips: lobby.starting_chips,
      houseRules: lobby.house_rules,
      results,
    };
  });
}
