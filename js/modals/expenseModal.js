/* Add / edit expense dialog. */

import { getOrCreateMonth, persist } from "../state.js";
import { escapeHtml } from "../utils/format.js";
import { listMonthKeys, loadMonth } from "../data/storage.js";
import { createExpense } from "../entities/expense.js";
import { showModal, closeModal, wireSeg, segValue } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import { renderAll } from "../render/shell.js";

export function openExpenseModal(id) {
  const m = getOrCreateMonth();
  const existing = id ? m.expenses.find((x) => x.id === id) : null;
  const knownCategories = [...new Set(listMonthKeys().flatMap((k) => (loadMonth(k)?.expenses || []).map((e) => e.category)))];

  showModal(`
    <h2>${existing ? "Edit expense" : "Add expense"}</h2>
    <div class="field">
      <label for="f-cat">Category</label>
      <input id="f-cat" list="cat-list" placeholder="e.g. Rent, Groceries" value="${existing ? escapeHtml(existing.category) : ""}">
      <datalist id="cat-list">${knownCategories.map((c) => `<option value="${escapeHtml(c)}">`).join("")}</datalist>
    </div>
    <div class="field">
      <label>Type</label>
      <div class="seg" id="f-type">
        <button type="button" data-val="Fixed" class="${(existing?.type ?? "Fixed") === "Fixed" ? "active" : ""}">Fixed</button>
        <button type="button" data-val="Variable" class="${existing?.type === "Variable" ? "active" : ""}">Variable</button>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label for="f-amt">Monthly amount</label>

        <div class="amount-input">
          <input
            id="f-amt"
            type="number"
            inputmode="decimal"
            step="0.01"
            placeholder="0.00"
            value="${existing ? existing.amount : ""}"
          >

          <button type="button" id="add-amt">+</button>
        </div>

        <div id="add-amount-area" class="add-amount-area" hidden>
          <input
            id="f-add-amt"
            type="number"
            inputmode="decimal"
            step="0.01"
            placeholder="Amount to add"
          >

          <button type="button" id="confirm-add">Add</button>
          <button type="button" id="cancel-add">Cancel</button>
        </div>
      </div>
      <div class="field">
        <label for="f-due">Due date (day)</label>
        <input id="f-due" type="number" min="1" max="31" placeholder="1–31" value="${existing?.due ?? ""}">
      </div>
    </div>
    <div class="field">
      <label>Recurring</label>
      <div class="seg" id="f-rec">
        <button type="button" data-val="Yes" class="${(existing?.recurring ?? "Yes") === "Yes" ? "active" : ""}">Yes</button>
        <button type="button" data-val="No" class="${existing?.recurring === "No" ? "active" : ""}">No</button>
      </div>
    </div>
    <div class="field">
      <label for="f-notes">Notes (optional)</label>
      <textarea id="f-notes">${existing ? escapeHtml(existing.notes || "") : ""}</textarea>
    </div>
    <div class="modal-actions">
      ${existing ? `<button class="btn btn-danger" id="f-delete">Delete</button>` : `<button class="btn btn-ghost" id="f-cancel">Cancel</button>`}
      <button class="btn btn-primary" id="f-save">Save</button>
    </div>
  `);

  wireSeg("f-type"); wireSeg("f-rec");

  document.getElementById("f-save").onclick = () => {
    const category = document.getElementById("f-cat").value.trim();
    const amount = parseFloat(document.getElementById("f-amt").value) || 0;
    if (!category) { toast("Enter a category name"); return; }
    const data = createExpense({
      id: existing?.id,
      category,
      type: segValue("f-type"),
      amount,
      due: document.getElementById("f-due").value || "",
      paid: existing ? existing.paid : "No",
      recurring: segValue("f-rec"),
      notes: document.getElementById("f-notes").value.trim(),
    });
    if (existing) {
      Object.assign(existing, data);
    } else {
      m.expenses.push(data);
    }
    persist();
    closeModal();
    renderAll();
    toast(existing ? "Expense updated" : "Expense added");
  };
  const cancelBtn = document.getElementById("f-cancel");
  if (cancelBtn) cancelBtn.onclick = closeModal;
  const delBtn = document.getElementById("f-delete");
  if (delBtn) delBtn.onclick = () => {
    m.expenses = m.expenses.filter((x) => x.id !== existing.id);
    persist();
    closeModal();
    renderAll();
    toast("Expense deleted");
  };
const amountInput = document.getElementById("f-amt");
const addButton = document.getElementById("add-amt");
const addAmountArea = document.getElementById("add-amount-area");
const addInput = document.getElementById("f-add-amt");
const confirmAdd = document.getElementById("confirm-add");
const cancelAdd = document.getElementById("cancel-add");

addButton.addEventListener("click", () => {
  addAmountArea.hidden = false;

  // Focus the new input.
  // On a phone this opens the numeric keyboard.
  addInput.focus();
});

confirmAdd.addEventListener("click", () => {
  const currentAmount = parseFloat(amountInput.value) || 0;
  const amountToAdd = parseFloat(addInput.value);

  if (isNaN(amountToAdd)) {
    addInput.focus();
    return;
  }

  amountInput.value = (currentAmount + amountToAdd).toFixed(2);

  // Clear and hide the add box
  addInput.value = "";
  addAmountArea.hidden = true;

  // Return focus to the main amount field if desired
  amountInput.focus();
});

cancelAdd.addEventListener("click", () => {
  addInput.value = "";
  addAmountArea.hidden = true;
});

}
