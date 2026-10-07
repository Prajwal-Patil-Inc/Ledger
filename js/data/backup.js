/* Export / import of all app data as a JSON file. */

import { state } from "../state.js";
import { DEFAULT_SETTINGS } from "../config.js";
import {
  listMonthKeys, loadMonth, saveMonth, saveSettings, saveGoals,
} from "./storage.js";
import { todayISO } from "../utils/date.js";
import { toast } from "../ui/toast.js";

export function exportBackup() {
  const data = { settings: state.settings, goals: state.goals, months: {} };
  listMonthKeys().forEach((k) => { data.months[k] = loadMonth(k); });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledger-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Backup downloaded");
}

export function importBackup(data) {
  if (data.settings) {
    state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    saveSettings(state.settings);
  }
  if (data.goals) {
    state.goals = data.goals;
    saveGoals(state.goals);
  }
  if (data.months) {
    Object.entries(data.months).forEach(([k, v]) => saveMonth(k, v));
  }
}
