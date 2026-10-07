/* Add / edit savings goal dialog. */

import { state } from "../state.js";
import { escapeHtml } from "../utils/format.js";
import { saveGoals } from "../data/storage.js";
import { createGoal } from "../entities/goal.js";
import { showModal, closeModal } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import { renderGoals } from "../render/goals.js";

export function openGoalModal(id) {
  const existing = id ? state.goals.find((x) => x.id === id) : null;

  showModal(`
    <h2>${existing ? "Edit goal" : "Add savings goal"}</h2>
    <div class="field">
      <label for="g-name">Goal name</label>
      <input id="g-name" placeholder="e.g. Emergency Fund" value="${existing ? escapeHtml(existing.name) : ""}">
    </div>
    <div class="field-row">
      <div class="field">
        <label for="g-target">Target amount</label>
        <input id="g-target" type="number" inputmode="decimal" step="0.01" value="${existing ? existing.target : ""}">
      </div>
      <div class="field">
        <label for="g-current">Current amount</label>
        <input id="g-current" type="number" inputmode="decimal" step="0.01" value="${existing ? existing.current : ""}">
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label for="g-monthly">Monthly contribution</label>
        <input id="g-monthly" type="number" inputmode="decimal" step="0.01" value="${existing ? existing.monthly : ""}">
      </div>
      <div class="field">
        <label for="g-date">Target date</label>
        <input id="g-date" type="date" value="${existing?.targetDate ?? ""}">
      </div>
    </div>
    <div class="modal-actions">
      ${existing ? `<button class="btn btn-danger" id="g-delete">Delete</button>` : `<button class="btn btn-ghost" id="g-cancel">Cancel</button>`}
      <button class="btn btn-primary" id="g-save">Save</button>
    </div>
  `);

  document.getElementById("g-save").onclick = () => {
    const name = document.getElementById("g-name").value.trim();
    if (!name) { toast("Enter a goal name"); return; }
    const data = createGoal({
      id: existing?.id,
      name,
      target: parseFloat(document.getElementById("g-target").value) || 0,
      current: parseFloat(document.getElementById("g-current").value) || 0,
      monthly: parseFloat(document.getElementById("g-monthly").value) || 0,
      targetDate: document.getElementById("g-date").value,
    });
    if (existing) Object.assign(existing, data);
    else state.goals.push(data);
    saveGoals(state.goals);
    closeModal();
    renderGoals();
    toast(existing ? "Goal updated" : "Goal added");
  };
  const cancelBtn = document.getElementById("g-cancel");
  if (cancelBtn) cancelBtn.onclick = closeModal;
  const delBtn = document.getElementById("g-delete");
  if (delBtn) delBtn.onclick = () => {
    state.goals = state.goals.filter((x) => x.id !== existing.id);
    saveGoals(state.goals);
    closeModal();
    renderGoals();
    toast("Goal deleted");
  };
}
