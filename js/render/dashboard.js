/* Dashboard tab: hero summary, KPIs, spending donut, insights. */

import { state } from "../state.js";
import { CATEGORY_PALETTE, SAVINGS_COLOR } from "../config.js";
import { fmt, fmt0, pct, escapeHtml } from "../utils/format.js";
import { totalIncome, totalExpenses, totalByType } from "../entities/month.js";
import { loadMonth, previousMonthKeyBefore } from "../data/storage.js";
import { currentBalanceForKey } from "../data/balance.js";
import { startMonthBlank, copyFromPreviousMonth } from "../actions/monthActions.js";
import { openIncomeModal } from "../modals/incomeModal.js";
import { openBalanceModal } from "../modals/balanceModal.js";

export function healthStatus(rate) {
  const s = state.settings;
  if (rate >= s.healthyRate) return { label: "Healthy", cls: "green" };
  if (rate >= s.attentionRate) return { label: "Needs attention", cls: "gold" };
  return { label: "Overspending", cls: "brick" };
}

export function renderDashboard() {
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
      <span class="chip ${health.cls}"><span class="chip-dot"></span>${health.label} · ${pct(rate)} saved</span>
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
  rows.push(expenses > income
    ? `<div class="insight-row warn">⚠️ Your expenses currently exceed your income.</div>`
    : `<div class="insight-row ok">✅ Your expenses are within your income.</div>`);
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
  const paidTotal = entries.reduce((a, [, v]) => a + v, 0);
  const savings = Math.max(0, income - paidTotal);
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
      ctx.fillStyle = SAVINGS_COLOR;
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
                ? SAVINGS_COLOR
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
