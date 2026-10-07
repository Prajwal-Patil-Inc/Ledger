/* ============================================================
   Ledger — Personal Finance
   Vanilla JS (ES modules), no dependencies. All data is stored
   locally on-device (localStorage) so it works fully offline.

   This file is the entry point: it wires DOM events to the
   feature modules and boots the app.
   ============================================================ */

import { state, setCursor, ensureMonth, getOrCreateMonth } from "./state.js";
import { migrateLegacyGlobalBalance } from "./data/migrations.js";
import { closeModal } from "./ui/modal.js";
import { renderAll, renderMonthLabel, renderActiveView, switchTab } from "./render/shell.js";
import { openExpenseModal } from "./modals/expenseModal.js";
import { openBillModal } from "./modals/billModal.js";
import { openGoalModal } from "./modals/goalModal.js";
import { openSettingsModal } from "./modals/settingsModal.js";
import { openMonthPickerModal } from "./modals/monthPickerModal.js";

/** The + button adds whatever belongs to the current tab. */
function handleFab() {
  if (!state.month && state.tab !== "goals") getOrCreateMonth();
  if (state.tab === "bills") openBillModal(null);
  else if (state.tab === "goals") openGoalModal(null);
  else openExpenseModal(null); // dashboard + expenses both default to "add expense"
}

function shiftMonth(delta) {
  setCursor(new Date(state.cursor.getFullYear(), state.cursor.getMonth() + delta, 1));
  renderAll();
}

function init() {
  migrateLegacyGlobalBalance();
  ensureMonth();
  renderMonthLabel();
  renderActiveView();

  document.getElementById("prevMonth").onclick = () => shiftMonth(-1);
  document.getElementById("nextMonth").onclick = () => shiftMonth(1);
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.onclick = () => switchTab(b.dataset.tab);
  });
  document.getElementById("fabBtn").onclick = handleFab;
  document.getElementById("settingsBtn").onclick = openSettingsModal;

  const label = document.getElementById("monthLabel");
  label.onclick = openMonthPickerModal;
  label.onkeydown = (ev) => {
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openMonthPickerModal(); }
  };

  document.getElementById("modalBackdrop").onclick = (ev) => {
    if (ev.target.id === "modalBackdrop") closeModal();
  };

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

// Modules are deferred, so the DOM is normally ready — but stay safe either way.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

// Handy for debugging in devtools: type `state` in the console.
window.state = state;
