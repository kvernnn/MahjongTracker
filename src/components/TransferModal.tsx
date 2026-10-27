/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, ArrowRight, AlertCircle, Coins, Sparkles } from 'lucide-react';
import type { PlayerSeat, ReasonType } from '../types/mahjong.ts';
import { sound } from '../services/sound.ts';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  direction: 'pay' | 'request';
  currentUserId: string;
  seats: PlayerSeat[];
  onConfirm: (payload: {
    direction: 'pay' | 'request';
    otherPlayerId: string;
    amount: number;
    reasonType: ReasonType;
    reasonNote: string;
  }) => Promise<void>;
}

const REASONS: { type: ReasonType; label: string; icon: string; desc: string }[] = [
  { type: 'hand_win', label: 'Hand Payment (Discard Win)', icon: '🀄', desc: 'Winner paid by discarder' },
  { type: 'self_draw', label: 'Self-Draw (Zi Mo)', icon: '✨', desc: 'Winner draws own winning tile' },
  { type: 'kong', label: 'Kong (Gang) Payout', icon: '🀅', desc: 'Instant kong tile settlement' },
  { type: 'flower_animal', label: 'Flower / Animal Bite', icon: '🐱', desc: 'Cat/Rat, Rooster/Centipede or Flower' },
  { type: 'adjustment', label: 'Adjustment / Penalty', icon: '⚖️', desc: 'Chousi, false win, or correction' },
  { type: 'custom', label: 'Custom Reason', icon: '📝', desc: 'Any custom arrangement' },
];

const PRESETS = [10, 20, 50, 100, 200, 500];

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  direction,
  currentUserId,
  seats,
  onConfirm,
}) => {
  if (!isOpen) return null;

  const otherPlayers = seats.filter((s) => s.playerId !== currentUserId);
  const mySeat = seats.find((s) => s.playerId === currentUserId);

  const [selectedOtherId, setSelectedOtherId] = useState<string>(
    otherPlayers[0]?.playerId || ''
  );
  const [amountInput, setAmountInput] = useState<string>('50');
  const [reasonType, setReasonType] = useState<ReasonType>('hand_win');
  const [reasonNote, setReasonNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedOtherSeat = seats.find((s) => s.playerId === selectedOtherId);

  // Sender is Me for Pay, Other for Request
  const senderSeat = direction === 'pay' ? mySeat : selectedOtherSeat;
  const recipientSeat = direction === 'pay' ? selectedOtherSeat : mySeat;

  const parsedAmount = parseInt(amountInput, 10) || 0;
  const maxAvailable = senderSeat?.chips || 0;

  const handleAddPreset = (val: number) => {
    const current = parseInt(amountInput, 10) || 0;
    const next = Math.min(maxAvailable > 0 ? maxAvailable : 99999, current + val);
    setAmountInput(String(next));
  };

  const handleSetMax = () => {
    if (maxAvailable > 0) {
      setAmountInput(String(maxAvailable));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedOtherId) {
      setErrorMsg('Please select a player.');
      return;
    }

    if (!parsedAmount || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid chip amount greater than 0.');
      return;
    }

    if (parsedAmount > maxAvailable) {
      setErrorMsg(
        `Insufficient chips. ${senderSeat?.displayName || 'Sender'} only has ${maxAvailable} chips available.`
      );
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm({
        direction,
        otherPlayerId: selectedOtherId,
        amount: parsedAmount,
        reasonType,
        reasonNote,
      });
      sound.playSent();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit transfer request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {direction === 'pay' ? 'Pay Chips to Player' : 'Request Chips from Player'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Requires confirmation from the other player before balances change
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {/* Direction Transfer Flow Visualizer */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
            <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider mb-2">
              Transfer Flow
            </div>
            <div className="flex items-center justify-between gap-3 text-sm font-medium">
              <div className="flex-1 bg-white p-2.5 rounded-lg border border-emerald-200 shadow-xs text-center">
                <span className="text-xs text-slate-500 block">Sender (Debited)</span>
                <span className="font-bold text-slate-900 block truncate">
                  {direction === 'pay' ? 'You' : selectedOtherSeat?.displayName || 'Select player'}
                </span>
                <span className="text-[11px] text-emerald-700 font-mono tabular-nums">
                  {senderSeat?.chips ?? 0} chips
                </span>
              </div>

              <div className="flex flex-col items-center justify-center px-1 text-emerald-700">
                <ArrowRight className="w-5 h-5" />
                <span className="text-[10px] font-bold font-mono mt-0.5">{parsedAmount}</span>
              </div>

              <div className="flex-1 bg-white p-2.5 rounded-lg border border-emerald-200 shadow-xs text-center">
                <span className="text-xs text-slate-500 block">Recipient (Credited)</span>
                <span className="font-bold text-slate-900 block truncate">
                  {direction === 'pay' ? selectedOtherSeat?.displayName || 'Select player' : 'You'}
                </span>
                <span className="text-[11px] text-emerald-700 font-mono tabular-nums">
                  {recipientSeat?.chips ?? 0} chips
                </span>
              </div>
            </div>
          </div>

          {/* Select Player */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {direction === 'pay' ? 'Select recipient player:' : 'Select player to request from:'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {otherPlayers.map((other) => {
                const isSelected = selectedOtherId === other.playerId;
                return (
                  <button
                    key={other.playerId}
                    type="button"
                    onClick={() => setSelectedOtherId(other.playerId)}
                    className={`p-2.5 rounded-xl text-left border transition-all ${
                      isSelected
                        ? 'border-emerald-700 bg-emerald-50 ring-1 ring-emerald-700 text-slate-900'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs truncate">{other.displayName}</div>
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                      {other.chips} chips
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Chip Amount</label>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                Max available: {maxAvailable}
              </span>
            </div>

            <div className="relative">
              <input
                type="number"
                min="1"
                max={maxAvailable > 0 ? maxAvailable : undefined}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 text-xl font-bold font-mono text-slate-900 tabular-nums"
                placeholder="Amount"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                chips
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleAddPreset(p)}
                  className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                >
                  +{p}
                </button>
              ))}
              <button
                type="button"
                onClick={handleSetMax}
                className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 transition-colors"
              >
                Max ({maxAvailable})
              </button>
              <button
                type="button"
                onClick={() => setAmountInput('0')}
                className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Singapore Mahjong Reason Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Singapore Mahjong Reason
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => {
                const isSelected = reasonType === r.type;
                return (
                  <button
                    key={r.type}
                    type="button"
                    onClick={() => setReasonType(r.type)}
                    className={`p-2.5 rounded-xl text-left border transition-all flex items-start gap-2 ${
                      isSelected
                        ? 'border-emerald-700 bg-emerald-50/80 ring-1 ring-emerald-700'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <span className="text-base select-none">{r.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">{r.label}</div>
                      <div className="text-[10px] text-slate-500 truncate">{r.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Optional Note / Hand Detail
            </label>
            <input
              type="text"
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              placeholder="e.g. 3 Tai, Cat catch mouse bite, Pong kong"
              maxLength={80}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 text-slate-900"
            />
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || parsedAmount <= 0}
              className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <span>Submitting...</span>
              ) : direction === 'pay' ? (
                <>
                  <Coins className="w-4 h-4" />
                  <span>Propose Payment of {parsedAmount} Chips</span>
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4" />
                  <span>Send Request for {parsedAmount} Chips</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
