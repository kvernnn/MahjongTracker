/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'assert';
import {
  getOrCreatePlayer,
  createLobby,
  joinLobby,
  startSession,
  proposeTransfer,
  acceptTransfer,
  rejectTransfer,
  cancelTransfer,
  cancelAllPendingTransfers,
  finalizeSession,
  getLobbyState,
  getPlayerStats,
} from './mahjong-engine.ts';

function runTests() {
  console.log('🧪 Starting Mahjong Chip Ledger Acceptance Rule Tests...');

  // Test 1: Setup 4 players
  const host = getOrCreatePlayer('Host Alice');
  const p2 = getOrCreatePlayer('Bob');
  const p3 = getOrCreatePlayer('Charlie');
  const p4 = getOrCreatePlayer('David');
  const p5 = getOrCreatePlayer('Eve');

  console.log('✓ Players created successfully with persistent tokens');

  // Test 2: Create lobby and configure starting chips
  const lobbyId = createLobby(host.id, 1000, 'Test Rules 5 Tai');
  joinLobby(lobbyId, p2.id);
  joinLobby(lobbyId, p3.id);
  joinLobby(lobbyId, p4.id);

  // Test 3: 5th player cannot join a four-player lobby
  assert.throws(
    () => {
      joinLobby(lobbyId, p5.id);
    },
    (err: any) => err.message.includes('maximum of 4 players')
  );
  console.log('✓ Acceptance Check 1: 5th player cannot join a four-player lobby');

  // Test 4: Start session
  startSession(lobbyId, host.id);
  let state = getLobbyState(lobbyId);
  assert.strictEqual(state?.status, 'active');
  assert.strictEqual(state?.totalChips, 4000);
  assert.strictEqual(state?.isTotalChipsValid, true);
  console.log('✓ Session started and total chips = 4000 verified');

  // Test 5: Pending transfer changes NO balances
  // Alice pays Bob 150 chips
  const tx1 = proposeTransfer(lobbyId, host.id, {
    direction: 'pay',
    otherPlayerId: p2.id,
    amount: 150,
    reasonType: 'hand_win',
    reasonNote: '3 Tai discard win',
  });

  state = getLobbyState(lobbyId);
  const aliceSeatBefore = state?.seats.find((s) => s.playerId === host.id);
  const bobSeatBefore = state?.seats.find((s) => s.playerId === p2.id);
  assert.strictEqual(aliceSeatBefore?.chips, 1000, 'Alice balance must be unchanged while pending');
  assert.strictEqual(bobSeatBefore?.chips, 1000, 'Bob balance must be unchanged while pending');
  console.log('✓ Acceptance Check 2: Pending transfer changes no balances');

  // Test 6: Initiator cannot approve own request
  assert.throws(
    () => {
      acceptTransfer(lobbyId, tx1, host.id);
    },
    (err: Error) => /initiator cannot approve/i.test(err.message)
  );
  console.log('✓ Acceptance Check 3: Initiator cannot approve own request');

  // Test 7: Third-party (Charlie) cannot approve
  assert.throws(
    () => {
      acceptTransfer(lobbyId, tx1, p3.id);
    },
    (err: Error) => /counterparty/i.test(err.message)
  );
  console.log('✓ Acceptance Check 4: Only recipient/counterparty can approve');

  // Test 8: Bob rejects tx1 -> balances remain unchanged
  rejectTransfer(lobbyId, tx1, p2.id);
  state = getLobbyState(lobbyId);
  assert.strictEqual(state?.seats.find((s) => s.playerId === host.id)?.chips, 1000);
  assert.strictEqual(state?.seats.find((s) => s.playerId === p2.id)?.chips, 1000);
  console.log('✓ Acceptance Check 5: Rejecting changes no balances');

  // Test 9: Bob requests 200 chips from Alice, then Bob cancels -> balances unchanged
  const tx2 = proposeTransfer(lobbyId, p2.id, {
    direction: 'request',
    otherPlayerId: host.id,
    amount: 200,
    reasonType: 'kong',
    reasonNote: 'Bite payout',
  });
  cancelTransfer(lobbyId, tx2, p2.id);
  state = getLobbyState(lobbyId);
  assert.strictEqual(state?.seats.find((s) => s.playerId === host.id)?.chips, 1000);
  assert.strictEqual(state?.seats.find((s) => s.playerId === p2.id)?.chips, 1000);
  console.log('✓ Acceptance Check 6: Cancelling changes no balances');

  // Test 10: Alice pays Bob 300 chips -> Bob accepts -> Alice 700, Bob 1300
  const tx3 = proposeTransfer(lobbyId, host.id, {
    direction: 'pay',
    otherPlayerId: p2.id,
    amount: 300,
    reasonType: 'hand_win',
  });
  acceptTransfer(lobbyId, tx3, p2.id);
  state = getLobbyState(lobbyId);
  const aliceAfter = state?.seats.find((s) => s.playerId === host.id)?.chips;
  const bobAfter = state?.seats.find((s) => s.playerId === p2.id)?.chips;
  assert.strictEqual(aliceAfter, 700);
  assert.strictEqual(bobAfter, 1300);
  assert.strictEqual(state?.totalChips, 4000);
  console.log('✓ Acceptance Check 7: Acceptance updates both balances atomically');

  // Test 11: Duplicate acceptance fails
  assert.throws(() => {
    acceptTransfer(lobbyId, tx3, p2.id);
  }, /already accepted/i);
  console.log('✓ Acceptance Check 8: Duplicate acceptance prevented');

  // Test 12: Overspending protection (Alice has 700 chips, tries to pay 800)
  assert.throws(() => {
    proposeTransfer(lobbyId, host.id, {
      direction: 'pay',
      otherPlayerId: p3.id,
      amount: 800,
      reasonType: 'adjustment',
    });
  }, /insufficient chips/i);
  console.log('✓ Acceptance Check 9: Overspending prevented at proposal');

  // Test 13: Charlie pays David 100 chips -> David accepts
  const tx4 = proposeTransfer(lobbyId, p3.id, {
    direction: 'pay',
    otherPlayerId: p4.id,
    amount: 100,
    reasonType: 'flower_animal',
  });
  acceptTransfer(lobbyId, tx4, p4.id);

  // Standings now:
  // Bob: 1300 (+300)
  // David: 1100 (+100)
  // Charlie: 900 (-100)
  // Alice: 700 (-300)
  // Total = 4000

  // Test 14: Finalization requires resolving pending requests
  const pendingTx = proposeTransfer(lobbyId, p2.id, {
    direction: 'request',
    otherPlayerId: p4.id,
    amount: 50,
    reasonType: 'custom',
    reasonNote: 'Unresolved',
  });

  assert.throws(() => {
    finalizeSession(lobbyId, host.id);
  }, /transfer request\(s\) are still pending/i);
  console.log('✓ Acceptance Check 10: Finalization blocked while transfers pending');

  // Host cancels all pending requests
  cancelAllPendingTransfers(lobbyId, host.id);

  // Non-host cannot finalize
  assert.throws(() => {
    finalizeSession(lobbyId, p2.id);
  }, /only the host/i);

  // Host finalizes session
  const results = finalizeSession(lobbyId, host.id);
  assert.strictEqual(results.length, 4);
  assert.strictEqual(results[0].displayName, 'Bob');
  assert.strictEqual(results[0].position, 1);
  assert.strictEqual(results[0].endingChips, 1300);
  assert.strictEqual(results[0].netChips, 300);

  console.log('✓ Acceptance Check 11: Host-only finalization succeeds with accurate standings');

  // Test 15: Finalized session cannot have new transfers
  assert.throws(() => {
    proposeTransfer(lobbyId, host.id, {
      direction: 'pay',
      otherPlayerId: p2.id,
      amount: 50,
      reasonType: 'custom',
    });
  }, /transfers can only be made during an active session/i);
  console.log('✓ Acceptance Check 12: Finalized session cannot be modified');

  // Test 16: Idempotent finalization (does not duplicate results)
  const resultsAgain = finalizeSession(lobbyId, host.id);
  assert.strictEqual(resultsAgain.length, 4);

  // Check stats for Bob
  const bobStats = getPlayerStats(p2.id);
  assert.strictEqual(bobStats.completedSessions, 1);
  assert.strictEqual(bobStats.totalNetChips, 300);
  assert.strictEqual(bobStats.soloFirstPlaces, 1);
  assert.strictEqual(bobStats.tiedFirstPlaces, 0);

  console.log('✓ Acceptance Check 13: Statistics idempotency and accuracy verified');

  // Test 17: Tied positions calculation in new session
  const lobby2 = createLobby(host.id, 1000);
  joinLobby(lobby2, p2.id);
  joinLobby(lobby2, p3.id);
  joinLobby(lobby2, p4.id);
  startSession(lobby2, host.id);
  // No transfers: everyone has 1000 chips -> 4-way tie for 1st
  const tiedResults = finalizeSession(lobby2, host.id);
  assert.strictEqual(tiedResults.every((r) => r.position === 1 && r.isTied), true);
  console.log('✓ Acceptance Check 14: Tied positions handled correctly');

  console.log('\n🎉 ALL ACCEPTANCE TESTS PASSED!\n');
}

runTests();
