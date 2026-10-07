/* Month entity: the shape of a month's data, its totals, and how a new
   month is derived from a previous one. */

import { uid, shiftDateToMonth } from "../utils/date.js";

export function emptyMonth() {
  return {
    income: { net: 0, other: 0, bonus: 0 },
    savingsTarget: 0,
    expenses: [],
    bills: [],
    balanceMode: "manual",
    balanceValue: 0,
    balanceLinkedFrom: null,
  };
}

export function totalIncome(m) {
  return (m.income.net || 0) + (m.income.other || 0) + (m.income.bonus || 0);
}

/** Total of expenses marked Paid. */
export function totalExpenses(m) {
  return m.expenses
    .filter((e) => e.paid === "Yes")
    .reduce((a, e) => a + (Number(e.amount) || 0), 0);
}

/** Total of Paid expenses of a given type ("Fixed" / "Variable"). */
export function totalByType(m, type) {
  return m.expenses
    .filter((e) => e.type === type && e.paid === "Yes")
    .reduce((a, e) => a + (Number(e.amount) || 0), 0);
}

/**
 * Build a new month from a previous one, keeping the category/bill structure
 * but nothing that should count toward totals until confirmed: every item is
 * reset to Unpaid with a new id, bill dates move into the target month, and
 * the balance is linked to the previous month so it follows on live.
 */
export function copyMonthStructure(prevData, prevKey, targetMonthDate) {
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
