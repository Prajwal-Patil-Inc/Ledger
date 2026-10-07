/* One-off data migrations, run at startup. */

import { listMonthKeys, loadMonth, saveMonth } from "./storage.js";

/**
 * Earlier versions kept a single global balance. Fold that old value in as
 * every pre-existing month's manual anchor, so nothing jumps to zero.
 */
export function migrateLegacyGlobalBalance() {
  if (localStorage.getItem("ledger_balance_migrated")) return;
  const legacyRaw = localStorage.getItem("ledger_balance");
  const legacy = legacyRaw !== null ? (parseFloat(legacyRaw) || 0) : 0;
  listMonthKeys().forEach((k) => {
    const m = loadMonth(k);
    if (m && !m.balanceMode) {
      m.balanceMode = "manual";
      m.balanceValue = legacy;
      saveMonth(k, m);
    }
  });
  localStorage.setItem("ledger_balance_migrated", "1");
}
