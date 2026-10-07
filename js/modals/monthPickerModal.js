/* Month / year picker opened by tapping the month label. */

import { state, setCursor } from "../state.js";
import { MONTH_NAMES_SHORT } from "../config.js";
import { listMonthKeys } from "../data/storage.js";
import { showModal, closeModal } from "../ui/modal.js";
import { renderAll } from "../render/shell.js";

export function openMonthPickerModal() {
  let pickerYear = state.cursor.getFullYear();
  const monthsWithData = new Set(listMonthKeys()); // "YYYY-MM" keys that have data
  const today = new Date();

  function jumpTo(date) {
    setCursor(date);
    closeModal();
    renderAll();
  }

  function monthGridHtml(year) {
    return MONTH_NAMES_SHORT.map((name, i) => {
      const key = `${year}-${String(i + 1).padStart(2, "0")}`;
      const isSelected = year === state.cursor.getFullYear() && i === state.cursor.getMonth();
      const isToday = year === today.getFullYear() && i === today.getMonth();
      const cls = ["cal-month-btn"];
      if (monthsWithData.has(key)) cls.push("has-data");
      if (isToday && !isSelected) cls.push("today");
      if (isSelected) cls.push("current");
      return `<button class="${cls.join(" ")}" data-month="${i}" data-year="${year}">${name}</button>`;
    }).join("");
  }

  function draw() {
    showModal(`
      <h2>Jump to month</h2>
      <div class="cal-year-switch">
        <button id="cal-prev-year" aria-label="Previous year">‹</button>
        <div class="cal-year-label" id="cal-year-label">${pickerYear}</div>
        <button id="cal-next-year" aria-label="Next year">›</button>
      </div>
      <div class="cal-month-grid" id="cal-month-grid">${monthGridHtml(pickerYear)}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="cal-today">Go to current month</button>
      </div>
    `);
    document.getElementById("cal-prev-year").onclick = () => { pickerYear -= 1; draw(); };
    document.getElementById("cal-next-year").onclick = () => { pickerYear += 1; draw(); };
    document.querySelectorAll("#cal-month-grid .cal-month-btn").forEach((b) => {
      b.onclick = () => jumpTo(new Date(parseInt(b.dataset.year, 10), parseInt(b.dataset.month, 10), 1));
    });
    document.getElementById("cal-today").onclick = () => jumpTo(today);
  }

  draw();
}
