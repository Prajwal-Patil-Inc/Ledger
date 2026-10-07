/* User actions that change a whole month, then re-render. */

import { state, persist } from "../state.js";
import { monthLabel } from "../utils/date.js";
import { loadMonth, previousMonthKeyBefore } from "../data/storage.js";
import { freshMonthShell } from "../data/balance.js";
import { copyMonthStructure } from "../entities/month.js";
import { toast } from "../ui/toast.js";
import { renderAll } from "../render/shell.js";

export function startMonthBlank({ silent } = {}) {
  state.month = freshMonthShell(state.monthKey);
  persist();
  renderAll();
  if (!silent) toast("New month started");
}

export function copyFromPreviousMonth() {
  const prevKey = previousMonthKeyBefore(state.monthKey);
  if (!prevKey) { toast("No previous month to copy from"); return false; }
  state.month = copyMonthStructure(loadMonth(prevKey), prevKey, state.cursor);
  persist();
  renderAll();
  toast("Copied last month");
  return true;
}

/* NOTE: the three helpers below are not wired to any button at the moment. */

export function clearMonthExpenses() {
  if (!state.month || !state.month.expenses.length) { toast("No expenses to clear"); return; }
  const { month } = monthLabel(state.cursor);
  if (!confirm(`Delete all expenses for ${month}? Bills, goals and income are left untouched.`)) return;
  state.month.expenses = [];
  persist();
  renderAll();
  toast("Expenses cleared");
}

export function resetMonthBlank() {
  const { month } = monthLabel(state.cursor);
  const verb = state.month ? "Reset" : "Start";
  if (state.month && !confirm(`${verb} ${month} completely? This clears income, expenses and bills for this month only — other months are untouched.`)) return;
  startMonthBlank({ silent: true });
  toast("Month reset");
}

export function resetMonthFromPrevious() {
  const prevKey = previousMonthKeyBefore(state.monthKey);
  if (!prevKey) { toast("No previous month to copy from"); return; }
  const { month } = monthLabel(state.cursor);
  if (state.month && !confirm(`Replace ${month}'s data with last month's category list? Amounts start at zero. This can't be undone.`)) return;
  copyFromPreviousMonth();
}
