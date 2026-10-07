/* Display formatting helpers. */

import { state } from "../state.js";

export function fmt(n) {
  const v = Math.round((n || 0) * 100) / 100;
  return state.settings.currency + v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmt0(n) {
  return state.settings.currency + Math.round(n || 0).toLocaleString("en-GB");
}

export function pct(n) {
  return Math.round((n || 0) * 1000) / 10 + "%";
}

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
