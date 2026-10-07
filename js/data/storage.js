/* localStorage persistence. Nothing here knows about the UI or app state. */

import { DEFAULT_SETTINGS } from "../config.js";

const KEYS = {
  settings: "ledger_settings",
  goals: "ledger_goals",
  cursor: "ledger_last_cursor",
  monthPrefix: "ledger_month_",
};

/* ---- Settings ---- */

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEYS.settings) || "{}") };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s) {
  localStorage.setItem(KEYS.settings, JSON.stringify(s));
}

/* ---- Goals ---- */

export function loadGoals() {
  try { return JSON.parse(localStorage.getItem(KEYS.goals) || "[]"); } catch { return []; }
}
export function saveGoals(g) {
  localStorage.setItem(KEYS.goals, JSON.stringify(g));
}

/* ---- Months ---- */

export function loadMonth(key) {
  try {
    const raw = localStorage.getItem(KEYS.monthPrefix + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
export function saveMonth(key, data) {
  localStorage.setItem(KEYS.monthPrefix + key, JSON.stringify(data));
}
export function deleteMonth(key) {
  localStorage.removeItem(KEYS.monthPrefix + key);
}
/** Sorted "YYYY-MM" keys of every stored month. */
export function listMonthKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(KEYS.monthPrefix)) keys.push(k.replace(KEYS.monthPrefix, ""));
  }
  return keys.sort();
}
export function previousMonthKeyBefore(key) {
  const keys = listMonthKeys().filter((k) => k < key);
  return keys.length ? keys[keys.length - 1] : null;
}

/* ---- Last viewed month ---- */

/** Returns the saved month as a Date (1st of month), or null. */
export function loadLastCursor() {
  const saved = localStorage.getItem(KEYS.cursor); // "YYYY-MM"
  if (saved) {
    const [y, mo] = saved.split("-").map(Number);
    if (y && mo) return new Date(y, mo - 1, 1);
  }
  return null;
}
export function saveCursorKey(key) {
  localStorage.setItem(KEYS.cursor, key);
}

/* ---- Everything ---- */

export function clearAllData() {
  localStorage.clear();
}
