/* ============================================================
   Ledger — Personal Finance
   Vanilla JS, no dependencies, all data stored locally on-device
   (localStorage) so it works fully offline.
   ============================================================ */

/* ---------------- Storage layer ---------------- */

const DEFAULT_SETTINGS = {
  currency: "£",
  healthyRate: 0.20,
  attentionRate: 0.10,
};

const CATEGORY_PALETTE = ["#1B2430", "#C99A3A", "#2F7A5C", "#B4432F", "#5b4d99", "#3C7A8C", "#9C5A3C", "#7A7568"];

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d) {
  return { month: d.toLocaleString("en-GB", { month: "long" }), year: d.getFullYear() };
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function shiftDateToMonth(dateStr, targetMonthDate) {
  // Move a stored date onto targetMonthDate's month/year, keeping the same
  // day-of-month (clamped so e.g. the 31st in Feb becomes the 28th/29th).
  const old = new Date(dateStr);
  if (isNaN(old)) return dateStr;
  const y = targetMonthDate.getFullYear();
  const mo = targetMonthDate.getMonth();
  const lastDay = new Date(y, mo + 1, 0).getDate();
  const day = Math.min(old.getDate(), lastDay);
  const d = new Date(y, mo, day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem("ledger_settings") || "{}") };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings(s) { localStorage.setItem("ledger_settings", JSON.stringify(s)); }

function loadGoals() {
  try { return JSON.parse(localStorage.getItem("ledger_goals") || "[]"); } catch { return []; }
}
function saveGoals(g) { localStorage.setItem("ledger_goals", JSON.stringify(g)); }

function emptyMonth() {
  return { income: { net: 0, other: 0, bonus: 0 }, savingsTarget: 0, expenses: [], bills: [] };
}
function loadMonth(key) {
  try {
    const raw = localStorage.getItem("ledger_month_" + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function saveMonth(key, data) {
  localStorage.setItem("ledger_month_" + key, JSON.stringify(data));
}
function listMonthKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith("ledger_month_")) keys.push(k.replace("ledger_month_", ""));
  }
  return keys.sort();
}
function previousMonthKeyBefore(key) {
  const keys = listMonthKeys().filter((k) => k < key);
  return keys.length ? keys[keys.length - 1] : null;
}

/* ---------------- App state ---------------- */

function loadLastCursor() {
  const saved = localStorage.getItem("ledger_last_cursor"); // "YYYY-MM"
  if (saved) {
    const [y, mo] = saved.split("-").map(Number);
    if (y && mo) return new Date(y, mo - 1, 1);
  }
  return null;
}
function saveCursor() {
  localStorage.setItem("ledger_last_cursor", monthKey(state.cursor));
}

const state = {
  cursor: loadLastCursor() || new Date(), // resume where you left off; else today's real month
  tab: "dashboard",
  settings: loadSettings(),
  goals: loadGoals(),
  month: null,
  monthKey: null,
};
state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1);

function currentMK() { return monthKey(state.cursor); }

function ensureMonth() {
  const key = currentMK();
  let m = loadMonth(key);
  if (!m) m = null; // leave null so dashboard can show "start this month" prompt
  state.month = m;
  state.monthKey = key;
}

function getOrCreateMonth() {
  if (!state.month) {
    state.month = emptyMonth();
    saveMonth(state.monthKey, state.month);
  }
  return state.month;
}

function persist() {
  if (state.month) saveMonth(state.monthKey, state.month);
}

// Month reset

function copyFromPreviousMonth() {
  const prevKey = previousMonthKeyBefore(state.monthKey);
  if (!prevKey) { toast("No previous month to copy from"); return false; }
  const prevData = loadMonth(prevKey);
  const copy = JSON.parse(JSON.stringify(prevData));
  // Bring over the category/bill *structure* only — not last month's amounts.
  // Nothing should count toward this month's totals until it's actually confirmed.
  copy.expenses.forEach((e) => {
    e.id = uid();
    e.paid = "No";
  });
  copy.bills.forEach((b) => {
    b.id = uid();
    b.paid = "No";
    if (b.due) b.due = shiftDateToMonth(b.due, state.cursor);
    if (b.renewal) b.renewal = shiftDateToMonth(b.renewal, state.cursor);
  });
  state.month = copy;
  persist();
  renderAll();
  toast("Copied last month");
  return true;
}
 
function clearMonthExpenses() {
  if (!state.month || !state.month.expenses.length) { toast("No expenses to clear"); return; }
  const { month } = monthLabel(state.cursor);
  if (!confirm(`Delete all expenses for ${month}? Bills, goals and income are left untouched.`)) return;
  state.month.expenses = [];
  persist();
  renderAll();
  toast("Expenses cleared");
}
 
function resetMonthBlank() {
  const { month } = monthLabel(state.cursor);
  const verb = state.month ? "Reset" : "Start";
  if (state.month && !confirm(`${verb} ${month} completely? This clears income, expenses and bills for this month only — other months are untouched.`)) return;
  startMonthBlank({ silent: true });
  toast("Month reset");
}
 
function resetMonthFromPrevious() {
  const prevKey = previousMonthKeyBefore(state.monthKey);
  if (!prevKey) { toast("No previous month to copy from"); return; }
  const { month } = monthLabel(state.cursor);
  if (state.month && !confirm(`Replace ${month}'s data with last month's category list? Amounts start at zero. This can't be undone.`)) return;
  copyFromPreviousMonth();
}

/* ---------------- Helpers ---------------- */

function fmt(n) {
  const s = state.settings;
  const v = Math.round((n || 0) * 100) / 100;
  return s.currency + v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmt0(n) {
  const s = state.settings;
  return s.currency + Math.round(n || 0).toLocaleString("en-GB");
}
function pct(n) {
  return Math.round((n || 0) * 1000) / 10 + "%";
}
function totalIncome(m) { return (m.income.net || 0) + (m.income.other || 0) + (m.income.bonus || 0); }
function totalExpenses(m) { return m.expenses.filter((e) => e.paid === "Yes").reduce((a, e) => a + (Number(e.amount) || 0), 0); }
function totalByType(m, type) {
  return m.expenses
    .filter((e) => e.type === type && e.paid === "Yes")
    .reduce((a, e) => a + (Number(e.amount) || 0), 0);
}

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

/* ---------------- Render: shell ---------------- */

function renderMonthLabel() {
  const { month, year } = monthLabel(state.cursor);
  document.getElementById("monthLabel").innerHTML = `${month} <span class="yr">${year}</span>`;
}

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + tab));
  renderActiveView();
}

function renderActiveView() {
  if (state.tab === "dashboard") renderDashboard();
  else if (state.tab === "expenses") renderExpenses();
  else if (state.tab === "bills") renderBills();
  else if (state.tab === "goals") renderGoals();
}

function renderAll() {
  ensureMonth();
  renderMonthLabel();
  renderActiveView();
}

/* ---------------- Dashboard ---------------- */

function healthStatus(rate) {
  const s = state.settings;
  if (rate >= s.healthyRate) return { label: "Healthy", cls: "green" };
  if (rate >= s.attentionRate) return { label: "Needs attention", cls: "gold" };
  return { label: "Overspending", cls: "brick" };
}

function renderDashboard() {
  const el = document.getElementById("view-dashboard");
  const m = state.month;
  const prevKey = previousMonthKeyBefore(state.monthKey);

  if (!m) {
    const prev = prevKey ? loadMonth(prevKey) : null;
    el.innerHTML = `
      <div class="empty-state" style="padding-top:60px;">
        <h3>No data for this month yet</h3>
        <p>Start fresh, or bring over last month's income and category list — amounts reset to zero so nothing is deducted until you fill them in.</p>
        <div class="modal-actions" style="max-width:280px; margin:0 auto;">
          <button class="btn btn-ghost" id="startBlank">Start blank</button>
          ${prev ? `<button class="btn btn-primary" id="copyPrev">Copy last month</button>` : ""}
        </div>
      </div>`;
    document.getElementById("startBlank").onclick = () => { getOrCreateMonth(); renderAll(); toast("New month started"); };
    const copyBtn = document.getElementById("copyPrev");
    if (copyBtn) copyBtn.onclick = () => {
      const prevData = loadMonth(prevKey);
      const copy = JSON.parse(JSON.stringify(prevData));
      // Bring over the category/bill *structure* only — not last month's amounts.
      // Nothing should count toward this month's totals until it's actually confirmed.
      copy.expenses.forEach((e) => {
        e.id = uid();
        e.paid = "No";
      });
      copy.bills.forEach((b) => {
        b.id = uid();
        b.paid = "No";
        if (b.due) b.due = shiftDateToMonth(b.due, state.cursor);
        if (b.renewal) b.renewal = shiftDateToMonth(b.renewal, state.cursor);
      });
      state.month = copy;
      persist();
      renderAll();
      toast("Copied last month");
    };
    return;
  }

  const income = totalIncome(m);
  const expenses = totalExpenses(m);
  const remaining = income - expenses;
  const rate = income > 0 ? remaining / income : 0;
  const fixed = totalByType(m, "Fixed");
  const variable = totalByType(m, "Variable");
  const health = healthStatus(rate);
  const sorted = [...m.expenses].sort((a, b) => (b.amount || 0) - (a.amount || 0));
  const largest = sorted[0];

  el.innerHTML = `
    <div class="hero">
      <div class="hero-label">Remaining this month</div>
      <div class="hero-amount ${remaining < 0 ? "neg" : ""}">${fmt(remaining)}</div>
      <div class="hero-sub">
        <span>Income <b>${fmt0(income)}</b></span>
        <span>Spent <b>${fmt0(expenses)}</b></span>
      </div>
      <span class="chip ${health.cls}"><span class="chip-dot"></span>${health.label} · ${pct(rate)} saved</span>
    </div>

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Savings rate</div><div class="kpi-value">${pct(rate)}</div></div>
      <div class="kpi"><div class="kpi-label">Active categories</div><div class="kpi-value">${m.expenses.length}</div></div>
      <div class="kpi"><div class="kpi-label">Fixed expenses</div><div class="kpi-value small">${fmt0(fixed)}</div></div>
      <div class="kpi"><div class="kpi-label">Variable expenses</div><div class="kpi-value small">${fmt0(variable)}</div></div>
    </div>

    <div class="section-head"><h2>Income</h2><span class="hint" id="editIncomeBtn" style="cursor:pointer; text-decoration:underline;">Edit</span></div>
    <div class="kpi-grid" style="grid-template-columns:1fr 1fr 1fr;">
      <div class="kpi"><div class="kpi-label">Net</div><div class="kpi-value small">${fmt0(m.income.net)}</div></div>
      <div class="kpi"><div class="kpi-label">Other</div><div class="kpi-value small">${fmt0(m.income.other)}</div></div>
      <div class="kpi"><div class="kpi-label">Bonus</div><div class="kpi-value small">${fmt0(m.income.bonus)}</div></div>
    </div>

    ${m.expenses.length ? `
    <div class="section-head"><h2>Where it's going</h2></div>
    <div class="donut-wrap">
      <canvas id="donut" width="220" height="220" style="width:110px;height:110px;flex:0 0 auto;"></canvas>
      <div class="donut-legend" id="legend"></div>
    </div>` : ""}

    <div class="section-head"><h2>Insights</h2></div>
    <div id="insights"></div>
  `;

  if (m.expenses.length) drawDonut(m);

  const insightsEl = document.getElementById("insights");
  const rows = [];
  if (largest) rows.push(`<div class="insight-row">Your largest expense is <b>${escapeHtml(largest.category)}</b> at ${fmt0(largest.amount)}.</div>`);
  rows.push(`<div class="insight-row">Your current savings rate is <b>${pct(rate)}</b>.</div>`);
  if (income > 0) rows.push(`<div class="insight-row">Fixed expenses are <b>${pct(fixed / income)}</b> of your income.</div>`);
  if (sorted.length >= 3) {
    const top3 = sorted.slice(0, 3).map((e) => e.category).join(", ");
    rows.push(`<div class="insight-row">Top 3 expenses: <b>${escapeHtml(top3)}</b>.</div>`);
  }
  rows.push(expenses > income
    ? `<div class="insight-row warn">⚠️ Your expenses currently exceed your income.</div>`
    : `<div class="insight-row ok">✅ Your expenses are within your income.</div>`);
  insightsEl.innerHTML = rows.join("");

  document.getElementById("editIncomeBtn").onclick = openIncomeModal;
}

function drawDonut(m) {
  const canvas = document.getElementById("donut");
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const cx = size / 2, cy = size / 2, rOuter = size / 2 - 6, rInner = rOuter * 0.6;
  ctx.clearRect(0, 0, size, size);

  const income =
    (Number(m.income?.net) || 0) +
    (Number(m.income?.other) || 0) +
    (Number(m.income?.bonus) || 0);

  const paidExpenses = (m.expenses || []).filter(
    (e) => e.paid === "Yes"
  );

  // group by category
  const byCat = {};
  paidExpenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + (Number(e.amount) || 0); });
  let entries = Object.entries(byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (entries.length > 7) {
    const head = entries.slice(0, 6);
    const restSum = entries.slice(6).reduce((a, [, v]) => a + v, 0);
    entries = [...head, ["Other", restSum]];
  }
  const totalExpenses = entries.reduce((a, [, v]) => a + v, 0);
  const savings = Math.max(0, income - totalExpenses);
  if(savings > 0){
    entries.push(["Savings", savings]);
  }

  const legend = document.getElementById("legend");

  if(income <= 0 || entries.length === 0){
    legend.innerHTML = "";
    return;
  }
  //const total = entries.reduce((a, [, v]) => a + v, 0);
  let start = -Math.PI / 2;
  entries.forEach(([name, val], i) => {
    const percentage = val / income;
    const angle = percentage * Math.PI * 2;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rOuter, start, start + angle);
    ctx.closePath();
    if(name === "Savings"){
      ctx.fillStyle = "#22c55e";
    }else{
      ctx.fillStyle = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
    }
    ctx.fill();
    start += angle;
  });
  // punch hole
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  legend.innerHTML = entries.map(([name, val], i) => {
      const percentage = val / income;

      return `
        <div class="legend-row">
          <span
            class="legend-swatch"
            style="background:${
              name === "Savings"
                ? "#22c55e"
                : CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]
            }">
          </span>

          <span class="legend-name">
            ${escapeHtml(name)}
          </span>

          <span class="legend-pct">
            ${pct(percentage)}
          </span>
        </div>
      `;
    }).join("");
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------------- Expenses ---------------- */

function renderExpenses() {
  const el = document.getElementById("view-expenses");
  const m = state.month;
  if (!m) { el.innerHTML = emptyMonthPrompt(); wireEmptyMonthPrompt(); return; }

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
      item.paid = item.paid === "Yes" ? "No" : "Yes";
      persist();
      renderExpenses();
    };
  });
  el.querySelectorAll(".ledger-row").forEach((row) => {
    row.onclick = () => openExpenseModal(row.dataset.id);
  });
}

function ordinalSuffix(n) {
  n = Number(n);
  if (n % 10 === 1 && n !== 11) return "st";
  if (n % 10 === 2 && n !== 12) return "nd";
  if (n % 10 === 3 && n !== 13) return "rd";
  return "th";
}

function emptyMonthPrompt() {
  return `<div class="empty-state" style="padding-top:60px;"><h3>No data for this month yet</h3><p>Go to the Dashboard tab to start this month.</p></div>`;
}
function wireEmptyMonthPrompt() {}

function openExpenseModal(id) {
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
    const data = {
      id: existing ? existing.id : uid(),
      category,
      type: segValue("f-type"),
      amount,
      due: document.getElementById("f-due").value || "",
      paid: existing ? existing.paid : "No",
      recurring: segValue("f-rec"),
      notes: document.getElementById("f-notes").value.trim(),
    };
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

/* ---------------- Bills ---------------- */

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(todayISO());
  const target = new Date(dateStr);
  return Math.round((target - today) / 86400000);
}

function renderBills() {
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
      item.paid = item.paid === "Yes" ? "No" : "Yes";
      persist();
      renderBills();
    };
  });
  el.querySelectorAll(".ledger-row").forEach((row) => {
    row.onclick = () => openBillModal(row.dataset.id);
  });
}

function openBillModal(id) {
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
    const data = {
      id: existing ? existing.id : uid(),
      item,
      category: document.getElementById("b-cat").value.trim(),
      cost: parseFloat(document.getElementById("b-cost").value) || 0,
      due: document.getElementById("b-due").value,
      method: document.getElementById("b-method").value.trim(),
      recurring: segValue("b-rec"),
      paid: existing ? existing.paid : "No",
      renewal: document.getElementById("b-renewal").value,
      notes: document.getElementById("b-notes").value.trim(),
    };
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

/* ---------------- Goals ---------------- */

function renderGoals() {
  const el = document.getElementById("view-goals");
  const goals = state.goals;

  if (!goals.length) {
    el.innerHTML = `
      <div class="empty-state">
        <h3>No savings goals yet</h3>
        <p>Tap the + button to set your first goal — an emergency fund, a holiday, anything you're saving toward.</p>
      </div>`;
    return;
  }

  const cards = goals.map((g) => {
    const remaining = Math.max(g.target - g.current, 0);
    const p = g.target > 0 ? Math.min(g.current / g.target, 1) : 0;
    const monthsLeft = g.monthly > 0 ? Math.ceil(remaining / g.monthly) : null;
    return `
    <div class="goal-card" data-id="${g.id}">
      <div class="goal-top">
        <div class="goal-name">${escapeHtml(g.name)}</div>
        <div class="goal-amounts">${fmt0(g.current)} / ${fmt0(g.target)}</div>
      </div>
      <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${(p * 100).toFixed(1)}%"></div></div>
      <div class="goal-foot">
        <span>${pct(p)} complete</span>
        <span>${monthsLeft !== null ? monthsLeft + " months left" : "Set monthly contribution"}</span>
      </div>
    </div>`;
  }).join("");

  el.innerHTML = `<div class="section-head"><h2>Savings Goals</h2></div>${cards}`;
  el.querySelectorAll(".goal-card").forEach((card) => {
    card.onclick = () => openGoalModal(card.dataset.id);
  });
}

function openGoalModal(id) {
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
    const data = {
      id: existing ? existing.id : uid(),
      name,
      target: parseFloat(document.getElementById("g-target").value) || 0,
      current: parseFloat(document.getElementById("g-current").value) || 0,
      monthly: parseFloat(document.getElementById("g-monthly").value) || 0,
      targetDate: document.getElementById("g-date").value,
    };
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

/* ---------------- Modal plumbing ---------------- */

function showModal(html) {
  document.getElementById("modalBody").innerHTML = `<div class="modal-handle"></div>${html}`;
  document.getElementById("modalBackdrop").classList.add("open");
}
function closeModal() {
  document.getElementById("modalBackdrop").classList.remove("open");
}
function wireSeg(id) {
  const seg = document.getElementById(id);
  seg.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      seg.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    };
  });
}
function segValue(id) {
  return document.querySelector(`#${id} button.active`).dataset.val;
}

/* ---------------- Income modal ---------------- */

function openIncomeModal() {
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

/* ---------------- Settings modal ---------------- */

function openSettingsModal() {
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
      Your data. Back it up before switching phones or browsers — this app stores everything only on this device.
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
      localStorage.clear();
      state.settings = { ...DEFAULT_SETTINGS };
      state.goals = [];
      closeModal();
      renderAll();
      toast("All data erased");
    }
  };
  document.getElementById("s-clear-this-month").onclick = () => {
    if (confirm("This deletes this  month's, bill and goal stored on this device. This can't be undone. Continue?")) {
      const key = currentMK();
      localStorage.removeItem("ledger_month_" + key);
      renderDashboard();
      closeModal();
      renderAll();
      toast("All data erased");
    }
  };
}

function exportBackup() {
  const data = { settings: state.settings, goals: state.goals, months: {} };
  listMonthKeys().forEach((k) => { data.months[k] = loadMonth(k); });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledger-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Backup downloaded");
}

function importBackup(data) {
  if (data.settings) { state.settings = { ...DEFAULT_SETTINGS, ...data.settings }; saveSettings(state.settings); }
  if (data.goals) { state.goals = data.goals; saveGoals(state.goals); }
  if (data.months) { Object.entries(data.months).forEach(([k, v]) => saveMonth(k, v)); }
}

/* ---------------- FAB routing ---------------- */

function handleFab() {
  if (!state.month && state.tab !== "goals") { getOrCreateMonth(); }
  if (state.tab === "bills") openBillModal(null);
  else if (state.tab === "goals") openGoalModal(null);
  else openExpenseModal(null); // dashboard + expenses both default to "add expense"
}

/* ---------------- Init & event wiring ---------------- */

function init() {
  ensureMonth();
  renderMonthLabel();
  renderActiveView();

  document.getElementById("prevMonth").onclick = () => {
    state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() - 1, 1);
    saveCursor();
    renderAll();
  };
  document.getElementById("nextMonth").onclick = () => {
    state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 1);
    saveCursor();
    renderAll();
  };
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.onclick = () => switchTab(b.dataset.tab);
  });
  document.getElementById("fabBtn").onclick = handleFab;
  document.getElementById("settingsBtn").onclick = openSettingsModal;
  document.getElementById("modalBackdrop").onclick = (ev) => {
    if (ev.target.id === "modalBackdrop") closeModal();
  };

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);

// Expose top-level state on window for debugging in devtools (e.g. typing
// `state` in the console works either way; this just makes `window.state`
// work too, since top-level const/let bindings aren't own-properties of
// window by default).
window.state = state;
