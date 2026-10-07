/* App shell rendering: month label, tab switching, and the top-level render. */

import { state, ensureMonth } from "../state.js";
import { monthLabel } from "../utils/date.js";
import { renderDashboard } from "./dashboard.js";
import { renderExpenses } from "./expenses.js";
import { renderBills } from "./bills.js";
import { renderGoals } from "./goals.js";

export function renderMonthLabel() {
  const { month, year } = monthLabel(state.cursor);
  document.getElementById("monthLabel").innerHTML = `${month} <span class="yr">${year}</span>`;
}

export function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + tab));
  renderActiveView();
}

export function renderActiveView() {
  if (state.tab === "dashboard") renderDashboard();
  else if (state.tab === "expenses") renderExpenses();
  else if (state.tab === "bills") renderBills();
  else if (state.tab === "goals") renderGoals();
}

export function renderAll() {
  ensureMonth();
  renderMonthLabel();
  renderActiveView();
}
