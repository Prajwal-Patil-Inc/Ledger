/* Settings dialog: currency, thresholds, backup/restore, data clearing. */

import { state, currentMK } from "../state.js";
import { DEFAULT_SETTINGS } from "../config.js";
import { monthLabel } from "../utils/date.js";
import { escapeHtml } from "../utils/format.js";
import { saveSettings, deleteMonth, clearAllData } from "../data/storage.js";
import { exportBackup, importBackup } from "../data/backup.js";
import { showModal, closeModal } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import { renderAll } from "../render/shell.js";

export function openSettingsModal() {
  const s = state.settings;
  showModal(`
    <h2>Settings</h2>
    <div class="field-row">
      <div class="field">
        <label for="s-currency">Currency symbol</label>
        <input id="s-currency" value="${escapeHtml(s.currency)}" maxlength="3">
      </div>
      <div class="field">
        <label for="s-healthy">Healthy savings rate ≥</label>
        <input id="s-healthy" type="number" step="1" value="${Math.round(s.healthyRate * 100)}">
      </div>
    </div>
    <div class="field">
      <label for="s-attention">Needs-attention savings rate ≥ (%)</label>
      <input id="s-attention" type="number" step="1" value="${Math.round(s.attentionRate * 100)}">
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="s-cancel">Cancel</button>
      <button class="btn btn-primary" id="s-save">Save</button>
    </div>
    <div class="helper-text" style="margin-top:18px; border-top:1px solid var(--hairline); padding-top:16px;">
      Your data. Back it up before switching phones or browsers - this app stores everything only on this device.
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="s-export">Export backup</button>
      <button class="btn btn-ghost" id="s-import">Import backup</button>
    </div>
    <input type="file" id="s-import-file" accept="application/json" style="display:none;">
    <div class="modal-actions">
      <button class="btn btn-danger" id="s-clear-this-month" style="flex:none; width:100%;">Clear this month</button>
    </div>
    <div class="modal-actions">
      <button class="btn btn-danger" id="s-clear" style="flex:none; width:100%;">Erase all data on this device</button>
    </div>
  `);

  document.getElementById("s-cancel").onclick = closeModal;

  document.getElementById("s-save").onclick = () => {
    s.currency = document.getElementById("s-currency").value.trim() || "£";
    s.healthyRate = (parseFloat(document.getElementById("s-healthy").value) || 0) / 100;
    s.attentionRate = (parseFloat(document.getElementById("s-attention").value) || 0) / 100;
    saveSettings(s);
    closeModal();
    renderAll();
    toast("Settings saved");
  };

  document.getElementById("s-export").onclick = exportBackup;
  document.getElementById("s-import").onclick = () => document.getElementById("s-import-file").click();
  document.getElementById("s-import-file").onchange = (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importBackup(JSON.parse(reader.result));
        closeModal();
        renderAll();
        toast("Backup imported");
      } catch {
        toast("That file couldn't be read");
      }
    };
    reader.readAsText(file);
  };

  document.getElementById("s-clear").onclick = () => {
    if (confirm("This deletes every month, bill and goal stored on this device. This can't be undone. Continue?")) {
      clearAllData();
      state.settings = { ...DEFAULT_SETTINGS };
      state.goals = [];
      closeModal();
      renderAll();
      toast("All data erased");
    }
  };

  document.getElementById("s-clear-this-month").onclick = () => {
    const { month, year } = monthLabel(state.cursor);
    if (confirm(`This deletes all data for ${month} ${year} stored on this device. Other months and goals are untouched. This can't be undone. Continue?`)) {
      deleteMonth(currentMK());
      closeModal();
      renderAll();
      toast("Month cleared");
    }
  };
}
