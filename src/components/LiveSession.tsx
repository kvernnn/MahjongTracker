/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  X,
  AlertTriangle,
  Crown,
  ChevronDown,
  ChevronUp,
  History,
  ShieldCheck,
  Info,
} from 'lucide-react';
import type { LobbyState, TransferRequest, ReasonType } from '../types/mahjong.ts';
import { TransferModal } from './TransferModal.tsx';
import { sound } from '../services/sound.ts';

interface LiveSessionProps {
  state: LobbyState;
  currentUserId: string;
  onProposeTransfer: (payload: {
    direction: 'pay' | 'request';
    otherPlayerId: string;
    amount: number;
    reasonType: ReasonType;
    reasonNote: string;
  }) => Promise<void>;
  onAcceptTransfer: (transferId: string) => Promise<void>;
  onRejectTransfer: (transferId: string) => Promise<void>;
  onCancelTransfer: (transferId: string) => Promise<void>;
  onCancelAllPending: () => Promise<void>;
  onFinalizeSession: () => Promise<void>;
}

const SEAT_WINDS = ['East (东)', 'South (南)', 'West (西)', 'North (北)'];

export const LiveSession: React.FC<LiveSessionProps> = ({
  state,
  currentUserId,
  onProposeTransfer,
  onAcceptTransfer,
  onRejectTransfer,
  onCancelTransfer,
  onCancelAllPending,
  onFinalizeSession,
}) => {
  const isHost = state.hostPlayerId === currentUserId;
  const mySeat = state.seats.find((s) => s.playerId === currentUserId);

  // Transfer modal state
  const [modalDirection, setModalDirection] = useState<'pay' | 'request' | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // End session dialog state
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  // Collapsible rules
  const [showRules, setShowRules] = useState(false);
  // Activity feed tab
  const [feedFilter, setFeedFilter] = useState<'all' | 'accepted'>('all');

  // Categorize pending requests
  // Incoming requests: pending requests where I am the counterparty (must respond)
  const incomingRequests = state.pendingRequests.filter((req) => {
    // If someone is paying me (recipient is me, initiator was sender)
    // Or if someone is requesting chips from me (sender is me, initiator was recipient)
    return (
      (req.recipientPlayerId === currentUserId && req.initiatorPlayerId !== currentUserId) ||
      (req.senderPlayerId === currentUserId && req.initiatorPlayerId !== currentUserId)
    );
  });

  // Outgoing requests: pending requests initiated by me
  const outgoingRequests = state.pendingRequests.filter(
    (req) => req.initiatorPlayerId === currentUserId
  );

  // Other pending requests (between other players)
  const otherPendingRequests = state.pendingRequests.filter(
    (req) =>
      req.initiatorPlayerId !== currentUserId &&
      req.senderPlayerId !== currentUserId &&
      req.recipientPlayerId !== currentUserId
  );

  const handleAccept = async (transferId: string) => {
    setProcessingId(transferId);
    try {
      await onAcceptTransfer(transferId);
      sound.playAccepted();
    } catch (err: any) {
      alert(err.message || 'Failed to accept transfer');
      sound.playRejected();
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (transferId: string) => {
    setProcessingId(transferId);
    try {
      await onRejectTransfer(transferId);
      sound.playRejected();
    } catch (err: any) {
      alert(err.message || 'Failed to reject transfer');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (transferId: string) => {
    setProcessingId(transferId);
    try {
      await onCancelTransfer(transferId);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel transfer');
    } finally {
      setProcessingId(null);
    }
  };

  const handleFinalize = async () => {
    setEndingSession(true);
    setEndError(null);
    try {
      await onFinalizeSession();
      sound.playAccepted();
      setShowEndDialog(false);
    } catch (err: any) {
      setEndError(err.message || 'Failed to finalize session.');
    } finally {
      setEndingSession(false);
    }
  };

  const filteredTransfers = state.completedTransfers.filter((t) => {
    if (feedFilter === 'accepted') return t.status === 'accepted';
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-5 pb-28">
      {/* Total Chips & Table Invariant Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/90 shadow-xs text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">Room {state.id}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">Starting: {state.startingChips} / player</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
            <Coins className="w-3.5 h-3.5 text-emerald-600" />
            <span className="tabular-nums">{state.totalChips.toLocaleString()} Total Chips</span>
            {state.isTotalChipsValid ? (
              <span className="text-[10px] text-emerald-600 font-sans ml-1 font-normal">
                (Balanced)
              </span>
            ) : (
              <span className="text-[10px] text-rose-600 font-sans ml-1 font-bold">
                (Imbalance!)
              </span>
            )}
          </div>

          {isHost && (
            <button
              onClick={() => {
                setEndError(null);
                setShowEndDialog(true);
              }}
              className="px-3 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold transition-colors"
            >
              End Game
            </button>
          )}
        </div>
      </div>

      {/* PROMINENT INCOMING REQUESTS (MUST RESPOND) */}
      {incomingRequests.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 shadow-md space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Action Required ({incomingRequests.length} Pending Approval)
              </h3>
            </div>
            <span className="text-[11px] text-amber-700">Balances change only on accept</span>
          </div>

          <div className="space-y-2.5">
            {incomingRequests.map((req) => {
              const isPayingMe = req.recipientPlayerId === currentUserId;
              const isProcessing = processingId === req.id;

              return (
                <div
                  key={req.id}
                  className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                        isPayingMe
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isPayingMe ? (
                        <ArrowDownLeft className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {isPayingMe ? (
                          <span>
                            <strong className="text-emerald-700">{req.senderName}</strong> wants to pay you{' '}
                            <span className="text-base text-emerald-800 font-mono tabular-nums">
                              {req.amount}
                            </span>{' '}
                            chips
                          </span>
                        ) : (
                          <span>
                            <strong className="text-amber-800">{req.recipientName}</strong> requests{' '}
                            <span className="text-base text-rose-700 font-mono tabular-nums">
                              {req.amount}
                            </span>{' '}
                            chips from you
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-700 capitalize">
                          {req.reasonType.replace('_', ' ')}
                        </span>
                        {req.reasonNote && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="italic text-slate-600">"{req.reasonNote}"</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Accept / Reject Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={isProcessing}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <span className="flex items-center gap-1">
                        <X className="w-3.5 h-3.5 text-slate-500" />
                        <span>Reject</span>
                      </span>
                    </button>
                    <button
                      onClick={() => handleAccept(req.id)}
                      disabled={isProcessing}
                      className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4 text-emerald-200" />
                      <span>{isProcessing ? 'Processing...' : 'Accept Transfer'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* OUTGOING PENDING REQUESTS (AWAITING OTHER'S APPROVAL) */}
      {outgoingRequests.length > 0 && (
        <div className="p-3.5 rounded-xl bg-slate-100/90 border border-slate-200/90 text-xs space-y-2">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Your Sent Proposals (Waiting for Counterparty)
          </div>

          <div className="space-y-2">
            {outgoingRequests.map((req) => {
              const otherName =
                req.senderPlayerId === currentUserId ? req.recipientName : req.senderName;
              const isPaying = req.senderPlayerId === currentUserId;

              return (
                <div
                  key={req.id}
                  className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="truncate text-slate-700">
                      {isPaying ? 'Paying ' : 'Requesting '}
                      <strong className="text-slate-900">{req.amount} chips</strong>{' '}
                      {isPaying ? 'to' : 'from'} <strong>{otherName}</strong>
                      {req.reasonNote && ` (${req.reasonNote})`}
                    </span>
                  </div>

                  <button
                    onClick={() => handleCancel(req.id)}
                    disabled={processingId === req.id}
                    className="px-2.5 py-1 rounded-md text-rose-700 hover:bg-rose-50 border border-rose-200 text-xs font-medium shrink-0 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4 PLAYER CARDS */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Table Standings & Balances
          </label>
          <span className="text-xs text-slate-500">Live Updates</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {state.seats.map((seat) => {
            const isMe = seat.playerId === currentUserId;
            const wind = SEAT_WINDS[seat.seatIndex] || `Seat ${seat.seatIndex + 1}`;
            const net = seat.netChips;
            const isPositive = net > 0;
            const isZero = net === 0;

            return (
              <div
                key={seat.seatIndex}
                className={`p-4 rounded-2xl border transition-all relative ${
                  isMe
                    ? 'border-emerald-600 bg-white ring-2 ring-emerald-600/30 shadow-md'
                    : 'border-slate-200 bg-white shadow-xs'
                }`}
              >
                {/* Wind and Badges */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {wind}
                  </span>
                  <div className="flex items-center gap-1">
                    {seat.isHost && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                        <Crown className="w-2.5 h-2.5 text-amber-600" />
                        <span>Host</span>
                      </span>
                    )}
                    {isMe && (
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        You
                      </span>
                    )}
                  </div>
                </div>

                {/* Player Display Name */}
                <div className="text-sm font-bold text-slate-900 truncate mb-2">
                  {seat.displayName}
                </div>

                {/* Big Readable Chip Balance */}
                <div className="py-1">
                  <div className="text-2xl font-black font-mono text-slate-900 tracking-tight tabular-nums">
                    {seat.chips.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-400">Chips</div>
                </div>

                {/* Net Gain / Loss */}
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Net:</span>
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      isPositive
                        ? 'text-emerald-700'
                        : isZero
                        ? 'text-slate-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {isPositive ? `+${net}` : net}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* House Rules Dropdown */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs">
        <button
          onClick={() => setShowRules(!showRules)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-slate-700 hover:bg-slate-50 transition-colors font-medium"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-700" />
            <span>View House Rules & Payout Notes</span>
          </div>
          {showRules ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showRules && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-slate-700 text-[11px] whitespace-pre-line leading-relaxed font-sans">
            {state.houseRules || 'Standard Singapore Mahjong rules applied.'}
          </div>
        )}
      </div>

      {/* Activity Feed & Confirmed Transfers */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Transaction Feed
            </h3>
          </div>

          <div className="flex gap-1 text-[11px]">
            <button
              onClick={() => setFeedFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                feedFilter === 'all'
                  ? 'bg-slate-200 text-slate-900 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({state.completedTransfers.length})
            </button>
            <button
              onClick={() => setFeedFilter('accepted')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                feedFilter === 'accepted'
                  ? 'bg-slate-200 text-slate-900 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Confirmed Only
            </button>
          </div>
        </div>

        {filteredTransfers.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No transfers recorded yet. Use the buttons below to pay or request chips!
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {filteredTransfers.map((item) => {
              const isAccepted = item.status === 'accepted';
              const isRejected = item.status === 'rejected';
              const isCancelled = item.status === 'cancelled';
              const isFailed = item.status === 'failed';

              const involvesMe =
                item.senderPlayerId === currentUserId || item.recipientPlayerId === currentUserId;

              return (
                <div
                  key={item.id}
                  className={`py-2.5 px-2 flex items-center justify-between gap-3 text-xs transition-colors ${
                    involvesMe ? 'bg-emerald-50/40 rounded-lg' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isAccepted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : isRejected ? (
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0" />
                    )}

                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate">
                        <strong className="text-slate-900">{item.senderName}</strong>
                        <span className="text-slate-400 mx-1">➔</span>
                        <strong className="text-slate-900">{item.recipientName}</strong>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                        <span className="capitalize">{item.reasonType.replace('_', ' ')}</span>
                        {item.reasonNote && (
                          <>
                            <span>·</span>
                            <span className="italic">{item.reasonNote}</span>
                          </>
                        )}
                        {item.failureReason && (
                          <span className="text-rose-600">({item.failureReason})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`font-mono font-bold tabular-nums text-sm ${
                        isAccepted ? 'text-slate-900' : 'text-slate-400 line-through'
                      }`}
                    >
                      {item.amount} chips
                    </div>
                    <div
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        isAccepted
                          ? 'text-emerald-700'
                          : isRejected
                          ? 'text-rose-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {item.status}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FIXED MOBILE-FIRST BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 shadow-lg">
        <div className="max-w-xl mx-auto grid grid-cols-2 gap-3">
          <button
            onClick={() => setModalDirection('pay')}
            className="h-12 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:scale-[0.98] text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-200" />
            <span>Pay Player</span>
          </button>

          <button
            onClick={() => setModalDirection('request')}
            className="h-12 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <ArrowDownLeft className="w-4 h-4 text-amber-300" />
            <span>Request Chips</span>
          </button>
        </div>
      </div>

      {/* Transfer Proposal Modal */}
      {modalDirection && (
        <TransferModal
          isOpen={true}
          onClose={() => setModalDirection(null)}
          direction={modalDirection}
          currentUserId={currentUserId}
          seats={state.seats}
          onConfirm={onProposeTransfer}
        />
      )}

      {/* End Session Confirmation Modal (Host Only) */}
      {showEndDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              End & Finalize Mahjong Session
            </h3>

            {state.pendingRequests.length > 0 ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>
                      {state.pendingRequests.length} transfer request(s) are still pending!
                    </span>
                  </div>
                  <p>
                    All pending transfers must be resolved before finalization. You can ask players to finish approvals, or cancel all remaining requests below.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await onCancelAllPending();
                    } catch (e: any) {
                      setEndError(e.message);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold text-xs border border-amber-300 transition-colors"
                >
                  Cancel All Remaining Pending Requests
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed">
                Ending the session will permanently lock all balances, determine final standings (1st–4th), and save results to each player's lifetime statistics.
              </p>
            )}

            {endError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {endError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEndDialog(false)}
                disabled={endingSession}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
              >
                Continue Playing
              </button>
              <button
                type="button"
                onClick={handleFinalize}
                disabled={endingSession || state.pendingRequests.length > 0}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {endingSession ? 'Finalizing...' : 'Confirm & Save Results'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
