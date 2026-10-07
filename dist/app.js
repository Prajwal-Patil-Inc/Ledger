(() => {
  // js/utils/date.js
  var pad2 = (n) => String(n).padStart(2, "0");
  function monthKey(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  }
  function monthLabel(d) {
    return { month: d.toLocaleString("en-GB", { month: "long" }), year: d.getFullYear() };
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function todayISO() {
    const d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function shiftDateToMonth(dateStr, targetMonthDate) {
    const old = new Date(dateStr);
    if (isNaN(old)) return dateStr;
    const y = targetMonthDate.getFullYear();
    const mo = targetMonthDate.getMonth();
    const lastDay = new Date(y, mo + 1, 0).getDate();
    const day = Math.min(old.getDate(), lastDay);
    const d = new Date(y, mo, day);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date(todayISO());
    const target = new Date(dateStr);
    return Math.round((target - today) / 864e5);
  }
  function ordinalSuffix(n) {
    n = Number(n);
    if (n % 10 === 1 && n !== 11) return "st";
    if (n % 10 === 2 && n !== 12) return "nd";
    if (n % 10 === 3 && n !== 13) return "rd";
    return "th";
  }

  // js/config.js
  var DEFAULT_SETTINGS = {
    currency: "\xA3",
    healthyRate: 0.2,
    attentionRate: 0.1
  };
  var CATEGORY_PALETTE = [
    "#1B2430",
    "#C99A3A",
    "#2F7A5C",
    "#B4432F",
    "#5b4d99",
    "#3C7A8C",
    "#9C5A3C",
    "#7A7568"
  ];
  var SAVINGS_COLOR = "#22c55e";
  var MONTH_NAMES_SHORT = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];

  // js/data/storage.js
  var KEYS = {
    settings: "ledger_settings",
    goals: "ledger_goals",
    cursor: "ledger_last_cursor",
    monthPrefix: "ledger_month_"
  };
  function loadSettings() {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEYS.settings) || "{}") };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
  function saveSettings(s) {
    localStorage.setItem(KEYS.settings, JSON.stringify(s));
  }
  function loadGoals() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.goals) || "[]");
    } catch {
      return [];
    }
  }
  function saveGoals(g) {
    localStorage.setItem(KEYS.goals, JSON.stringify(g));
  }
  function loadMonth(key) {
    try {
      const raw = localStorage.getItem(KEYS.monthPrefix + key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  function saveMonth(key, data) {
    localStorage.setItem(KEYS.monthPrefix + key, JSON.stringify(data));
  }
  function deleteMonth(key) {
    localStorage.removeItem(KEYS.monthPrefix + key);
  }
  function listMonthKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(KEYS.monthPrefix)) keys.push(k.replace(KEYS.monthPrefix, ""));
    }
    return keys.sort();
  }
  function previousMonthKeyBefore(key) {
    const keys = listMonthKeys().filter((k) => k < key);
    return keys.length ? keys[keys.length - 1] : null;
  }
  function loadLastCursor() {
    const saved = localStorage.getItem(KEYS.cursor);
    if (saved) {
      const [y, mo] = saved.split("-").map(Number);
      if (y && mo) return new Date(y, mo - 1, 1);
    }
    return null;
  }
  function saveCursorKey(key) {
    localStorage.setItem(KEYS.cursor, key);
  }
  function clearAllData() {
    localStorage.clear();
  }

  // js/entities/month.js
  function emptyMonth() {
    return {
      income: { net: 0, other: 0, bonus: 0 },
      savingsTarget: 0,
      expenses: [],
      bills: [],
      balanceMode: "manual",
      balanceValue: 0,
      balanceLinkedFrom: null
    };
  }
  function totalIncome(m) {
    return (m.income.net || 0) + (m.income.other || 0) + (m.income.bonus || 0);
  }
  function totalExpenses(m) {
    return m.expenses.filter((e) => e.paid === "Yes").reduce((a, e) => a + (Number(e.amount) || 0), 0);
  }
  function totalByType(m, type) {
    return m.expenses.filter((e) => e.type === type && e.paid === "Yes").reduce((a, e) => a + (Number(e.amount) || 0), 0);
  }
  function copyMonthStructure(prevData, prevKey, targetMonthDate) {
    const copy = JSON.parse(JSON.stringify(prevData));
    copy.expenses.forEach((e) => {
      e.id = uid();
      e.paid = "No";
    });
    copy.bills.forEach((b) => {
      b.id = uid();
      b.paid = "No";
      if (b.due) b.due = shiftDateToMonth(b.due, targetMonthDate);
      if (b.renewal) b.renewal = shiftDateToMonth(b.renewal, targetMonthDate);
    });
    copy.balanceMode = "linked";
    copy.balanceLinkedFrom = prevKey;
    copy.balanceValue = 0;
    return copy;
  }

  // js/data/balance.js
  function monthPaidTotal(m) {
    return totalExpenses(m);
  }
  function currentBalanceForKey(key, _depth = 0) {
    if (_depth > 240 || !key) return 0;
    const m = loadMonth(key);
    if (!m) return 0;
    let base;
    if (m.balanceMode === "linked" && m.balanceLinkedFrom) {
      base = totalIncome(m) + currentBalanceForKey(m.balanceLinkedFrom, _depth + 1);
    } else {
      base = typeof m.balanceValue === "number" ? m.balanceValue : 0;
    }
    return base - monthPaidTotal(m);
  }
  function freshMonthShell(key) {
    const m = emptyMonth();
    const prevKey = previousMonthKeyBefore(key);
    if (prevKey) {
      m.balanceMode = "linked";
      m.balanceLinkedFrom = prevKey;
    }
    return m;
  }

  // js/state.js
  var state = {
    cursor: loadLastCursor() || /* @__PURE__ */ new Date(),
    // resume where you left off; else today's real month
    tab: "dashboard",
    settings: loadSettings(),
    goals: loadGoals(),
    month: null,
    monthKey: null
  };
  state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1);
  function currentMK() {
    return monthKey(state.cursor);
  }
  function setCursor(date) {
    state.cursor = new Date(date.getFullYear(), date.getMonth(), 1);
    saveCursorKey(currentMK());
  }
  function ensureMonth() {
    const key = currentMK();
    state.month = loadMonth(key) || null;
    state.monthKey = key;
  }
  function getOrCreateMonth() {
    if (!state.month) {
      state.month = freshMonthShell(currentMK());
      saveMonth(state.monthKey, state.month);
    }
    return state.month;
  }
  function persist() {
    if (state.month) saveMonth(state.monthKey, state.month);
  }

  // js/data/migrations.js
  function migrateLegacyGlobalBalance() {
    if (localStorage.getItem("ledger_balance_migrated")) return;
    const legacyRaw = localStorage.getItem("ledger_balance");
    const legacy = legacyRaw !== null ? parseFloat(legacyRaw) || 0 : 0;
    listMonthKeys().forEach((k) => {
      const m = loadMonth(k);
      if (m && !m.balanceMode) {
        m.balanceMode = "manual";
        m.balanceValue = legacy;
        saveMonth(k, m);
      }
    });
    localStorage.setItem("ledger_balance_migrated", "1");
  }

  // js/ui/modal.js
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

  // js/utils/format.js
  function fmt(n) {
    const v = Math.round((n || 0) * 100) / 100;
    return state.settings.currency + v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmt0(n) {
    return state.settings.currency + Math.round(n || 0).toLocaleString("en-GB");
  }
  function pct(n) {
    return Math.round((n || 0) * 1e3) / 10 + "%";
  }
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  // js/ui/toast.js
  var toastTimer = null;
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  // js/actions/monthActions.js
  function startMonthBlank({ silent } = {}) {
    state.month = freshMonthShell(state.monthKey);
    persist();
    renderAll();
    if (!silent) toast("New month started");
  }
  function copyFromPreviousMonth() {
    const prevKey = previousMonthKeyBefore(state.monthKey);
    if (!prevKey) {
      toast("No previous month to copy from");
      return false;
    }
    state.month = copyMonthStructure(loadMonth(prevKey), prevKey, state.cursor);
    persist();
    renderAll();
    toast("Copied last month");
    return true;
  }

  // js/modals/incomeModal.js
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

  // js/modals/balanceModal.js
  function openBalanceModal() {
    const m = state.month;
    if (!m) return;
    const current = currentBalanceForKey(state.monthKey);
    const linkNote = m.balanceMode === "linked" ? "This month currently follows on from last month's balance automatically. Saving a value here fixes this month to that number instead \u2014 later months linked after it will then follow from this one." : "This updates itself as you mark expenses and bills Paid/Unpaid - you shouldn't need to touch it often.";
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
      m.balanceMode = "manual";
      m.balanceLinkedFrom = null;
      m.balanceValue = entered + monthPaidTotal(m);
      persist();
      closeModal();
      renderAll();
      toast("Balance updated");
    };
  }

  // js/render/dashboard.js
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
      const previewBalance = prevKey ? currentBalanceForKey(prevKey) : null;
      el.innerHTML = `
      <div class="empty-state" style="padding-top:60px;">
        <h3>No data for this month yet</h3>
        <p>Start fresh, or bring over last month's income and category list - amounts reset to zero so nothing is deducted until you fill them in.</p>
        <div class="modal-actions" style="max-width:280px; margin:0 auto;">
          <button class="btn btn-ghost" id="startBlank">Start blank</button>
          ${prev ? `<button class="btn btn-primary" id="copyPrev">Copy last month</button>` : ""}
        </div>
        ${previewBalance !== null ? `<p class="helper-text" style="margin-top:16px;">Balance will carry over from last month: ${fmt(previewBalance)}</p>` : ""}
      </div>`;
      document.getElementById("startBlank").onclick = () => startMonthBlank();
      const copyBtn = document.getElementById("copyPrev");
      if (copyBtn) copyBtn.onclick = () => copyFromPreviousMonth();
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
    const balance = currentBalanceForKey(state.monthKey);
    const unpaidExpenses = m.expenses.filter((e) => e.paid !== "Yes").reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const forecast = balance - unpaidExpenses;
    const hasOutstanding = unpaidExpenses > 0;
    el.innerHTML = `
    <div class="hero">
      <div class="hero-label">Remaining this month</div>
      <div class="hero-amount ${remaining < 0 ? "neg" : ""}">${fmt(remaining)}</div>
      <div class="hero-sub">
        <span>Income <b>${fmt0(income)}</b></span>
        <span>Spent <b>${fmt0(expenses)}</b></span>
        <span id="balanceRow" style="cursor:pointer; text-decoration:underline dotted;">Balance <b>${fmt0(balance)}</b></span>
      </div>
      <span class="chip ${health.cls}"><span class="chip-dot"></span>${health.label} \xB7 ${pct(rate)} saved</span>
      ${hasOutstanding ? `<span class="chip ${forecast < 0 ? "brick" : "gold"}" style="margin-left:6px;">Forecast ${fmt0(forecast)} once unpaid items settle</span>` : ""}
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
    rows.push(expenses > income ? `<div class="insight-row warn">\u26A0\uFE0F Your expenses currently exceed your income.</div>` : `<div class="insight-row ok">\u2705 Your expenses are within your income.</div>`);
    insightsEl.innerHTML = rows.join("");
    document.getElementById("editIncomeBtn").onclick = openIncomeModal;
    document.getElementById("balanceRow").onclick = openBalanceModal;
  }
  function drawDonut(m) {
    const canvas = document.getElementById("donut");
    const ctx = canvas.getContext("2d");
    const size = canvas.width;
    const cx = size / 2, cy = size / 2, rOuter = size / 2 - 6, rInner = rOuter * 0.6;
    ctx.clearRect(0, 0, size, size);
    const income = (Number(m.income?.net) || 0) + (Number(m.income?.other) || 0) + (Number(m.income?.bonus) || 0);
    const paidExpenses = (m.expenses || []).filter(
      (e) => e.paid === "Yes"
    );
    const byCat = {};
    paidExpenses.forEach((e) => {
      byCat[e.category] = (byCat[e.category] || 0) + (Number(e.amount) || 0);
    });
    let entries = Object.entries(byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (entries.length > 7) {
      const head = entries.slice(0, 6);
      const restSum = entries.slice(6).reduce((a, [, v]) => a + v, 0);
      entries = [...head, ["Other", restSum]];
    }
    const paidTotal = entries.reduce((a, [, v]) => a + v, 0);
    const savings = Math.max(0, income - paidTotal);
    if (savings > 0) {
      entries.push(["Savings", savings]);
    }
    const legend = document.getElementById("legend");
    if (income <= 0 || entries.length === 0) {
      legend.innerHTML = "";
      return;
    }
    let start = -Math.PI / 2;
    entries.forEach(([name, val], i) => {
      const percentage = val / income;
      const angle = percentage * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, rOuter, start, start + angle);
      ctx.closePath();
      if (name === "Savings") {
        ctx.fillStyle = SAVINGS_COLOR;
      } else {
        ctx.fillStyle = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
      }
      ctx.fill();
      start += angle;
    });
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
            style="background:${name === "Savings" ? SAVINGS_COLOR : CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]}">
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

  // js/render/shared.js
  function emptyMonthPrompt() {
    return `<div class="empty-state" style="padding-top:60px;"><h3>No data for this month yet</h3><p>Go to the Dashboard tab to start this month.</p></div>`;
  }

  // js/entities/expense.js
  function createExpense({
    id,
    category,
    type = "Fixed",
    amount = 0,
    due = "",
    paid = "No",
    recurring = "Yes",
    notes = ""
  }) {
    return { id: id || uid(), category, type, amount, due, paid, recurring, notes };
  }

  // js/modals/expenseModal.js
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
        <input id="f-due" type="number" min="1" max="31" placeholder="1\u201331" value="${existing?.due ?? ""}">
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
    wireSeg("f-type");
    wireSeg("f-rec");
    document.getElementById("f-save").onclick = () => {
      const category = document.getElementById("f-cat").value.trim();
      const amount = parseFloat(document.getElementById("f-amt").value) || 0;
      if (!category) {
        toast("Enter a category name");
        return;
      }
      const data = createExpense({
        id: existing?.id,
        category,
        type: segValue("f-type"),
        amount,
        due: document.getElementById("f-due").value || "",
        paid: existing ? existing.paid : "No",
        recurring: segValue("f-rec"),
        notes: document.getElementById("f-notes").value.trim()
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
      addInput.value = "";
      addAmountArea.hidden = true;
      amountInput.focus();
    });
    cancelAdd.addEventListener("click", () => {
      addInput.value = "";
      addAmountArea.hidden = true;
    });
  }

  // js/render/expenses.js
  function renderExpenses() {
    const el = document.getElementById("view-expenses");
    const m = state.month;
    if (!m) {
      el.innerHTML = emptyMonthPrompt();
      return;
    }
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

  // js/entities/bill.js
  function createBill({
    id,
    item,
    category = "",
    cost = 0,
    due = "",
    method = "",
    recurring = "Yes",
    paid = "No",
    renewal = "",
    notes = ""
  }) {
    return { id: id || uid(), item, category, cost, due, method, recurring, paid, renewal, notes };
  }

  // js/modals/billModal.js
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
      if (!item) {
        toast("Enter an item name");
        return;
      }
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
        notes: document.getElementById("b-notes").value.trim()
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

  // js/render/bills.js
  function renderBills() {
    const el = document.getElementById("view-bills");
    const m = state.month;
    if (!m) {
      el.innerHTML = emptyMonthPrompt();
      return;
    }
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
      const dueLabel = b.due ? new Date(b.due).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "\u2014";
      return `
    <div class="ledger-row ${rowCls}" data-id="${b.id}" data-kind="bill">
      <div class="ledger-main">
        <div class="ledger-cat">${escapeHtml(b.item)}</div>
        <div class="ledger-meta">
          <span>${escapeHtml(b.category || "")}</span>
          <span>Due ${dueLabel}${b.paid !== "Yes" && dleft !== null && dleft < 0 ? " \xB7 overdue" : ""}</span>
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

  // js/entities/goal.js
  function createGoal({
    id,
    name,
    target = 0,
    current = 0,
    monthly = 0,
    targetDate = ""
  }) {
    return { id: id || uid(), name, target, current, monthly, targetDate };
  }

  // js/modals/goalModal.js
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
      if (!name) {
        toast("Enter a goal name");
        return;
      }
      const data = createGoal({
        id: existing?.id,
        name,
        target: parseFloat(document.getElementById("g-target").value) || 0,
        current: parseFloat(document.getElementById("g-current").value) || 0,
        monthly: parseFloat(document.getElementById("g-monthly").value) || 0,
        targetDate: document.getElementById("g-date").value
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

  // js/render/goals.js
  function renderGoals() {
    const el = document.getElementById("view-goals");
    const goals = state.goals;
    if (!goals.length) {
      el.innerHTML = `
      <div class="empty-state">
        <h3>No savings goals yet</h3>
        <p>Tap the + button to set your first goal - an emergency fund, a holiday, anything you're saving toward.</p>
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

  // js/render/shell.js
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

  // js/data/backup.js
  function exportBackup() {
    const data = { settings: state.settings, goals: state.goals, months: {} };
    listMonthKeys().forEach((k) => {
      data.months[k] = loadMonth(k);
    });
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
    if (data.settings) {
      state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
      saveSettings(state.settings);
    }
    if (data.goals) {
      state.goals = data.goals;
      saveGoals(state.goals);
    }
    if (data.months) {
      Object.entries(data.months).forEach(([k, v]) => saveMonth(k, v));
    }
  }

  // js/modals/settingsModal.js
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
        <label for="s-healthy">Healthy savings rate \u2265</label>
        <input id="s-healthy" type="number" step="1" value="${Math.round(s.healthyRate * 100)}">
      </div>
    </div>
    <div class="field">
      <label for="s-attention">Needs-attention savings rate \u2265 (%)</label>
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
      s.currency = document.getElementById("s-currency").value.trim() || "\xA3";
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

  // js/modals/monthPickerModal.js
  function openMonthPickerModal() {
    let pickerYear = state.cursor.getFullYear();
    const monthsWithData = new Set(listMonthKeys());
    const today = /* @__PURE__ */ new Date();
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
        <button id="cal-prev-year" aria-label="Previous year">\u2039</button>
        <div class="cal-year-label" id="cal-year-label">${pickerYear}</div>
        <button id="cal-next-year" aria-label="Next year">\u203A</button>
      </div>
      <div class="cal-month-grid" id="cal-month-grid">${monthGridHtml(pickerYear)}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="cal-today">Go to current month</button>
      </div>
    `);
      document.getElementById("cal-prev-year").onclick = () => {
        pickerYear -= 1;
        draw();
      };
      document.getElementById("cal-next-year").onclick = () => {
        pickerYear += 1;
        draw();
      };
      document.querySelectorAll("#cal-month-grid .cal-month-btn").forEach((b) => {
        b.onclick = () => jumpTo(new Date(parseInt(b.dataset.year, 10), parseInt(b.dataset.month, 10), 1));
      });
      document.getElementById("cal-today").onclick = () => jumpTo(today);
    }
    draw();
  }

  // js/main.js
  function handleFab() {
    if (!state.month && state.tab !== "goals") getOrCreateMonth();
    if (state.tab === "bills") openBillModal(null);
    else if (state.tab === "goals") openGoalModal(null);
    else openExpenseModal(null);
  }
  function shiftMonth(delta) {
    setCursor(new Date(state.cursor.getFullYear(), state.cursor.getMonth() + delta, 1));
    renderAll();
  }
  function init() {
    migrateLegacyGlobalBalance();
    ensureMonth();
    renderMonthLabel();
    renderActiveView();
    document.getElementById("prevMonth").onclick = () => shiftMonth(-1);
    document.getElementById("nextMonth").onclick = () => shiftMonth(1);
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.onclick = () => switchTab(b.dataset.tab);
    });
    document.getElementById("fabBtn").onclick = handleFab;
    document.getElementById("settingsBtn").onclick = openSettingsModal;
    const label = document.getElementById("monthLabel");
    label.onclick = openMonthPickerModal;
    label.onkeydown = (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        openMonthPickerModal();
      }
    };
    document.getElementById("modalBackdrop").onclick = (ev) => {
      if (ev.target.id === "modalBackdrop") closeModal();
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {
      });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  window.state = state;
})();
