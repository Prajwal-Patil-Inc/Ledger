/* Add / edit bill dialog. */

import { getOrCreateMonth, persist } from "../state.js";
import { todayISO } from "../utils/date.js";
import { escapeHtml } from "../utils/format.js";
import { createBill } from "../entities/bill.js";
import { showModal, closeModal, wireSeg, segValue } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import { renderAll } from "../render/shell.js";

export function openBillModal(id) {
  const m = getOrCreateMonth();
  const existing = id ? m.bills.find((x) => x.id === id) : null;

  showModal(`
    <h2>${existing ? "Edit bill" : "Add bill"}</h2>
    <div class="field">
      <label for="b-item">Item</label>
      <input id="b-item" placeholder="e.g. Broadband" value="${existing ? escapeHtml(existing.item) : ""}">
    </div>
    <div class="field-row">
      <div class="field">
        <label for="b-cat">Category</label>
        <input id="b-cat" placeholder="e.g. Utilities" value="${existing ? escapeHtml(existing.category || "") : ""}">
      </div>
      <div class="field">
        <label for="b-cost">Monthly cost</label>
        <input id="b-cost" type="number" inputmode="decimal" step="0.01" placeholder="0.00" value="${existing ? existing.cost : ""}">
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label for="b-due">Due date</label>
        <input id="b-due" type="date" value="${existing?.due ?? todayISO()}">
      </div>
      <div class="field">
        <label for="b-method">Payment method</label>
        <input id="b-method" placeholder="e.g. Direct Debit" value="${existing ? escapeHtml(existing.method || "") : ""}">
      </div>
    </div>
    <div class="field">
      <label>Recurring</label>
      <div class="seg" id="b-rec">
        <button type="button" data-val="Yes" class="${(existing?.recurring ?? "Yes") === "Yes" ? "active" : ""}">Yes</button>
        <button type="button" data-val="No" class="${existing?.recurring === "No" ? "active" : ""}">No</button>
      </div>
    </div>
    <div class="field">
      <label for="b-renewal">Renewal date (optional)</label>
      <input id="b-renewal" type="date" value="${existing?.renewal ?? ""}">
    </div>
    <div class="field">
      <label for="b-notes">Notes (optional)</label>
      <textarea id="b-notes">${existing ? escapeHtml(existing.notes || "") : ""}</textarea>
    </div>
    <div class="modal-actions">
      ${existing ? `<button class="btn btn-danger" id="b-delete">Delete</button>` : `<button class="btn btn-ghost" id="b-cancel">Cancel</button>`}
      <button class="btn btn-primary" id="b-save">Save</button>
    </div>
  `);

  wireSeg("b-rec");

  document.getElementById("b-save").onclick = () => {
    const item = document.getElementById("b-item").value.trim();
    if (!item) { toast("Enter an item name"); return; }
    const data = createBill({
      id: existing?.id,
      item,
      category: document.getElementById("b-cat").value.trim(),
      cost: parseFloat(document.getElementById("b-cost").value) || 0,
      due: document.getElementById("b-due").value,
      method: document.getElementById("b-method").value.trim(),
      recurring: segValue("b-rec"),
      paid: existing ? existing.paid : "No",
      renewal: document.getElementById("b-renewal").value,
      notes: document.getElementById("b-notes").value.trim(),
    });
    if (existing) Object.assign(existing, data);
    else m.bills.push(data);
    persist();
    closeModal();
    renderAll();
    toast(existing ? "Bill updated" : "Bill added");
  };
  const cancelBtn = document.getElementById("b-cancel");
  if (cancelBtn) cancelBtn.onclick = closeModal;
  const delBtn = document.getElementById("b-delete");
  if (delBtn) delBtn.onclick = () => {
    m.bills = m.bills.filter((x) => x.id !== existing.id);
    persist();
    closeModal();
    renderAll();
    toast("Bill deleted");
  };
}
