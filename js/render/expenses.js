/* Expenses tab. */

import { state, persist } from "../state.js";
import { monthLabel, ordinalSuffix } from "../utils/date.js";
import { fmt, fmt0, escapeHtml } from "../utils/format.js";
import { totalExpenses } from "../entities/month.js";
import { emptyMonthPrompt } from "./shared.js";
import { openExpenseModal } from "../modals/expenseModal.js";

export function renderExpenses() {
  const el = document.getElementById("view-expenses");
  const m = state.month;
  if (!m) { el.innerHTML = emptyMonthPrompt(); return; }

  if (!m.expenses.length) {
    el.innerHTML = `
      <div class="empty-state">
        <h3>No expenses logged</h3>
        <p>Tap the + button to add your first expense for ${monthLabel(state.cursor).month}.</p>
      </div>`;
    return;
  }

  const total = totalExpenses(m);
  const rows = m.expenses.map((e) => `
    <div class="ledger-row" data-id="${e.id}" data-kind="expense">
      <div class="ledger-main">
        <div class="ledger-cat">${escapeHtml(e.category)}</div>
        <div class="ledger-meta">
          <span class="tag ${e.type === "Fixed" ? "fixed" : "variable"}">${e.type}</span>
          ${e.due ? `<span>Due ${e.due}${ordinalSuffix(e.due)}</span>` : ""}
        </div>
      </div>
      <div class="ledger-amount">${fmt0(e.amount)}</div>
      <button class="paid-btn ${e.paid === "Yes" ? "yes" : "no"}" data-toggle-paid="${e.id}">${e.paid === "Yes" ? "Paid" : "Unpaid"}</button>
    </div>`).join("");

  el.innerHTML = `
    <div class="section-head"><h2>Expenses</h2><span class="hint">${m.expenses.length} categories</span></div>
    <div class="ledger-list">${rows}</div>
    <div class="list-total"><span>Total</span><span>${fmt(total)}</span></div>
  `;

  el.querySelectorAll("[data-toggle-paid]").forEach((btn) => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      const id = btn.dataset.togglePaid;
      const item = m.expenses.find((x) => x.id === id);
      // Balance is derived live from monthPaidTotal(), so simply flipping
      // paid status and persisting is enough — no manual adjustment needed.
      item.paid = item.paid === "Yes" ? "No" : "Yes";
      persist();
      renderExpenses();
    };
  });
  el.querySelectorAll(".ledger-row").forEach((row) => {
    row.onclick = () => openExpenseModal(row.dataset.id);
  });
}
