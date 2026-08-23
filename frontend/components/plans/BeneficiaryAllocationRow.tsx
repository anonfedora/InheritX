"use client";

import { motion } from "framer-motion";
import { ArrowLeftRight, Trash2 } from "lucide-react";
import { isValidStellarAccount } from "@/app/lib/validation/inheritancePlan";
import type { PlanBeneficiaryRequest } from "@/app/lib/api/inheritance";

export interface BeneficiaryDraft {
  address: string;
  name: string;
  /** Allocation in basis points. 10000 bps = 100%. */
  allocationBps: number;
  isFiat: boolean;
  fiatBank: string;
  fiatAccount: string;
  fiatCurrency: string;
  /** Optional daily fiat payout limit, entered as a plain decimal string. */
  fiatDailyLimit: string;
}

export const DEFAULT_BENEFICIARY_DRAFT: BeneficiaryDraft = {
  address: "",
  name: "",
  allocationBps: 0,
  isFiat: false,
  fiatBank: "",
  fiatAccount: "",
  fiatCurrency: "USD",
  fiatDailyLimit: "",
};

export function totalAllocationBps(beneficiaries: BeneficiaryDraft[]): number {
  return beneficiaries.reduce((sum, b) => sum + (b.allocationBps || 0), 0);
}

/** Formats basis points as a percentage string, e.g. 3333 -> "33.33". */
export function bpsToPercentageLabel(bps: number): string {
  return (bps / 100).toFixed(2).replace(/\.00$/, "");
}

/** Converts a user-entered percentage (up to 2 decimals) into basis points. */
export function percentageToBps(percentage: number): number {
  return Math.round(percentage * 100);
}

interface BeneficiaryValidation {
  /** Per-row error message, keyed by beneficiary index. */
  rowErrors: Record<number, string>;
  /** Set when the total allocation doesn't equal exactly 10,000 bps. */
  totalError?: string;
}

export function validateBeneficiaryDrafts(
  beneficiaries: BeneficiaryDraft[]
): BeneficiaryValidation {
  const rowErrors: Record<number, string> = {};
  const seenAddresses = new Set<string>();

  beneficiaries.forEach((b, index) => {
    const address = b.address.trim();

    if (!b.name.trim()) {
      rowErrors[index] = "Name is required.";
      return;
    }
    if (!isValidStellarAccount(address)) {
      rowErrors[index] = "Enter a valid Stellar wallet address (starts with G).";
      return;
    }
    if (seenAddresses.has(address)) {
      rowErrors[index] = "This wallet address is already used by another beneficiary.";
      return;
    }
    seenAddresses.add(address);

    if (!b.allocationBps || b.allocationBps <= 0) {
      rowErrors[index] = "Allocation must be greater than 0%.";
      return;
    }
    if (b.isFiat && !b.fiatBank.trim()) {
      rowErrors[index] = "Bank name is required for fiat off-ramp payouts.";
      return;
    }
    if (b.isFiat && !b.fiatAccount.trim()) {
      rowErrors[index] = "Account number is required for fiat off-ramp payouts.";
      return;
    }
  });

  const total = totalAllocationBps(beneficiaries);
  const totalError =
    total !== 10000
      ? `Allocations must total exactly 100% (10,000 bps) — currently ${bpsToPercentageLabel(total)}%.`
      : undefined;

  return { rowErrors, totalError };
}

/** Builds the fiat_anchor_info payload the backend parses on payout. Empty string means crypto payout. */
export function buildFiatAnchorInfo(b: BeneficiaryDraft): string {
  if (!b.isFiat) return "";
  return JSON.stringify({
    name: b.name.trim(),
    currency: b.fiatCurrency.trim() || "USD",
    bank: b.fiatBank.trim(),
    account: b.fiatAccount.trim(),
    ...(b.fiatDailyLimit.trim() ? { daily_limit: b.fiatDailyLimit.trim() } : {}),
  });
}

export function beneficiaryDraftToRequest(b: BeneficiaryDraft): PlanBeneficiaryRequest {
  return {
    address: b.address.trim(),
    name: b.name.trim(),
    allocation_bps: b.allocationBps,
    fiat_anchor_info: buildFiatAnchorInfo(b),
  };
}

interface BeneficiaryAllocationRowProps {
  beneficiary: BeneficiaryDraft;
  index: number;
  error?: string;
  onChange: (
    index: number,
    field: keyof BeneficiaryDraft,
    value: string | number | boolean
  ) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

export function BeneficiaryAllocationRow({
  beneficiary,
  index,
  error,
  onChange,
  onRemove,
  canRemove,
}: BeneficiaryAllocationRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="space-y-2 rounded-lg border border-[#2A3338] p-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_90px_90px_36px] gap-3 items-start">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#92A5A8] uppercase tracking-wider">
            Name
          </label>
          <input
            type="text"
            value={beneficiary.name}
            onChange={(e) => onChange(index, "name", e.target.value)}
            placeholder="Alice Smith"
            className="bg-[#0A0F11] border border-[#2A3338] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-[#4A5568] focus:outline-none focus:border-[#33C5E0] transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#92A5A8] uppercase tracking-wider">
            Wallet Address
          </label>
          <input
            type="text"
            value={beneficiary.address}
            onChange={(e) => onChange(index, "address", e.target.value)}
            placeholder="G..."
            className="bg-[#0A0F11] border border-[#2A3338] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-[#4A5568] focus:outline-none focus:border-[#33C5E0] transition-colors font-mono"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#92A5A8] uppercase tracking-wider">
            Share (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={beneficiary.allocationBps ? beneficiary.allocationBps / 100 : ""}
            onChange={(e) =>
              onChange(index, "allocationBps", percentageToBps(Number(e.target.value) || 0))
            }
            placeholder="0"
            className="bg-[#0A0F11] border border-[#2A3338] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-[#4A5568] focus:outline-none focus:border-[#33C5E0] transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#92A5A8] uppercase tracking-wider">
            Payout
          </label>
          <button
            type="button"
            onClick={() => onChange(index, "isFiat", !beneficiary.isFiat)}
            aria-label={`Toggle fiat off-ramp for ${beneficiary.name || index + 1}`}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${
              beneficiary.isFiat
                ? "bg-[#F59E0B14] border-[#F59E0B40] text-[#F59E0B]"
                : "bg-[#48BB7814] border-[#48BB7840] text-[#48BB78]"
            }`}
          >
            <ArrowLeftRight size={12} />
            {beneficiary.isFiat ? "Fiat" : "Token"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          aria-label={`Remove beneficiary ${beneficiary.name || index + 1}`}
          className="mt-6 p-2 rounded-lg text-[#F56565] hover:bg-[#F5656514] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {beneficiary.isFiat && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-[#2A3338]/60">
          <div className="flex flex-col gap-1 pt-2">
            <label className="text-[10px] text-[#92A5A8] uppercase tracking-wider">
              Bank Name
            </label>
            <input
              type="text"
              value={beneficiary.fiatBank}
              onChange={(e) => onChange(index, "fiatBank", e.target.value)}
              placeholder="First Bank"
              className="bg-[#0A0F11] border border-[#2A3338] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-[#4A5568] focus:outline-none focus:border-[#33C5E0] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1 pt-2">
            <label className="text-[10px] text-[#92A5A8] uppercase tracking-wider">
              Account Number
            </label>
            <input
              type="text"
              value={beneficiary.fiatAccount}
              onChange={(e) => onChange(index, "fiatAccount", e.target.value)}
              placeholder="0123456789"
              className="bg-[#0A0F11] border border-[#2A3338] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-[#4A5568] focus:outline-none focus:border-[#33C5E0] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1 pt-2">
            <label className="text-[10px] text-[#92A5A8] uppercase tracking-wider">
              Currency
            </label>
            <input
              type="text"
              value={beneficiary.fiatCurrency}
              onChange={(e) => onChange(index, "fiatCurrency", e.target.value.toUpperCase())}
              placeholder="NGN"
              maxLength={3}
              className="bg-[#0A0F11] border border-[#2A3338] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-[#4A5568] focus:outline-none focus:border-[#33C5E0] transition-colors uppercase"
            />
          </div>
          <div className="flex flex-col gap-1 pt-2">
            <label className="text-[10px] text-[#92A5A8] uppercase tracking-wider">
              Daily Limit (optional)
            </label>
            <input
              type="number"
              min={0}
              value={beneficiary.fiatDailyLimit}
              onChange={(e) => onChange(index, "fiatDailyLimit", e.target.value)}
              placeholder="Unlimited"
              className="bg-[#0A0F11] border border-[#2A3338] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-[#4A5568] focus:outline-none focus:border-[#33C5E0] transition-colors"
            />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-[#F56565]">{error}</p>}
    </motion.div>
  );
}
