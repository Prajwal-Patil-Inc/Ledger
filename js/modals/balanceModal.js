/* Edit-balance dialog. */

import { state, persist } from "../state.js";
import { currentBalanceForKey, monthPaidTotal } from "../data/balance.js";
import { showModal, closeModal } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import { renderAll } from "../render/shell.js";

export function openBalanceModal() {
  const m = state.month;
  if (!m) return;
  const current = currentBalanceForKey(state.monthKey);
  const linkNote = m.balanceMode === "linked"
    ? "This month currently follows on from last month's balance automatically. Saving a value here fixes this month to that number instead — later months linked after it will then follow from this one."
    : "This updates itself as you mark expenses and bills Paid/Unpaid - you shouldn't need to touch it often.";
  showModal(`
    <h2>Edit balance</h2>
    <div class="helper-text" style="margin:-6px 2px 14px;">
      Set this to what's actually in your bank account right now. ${linkNote}
    </div>
    <div class="field">
      <label for="bal-amt">Current balance</label>
      <input id="bal-amt" type="number" inputmode="decimal" step="0.01" value="${current}">
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="bal-cancel">Cancel</button>
      <button class="btn btn-primary" id="bal-save">Save</button>
    </div>
  `);
  document.getElementById("bal-cancel").onclick = closeModal;
  document.getElementById("bal-save").onclick = () => {
    const val = parseFloat(document.getElementById("bal-amt").value);
    const entered = isNaN(val) ? 0 : val;
    // Store as a fixed anchor for this month. Since monthPaidTotal() gets
    // subtracted every time the balance is computed, add it back here so
    // the figure the person just typed is exactly what displays next.
    m.balanceMode = "manual";
    m.balanceLinkedFrom = null;
    m.balanceValue = entered + monthPaidTotal(m);
    persist();
    closeModal();
    renderAll();
    toast("Balance updated");
  };
}
