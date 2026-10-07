/* Balance calculation.
 *
 * Each month carries its own balance, in one of two modes:
 *   "manual" — balanceValue is a fixed anchor for this month, set directly.
 *   "linked" — no anchor of its own; the balance is computed live as
 *              (this month's income) + (the linked-from month's balance).
 *              Because it's computed on the fly, editing an earlier month
 *              ripples forward through every month linked after it.
 * Either way, whatever has been marked Paid this month is then subtracted,
 * since that money has genuinely left the account.
 */

import { loadMonth, previousMonthKeyBefore } from "./storage.js";
import { emptyMonth, totalIncome, totalExpenses } from "../entities/month.js";

export function monthPaidTotal(m) {
  return totalExpenses(m); // already filters paid === "Yes"
}

export function currentBalanceForKey(key, _depth = 0) {
  if (_depth > 240 || !key) return 0; // guard against a pathological/circular chain
  const m = loadMonth(key);
  if (!m) return 0;
  let base;
  if (m.balanceMode === "linked" && m.balanceLinkedFrom) {
    base = totalIncome(m) + currentBalanceForKey(m.balanceLinkedFrom, _depth + 1);
  } else {
    base = typeof m.balanceValue === "number" ? m.balanceValue : 0;
  }
  return base - monthPaidTotal(m);
}

/**
 * A brand-new month for `key`, linked onto whatever month came right before
 * it (if any) so it doesn't wrongly appear to reset to zero.
 */
export function freshMonthShell(key) {
  const m = emptyMonth();
  const prevKey = previousMonthKeyBefore(key);
  if (prevKey) {
    m.balanceMode = "linked";
    m.balanceLinkedFrom = prevKey;
  }
  return m;
}
