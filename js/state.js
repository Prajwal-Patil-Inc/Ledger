/* Single source of truth for runtime app state.
   Pure state + persistence only — no rendering happens here. */

import { monthKey } from "./utils/date.js";
import {
  loadSettings, loadGoals, loadMonth, saveMonth,
  loadLastCursor, saveCursorKey,
} from "./data/storage.js";
import { freshMonthShell } from "./data/balance.js";

export const state = {
  cursor: loadLastCursor() || new Date(), // resume where you left off; else today's real month
  tab: "dashboard",
  settings: loadSettings(),
  goals: loadGoals(),
  month: null,
  monthKey: null,
};
state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1);

export function currentMK() {
  return monthKey(state.cursor);
}

/** Move the viewed month and remember it. */
export function setCursor(date) {
  state.cursor = new Date(date.getFullYear(), date.getMonth(), 1);
  saveCursorKey(currentMK());
}

/** Load the viewed month into state. Stays null if it doesn't exist yet. */
export function ensureMonth() {
  const key = currentMK();
  state.month = loadMonth(key) || null;
  state.monthKey = key;
}

export function getOrCreateMonth() {
  if (!state.month) {
    state.month = freshMonthShell(currentMK());
    saveMonth(state.monthKey, state.month);
  }
  return state.month;
}

export function persist() {
  if (state.month) saveMonth(state.monthKey, state.month);
}
