/* Savings Goals tab. */

import { state } from "../state.js";
import { fmt0, pct, escapeHtml } from "../utils/format.js";
import { openGoalModal } from "../modals/goalModal.js";

export function renderGoals() {
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
