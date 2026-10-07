/* Edit-income dialog. */

import { getOrCreateMonth, persist } from "../state.js";
import { showModal, closeModal } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import { renderAll } from "../render/shell.js";

export function openIncomeModal() {
  const m = getOrCreateMonth();
  showModal(`
    <h2>Edit income</h2>
    <div class="field">
      <label for="i-net">Monthly net income</label>
      <input id="i-net" type="number" inputmode="decimal" step="0.01" value="${m.income.net}">
    </div>
    <div class="field">
      <label for="i-other">Other income</label>
      <input id="i-other" type="number" inputmode="decimal" step="0.01" value="${m.income.other}">
    </div>
    <div class="field">
      <label for="i-bonus">Bonuses / additional income</label>
      <input id="i-bonus" type="number" inputmode="decimal" step="0.01" value="${m.income.bonus}">
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="i-cancel">Cancel</button>
      <button class="btn btn-primary" id="i-save">Save</button>
    </div>
  `);
  document.getElementById("i-cancel").onclick = closeModal;
  document.getElementById("i-save").onclick = () => {
    m.income.net = parseFloat(document.getElementById("i-net").value) || 0;
    m.income.other = parseFloat(document.getElementById("i-other").value) || 0;
    m.income.bonus = parseFloat(document.getElementById("i-bonus").value) || 0;
    persist();
    closeModal();
    renderAll();
    toast("Income updated");
  };
}
