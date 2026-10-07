/* Bills & Maintenance tab. */

import { state, persist } from "../state.js";
import { daysUntil } from "../utils/date.js";
import { fmt, fmt0, escapeHtml } from "../utils/format.js";
import { emptyMonthPrompt } from "./shared.js";
import { openBillModal } from "../modals/billModal.js";

export function renderBills() {
  const el = document.getElementById("view-bills");
  const m = state.month;
  if (!m) { el.innerHTML = emptyMonthPrompt(); return; }

  if (!m.bills.length) {
    el.innerHTML = `
      <div class="empty-state">
        <h3>No bills tracked</h3>
        <p>Tap the + button to add a recurring bill or maintenance item.</p>
      </div>`;
    return;
  }

  const recurringTotal = m.bills.filter((b) => b.recurring === "Yes").reduce((a, b) => a + (Number(b.cost) || 0), 0);
  const unpaidCount = m.bills.filter((b) => b.paid !== "Yes").length;

  const rows = m.bills.map((b) => {
    const dleft = daysUntil(b.due);
    let rowCls = "";
    if (b.paid !== "Yes" && dleft !== null) {
      if (dleft < 0) rowCls = "overdue";
      else if (dleft <= 7) rowCls = "due-soon";
    }
    const dueLabel = b.due ? new Date(b.due).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";
    return `
    <div class="ledger-row ${rowCls}" data-id="${b.id}" data-kind="bill">
      <div class="ledger-main">
        <div class="ledger-cat">${escapeHtml(b.item)}</div>
        <div class="ledger-meta">
          <span>${escapeHtml(b.category || "")}</span>
          <span>Due ${dueLabel}${b.paid !== "Yes" && dleft !== null && dleft < 0 ? " · overdue" : ""}</span>
        </div>
      </div>
      <div class="ledger-amount">${fmt0(b.cost)}</div>
      <button class="paid-btn ${b.paid === "Yes" ? "yes" : "no"}" data-toggle-paid="${b.id}">${b.paid === "Yes" ? "Paid" : "Unpaid"}</button>
    </div>`;
  }).join("");

  el.innerHTML = `
    <div class="section-head"><h2>Bills & Maintenance</h2><span class="hint">${unpaidCount} unpaid</span></div>
    <div class="ledger-list">${rows}</div>
    <div class="list-total"><span>Recurring monthly total</span><span>${fmt(recurringTotal)}</span></div>
  `;

  el.querySelectorAll("[data-toggle-paid]").forEach((btn) => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      const id = btn.dataset.togglePaid;
      const item = m.bills.find((x) => x.id === id);
      // Balance is derived live from monthPaidTotal(), so simply flipping
      // paid status and persisting is enough — no manual adjustment needed.
      item.paid = item.paid === "Yes" ? "No" : "Yes";
      persist();
      renderBills();
    };
  });
  el.querySelectorAll(".ledger-row").forEach((row) => {
    row.onclick = () => openBillModal(row.dataset.id);
  });
}
